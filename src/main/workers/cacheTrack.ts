const { parentPort: cachePort } = require('node:worker_threads')
const _fs = require('node:fs')
const _https = require('node:https')
const _http = require('node:http')
const _url = require('url')
const { extname } = require('path')
const _sharp = require('sharp')

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
  if (extension === 'mp3' && contentType && typeMap[contentType]) {
    extension = typeMap[contentType]
  }

  const name = track.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  return decodeURI(`${audioCachePath}/${track.id}-${track.br ?? 320000}-${name}.${extension}`)
}

const getPic = (url: string): Promise<{ pic: Buffer; format: string }> =>
  new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https') ? _https : _http
      const fullUrl = url + '?param=1024y1024'
      const req = client.get(fullUrl, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`Request Failed: ${res.statusCode}`))
        }
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            pic: Buffer.concat(chunks),
            format: res.headers['content-type'] || 'image/jpeg'
          })
        })
      })
      req.on('error', reject)
      req.end()
    } catch (e) {
      reject(e)
    }
  })

const downloadToBuffer = (
  url: string
): Promise<{ buffer: Buffer<ArrayBuffer>; contentType: string; size: number }> =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? _https : _http
    client
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Request Failed. Status: ${res.statusCode}`))
        }
        const data = []
        res.on('data', (chunk) => data.push(chunk))
        res.on('end', () => {
          const buffer = Buffer.concat(data)
          resolve({
            buffer,
            contentType: res.headers['content-type'],
            size: Number(res.headers['content-length'] || buffer.length)
          })
        })
      })
      .on('error', reject)
  })

const updateMetadata = async (audioBuffer: Buffer<ArrayBuffer>, track: Record<string, any>) => {
  try {
    const { readTags, applyTags, replacePictureByType } = await import('taglib-wasm')
    const tags = await readTags(audioBuffer)

    const newTags = {
      ...tags,
      title: tags.title || track.name,
      album: tags.album || track.al?.name || track.album?.name || track.album,
      artist: tags.artist || ((track.ar || track.artists)?.[0]?.name ?? 'Unknown Artist')
    }

    const modifiedTagBuffer = await applyTags(audioBuffer, newTags)
    const image = await getPic(track.al?.picUrl || track.album?.picUrl)
    image.pic = await _sharp(image.pic).resize(512, 512, { fit: 'cover' }).toBuffer()

    const modifiedCoverBuffer = await replacePictureByType(modifiedTagBuffer, {
      mimeType: image.format,
      data: image.pic,
      type: 3
    })

    return modifiedCoverBuffer
  } catch (error) {
    console.error('[Worker cacheTrack: updateMetadata] error:', error)
    throw error
  }
}

const runCacheTask = async (track: Record<string, any>, url: string, audioCachePath: string) => {
  const { buffer: audioBuffer, contentType, size } = await downloadToBuffer(url)
  const urlParts = new _url.URL(url)
  const filePath = getFilePath(track, urlParts, contentType, audioCachePath)
  const modifiedBuffer = await updateMetadata(audioBuffer, track)
  await _fs.promises.writeFile(filePath, Buffer.from(modifiedBuffer))

  return {
    ...track,
    size,
    url: filePath,
    cache: true,
    insertTime: Date.now()
  }
}

const taskQueue = []
let _running = false

async function processQueue() {
  if (_running || taskQueue.length === 0) return
  _running = true
  const { track, url, audioCachePath } = taskQueue.shift()

  try {
    const result = await runCacheTask(track, url, audioCachePath)
    cachePort?.postMessage({ type: 'task-done', data: result })
  } catch (err) {
    console.error('[Worker cacheTrack] task failed:', err)
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
