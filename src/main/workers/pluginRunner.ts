import { parentPort } from 'node:worker_threads'
import crypto from 'crypto'

process.on('unhandledRejection', (reason) => {
  console.error('[Worker] Unhandled rejection:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('[Worker] Uncaught exception:', err.message)
})

type PluginExports = Record<string, (...args: any[]) => any>

type PendingRequest = {
  resolve: (data: any) => void
  reject: (err: any) => void
}

type LoadPluginMessage = { type: 'LOAD_PLUGIN'; code: string }
type HttpResponseMessage = {
  type: 'HTTP_RESPONSE'
  requestId: string
  raw: boolean
  data?: any
  error?: any
  status?: any
  headers?: Record<string, string>
}
type CallMethodMessage = { type: 'CALL_METHOD'; callId: number; method: string; args: any[] }
type StoreResponseMessage = { type: 'STORE_RESPONSE'; requestId: string; data?: any }
type DBResponseMessage = { type: 'DB_RESPONSE'; requestId: string; data?: any }
type LyricResonseMessage = { type: 'LYRIC_RESPONSE'; requestId: string; data?: any }
type IncomingMessage =
  | LoadPluginMessage
  | HttpResponseMessage
  | CallMethodMessage
  | StoreResponseMessage
  | DBResponseMessage
  | LyricResonseMessage

let pluginExports: PluginExports = Object.create(null)

const pendingRequests = new Map<string, PendingRequest>()

const api = {
  http: {
    get(
      url: string,
      params?: Record<string, any>,
      headers?: Record<string, string>,
      raw?: boolean
    ) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)

        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 12000)

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
        parentPort?.postMessage({
          type: 'HTTP_REQUEST',
          url,
          params,
          headers,
          method: 'GET',
          requestId,
          raw
        })
      })
    },
    post(url: string, data?: any, headers?: Record<string, string>, raw?: boolean) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)

        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 12000)

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
        parentPort?.postMessage({
          type: 'HTTP_REQUEST',
          url,
          data,
          headers,
          method: 'POST',
          requestId,
          raw
        })
      })
    },
    delete(url: string, data?: any, headers?: Record<string, string>, raw?: boolean) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)

        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 12000)

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
        parentPort?.postMessage({
          type: 'HTTP_REQUEST',
          url,
          data,
          headers,
          method: 'DELETE',
          requestId,
          raw
        })
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
  },

  db: {
    get(table: string, filter?: Record<string, any>) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)

        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 5000)

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
        parentPort?.postMessage({ type: 'DB_REQUEST', key: table, requestId, filter })
      })
    },
    set(key: string, value: any) {
      parentPort?.postMessage({ type: 'DB_SET', key, value })
    }
  },

  utils: {
    parseLyric(msg: string) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)

        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 12000)

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
        parentPort?.postMessage({ type: 'LYRIC_PARSE', msg, requestId })
      })
    },
    md5(input: string) {
      return crypto.createHash('md5').update(input).digest('hex')
    },
    generateSalt() {
      return crypto.randomBytes(6).toString('hex')
    },
    generateToken(password: string, salt: string) {
      return crypto
        .createHash('md5')
        .update(password + salt)
        .digest('hex')
    },
    getEmbeddedLyric(filePath: string) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)
        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 12000)
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
        parentPort?.postMessage({ type: 'LYRIC_EMBEDDED', filePath, requestId })
      })
    },
    getPathLyric(filePath: string) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)
        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 12000)
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
        parentPort?.postMessage({ type: 'LYRIC_PATH', filePath, requestId })
      })
    },
    checkFileExist(paths: string[]) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)
        const requestTimeout = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.get(requestId)?.reject(new Error('Request timeout'))
            pendingRequests.delete(requestId)
          }
        }, 12000)
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
        parentPort?.postMessage({ type: 'CHECK_FILE_EXIST', paths, requestId })
      })
    }
  }
}

parentPort?.on('message', async (msg: IncomingMessage) => {
  try {
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

        if (msg.error) {
          req.reject(new Error(msg.error))
        } else if (msg.raw) {
          req.resolve({ data: msg.data, status: msg.status, headers: msg.headers })
        } else {
          req.resolve(msg.data)
        }

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

      case 'DB_RESPONSE': {
        const req = pendingRequests.get(msg.requestId)
        if (!req) return
        req.resolve(msg.data)
        pendingRequests.delete(msg.requestId)
        break
      }

      case 'LYRIC_RESPONSE': {
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
  } catch (e: any) {
    console.error('[Worker] Unhandled error processing message:', e?.message ?? String(e))
  }
})
