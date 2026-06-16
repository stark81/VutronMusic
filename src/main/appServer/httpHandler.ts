import { BrowserWindow } from 'electron'
import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { fileTypeFromBuffer } from 'file-type'
import Constants from '../utils/Constants'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { db, Tables } from '../db'
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

      // 从 Audio 表查询本地文件路径
      // 支持 trackId 直接查找，也支持 albumId 间接查找
      let audio = db.sqlite
        .prepare(`SELECT filePath FROM ${Tables.Audio} WHERE trackId = ?`)
        .get(trackId) as { filePath: string } | undefined

      // 如果是 albumId，先找到该专辑下的第一个 track
      if (!audio) {
        const track = db.sqlite
          .prepare(`SELECT id FROM ${Tables.Track} WHERE albumId = ? LIMIT 1`)
          .get(trackId) as { id: string } | undefined
        if (track) {
          audio = db.sqlite
            .prepare(`SELECT filePath FROM ${Tables.Audio} WHERE trackId = ?`)
            .get(track.id) as { filePath: string } | undefined
        }
      }

      if (!audio) {
        const pic = await fs.promises.readFile(defaultImagePath)
        return reply.type('image/jpeg').send(pic)
      }

      // 构建 getPic 需要的 track 对象
      const track = {
        filePath: audio.filePath,
        matched: false,
        album: {},
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
}

export default httpHandler
