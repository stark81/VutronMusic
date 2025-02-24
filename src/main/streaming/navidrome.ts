import store from '../store'
import axios from 'axios'
import crypto from 'crypto'
import qs from 'qs'

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
      salt
    })
    store.set('accounts.selected', 'navidrome')
    return { code: 200 }
  } catch (error) {
    return { code: 404, message: error.response.data.error }
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
    timeout: 15000
  }

  const queryString = new URLSearchParams(params).toString()
  const url = `${store.get('accounts.navidrome.url')}/api/${endpoint}?${queryString}`

  return axios
    .get(url, { headers })
    .then((res) => {
      return { code: 200, message: res.statusText, data: res.data }
    })
    .catch((err) => {
      if (err.code === 'ECONNREFUSED') {
        return { code: 504, message: '连接navidrom服务器失败', data: undefined }
      } else if (err.code === 'ETIMEDOUT') {
        return { code: 504, message: '连接navidrom服务器超时', data: undefined }
      } else if (err.code === 'ERR_BAD_REQUEST') {
        const baseUrl = store.get('accounts.navidrome.url') as string
        const username = store.get('accounts.navidrome.username') as string
        const password = store.get('accounts.navidrome.password') as string
        return doLogin(baseUrl, username, password).then((result) => {
          if (result.code === 200) {
            return axios.get(url, { headers }).then((res) => {
              return { code: 200, message: res.statusText, data: res.data }
            })
          }
          return { code: 401, message: err.response.data.error, data: undefined }
        })
      }
      console.log('=getTracks= err = ', err)
      return err
    })
}

const getRestUrl = (endpoint: string, params?: Record<string, any>) => {
  const baseURL = (store.get('accounts.navidrome.url') as string) || ''
  const username = (store.get('accounts.navidrome.username') as string) || ''
  // const token = (store.get('accounts.navidrome.token') as string) || ''
  // const salt = (store.get('accounts.navidrome.salt') as string) || ''
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
  doLogin: (baseURL: string, username: string, password: string) => Promise<any>
  getTracks: () => Promise<{ code: number; message: string; data: any }>
  getPlaylists: () => Promise<{ code: number; message: string; data: any }>
  getPic: (id: string, size?: number) => string
  getStream: (id: string) => string
  getLyricByID: (id: string) => string
  createPlaylist: (name: string) => Promise<{ status: string; pid: any }>
  deletePlaylist: (id: string) => Promise<boolean>
  addTracksToPlaylist: (op: string, playlistId: string, ids: string[]) => Promise<boolean>
  scrobble: (id: string) => void
}

class Navidrome implements NavidromeImpl {
  async doLogin(baseUrl: string, username: string, password: string) {
    return doLogin(baseUrl, username, password)
  }

  async getTracks() {
    const response = await ApiRequest('song')
    // if (response && response.code === 401) {
    //   return response
    // }
    if (response.code && response.code === 200) {
      const tracks =
        response?.data.map((song: any) => {
          const track = {
            id: song.id,
            name: song.title,
            dt: song.duration * 1000,
            size: song.size,
            source: 'navidrome',
            url: `atom://get-stream-music/${song.id}`,
            gain: song.rgTrackGain,
            peak: song.rgTrackPeak,
            br: song.sampleRate,
            type: 'stream',
            matched: false,
            offset: 0,
            createTime: new Date(song.createdAt).getTime(),
            alias: [],
            album: {
              id: song.albumId,
              name: song.album,
              matched: false,
              picUrl: `atom://get-stream-pic/${song.albumId}/64`
            },
            artists: [
              {
                id: song.artistId,
                name: song.artist,
                matched: false,
                picUrl: `atom://get-stream-pic/${song.albumId}/64`
              }
            ],
            picUrl: `atom://get-stream-pic/${song.albumId}/64`
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
    // if (response && response.code === 401) {
    //   const baseUrl = store.get('accounts.navidrome.url') as string
    //   const username = store.get('accounts.navidrome.username') as string
    //   const password = store.get('accounts.navidrome.password') as string
    //   const { code } = await this.doLogin(baseUrl, username, password)
    //   if (code === 200) {
    //     return this.getPlaylists()
    //   }
    //   return response
    // }
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
            coverImgUrl: `atom://get-stream-pic/${p.id}/512`,
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

  getPic(id: string, size?: number) {
    return getRestUrl('getCoverArt', { id, size })
  }

  getStream(id: string) {
    return getRestUrl('stream', { id })
  }

  getLyricByID(id: string) {
    return getRestUrl('getLyricsBySongId.view', { id })
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

// export const startNavidrome = () => {
//   return new Navidrome()
// }

const navidrome = new Navidrome()

export default navidrome
