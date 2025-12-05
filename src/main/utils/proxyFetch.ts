import { HttpsProxyAgent } from 'https-proxy-agent'
import store from '../store'

const getProxyAgent = () => {
  const proxy = store.get('settings.proxy') as { type: 0 | 1 | 2; address: string; port: string }

  if (proxy && proxy.type !== 0) {
    const map = { 1: 'http', 2: 'https' }
    const proxyUrl = `${map[proxy.type]}://${proxy.address}:${proxy.port}`

    return new HttpsProxyAgent(proxyUrl)
  }
  return undefined
}

export const proxyFetch = (url: string, options: any = {}) => {
  const agent = getProxyAgent()

  if (agent) {
    options.agent = agent
  }

  return fetch(url, options)
}
