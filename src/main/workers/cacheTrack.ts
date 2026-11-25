const { parentPort: cachePort } = require('node:worker_threads')
const _fs = require('node:fs')
const _https = require('node:https')
const _http = require('node:http')
const _url = require('url')
const { extname } = require('path')
const _sharp = require('sharp')

/** 下载超时（毫秒）：卡住的连接会把单线程队列一起堵死 */
const DOWNLOAD_TIMEOUT = 60000
/** 重定向最多跟几跳：线上音频地址经常 302 到 CDN */
const MAX_REDIRECTS = 5

const isHttpUrl = (url: unknown) => typeof url === 'string' && /^https?:\/\//i.test(url)

const getFilePath = (
  track: Record<string, any>,
  url: any,
  contentType: string,
  audioCachePath: string
) => {
  const typeMap = {
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
    'audio/x-flac': 'flac',
    'audio/x-m4a': 'm4a',
    'audio/m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/mp4': 'mp4'
  }

  let extension = 'mp3'
  if (url.pathname) {
    const urlExt = extname(url.pathname).toLowerCase()
    if (urlExt && urlExt.length > 1) extension = urlExt.substring(1)
  }
  if (extension === 'mp3' && contentType && contentType in typeMap) {
    extension = typeMap[contentType as keyof typeof typeMap]
  }

  // 名字里的 % 可能出现在「100%」这类正常标题里，decodeURI 遇到非法转义会抛错，
  // 一旦抛出整首歌就缓存不下来，所以失败时保留原样
  let name = String(track.name ?? '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  try {
    name = decodeURI(name)
  } catch {
    /* 保留原样 */
  }
  return `${audioCachePath}/${track.id}-${track.br ?? 320000}-${name}.${extension}`
}

const requestHeaders = (headers?: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = { accept: '*/*' }
  for (const [key, value] of Object.entries(headers || {})) {
    if (typeof value === 'string' && value) result[key.toLowerCase()] = value
  }
  return result
}

const getPic = (
  url: string,
  headers?: Record<string, string>
): Promise<{ pic: Buffer; format: string }> =>
  new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https') ? _https : _http
      const fullUrl = url + '?param=1024y1024'
      const req = client.get(fullUrl, { headers: requestHeaders(headers) }, (res: any) => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`Request Failed: ${res.statusCode}`))
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            pic: Buffer.concat(chunks),
            format: res.headers['content-type'] || 'image/jpeg'
          })
        })
      })
      req.on('error', reject)
      req.setTimeout(DOWNLOAD_TIMEOUT, () => req.destroy(new Error('封面下载超时')))
    } catch (e) {
      reject(e)
    }
  })

/**
 * 下载音频到内存。
 *
 * 只支持 http(s)：Worker 里没有 Electron 的 protocol 实现，`vutron://` 地址
 * 必须先由主进程还原成真实地址（见 `src/main/utils/streamUrl.ts`）。
 */
const downloadToBuffer = (
  url: string,
  headers?: Record<string, string>,
  redirectsLeft = MAX_REDIRECTS
): Promise<{ buffer: Buffer<ArrayBuffer>; contentType: string; size: number; finalUrl: string }> =>
  new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new _url.URL(url)
    } catch {
      return reject(new Error(`无效的音频地址: ${url}`))
    }
    const client =
      parsed.protocol === 'https:' ? _https : parsed.protocol === 'http:' ? _http : null
    if (!client) return reject(new Error(`不支持的音频协议: ${parsed.protocol}`))

    const req = client.get(url, { headers: requestHeaders(headers) }, (res: any) => {
      const status = res.statusCode || 0

      // Node 的 http 不会自动跟随重定向，不处理会把 302 页面当成音频存下来
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume()
        if (redirectsLeft <= 0) return reject(new Error('音频地址重定向次数过多'))
        let next: string
        try {
          next = new _url.URL(res.headers.location, url).toString()
        } catch {
          return reject(new Error(`无效的重定向地址: ${res.headers.location}`))
        }
        return downloadToBuffer(next, headers, redirectsLeft - 1).then(resolve, reject)
      }

      if (status < 200 || status >= 300) {
        res.resume()
        return reject(new Error(`Request Failed. Status: ${status}`))
      }

      const data: Buffer[] = []
      res.on('data', (chunk: Buffer) => data.push(chunk))
      res.on('error', reject)
      res.on('end', () => {
        const buffer = Buffer.concat(data)
        const declared = Number(res.headers['content-length'] || 0)
        // 声明了长度却收不全：连接中途断了，落盘会得到一个放不出来的半截文件
        if (declared && buffer.length < declared) {
          return reject(new Error(`音频下载不完整（${buffer.length}/${declared} 字节）`))
        }
        resolve({
          buffer,
          contentType: res.headers['content-type'] || '',
          size: declared || buffer.length,
          finalUrl: url
        })
      })
    })
    req.on('error', reject)
    req.setTimeout(DOWNLOAD_TIMEOUT, () => req.destroy(new Error('音频下载超时')))
  })

const updateMetadata = async (
  audioBuffer: Buffer<ArrayBuffer>,
  track: Record<string, any>,
  headers?: Record<string, string>
) => {
  const { readTags, applyTags, replacePictureByType } = await import('taglib-wasm')
  const tags = await readTags(audioBuffer)

  const newTags = {
    ...tags,
    title: tags.title || track.name,
    album: tags.album || track.al?.name || track.album?.name || track.album,
    artist: tags.artist || ((track.ar || track.artists)?.[0]?.name ?? 'Unknown Artist')
  }

  const modifiedTagBuffer = await applyTags(audioBuffer, newTags)

  // 没有可用的 http(s) 封面（空 picUrl / vutron:// 地址）时就只写标签，
  // 不能让封面这一步把整首歌的缓存拖垮
  const picUrl = track.al?.picUrl || track.album?.picUrl
  if (!isHttpUrl(picUrl)) return modifiedTagBuffer

  const image = await getPic(picUrl, headers)
  image.pic = await _sharp(image.pic).resize(512, 512, { fit: 'cover' }).toBuffer()

  return replacePictureByType(modifiedTagBuffer, {
    mimeType: image.format,
    data: image.pic,
    type: 3
  })
}

const runCacheTask = async (
  track: Record<string, any>,
  url: string,
  audioCachePath: string,
  headers?: Record<string, string>
) => {
  const { buffer: audioBuffer, contentType, size, finalUrl } = await downloadToBuffer(url, headers)
  const urlParts = new _url.URL(finalUrl)
  const filePath = getFilePath(track, urlParts, contentType, audioCachePath)

  let modifiedBuffer: Buffer = audioBuffer
  try {
    modifiedBuffer = Buffer.from(await updateMetadata(audioBuffer, track, headers))
  } catch (error) {
    // 写标签 / 嵌封面属于增强能力：失败也要把音频落盘，否则用户只会看到
    // 「能播放但缓存目录里没有文件」
    console.warn('[Worker cacheTrack] 写入元数据失败，回退为原始音频:', error)
  }

  await _fs.promises.writeFile(filePath, modifiedBuffer)

  return {
    ...track,
    size,
    url: filePath,
    cache: true,
    insertTime: Date.now()
  }
}

const taskQueue: {
  track: Record<string, any>
  url: string
  audioCachePath: string
  headers?: Record<string, string>
}[] = []
let _running = false

async function processQueue() {
  if (_running || taskQueue.length === 0) return
  _running = true
  const { track, url, audioCachePath, headers } = taskQueue.shift()!

  try {
    const result = await runCacheTask(track, url, audioCachePath, headers)
    cachePort?.postMessage({ type: 'task-done', data: result })
  } catch (err) {
    // 失败要回传主进程：Worker 的 console 在打包版里看不到
    console.error('[Worker cacheTrack] task failed:', err)
    cachePort?.postMessage({
      type: 'task-error',
      id: track?.id,
      error: err instanceof Error ? err.message : String(err)
    })
  } finally {
    _running = false
    processQueue()
  }
}

cachePort?.on(
  'message',
  async (data: {
    type: 'task' | 'quit'
    track: Record<string, any>
    url: string
    audioCachePath: string
    headers?: Record<string, string>
  }) => {
    try {
      if (data.type === 'task') {
        taskQueue.push(data)
        processQueue()
      } else if (data.type === 'quit') {
        const check = setInterval(() => {
          if (!_running && taskQueue.length === 0) {
            clearInterval(check)
            cachePort?.postMessage({ type: 'finished' })
          }
        }, 1000)
      }
    } catch (error) {
      console.error('[Worker cacheTrack] message handler error:', error)
    }
  }
)
