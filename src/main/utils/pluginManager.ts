import path from 'path'
import fs from 'fs'
import { Worker } from 'worker_threads'
import electronStore from '../store'

export interface PluginMeta {
  name?: string
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

  /**
   * 获取当前插件的store信息
   */
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
        electronStore.set(`plugins.${this.id}.name`, this.meta.name)
        // const params = { keywords: '周杰伦' }
        // const result = await this.call('search', params)
        // console.log('==22==22== result =', result.code)
        // const resa = await this.call('getLyric')
        // console.log('==22==22== resa =', resa)
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

  private checkDomain(url: string) {
    return this.meta.allowedDomains.every((domain) => url.includes(domain))
  }

  private async handleHttp(msg: any) {
    const { url, params, requestId, method = 'GET', data } = msg
    if (!this.checkDomain(url)) {
      console.log(`[plugin: ${this.id}] error: 请求url'${url}'与声明域名不相关`)
      return
    }

    try {
      const queryString = params ? new URLSearchParams(params).toString() : ''
      const fullUrl = method === 'GET' && queryString ? `${url}?${queryString}` : url

      const response = await fetch(fullUrl, {
        method,
        headers: { 'User-Agent': 'Mozilla/5.0 VutronMusic' },
        body: method === 'POST' ? JSON.stringify(data) : undefined
      }).catch((error) => {
        console.log('=44444 error =', error)
        return error
      })
      const resData = await response.json()

      this.worker.postMessage({ type: 'HTTP_RESPONSE', requestId, data: resData })
    } catch (err: any) {
      this.worker.postMessage({ type: 'HTTP_RESPONSE', requestId, error: err.message })
    }
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
