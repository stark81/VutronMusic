import crypto from 'crypto'
import store from '../store'
import { net, shell, dialog } from 'electron'

const API_KEY = '7ce6ffbb02cb96cf7414d44d89fe893f'
const SHARED_SECRET = '9f6c093500821346a8e0da892e38df43'
const API_URL = 'https://ws.audioscrobbler.com/2.0/'

const sign = (param: Record<string, string>) => {
  const sorted = Object.keys(param)
    .sort()
    .map((k) => k + String(param[k]))
    .join('')
  const toHash = sorted + SHARED_SECRET
  return crypto.createHash('md5').update(toHash).digest('hex')
}

const netGet = (
  params: Record<string, string>,
  method: 'GET' | 'POST' = 'GET',
  timeout = 10000
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString()
    const request = net.request({
      method,
      url: `${API_URL}?${query}`
    })

    const timer = setTimeout(() => {
      request.abort()
      reject(new Error('Last.fm request timeout'))
    }, timeout)

    request.on('response', (response) => {
      let raw = ''

      response.on('data', (chunk) => {
        raw += chunk.toString()
      })

      response.on('end', () => {
        clearTimeout(timer)
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Last.fm HTTP ${response.statusCode}: ${raw}`))
          return
        }
        try {
          resolve(JSON.parse(raw))
        } catch (e) {
          reject(new Error('Failed to parse Last.fm response'))
        }
      })
    })

    request.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    request.end()
  })
}

const getAuthToken = async (): Promise<string | null> => {
  try {
    const params = {
      method: 'auth.getToken',
      api_key: API_KEY
    }
    const sig = sign(params)

    const data = await netGet({
      ...params,
      api_sig: sig,
      format: 'json'
    })

    return data?.token ?? null
  } catch (error) {
    console.error('Error getting Last.fm auth token:', error)
    return null
  }
}

const getSession = async (token: string) => {
  const params = {
    method: 'auth.getSession',
    api_key: API_KEY,
    token
  }
  const sig = sign(params)

  const data = await netGet({
    ...params,
    api_sig: sig,
    format: 'json'
  })

  return data.session as {
    name: string
    key: string
    subscriber: number
  }
}

export const requestUserAuth = async () => {
  try {
    const token = await getAuthToken()
    if (!token) return { name: '' }

    const url = `https://www.last.fm/api/auth/?api_key=${API_KEY}&token=${token}`
    shell.openExternal(url)

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Last.fm 授权',
      message: '请在浏览器中完成授权，然后点击下方按钮',
      buttons: ['我已授权', '取消']
    })

    if (result.response !== 0) return { name: '' }

    const session = await getSession(token)
    console.log('[Last.fm] session:', session)

    store.set('settings.lastfmSession', session)
    return { name: session.name }
  } catch (error) {
    console.error('Error during Last.fm user authentication:', error)
    return { name: '' }
  }
}

export const scrobbleTrack = (params: Record<string, any>) => {
  const session = store.get('settings.lastfmSession') as {
    name: string
    key: string
    subscriber: number
  } | null
  if (!session) return

  const baseParams: Record<string, string> = {
    ...params,
    method: 'track.scrobble',
    api_key: API_KEY,
    sk: session.key
  }

  const sig = sign(baseParams)

  netGet(
    {
      ...baseParams,
      api_sig: sig,
      format: 'json'
    },
    'POST',
    5000
  ).catch((error) => {
    console.error('Error scrobbling track to Last.fm:', error)
  })
}

export const updateNowPlaying = (params: Record<string, any>) => {
  const session = store.get('settings.lastfmSession') as {
    name: string
    key: string
    subscriber: number
  } | null
  if (!session) return

  const baseParams: Record<string, string> = {
    ...params,
    method: 'track.updateNowPlaying',
    api_key: API_KEY,
    sk: session.key
  }

  const sig = sign(baseParams)

  netGet(
    {
      ...baseParams,
      api_sig: sig,
      format: 'json'
    },
    'POST',
    5000
  ).catch((error) => {
    console.error('Error updating now playing on Last.fm:', error)
  })
}
