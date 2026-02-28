import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { doLogout } from './auth'

const baseUrl = '/netease'
const map = { 1: 'http', 2: 'https' }

const service: AxiosInstance = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
  timeout: 15000
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
    const res = response
    return res
  },
  (error: AxiosError) => {
    const { response } = error
    const data = response?.data as any
    if (data?.code === 301 && data?.message === '未登录') {
      console.log('Not logged in')
      doLogout()
    }
    return Promise.reject(error)
  }
)

const request = async (config: AxiosRequestConfig) => {
  const { data } = await service.request(config).catch(() => ({ data: null }))
  return data as any
}

export default request
