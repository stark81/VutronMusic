import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { doLogout } from './auth'
import { networkMonitor } from './networkMonitor'
import { pageCache } from './pageCache'

const baseUrl = '/netease'
const map = { 1: 'http', 2: 'https' }

const service: AxiosInstance = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
  timeout: 3000
})

service.interceptors.request.use((config: any) => {
  if (!config.params) config.params = {}
  const misc = JSON.parse(localStorage.getItem('settings') || '{}').misc

  const proxy = misc.proxy as { type: 0 | 1 | 2; address: string; port: string }
  if (proxy && proxy.type !== 0) {
    config.params.proxy = `${map[proxy.type]}://${proxy.address}:${proxy.port}`
  }

  const realIp = misc.realIp as { enable: boolean; ip: string }
  if (realIp && realIp.enable && realIp.ip) {
    config.params.realIP = realIp.ip
  }
  return config
})

service.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError) => {
    const { response } = error
    const data = response?.data as any
    if (data?.code === 301 && data?.message === '未登录') {
      console.log('未登录')
      doLogout()
    }
    return Promise.reject(error)
  }
)

const request = async (config: AxiosRequestConfig) => {
  const url = config.url || ''

  if (networkMonitor.isOfflineMode.value) {
    const cached =
      (await pageCache.getCachedApiResponse(url, config.params)) ||
      (await pageCache.getAnyCachedForUrl(url))
    return cached || {}
  }

  try {
    const { data } = await service.request(config)
    if (data && Object.keys(data).length > 0) {
      networkMonitor.recordSuccess()
      pageCache.cacheApiResponse(url, config.params, data)
    }
    return data as any
  } catch {
    networkMonitor.recordFailure()
    const cached =
      (await pageCache.getCachedApiResponse(url, config.params)) ||
      (await pageCache.getAnyCachedForUrl(url))
    return cached || {}
  }
}

export default request
