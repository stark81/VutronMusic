// 这里必须使用require的导包方式，否则会报错
const { parentPort: coverPort } = require('node:worker_threads')
const fs = require('node:fs')
const https = require('node:https')
const http = require('node:http')
const sharp = require('sharp')

let currentPlayingPath: string | null = null
let running = false

const checkEmbeddedExist = async (filePath: string) => {
  const { readPictures } = await import('taglib-wasm')
  const decodedPath = decodeURI(filePath)
  const picture = (await readPictures(decodedPath)).find((p) => p.type === 3)
  return !!picture
}

const writeCoverToEmbedded = async (
  filePath: string,
  image: { pic: Buffer<ArrayBufferLike>; format: string }
) => {
  try {
    const { replacePictureByType } = await import('taglib-wasm')
    const decodedPath = decodeURI(filePath)

    const modifiedBuffer = await replacePictureByType(decodedPath, {
      mimeType: image.format,
      data: image.pic,
      type: 3
    })
    await fs.promises.writeFile(decodedPath, Buffer.from(modifiedBuffer))
  } catch (error) {
    console.error(`Failed to write cover image to ${filePath}:`, error)
  }
}

const writeCoverToFile = async (filePath: string, url: string, embedStyle: number) => {
  try {
    if (embedStyle === 0) {
      let flag = false
      const prefixs = ['.jpg', '.png', '.jpeg', '.webp']
      for (const prefix of prefixs) {
        const possibleFile = filePath.replace(/\.[^/.]+$/, prefix)
        flag = await fs.promises
          .access(possibleFile, fs.constants.F_OK)
          .then(() => true)
          .catch(() => false)
        if (flag) return
      }
    }

    const image = await getPicFromApi(url)
    image.pic = await sharp(image.pic).resize(512, 512, { fit: 'cover' }).toBuffer()

    const prefix = image.format.includes('image/png') ? '.png' : '.jpg'
    const coverPath = filePath.replace(/\.[^/.]+$/, prefix)

    await fs.promises.writeFile(coverPath, image.pic)
  } catch (error) {
    console.error(`Failed to write cover image to ${filePath}:`, error)
  }
}

const getPicFromApi = async (url: string): Promise<{ pic: Buffer; format: string }> => {
  return new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https') ? https : http
      url = url + '?param=1024y1024'
      const req = client.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`Request Failed: ${res.statusCode}`))
        }

        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          try {
            resolve({
              pic: Buffer.concat(chunks),
              format: res.headers['content-type'] || 'image/jpeg'
            })
          } catch (err) {
            reject(err)
          }
        })
      })

      req.on('error', (err) => {
        reject(err)
      })

      req.end()
    } catch (e) {
      reject(e)
    }
  })
}

const embeddedMap = new Map<string, { url: string; func: (typeof writeCoverToEmbedded)[] }>()

const runEmbedTasks = async () => {
  if (running) return
  running = true

  while (embeddedMap.size > 0) {
    const entries = Array.from(embeddedMap.entries())
    let taskProcessed = false

    for (const [filePath, task] of entries) {
      if (filePath === currentPlayingPath) continue

      try {
        const image = await getPicFromApi(task.url)
        image.pic = await sharp(image.pic).resize(512, 512, { fit: 'cover' }).toBuffer()
        for (const fn of task.func) {
          await fn(filePath, image)
        }
        embeddedMap.delete(filePath)
        taskProcessed = true
      } catch (error) {
        console.error(`[Cover Writer] Failed to write ${filePath}, keeping in queue:`, error)
        taskProcessed = true
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    if (!taskProcessed) break
  }

  running = false
}

coverPort?.on(
  'message',
  async (data: {
    type: 'finished' | 'normal'
    filePath: string | null
    currentPlayingPath?: string
    picUrl: string | null
    embedOption: number
    embedStyle: number
  }) => {
    try {
      if (data.type === 'normal') {
        currentPlayingPath = data.currentPlayingPath ?? currentPlayingPath

        if (data.filePath && data.picUrl) {
          const func: (typeof writeCoverToEmbedded)[] = []

          if (data.embedOption !== 2) {
            let isExist: boolean = false
            if (data.embedStyle === 0) {
              isExist = await checkEmbeddedExist(data.filePath)
            }
            if (!isExist) func.push(writeCoverToEmbedded)
          }
          if (data.embedOption !== 1) {
            writeCoverToFile(data.filePath, data.picUrl, data.embedStyle)
          }

          if (func.length > 0) {
            embeddedMap.set(data.filePath, { url: data.picUrl, func })
          }
        }
      } else {
        currentPlayingPath = null
      }
      await runEmbedTasks()
      if (data.type === 'finished') {
        coverPort.postMessage({ status: 'done' })
      }
    } catch (err) {
      console.error('[Worker writeCover] message handler error:', err)
    }
  }
)
