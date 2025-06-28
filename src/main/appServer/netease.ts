import { pathCase } from 'change-case'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import cache from '../cache'
import { CacheAPIs } from '../utils/CacheApis'
import { handleNeteaseResult } from '../utils/utils'
import log from '../log'

async function netease(fastify: FastifyInstance) {
  const NeteaseCloudMusicApi = require('NeteaseCloudMusicApi')
  const getHandler = (name: string, neteaseApi: (params: any) => any) => {
    return async (
      req: FastifyRequest<{ Querystring: { [key: string]: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { localID, ...params } = req.query
        if (!params.cookie) params.cookie = (req as any).cookies
        const result = await neteaseApi(params)

        result.body = handleNeteaseResult(name as CacheAPIs, result.body)
        cache.set(name as CacheAPIs, result.body, req.query)
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
  fastify.get('/netease', () => 'NeteaseCloudMusicApi')
}

export default netease
