import path from 'path'
import fs from 'fs'
import { Worker } from 'worker_threads'
import electronStore from '../store'
import cache from '../cache'
import { CacheAPIs } from './CacheApis'
import { fetch, Agent } from 'undici'
import { yrcLyricParse, lrcLyricParse, parseLyricString } from '.'
import { LyricLine } from '@/types/plugin'

const dispatcher = new Agent({
  connections: 2,
  pipelining: 0,
  keepAliveTimeout: 1000,
  keepAliveMaxTimeout: 2000
})

export interface PluginMeta {
  name?: string
  type?: 'online' | 'stream' | 'local'
  [key: string]: any
}

export class PluginInstance {
  private worker: Worker
  private callResolvers = new Map<number, (val: any) => void>()
  private callIdCounter = 0
  public meta: PluginMeta = {}
  private id: string
  private loaded = false
  private loadError: string | null = null

  constructor(pluginPath: string, pluginName: string) {
    this.id = pluginName
    this.initStore()

    const code = fs.readFileSync(pluginPath, 'utf-8')
    const workerFile = path.join(__dirname, 'workers/pluginRunner.js')
    this.worker = new Worker(workerFile)

    this.worker.on('message', (msg: any) => this.onMessage(msg))
    this.worker.on('error', (err) => console.error(`[Plugin Worker ${this.meta.name}] error`, err))
    this.worker.on('exit', (code) =>
      console.log(`[Plugin Worker ${this.meta.name}] exited with code ${code}`)
    )

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
        this.loaded = true
        this.loadError = null
        this.meta = msg.meta || {}
        if ((electronStore.get(`plugins.${this.id}.name`) as string) !== this.meta.name) {
          electronStore.set(`plugins.${this.id}.name`, this.meta.name)
          electronStore.set(`plugins.${this.id}.type`, this.meta.type)
        }
        break

      case 'LOG':
        console.log('[Plugin]', msg.msg)
        break

      case 'STORE_REQUEST':
        const pluginStore = msg.key
          ? (electronStore.get(`plugins.${this.id}.${msg.key}`) as
              | Record<string, any>
              | undefined) || undefined
          : (electronStore.get(`plugins.${this.id}`) as Record<string, any> | undefined) || {}
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

      case 'DB_REQUEST': {
        const { key, requestId } = msg as { key: 'PluginData' | 'Track'; requestId: string }
        const map = {
          PluginData: CacheAPIs.PluginData,
          Track: CacheAPIs.LocalMusic
        }
        const result = cache.get(map[key], { platform: this.id })
        this.worker.postMessage({
          type: 'DB_RESPONSE',
          requestId,
          data: result
        })
        break
      }

      case 'DB_SET': {
        const { key, value } = msg as { key: 'PluginData' | 'Track'; value: any }
        const map = {
          PluginData: CacheAPIs.PluginData,
          Track: CacheAPIs.LocalMusic
        }
        cache.set(map[key], { platform: this.id, type: this.meta.type, data: value })
        break
      }

      case 'LYRIC_PARSE': {
        let data: LyricLine[] = []
        if (msg.msg.yrc?.lyric) {
          data = yrcLyricParse(msg.msg) || []
        } else if (msg.msg.lrc?.lyric) {
          data = lrcLyricParse(msg.msg) || []
        } else {
          data = parseLyricString(msg.msg)
        }
        this.worker.postMessage({
          type: 'LYRIC_RESPONSE',
          requestId: msg.requestId,
          data
        })
        break
      }

      case 'ERROR': {
        this.loaded = false
        this.loadError = msg.message
        console.error(`[Plugin ${this.id}] Load error:`, msg.message)
        break
      }
    }
  }

  private checkDomain(rawUrl: string) {
    const allowedDomains = (electronStore.get(`plugins.${this.id}.baseUrl`) as string) || ''

    let target: URL
    try {
      target = new URL(rawUrl)
      const allowedUrl = new URL(allowedDomains)

      return (
        target.protocol === allowedUrl.protocol &&
        target.hostname === allowedUrl.hostname &&
        (allowedUrl.port === '' || target.port === allowedUrl.port)
      )
    } catch {
      return false
    }
  }

  private async handleHttp(msg: any) {
    const { url, params, headers, requestId, method = 'GET', data } = msg

    const controller = new AbortController()

    const timeout = setTimeout(() => {
      controller.abort()
    }, 12000)

    let fullUrl: string

    try {
      const u = new URL(url)

      // 保留原 query
      const searchParams = new URLSearchParams(u.search)

      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value))
        }
      })

      u.search = searchParams.toString()

      fullUrl = u.toString()
    } catch {
      clearTimeout(timeout)

      this.worker.postMessage({
        type: 'HTTP_RESPONSE',
        requestId,
        error: 'Invalid URL'
      })

      return
    }

    if (!this.checkDomain(fullUrl)) {
      clearTimeout(timeout)

      this.worker.postMessage({
        type: 'HTTP_RESPONSE',
        requestId,
        error: 'Domain not allowed'
      })

      return
    }

    let response

    try {
      const baseHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 VutronMusic'
      }

      if (method === 'POST') {
        baseHeaders['Content-Type'] = 'application/json'
      }

      const finalHeaders: Record<string, string> = {
        ...baseHeaders,
        ...(headers || {})
      }

      if (headers?.Cookie) {
        finalHeaders.Cookie = headers.Cookie
      }

      const start = Date.now()

      response = await fetch(fullUrl, {
        method,
        headers: finalHeaders,
        body: method === 'GET' ? undefined : JSON.stringify(data ?? {}),
        redirect: 'manual',
        signal: controller.signal,
        dispatcher
      })

      console.log('[HTTP RESPONSE]', response.status, fullUrl, `${Date.now() - start}ms`)
    } catch (err: any) {
      clearTimeout(timeout)

      const isTimeout = err?.name === 'AbortError'

      console.error('[HTTP ERROR]', fullUrl, isTimeout ? 'Request timeout' : err)

      this.worker.postMessage({
        type: 'HTTP_RESPONSE',
        requestId,
        error: isTimeout ? 'Request timeout' : (err?.message ?? 'Network error')
      })

      return
    } finally {
      clearTimeout(timeout)
    }

    // 阻止重定向
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
        error: 'Redirect blocked'
      })

      return
    }

    let resData: any = null

    try {
      const rawText = await response.text()

      const contentType = response.headers.get('content-type') ?? ''

      if (contentType.includes('application/json')) {
        try {
          resData = JSON.parse(rawText)
        } catch {
          resData = rawText
        }
      } else {
        resData = rawText
      }
    } catch (err) {
      console.error('[HTTP PARSE ERROR]', fullUrl, err)
    }

    this.worker.postMessage({
      type: 'HTTP_RESPONSE',
      requestId,
      data: resData,
      status: response.status
    })
  }

  /**
   * @param {string} method 调用的函数名称
   */
  public call(method: string, ...args: any[]): Promise<any> {
    if (!this.loaded) {
      throw new Error(this.loadError || `[Plugin ${this.id} not loaded]`)
    }
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
