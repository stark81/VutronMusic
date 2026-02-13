import { parentPort as downloadPort } from 'node:worker_threads'
import fs from 'node:fs'
import https from 'node:https'
import http from 'node:http'
import { URL } from 'node:url'
import { extname } from 'path'
import sharp from 'sharp'

const getFilePath = (
  track: Record<string, any>,
  url: any,
  contentType: string,
  downloadPath: string
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

  // 优先使用专辑艺人名称，如果没有则使用歌曲艺人名称
  console.log('[Worker downloadTrack] track.albumArtist?.[0]?.name:', track.albumArtist?.[0]?.name)
  console.log('[Worker downloadTrack] track.al?.ar?.[0]?.name:', track.al?.ar?.[0]?.name)
  console.log('[Worker downloadTrack] track.ar?.[0]?.name:', track.ar?.[0]?.name)
  console.log('[Worker downloadTrack] track.artists?.[0]?.name:', track.artists?.[0]?.name)
  const artistName =
    track.albumArtist?.[0]?.name ||
    track.al?.ar?.[0]?.name ||
    track.ar?.[0]?.name ||
    track.artists?.[0]?.name ||
    'Unknown Artist'
  const albumName = track.al?.name || track.album?.name || 'Unknown Album'
  const songName = track.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')

  // 创建目录结构: Artist/Album/Song.ext
  const artistDir = downloadPath + '/' + artistName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  const albumDir = artistDir + '/' + albumName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')

  if (!fs.existsSync(artistDir)) {
    fs.mkdirSync(artistDir, { recursive: true })
  }
  if (!fs.existsSync(albumDir)) {
    fs.mkdirSync(albumDir, { recursive: true })
  }

  return decodeURI(`${albumDir}/${songName}.${extension}`)
}

const getPic = (url: string): Promise<{ pic: Buffer; format: string }> =>
  new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https') ? https : http
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
  url: string,
  onProgress: (progress: number) => void
): Promise<{ buffer: Buffer<ArrayBuffer>; contentType: string; size: number }> =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Request Failed. Status: ${res.statusCode}`))
          return
        }
        const data = []
        const totalSize = Number(res.headers['content-length'] || 0)
        let downloadedSize = 0

        res.on('data', (chunk) => {
          data.push(chunk)
          downloadedSize += chunk.length
          if (totalSize > 0) {
            const progress = (downloadedSize / totalSize) * 100
            onProgress(progress)
          }
        })
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

    const artistNames = (track.ar || track.artists || []).map((a: any) => a.name).join(', ')
    const newTags = {
      ...tags,
      title: tags.title || track.name,
      album: tags.album || track.al?.name || track.album?.name || track.album,
      artist: tags.artist || artistNames || 'Unknown Artist',
      albumArtist: (track.albumArtist || track.al?.ar || [track.ar?.[0]] || [])
        .map((a: any) => a.name)
        .join(', ')
    }

    const modifiedTagBuffer = await applyTags(audioBuffer, newTags)
    const image = await getPic(track.al?.picUrl || track.album?.picUrl)
    image.pic = await sharp(image.pic).resize(512, 512, { fit: 'cover' }).toBuffer()

    const modifiedCoverBuffer = await replacePictureByType(modifiedTagBuffer, {
      mimeType: image.format,
      data: image.pic,
      type: 3
    })

    return modifiedCoverBuffer
  } catch (error) {
    console.error('[Worker downloadTrack: updateMetadata] error:', error)
    throw error
  }
}

const getAlbumInfo = async (
  albumId: number
): Promise<{ id: number; name: string; picUrl: string; artists: any[] }> => {
  try {
    // 通过本地服务器代理调用网易云 API
    const client = http
    const url = `http://127.0.0.1:40001/netease/album?id=${albumId}`

    return new Promise((resolve) => {
      const req = client.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return resolve({ id: albumId, name: 'Unknown Album', picUrl: '', artists: [] })
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString())
            if (data.code === 200 && data.album) {
              resolve({
                id: data.album.id,
                name: data.album.name,
                picUrl: data.album.picUrl,
                artists: data.album.artists || data.album.ar || []
              })
            } else {
              resolve({ id: albumId, name: 'Unknown Album', picUrl: '', artists: [] })
            }
          } catch (e) {
            console.error('[Worker downloadTrack: getAlbumInfo] parse error:', e)
            resolve({ id: albumId, name: 'Unknown Album', picUrl: '', artists: [] })
          }
        })
      })
      req.on('error', (err) => {
        console.error('[Worker downloadTrack: getAlbumInfo] request error:', err)
        resolve({ id: albumId, name: 'Unknown Album', picUrl: '', artists: [] })
      })
      req.setTimeout(5000, () => {
        req.destroy()
        resolve({ id: albumId, name: 'Unknown Album', picUrl: '', artists: [] })
      })
      req.end()
    })
  } catch (error) {
    console.error('[Worker downloadTrack: getAlbumInfo] error:', error)
    return { id: albumId, name: 'Unknown Album', picUrl: '', artists: [] }
  }
}

const runDownloadTask = async (
  track: Record<string, any>,
  url: string,
  downloadPath: string,
  onProgress: (progress: number) => void
) => {
  onProgress(0)

  // 下载前通过 API 获取专辑信息
  const albumId = track.album?.id || track.al?.id
  let albumInfo = {
    id: track.album?.id || track.al?.id,
    name: track.album?.name || track.al?.name || 'Unknown Album',
    picUrl: track.album?.picUrl || track.al?.picUrl,
    artists: track.albumArtist || track.al?.ar || []
  }

  if (albumId && !track.albumArtist?.[0]?.name && !track.al?.ar?.[0]?.name) {
    console.log('[Worker downloadTrack] Fetching album info for album:', albumId)
    albumInfo = await getAlbumInfo(albumId)
    // 更新 track 对象的专辑艺人信息
    if (albumInfo.artists && albumInfo.artists.length > 0) {
      track.albumArtist = albumInfo.artists
      track.al = { ...track.al, ar: albumInfo.artists }
    }
  }

  console.log('[Worker downloadTrack] Album info after fetch:', {
    id: albumInfo.id,
    name: albumInfo.name,
    artists: albumInfo.artists.map((a: any) => a.name)
  })

  // 先计算文件路径
  const client = url.startsWith('https') ? https : http
  const urlParts = new URL(url)

  // 获取内容类型来确定扩展名
  const contentType = await new Promise<string>((resolve) => {
    const req = client.request(url, { method: 'HEAD' }, (res) => {
      resolve(res.headers['content-type'] || '')
    })
    req.on('error', () => resolve(''))
    req.setTimeout(5000, () => {
      req.destroy()
      resolve('')
    })
    req.end()
  })

  const filePath = getFilePath(track, urlParts, contentType, downloadPath)

  // 检查文件是否已存在
  if (fs.existsSync(filePath)) {
    console.log('[Worker downloadTrack] File already exists, skipping:', filePath)
    onProgress(100)
    return {
      ...track,
      size: fs.statSync(filePath).size,
      filePath,
      success: true,
      skipped: true,
      albumArtistName:
        albumInfo.artists?.[0]?.name ||
        track.ar?.[0]?.name ||
        track.artists?.[0]?.name ||
        'Unknown Artist',
      albumInfo: {
        id: albumInfo.id,
        name: albumInfo.name,
        picUrl: albumInfo.picUrl
      }
    }
  }

  const { buffer: audioBuffer, size } = await downloadToBuffer(url, (progress) => {
    onProgress(progress * 0.8) // 下载占 80%
  })

  onProgress(80)
  const modifiedBuffer = await updateMetadata(audioBuffer, track)
  onProgress(95)

  await fs.promises.writeFile(filePath, Buffer.from(modifiedBuffer))
  onProgress(100)

  return {
    ...track,
    size,
    filePath,
    success: true,
    albumArtistName:
      albumInfo.artists?.[0]?.name ||
      track.ar?.[0]?.name ||
      track.artists?.[0]?.name ||
      'Unknown Artist',
    albumInfo: {
      id: albumInfo.id,
      name: albumInfo.name,
      picUrl: albumInfo.picUrl
    }
  }
}

const taskQueue: any[] = []
let _running = false

async function processQueue() {
  if (_running || taskQueue.length === 0) return
  _running = true
  const { track, url, downloadPath, taskId } = taskQueue.shift()
  // TODO: 跟踪当前任务

  try {
    downloadPort?.postMessage({ type: 'download-start', taskId })
    const result = await runDownloadTask(track, url, downloadPath, (progress) => {
      downloadPort?.postMessage({ type: 'download-progress', taskId, progress })
    })
    downloadPort?.postMessage({ type: 'download-complete', taskId, data: result })
  } catch (err) {
    console.error('[Worker downloadTrack] task failed:', err)
    downloadPort?.postMessage({ type: 'download-error', taskId, error: err.message })
  } finally {
    _running = false
    processQueue()
  }
}

downloadPort?.on(
  'message',
  async (data: {
    type: 'download' | 'cancel' | 'clear'
    track: Record<string, any>
    url: string
    downloadPath: string
    taskId: string
    albumInfo?: { id: number; name: string; picUrl: string }
  }) => {
    try {
      if (data.type === 'download') {
        console.log('[Worker downloadTrack] Received download task:', JSON.stringify(data))
        taskQueue.push(data)
        processQueue()
      } else if (data.type === 'cancel') {
        const index = taskQueue.findIndex((t) => t.taskId === data.taskId)
        if (index !== -1) {
          taskQueue.splice(index, 1)
        }
        downloadPort?.postMessage({ type: 'download-cancelled', taskId: data.taskId })
      } else if (data.type === 'clear') {
        taskQueue.length = 0
      }
    } catch (error) {
      console.error('[Worker downloadTrack] message handler error:', error)
    }
  }
)
