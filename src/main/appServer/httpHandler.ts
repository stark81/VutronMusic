import { BrowserWindow } from 'electron'
import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import cache from '../cache'
import { CacheAPIs } from '../utils/CacheApis'
import { getTrackDetail, getPic, getPicFromApi } from '../utils/utils'
import navidrome from '../streaming/navidrome'
import jellyfin from '../streaming/jellyfin'
import emby from '../streaming/emby'

const httpHandler: FastifyPluginAsync = async (fastify: FastifyInstance, options) => {
  fastify.get(
    '/local-asset',
    async (req: FastifyRequest<{ Querystring: Record<string, string> }>) => {
      const { id, size } = req.query
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
      } else {
        const url = new URL((track.album || track.al).picUrl)
        url.searchParams.set('param', `${size}y${size}`)
        ;(track.album || track.al).picUrl = url.toString()
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

  fastify.get(
    '/stream-asset',
    async (req: FastifyRequest<{ Querystring: Record<string, string> }>, res) => {
      const { service, id, primary, size } = req.query as {
        service: 'navidrom' | 'jellyfin' | 'emby'
        id: string
        primary: string
        size: string
      }

      let url: string

      if (service === 'emby') {
        url =
          primary === 'undefined'
            ? `https://p1.music.126.net/jWE3OEZUlwdz0ARvyQ9wWw==/109951165474121408.jpg?param=${size}y${size}`
            : emby.getPic(Number(id), primary, Number(size))
      } else if (service === 'jellyfin') {
        url =
          primary === 'undefined'
            ? `https://p2.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg?param=${size}y${size}`
            : jellyfin.getPic(id, Number(size))
      } else {
        url = navidrome.getPic(id, Number(size))
      }

      const result = await getPicFromApi(url)
      const pic = result.pic
      const format = result.format

      return new Response(new Uint8Array(pic), { headers: { 'Content-Type': format } })
    }
  )
}

export default httpHandler
