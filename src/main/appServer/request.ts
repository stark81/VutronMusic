import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import Constants from '../utils/Constants'
import { session } from 'electron'
import log from '../log'

const port = Number(
  Constants.IS_DEV_ENV
    ? Constants.ELECTRON_DEV_NETEASE_API_PORT || 40001
    : Constants.ELECTRON_WEB_SERVER_PORT || 41830
)

const baseUrl = `http://localhost:${port}/netease`

const service: AxiosInstance = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
  timeout: 15000
})

service.interceptors.request.use(async (config: any) => {
  if (!config.params) config.params = {}
  const cookieString = await session.defaultSession.cookies.get({})
  const cookie = cookieString.find((cookie: any) => cookie.name === 'MUSIC_U')
  if (cookie) config.params.cookie = `MUSIC_U=${cookie.value}`

  const proxy = (store.get('settings.proxy') || { type: 0, address: '', port: '' }) as {
    type: 0 | 1 | 2
    address: string
    port: string
  }

  if (proxy && proxy.type !== 0) {
    const map = { 1: 'http', 2: 'https' }
    const url = `${map[proxy.type]}://${proxy.address}:${proxy.port}`
    config.params.proxy = url
  }

  return config
})

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response
    return res
  },
  (error: AxiosError) => {
    const { response } = error
    const data = response?.data as any
    if (data?.code === 301 && data?.message === '未登录') {
      log.info('未登录')
    }
    return Promise.reject(error)
  }
)

const request = async (config: AxiosRequestConfig) => {
  const { data } = await service.request(config)
  return data as any
}

export default request
