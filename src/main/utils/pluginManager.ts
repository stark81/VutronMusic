import path from 'path'
import fs from 'fs'
import { Worker } from 'worker_threads'
import electronStore from '../store'

export interface PluginMeta {
  name?: string
  type?: 'online' | 'streaming'
  allowedDomains?: string[]
  [key: string]: any
}

export class PluginInstance {
  private worker: Worker
  private callResolvers = new Map<number, (val: any) => void>()
  private callIdCounter = 0
  private meta: PluginMeta = {}
  private id: string

  constructor(pluginPath: string, pluginName: string) {
    this.id = pluginName
    this.initStore()

    const code = fs.readFileSync(pluginPath, 'utf-8')
    const workerFile = path.join(__dirname, 'workers/pluginRunner.js')
    this.worker = new Worker(workerFile)

    this.worker.on('message', (msg: any) => this.onMessage(msg))
    this.worker.on('error', (err) => console.error('[Plugin Worker] error', err))
    this.worker.on('exit', (code) => console.log(`[Plugin Worker] exited with code ${code}`))

    this.worker.postMessage({ type: 'LOAD_PLUGIN', code })
  }

  private initStore() {
    const pluginStore = electronStore.get(`plugins.${this.id}`) as Record<string, any> | undefined

    if (!pluginStore) {
      electronStore.set(`plugins.${this.id}`, {})
    }
  }

  private async onMessage(msg: any) {
    switch (msg.type) {
      case 'LOAD_DONE':
        this.meta = msg.meta || {}
        if ((electronStore.get(`plugins.${this.id}.name`) as string) !== this.meta.name) {
          electronStore.set(`plugins.${this.id}.name`, this.meta.name)
          electronStore.set(`plugins.${this.id}.type`, this.meta.type)
        }
        this.call('getLyric', '536099160')
        break

      case 'LOG':
        console.log('[Plugin]', msg.msg)
        break

      case 'STORE_REQUEST':
        const pluginStore =
          (electronStore.get(`plugins.${this.id}.${msg.key}`) as Record<string, any> | undefined) ||
          undefined
        this.worker.postMessage({
          type: 'STORE_RESPONSE',
          requestId: msg.requestId,
          data: pluginStore
        })
        break

      case 'STORE_SET':
        const { key, value } = msg
        electronStore.set(`plugins.${this.id}.${key}`, value)
        break

      case 'HTTP_REQUEST':
        this.handleHttp(msg)
        break

      case 'CALL_RESULT': {
        const resolve = this.callResolvers.get(msg.callId)
        if (!resolve) return
        msg.error ? resolve(Promise.reject(msg.error)) : resolve(msg.result)
        this.callResolvers.delete(msg.callId)
        break
      }
    }
  }

  private checkDomain(rawUrl: string) {
    if (!Array.isArray(this.meta.allowedDomains)) return false

    let target: URL
    try {
      target = new URL(rawUrl)
    } catch {
      return false
    }

    return this.meta.allowedDomains.some((allowed) => {
      try {
        const a = new URL(allowed)
        return (
          target.protocol === a.protocol &&
          target.hostname === a.hostname &&
          (a.port === '' || target.port === a.port)
        )
      } catch {
        return false
      }
    })
  }

  private async handleHttp(msg: any) {
    const { url, params, requestId, method = 'GET', data } = msg
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let fullUrl: string
    try {
      const u = new URL(url)
      if (method === 'GET' && params) {
        u.search = new URLSearchParams(params).toString()
      }
      fullUrl = u.toString()
    } catch {
      this.worker.postMessage({
        type: 'HTTP_RESPONSE',
        requestId,
        error: 'Invalid URL'
      })
      return
    }

    if (!this.checkDomain(fullUrl)) {
      this.worker.postMessage({
        type: 'HTTP_RESPONSE',
        requestId,
        error: 'Domain not allowed'
      })
      return
    }

    let response: Response

    try {
      response = await fetch(fullUrl, {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 VutronMusic',
          'Content-Type': method === 'POST' ? 'application/json' : undefined
        },
        body: method === 'POST' ? JSON.stringify(data ?? {}) : undefined,
        redirect: 'manual',
        signal: controller.signal
      })
    } catch (err: any) {
      this.worker.postMessage({
        type: 'HTTP_RESPONSE',
        requestId,
        error: err?.message ?? 'Network error'
      })
      return
    } finally {
      clearTimeout(timeout)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || !this.checkDomain(location)) {
        this.worker.postMessage({
          type: 'HTTP_RESPONSE',
          requestId,
          error: 'Redirect target not allowed'
        })
        return
      }
      this.worker.postMessage({
        type: 'HTTP_RESPONSE',
        requestId,
        error: 'Redirect blocked (even allowed)'
      })
      return
    }

    let resData: any
    try {
      const rawText = await response.text()
      const ct = response.headers.get('content-type') ?? ''

      if (ct.includes('application/json')) {
        try {
          resData = JSON.parse(rawText)
        } catch {
          resData = rawText
        }
      } else {
        resData = rawText
      }
    } catch (err) {
      resData = null
    }

    this.worker.postMessage({
      type: 'HTTP_RESPONSE',
      requestId,
      data: resData,
      status: response.status
    })
  }

  public call(method: string, ...args: any[]): Promise<any> {
    return new Promise((resolve) => {
      const callId = ++this.callIdCounter
      this.callResolvers.set(callId, resolve)
      this.worker.postMessage({ type: 'CALL_METHOD', method, args, callId })
    })
  }

  public terminate() {
    this.worker.terminate()
  }
}
