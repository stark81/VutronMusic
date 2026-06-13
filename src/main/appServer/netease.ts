import { pathCase } from 'change-case'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
// import cache from '../cache'
// import { CacheAPIs } from '../utils/CacheApis'
// import { handleNeteaseResult } from '../utils'
import log from '../log'
import store from '../store'

async function netease(fastify: FastifyInstance) {
  const NeteaseCloudMusicApi = require('@neteasecloudmusicapienhanced/api')
  const getHandler = (name: string, neteaseApi: (params: any) => any) => {
    return async (
      req: FastifyRequest<{ Querystring: { [key: string]: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { ...params } = req.query

        const headerCookie = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
        if (!params.cookie) {
          if (headerCookie) {
            params.cookie = headerCookie
          } else {
            const cookie = Object.entries(req.cookies)
              .map(([key, value]) => `${key}=${value}`)
              .join('; ')
            if (cookie) params.cookie = cookie
          }
        }

        const result = await neteaseApi(params)
        // result.body = await handleNeteaseResult(name as CacheAPIs, result?.body)
        // cache.set(name as CacheAPIs, result.body, req.query)
        return reply.send(result.body)
      } catch (error: any) {
        log.error(`Netease API Error: ${name}`, error)
        if ([400, 301, 250].includes(error.status)) {
          return reply.status(error.status).send(error.body)
        }
        return reply.status(500)
      }
    }
  }

  Object.entries(NeteaseCloudMusicApi).forEach(([nameInSnakeCase, neteaseApi]: [string, any]) => {
    if (['serveNcmApi', 'getModulesDefinitions'].includes(nameInSnakeCase)) return
    const name = pathCase(nameInSnakeCase)
    const handler = getHandler(name, neteaseApi)
    fastify.get(`/netease/${name}`, handler)
    fastify.post(`/netease/${name}`, handler)
  })

  fastify.get(
    '/netease/unblock/song/url',
    async (
      req: FastifyRequest<{ Querystring: { [key: string]: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = req.query

      const source = (store.get('settings.unblockNeteaseMusic.source') as string) || ''
      const sourceList = source
        ? source.split(',').map((s) => s.trim().toLowerCase())
        : ['bodian', 'kuwo', 'kugou', 'ytdlp', 'qq', 'bilibili', 'pyncmd', 'migu']

      const qqCookie = (store.get('settings.unblockNeteaseMusic.qqCookie') as string) || ''
      const jooxCookie = store.get('settings.unblockNeteaseMusic.jooxCookie') as string
      const enableFlac = store.get('settings.unblockNeteaseMusic.enableFlac') as boolean
      const orderFirst = store.get('settings.unblockNeteaseMusic.orderFirst') as boolean

      process.env.ENABLE_LOCAL_VIP = 'true'
      process.env.QQ_COOKIE = qqCookie || ''
      process.env.JOOX_COOKIE = jooxCookie || ''
      process.env.ENABLE_FLAC = enableFlac ? 'true' : 'false'
      process.env.FOLLOW_SOURCE_ORDER = orderFirst ? 'true' : 'false'

      const match = require('@unblockneteasemusic/server')
      const proxy = store.get('settings.proxy') as {
        type: 0 | 1 | 2
        address: string
        port: string
      }
      const map = { 1: 'http', 2: 'https' }
      const url =
        proxy && proxy.type !== 0 ? `${map[proxy.type]}://${proxy.address}:${proxy.port}` : null

      // @ts-ignore
      global.proxy = url

      const result = await match(id, sourceList).catch((error: any) => {
        // @ts-ignore
        console.log('=== unblock error ===', global.proxy, error)
        return null
      })
      return reply.send(result)
    }
  )

  fastify.get('/netease', () => 'NeteaseCloudMusicApi')
}

export default netease
