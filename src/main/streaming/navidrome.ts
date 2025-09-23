import store from '../store'
import axios from 'axios'
import crypto from 'crypto'
import qs from 'qs'
import { formatTime } from '../utils/utils'

const apiVersion = '1.16.1'
const client = 'VutronMusic'

const doLogin = async (baseUrl: string, username: string, password: string) => {
  const url = `${baseUrl}/auth/login`
  const data = { username, password }
  const headers = { 'content-type': 'application/json' }

  try {
    const response = await axios.post(url, data, { headers })
    const salt = crypto.randomBytes(6).toString('hex')
    store.set('accounts.navidrome', {
      url: baseUrl,
      clientID: response.data.id,
      anthorization: response.data.token,
      username,
      password,
      token: generateToken(password, salt),
      salt,
      status: 'login'
    })
    return { code: 200 }
  } catch (error) {
    const dialog = (await import('electron')).dialog
    dialog.showErrorBox(
      'Navidrome 接口请求失败',
      JSON.stringify(error?.response?.data || error.message)
    )
    return { code: 404, message: error?.response?.data?.error || '登录失败' }
  }
}

const generateToken = (password: string, salt: string) => {
  return crypto
    .createHash('md5')
    .update(password + salt)
    .digest('hex')
}

const ApiRequest = async (endpoint: string, params?: Record<string, string>) => {
  const headers = {
    'x-nd-authorization': `Bearer ${store.get('accounts.navidrome.anthorization')}`,
    'x-nd-client-unique-id': store.get('accounts.navidrome.clientID') as string,
    timeout: 5000
  }

  const queryString = new URLSearchParams(params).toString()
  const url = `${store.get('accounts.navidrome.url')}/api/${endpoint}?${queryString}`

  return axios
    .get(url, { headers })
    .then((res) => {
      return { code: 200, message: res.statusText, data: res.data }
    })
    .catch(async (error) => {
      const dialog = (await import('electron')).dialog
      dialog.showErrorBox(
        'Navidrome 接口请求失败',
        JSON.stringify(error?.response?.data || error.message)
      )
      return error
    })
}

const getRestUrl = (endpoint: string, params?: Record<string, any>) => {
  const baseURL = (store.get('accounts.navidrome.url') as string) || ''
  const username = (store.get('accounts.navidrome.username') as string) || ''
  const password = (store.get('accounts.navidrome.password') as string) || ''
  const salt = crypto.randomBytes(6).toString('hex')
  const token = generateToken(password, salt)

  const queryString = qs.stringify(
    {
      u: username,
      t: token,
      s: salt,
      v: apiVersion,
      c: client,
      f: 'json',
      ...params // 包含 songIdToAdd: ['id1', 'id2']
    },
    { arrayFormat: 'repeat' } // 关键配置
  )
  const url = `${baseURL}/rest/${endpoint}?${queryString}`
  return url
}

interface NavidromeImpl {
  systemPing: () => Promise<'logout' | 'login' | 'offline'>
  doLogin: (baseURL: string, username: string, password: string) => Promise<any>
  getTracks: () => Promise<{ code: number; message: string; data: any }>
  getPlaylists: () => Promise<{ code: number; message: string; data: any }>
  getPic: (id: string, size?: number) => string
  getStream: (id: string) => string
  getLyric: (id: string) => Promise<any>
  createPlaylist: (name: string) => Promise<{ status: string; pid: any }>
  deletePlaylist: (id: string) => Promise<boolean>
  addTracksToPlaylist: (op: string, playlistId: string, ids: string[]) => Promise<boolean>
  scrobble: (id: string) => void
  likeATrack: (operation: 'unstar' | 'star', id: string) => Promise<boolean>
}

class Navidrome implements NavidromeImpl {
  async systemPing() {
    const baseURL = (store.get('accounts.navidrome.url') as string) || ''
    const status = store.get('accounts.navidrome.status') as 'logout' | 'login' | 'offline'
    if (!baseURL || status === 'logout') return 'logout'

    const url = getRestUrl('ping')
    const res = await axios
      .get(url, { timeout: 5000 })
      .then((res) => {
        store.set('accounts.navidrome.status', 'login')
        return res
      })
      .catch((error) => ({ status: error?.code === 'ECONNREFUSED' ? 503 : 500, ...error }))

    if (res.status === 200) {
      return res.data['subsonic-response'].status === 'ok' ? 'login' : 'logout'
    }
    return res.status === 503 || res.response?.status === 504 ? 'offline' : 'logout'
  }

  async doLogin(baseUrl: string, username: string, password: string) {
    return doLogin(baseUrl, username, password)
  }

  async getTracks() {
    const response = await ApiRequest('song')
    if (response.code && response.code === 200) {
      const tracks =
        response?.data.map((song: any) => {
          const track = {
            id: song.id,
            name: song.title,
            dt: song.duration * 1000,
            starred: song.starred,
            size: song.size,
            source: 'navidrome',
            url: this.getStream(song.id),
            gain: song.rgTrackGain,
            peak: song.rgTrackPeak,
            br: song.sampleRate,
            type: 'stream',
            matched: false,
            no: song.trackNumber || 1,
            offset: 0,
            createTime: new Date(song.createdAt).getTime(),
            alias: [],
            album: {
              id: song.albumId ?? '',
              name: song.album ?? '',
              matched: false,
              picUrl: `/stream-asset?service=navidrome&id=${song.albumId ?? song.id}&size=64`
            },
            artists: [
              {
                id: song.artistId ?? '',
                name: song.artist ?? '',
                matched: false,
                picUrl: this.getPic(song.artistId ?? song.albumId ?? song.id, 64)
              }
            ],
            picUrl: getRestUrl('getCoverArt', { id: song.albumId, size: 64 })
          }
          return track
        }) || []
      return { code: 200, message: 'ok', data: tracks }
    }
    return response
  }

  async getPlaylistTracks(id: string, params?: Record<string, string>) {
    const response = await ApiRequest('playlist/' + id + '/tracks', params)
    return response.data
  }

  async getPlaylists() {
    const response = await ApiRequest('playlist')
    if (response.code && response.code === 200) {
      const playlists = await Promise.all(
        response.data.map(async (p: any) => {
          const tracks = await this.getPlaylistTracks(p.id)
          const trackIds = tracks?.map((track: any) => track.mediaFileId) || []
          const playlist = {
            id: p.id,
            name: p.name,
            description: p.comment,
            updateTime: new Date(p.updatedAt).getTime(),
            trackCount: p.songCount,
            coverImgUrl: this.getPic(p.id, 512),
            service: 'navidrome',
            trackIds,
            creator: { nickname: p.ownerName }
          }
          return playlist
        })
      )
      return { code: 200, massage: 'ok', data: playlists }
    }
    return response
  }

  async likeATrack(op: 'star' | 'unstar', id: string) {
    const url = getRestUrl(op, { id })
    const result = await fetch(url)
      .then((res) => res.json())
      .then((res) => res['subsonic-response'].status === 'ok')
    return result
  }

  getPic(id: string, size?: number) {
    return getRestUrl('getCoverArt', { id, size })
  }

  getStream(id: string) {
    return getRestUrl('stream', { id })
  }

  async getLyric(id: string) {
    const result = {
      lrc: { lyric: [] },
      tlyric: { lyric: [] },
      romalrc: { lyric: [] },
      yrc: { lyric: [] },
      ytlrc: { lyric: [] },
      yromalrc: { lyric: [] }
    }
    const url = getRestUrl('getLyricsBySongId.view', { id })
    const lyricRaw: any[] = await fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const lyricArray = data['subsonic-response'].lyricsList.structuredLyrics
        return lyricArray ? lyricArray[0].line : []
      })
    if (lyricRaw.length) {
      const map = new Map()
      const chineseRegex = /[\u4E00-\u9FFF]/
      lyricRaw.forEach(({ start, value }) => {
        if (!map.has(start)) {
          map.set(start, [])
        }
        map.get(start).push(value)
      })

      const sortedStarts = Array.from(map.keys()).sort((a, b) => a - b)
      for (const start of sortedStarts) {
        const values = map.get(start)
        const timeStr = formatTime(start)
        for (let i = 0; i < values.length; i++) {
          if (i === 0) {
            result.lrc.lyric.push(`${timeStr}${values[0]}`)
          } else {
            if (chineseRegex.test(values[i])) {
              result.tlyric.lyric.push(`${timeStr}${values[i]}`)
            } else {
              result.romalrc.lyric.push(`${timeStr}${values[i]}`)
            }
          }
        }
      }
    }
    return result
  }

  async createPlaylist(name: string) {
    const url = getRestUrl('createPlaylist', { name })
    const result = await fetch(url)
      .then((res) => res.json())
      .then((res) => {
        if (res['subsonic-response'].status === 'ok') {
          const pid = res['subsonic-response'].playlist.id as string
          return { status: 'ok', pid }
        }
        return { status: 'failed', pid: undefined }
      })
    return result
  }

  async deletePlaylist(id: string) {
    const url = getRestUrl('deletePlaylist', { id })
    const isSuccess = await fetch(url)
      .then((res) => res.json())
      .then((res) => res['subsonic-response'].status === 'ok')
    return isSuccess
  }

  async addTracksToPlaylist(op: string, playlistId: string, ids: string[]) {
    const params =
      op === 'add'
        ? { playlistId, songIdToAdd: ids }
        : op === 'del'
          ? { playlistId, songIndexToRemove: ids }
          : {}
    const url = getRestUrl('updatePlaylist', params)
    const isSuccess = await fetch(url)
      .then((res) => res.json())
      .then((res) => res['subsonic-response'].status === 'ok')
    return isSuccess
  }

  scrobble(id: string) {
    fetch(getRestUrl('scrobble', { id }))
  }
}

const navidrome = new Navidrome()

export default navidrome
