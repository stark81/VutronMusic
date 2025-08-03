import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { doLogout } from './auth'

const baseUrl = '/netease'

const service: AxiosInstance = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
  timeout: 15000
})

service.interceptors.request.use((config: any) => {
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
      console.log('未登录')
      doLogout()
    }
    return Promise.reject(error)
  }
)

const request = async (config: AxiosRequestConfig) => {
  const { data } = await service.request(config)
  return data as any
}

export default request
