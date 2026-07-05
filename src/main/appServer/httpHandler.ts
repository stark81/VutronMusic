import { BrowserWindow } from 'electron'
import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { fileTypeFromBuffer } from 'file-type'
import Constants from '../utils/Constants'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { findLocalTrackAudio, findTrackSourcesBySourceContext } from '../dbHelpers'
import { getPic } from '../utils'

const defaultImagePath = Constants.IS_DEV_ENV
  ? path.join(process.cwd(), `./src/public/images/default.jpg`)
  : path.join(__dirname, `../images/default.jpg`)

const singerImagePath = Constants.IS_DEV_ENV
  ? path.join(process.cwd(), `./src/public/images/singer.png`)
  : path.join(__dirname, `../images/singer.png`)

const httpHandler: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * 本地歌曲封面接口
   *
   * 根据 trackId 查找歌曲的封面图片，优先级：
   * 1. 歌曲所在目录下的同名图片文件（song.mp3 → song.jpg/png/jpeg/webp）
   * 2. 音频文件内嵌封面
   * 3. 默认封面
   *
   * URL: /local-asset?trackId=xxx&size=256
   */
  fastify.get('/local-asset', async (req, reply) => {
    try {
      const { trackId, size } = req.query as Record<string, string>
      if (!trackId) {
        const pic = await fs.promises.readFile(defaultImagePath)
        return reply.type('image/jpeg').send(pic)
      }

      const localAudio = findLocalTrackAudio(trackId)
      if (!localAudio) {
        const pic = await fs.promises.readFile(defaultImagePath)
        return reply.type('image/jpeg').send(pic)
      }

      // 构建 getPic 需要的 track 对象
      const track = {
        filePath: localAudio.filePath,
        matched: false,
        album: { picUrl: localAudio.picUrl },
        al: {}
      }

      const result = await getPic(track)

      if (!result.pic) {
        const pic = await fs.promises.readFile(defaultImagePath)
        return reply.type('image/jpeg').send(pic)
      }

      let pic = result.pic
      let format = result.format

      // 根据 size 参数缩放
      if (size && Number(size) > 0) {
        pic = await sharp(pic).resize(Number(size), Number(size), { fit: 'cover' }).toBuffer()
      }

      if (!format) {
        const type = await fileTypeFromBuffer(pic)
        format = type?.mime || 'image/jpeg'
      }

      reply.header('Cache-Control', 'public, max-age=86400')
      return reply.type(format).send(pic)
    } catch (error) {
      console.error('[local-asset] error:', error)
      const pic = await fs.promises.readFile(defaultImagePath)
      return reply.type('image/jpeg').send(pic)
    }
  })

  fastify.get('/local-asset/default-cover', async (req, reply) => {
    const pic = await fs.promises.readFile(defaultImagePath)
    reply.header('Cache-Control', 'no-store').type('image/jpeg')
    return reply.send(pic)
  })

  fastify.get('/local-asset/singer-cover', async (req, reply) => {
    const pic = await fs.promises.readFile(singerImagePath)
    reply.header('Cache-Control', 'no-store').type('image/jpeg')
    return reply.send(pic)
  })

  fastify.get('/local-asset/player', async (req, res) => {
    try {
      const win = (fastify as any).win as BrowserWindow

      if (!win) {
        return res.status(503).send({
          success: false,
          error: 'Window not ready'
        })
      }

      const result = await win.webContents.executeJavaScript(`window.vutronmusic`)
      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('Failed to get player data:', error)
      return res.status(500).send({
        success: false,
        error: 'Failed to retrieve player data'
      })
    }
  })

  /**
   * 流媒体封面回退接口
   * 通过流媒体歌曲的 sourceContext，查找已匹配的 library 来源封面
   * URL: /stream-asset?sourceContext=${encodeURIComponent(JSON.stringify(ctx))}&size=256
   */
  fastify.get('/stream-asset', async (req, reply) => {
    try {
      const { sourceContext: ctxStr, size: sizeStr } = req.query as Record<string, string>
      if (!ctxStr) {
        const pic = await fs.promises.readFile(defaultImagePath)
        return reply.type('image/jpeg').send(pic)
      }

      let ctx: Record<string, any>
      try {
        ctx = JSON.parse(decodeURIComponent(ctxStr))
      } catch {
        const pic = await fs.promises.readFile(defaultImagePath)
        return reply.type('image/jpeg').send(pic)
      }

      const sources = findTrackSourcesBySourceContext(ctx)
      const size = Number(sizeStr) || 256

      // 找第一个含 picUrl 的 library 来源
      let picUrl: string | null = null
      for (const row of sources) {
        try {
          const sc = JSON.parse(row.sourceContext)
          if (sc.picUrl && typeof sc.picUrl === 'string') {
            picUrl = sc.picUrl
            break
          }
        } catch {}
      }

      if (!picUrl) {
        const pic = await fs.promises.readFile(defaultImagePath)
        return reply.type('image/jpeg').send(pic)
      }

      // 下载图片
      const client = picUrl.startsWith('https') ? require('https') : require('http')
      const image = await new Promise<Buffer>((resolve, reject) => {
        client.get(picUrl, (res: any) => {
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`Request Failed: ${res.statusCode}`))
          }
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => resolve(Buffer.concat(chunks)))
        }).on('error', reject)
      })

      const resized = await sharp(image).resize(size, size, { fit: 'cover' }).toBuffer()
      reply.header('Cache-Control', 'public, max-age=86400')
      return reply.type('image/jpeg').send(resized)
    } catch (error) {
      console.error('[stream-asset] error:', error)
      const pic = await fs.promises.readFile(defaultImagePath)
      return reply.type('image/jpeg').send(pic)
    }
  })
}

export default httpHandler
