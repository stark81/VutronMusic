import { parentPort } from 'node:worker_threads'

type PluginExports = Record<string, (...args: any[]) => any>

type PendingRequest = {
  resolve: (data: any) => void
  reject: (err: any) => void
}

type LoadPluginMessage = { type: 'LOAD_PLUGIN'; code: string }
type HttpResponseMessage = { type: 'HTTP_RESPONSE'; requestId: string; data?: any; error?: any }
type CallMethodMessage = { type: 'CALL_METHOD'; callId: number; method: string; args: any[] }
type StoreResponseMessage = { type: 'STORE_RESPONSE'; requestId: string; data?: any }
type IncomingMessage =
  | LoadPluginMessage
  | HttpResponseMessage
  | CallMethodMessage
  | StoreResponseMessage

let pluginExports: PluginExports = Object.create(null)

const pendingRequests = new Map<string, PendingRequest>()

const api = {
  http: {
    get(url: string, params?: Record<string, any>) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)

        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 15000)

        pendingRequests.set(requestId, {
          resolve: (data) => {
            clearTimeout(requestTimeout)
            resolve(data)
          },
          reject: (err) => {
            clearTimeout(requestTimeout)
            reject(err)
          }
        })
        parentPort?.postMessage({ type: 'HTTP_REQUEST', url, params, requestId })
      })
    },
    post(url: string, data?: any) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)

        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 15000)

        pendingRequests.set(requestId, {
          resolve: (data) => {
            clearTimeout(requestTimeout)
            resolve(data)
          },
          reject: (err) => {
            clearTimeout(requestTimeout)
            reject(err)
          }
        })
        parentPort?.postMessage({ type: 'HTTP_REQUEST', url, data, method: 'POST', requestId })
      })
    }
  },

  log(msg: string) {
    parentPort?.postMessage({ type: 'LOG', msg })
  },

  store: {
    get(key: string) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)
        pendingRequests.set(requestId, { resolve, reject })
        parentPort?.postMessage({ type: 'STORE_REQUEST', key, requestId })
      })
    },
    set(key: string, value: any) {
      parentPort?.postMessage({ type: 'STORE_SET', key, value })
    }
  }
}

parentPort?.on('message', async (msg: IncomingMessage) => {
  switch (msg.type) {
    case 'LOAD_PLUGIN':
      try {
        const exports: PluginExports = Object.create(null)
        // eslint-disable-next-line no-new-func
        const fn = new Function('api', 'exports', `"use strict";\n${msg.code}`)
        fn(api, exports)
        pluginExports = exports
        parentPort?.postMessage({ type: 'LOAD_DONE', meta: exports.meta || {} })
      } catch (e: any) {
        parentPort?.postMessage({ type: 'ERROR', message: e?.message ?? String(e) })
      }
      break

    case 'HTTP_RESPONSE': {
      const req = pendingRequests.get(msg.requestId)
      if (!req) return
      msg.error ? req.reject(msg.error) : req.resolve(msg.data)
      pendingRequests.delete(msg.requestId)
      break
    }

    case 'STORE_RESPONSE': {
      const req = pendingRequests.get(msg.requestId)
      if (!req) return
      req.resolve(msg.data)
      pendingRequests.delete(msg.requestId)
      break
    }

    case 'CALL_METHOD':
      try {
        const fn = pluginExports[msg.method]
        if (typeof fn !== 'function') throw new Error(`Method not found: ${msg.method}`)
        const result = await fn(...msg.args)
        parentPort?.postMessage({ type: 'CALL_RESULT', callId: msg.callId, result })
      } catch (e: any) {
        parentPort?.postMessage({
          type: 'CALL_RESULT',
          callId: msg.callId,
          error: e?.message ?? String(e)
        })
      }
      break
  }
})
