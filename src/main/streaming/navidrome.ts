import store from '../store'
import axios from 'axios'
import crypto from 'crypto'
import qs from 'qs'

const apiVersion = '1.16.1'
const client = 'VutronMusic'

const generateToken = (password: string, salt: string) => {
  return crypto
    .createHash('md5')
    .update(password + salt)
    .digest('hex')
}

const ApiRequest = async (endpoint: string, params?: Record<string, string>) => {
  const headers = {
    'x-nd-authorization': `Bearer ${store.get('accounts.navidrome.anthorization')}`,
    'x-nd-client-unique-id': store.get('accounts.navidrome.clientID') as string
  }

  const queryString = new URLSearchParams(params).toString()
  const url = `${store.get('accounts.navidrome.url')}/api/${endpoint}?${queryString}`

  return axios.get(url, { headers }).catch((error) => {
    console.log('=1=1=1=1=1=1=1=1=', error)
    return null
  })
}

const getRestUrl = (endpoint: string, params?: Record<string, any>) => {
  const baseURL = (store.get('accounts.navidrome.url') as string) || ''
  const username = (store.get('accounts.navidrome.username') as string) || ''
  const token = (store.get('accounts.navidrome.token') as string) || ''
  const salt = (store.get('accounts.navidrome.salt') as string) || ''

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

export interface NavidromeImpl {
  doLogin: (baseURL: string, username: string, password: string) => Promise<any>
  getTracks: () => Promise<any[]>
  getPlaylists: () => Promise<any[]>
  getPic: (id: string) => string
  getStream: (id: string) => string
  getLyricByID: (id: string) => string
  createPlaylist: (name: string) => Promise<{ status: string; pid: any }>
  deletePlaylist: (id: string) => Promise<boolean>
  addTracksToPlaylist: (op: string, playlistId: string, ids: string[]) => Promise<boolean>
}

class Navidrome implements NavidromeImpl {
  async doLogin(baseUrl: string, username: string, password: string) {
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
      store.set('accounts.navidrome', {
        url: '',
        clientID: '',
        anthorization: '',
        username: '',
        password: '',
        token: '',
        salt: ''
      })
      store.set('accounts.selected', 'navidrome')
      return { code: 404, massage: error.response.data.error }
    }
  }

  async getTracks() {
    const response = await ApiRequest('song')
    const tracks =
      response.data?.map((song: any) => {
        const track = {
          id: song.id,
          name: song.title,
          dt: song.duration * 1000,
          size: song.size,
          source: 'navidrome',
          url: `atom://get-navidrome-music/${song.id}`,
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
            picUrl: `atom://get-navidrome-pic/${song.albumId}`
          },
          artists: [
            {
              id: song.artistId,
              name: song.artist,
              matched: false,
              picUrl: `atom://get-navidrome-pic/${song.albumId}`
            }
          ],
          picUrl: `atom://get-navidrome-pic/${song.albumId}`
        }
        return track
      }) || []
    return tracks
  }

  async getPlaylistTracks(id: string, params?: Record<string, string>) {
    const response = await ApiRequest('playlist/' + id + '/tracks', params)
    return response.data
  }

  async getPlaylists() {
    const response = await ApiRequest('playlist')
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
          coverImgUrl: `atom://get-navidrome-pic/${p.id}`,
          trackIds,
          creator: { nickname: p.ownerName }
        }
        return playlist
      })
    )
    return playlists || []
  }

  getPic(id: string) {
    return getRestUrl('getCoverArt', { id })
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
}

export const startNavidrome = (): NavidromeImpl => {
  return new Navidrome()
}
