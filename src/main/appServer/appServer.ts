import fastify from 'fastify'
import netease from './netease'
import Constants from '../utils/Constants'

const initAppserver = async () => {
  const server = fastify({
    ignoreTrailingSlash: true
  })
  server.register(netease)

  const port = Number(
    Constants.IS_DEV_ENV
      ? Constants.ELECTRON_DEV_NETEASE_API_PORT || 40001
      : Constants.ELECTRON_WEB_SERVER_PORT || 41830
  )
  await server.listen({ port })
  console.log(`AppServer is running at http://localhost:${port}`)
  return server
}

export default initAppserver
