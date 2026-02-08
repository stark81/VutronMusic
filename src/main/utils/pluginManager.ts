import path from 'path'
import fs from 'fs'
import { Worker } from 'worker_threads'

export interface PluginMeta {
  code?: string
  name?: string
  [key: string]: any
}

export class PluginInstance {
  private worker: Worker
  private callResolvers = new Map<number, (val: any) => void>()
  private callIdCounter = 0
  public meta: PluginMeta = {}

  constructor(pluginPath: string) {
    const code = fs.readFileSync(pluginPath, 'utf-8')
    const workerFile = path.join(__dirname, 'workers/pluginRunner.js')
    this.worker = new Worker(workerFile)

    this.worker.on('message', (msg: any) => this.onMessage(msg))
    this.worker.on('error', (err) => console.error('[Plugin Worker] error', err))
    this.worker.on('exit', (code) => console.log(`[Plugin Worker] exited with code ${code}`))

    this.worker.postMessage({ type: 'LOAD_PLUGIN', code })
  }

  private onMessage(msg: any) {
    switch (msg.type) {
      case 'LOAD_DONE':
        this.meta = msg.meta || {}
        break

      case 'LOG':
        console.log('[Plugin]', msg.msg)
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

  private async handleHttp(msg: any) {
    const { url, params, requestId, method = 'GET', data } = msg

    try {
      const queryString = params ? new URLSearchParams(params).toString() : ''
      const fullUrl = method === 'GET' && queryString ? `${url}?${queryString}` : url

      const response = await fetch(fullUrl, {
        method,
        headers: { 'User-Agent': 'Mozilla/5.0 PluginWorker/1.0' },
        body: method === 'POST' ? JSON.stringify(data) : undefined
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
