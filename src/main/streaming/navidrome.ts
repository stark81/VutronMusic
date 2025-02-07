import store from '../store'
import axios from 'axios'
import crypto from 'crypto'

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

  try {
    const response = await axios.get(url, { headers })
    return response
  } catch (error) {
    return error
  }
}

const getRestUrl = (endpoint: string, params?: Record<string, string>) => {
  const baseURL = (store.get('accounts.navidrome.url') as string) || ''
  const username = (store.get('accounts.navidrome.username') as string) || ''
  const token = (store.get('accounts.navidrome.token') as string) || ''
  const salt = (store.get('accounts.navidrome.salt') as string) || ''

  const queryString = new URLSearchParams({
    u: username,
    t: token,
    s: salt,
    v: apiVersion,
    c: client,
    f: 'json',
    ...params
  })
  const url = `${baseURL}/rest/${endpoint}?${queryString}`
  return url
}

export interface NavidromeImpl {
  doLogin: (baseURL: string, username: string, password: string) => Promise<any>
  getTracks: () => Promise<any[]>
  getPlaylists: () => Promise<any[]>
  getPic: (id: string) => string
}

class Navidrome implements NavidromeImpl {
  async doLogin(baseUrl: string, username: string, password: string) {
    const url = `${baseUrl}/auth/login`
    const data = { username, password }
    const headers = { 'content-type': 'application/json' }

    try {
      const response = await axios.post(url, data, { headers })
      const salt = crypto.randomBytes(4).toString('hex')
      store.set('accounts.navidrome', {
        url: baseUrl,
        clientID: response.data.id,
        anthorization: response.data.token,
        username,
        token: generateToken(password, salt),
        salt
      })
      return { code: 200 }
    } catch (error) {
      store.set('accounts.navidrome', {
        url: '',
        clientID: '',
        anthorization: '',
        username: '',
        token: '',
        salt: ''
      })
      return { code: 404, massage: error.response.data.error }
    }
  }

  async getTracks() {
    const response = await ApiRequest('song')
    const tracks = response.data.map((song: any) => {
      const track = {
        id: song.id,
        name: song.title,
        dt: song.duration * 1000,
        size: song.size,
        source: 'navidrome',
        gain: song.rgTrackGain,
        peak: song.rgTrackPeak,
        br: song.sampleRate,
        filePath: song.path,
        show: true,
        delete: false,
        isLocal: false,
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
    })
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
        const tracks = await this.getPlaylistTracks(p.id, { _sort: 'id', _order: 'desc' })
        const trackIds = tracks.map((track: any) => track.mediaFileId)
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
    return playlists
  }

  getPic(id: string) {
    return getRestUrl('getCoverArt', { id })
  }
}

export const startNavidrome = (): NavidromeImpl => {
  return new Navidrome()
}
