// 这里必须使用require的导包方式，否则会报错
const { parentPort } = require('node:worker_threads')
const fs = require('node:fs')
const https = require('node:https')
const http = require('node:http')

let currentPlayingPath: string | null = null
let running = false

const writeCoverToEmbedded = async (
  filePath: string,
  image: { pic: Buffer<ArrayBufferLike>; format: string }
) => {
  try {
    const { replacePictureByType, readPictures } = await import('taglib-wasm')

    const decodedPath = decodeURI(filePath)

    const picture = (await readPictures(decodedPath)).find((p) => p.type === 3)
    if (picture) return

    const modifiedBuffer = await replacePictureByType(decodedPath, {
      mimeType: image.format,
      data: image.pic,
      type: 3
    })
    await fs.promises.writeFile(decodedPath, Buffer.from(modifiedBuffer))
  } catch (error) {
    console.error(`写入封面图片 ${filePath} 失败:`, error)
  }
}

const writeCoverToFile = async (
  filePath: string,
  image: { pic: Buffer<ArrayBufferLike>; format: string }
) => {
  try {
    const prefix = image.format.includes('image/png') ? '.png' : '.jpg'
    filePath = filePath.replace(/\.[^/.]+$/, prefix)

    await fs.promises.writeFile(filePath, image.pic)
  } catch (error) {
    console.error(`写入封面图片 ${filePath} 失败:`, error)
  }
}

const getPicFromApi = async (url: string): Promise<{ pic: Buffer; format: string }> => {
  return new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https') ? https : http
      url = url + '?param=512y512'
      const req = client.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume() // 防止 socket 泄漏
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

const embeddedMap = new Map<
  string,
  { url: string; func: (typeof writeCoverToEmbedded | typeof writeCoverToFile)[] }
>()

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
        for (const fn of task.func) {
          await fn(filePath, image)
        }
        embeddedMap.delete(filePath)
        taskProcessed = true
      } catch (error) {
        console.error(`[Cover Writer] 写入 ${filePath} 失败，保留在队列中:`, error)
        taskProcessed = true
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    if (!taskProcessed) break
  }

  running = false
}

parentPort?.on(
  'message',
  async (data: {
    type: 'finished' | 'normal'
    filePath: string | null
    picUrl: string | null
    embedOption: number
  }) => {
    try {
      if (data.type === 'normal') {
        currentPlayingPath = data.filePath

        if (data.filePath && data.picUrl) {
          const func: (typeof writeCoverToEmbedded | typeof writeCoverToFile)[] = []
          if (data.embedOption === 1) {
            func.push(writeCoverToEmbedded)
          } else if (data.embedOption === 2) {
            func.push(writeCoverToFile)
          } else if (data.embedOption === 3) {
            func.push(writeCoverToEmbedded, writeCoverToFile)
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
        parentPort.postMessage({ status: 'done' })
      }
    } catch (err) {
      console.error('[Worker writeCover] message handler error:', err)
    }
  }
)
