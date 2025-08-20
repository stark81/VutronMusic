import { BrowserWindow } from 'electron'
import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import cache from '../cache'
import { CacheAPIs } from '../utils/CacheApis'
import { getTrackDetail, getPic } from '../utils/utils'

const httpHandler: FastifyPluginAsync = async (fastify: FastifyInstance, options) => {
  fastify.get(
    '/local-asset/pic',
    async (req: FastifyRequest<{ Querystring: Record<string, string> }>) => {
      const { id } = req.query
      const res = cache.get(CacheAPIs.Track, { ids: id })
      let track: any
      if (res) {
        track = res.songs[0]
      } else {
        const res = await getTrackDetail(id)
        track = res.songs[0]
      }
      if (!track.matched) {
        ;(track.album || track.al).picUrl = 'atom://get-default-pic'
      }

      const result = await getPic(track)

      const pic = result.pic
      const format = result.format

      return new Response(new Uint8Array(pic), { headers: { 'Content-Type': format } })
    }
  )

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

  fastify.get('/stream-asset/', () => {})
}

export default httpHandler
