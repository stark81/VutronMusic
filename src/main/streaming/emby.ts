// import store from '../store'
import axios from 'axios'
import Constants from '../utils/Constants'
import { parseLyricString } from '../utils/utils'
import store from '../store'

const client = 'VutronMusic'
const version = Constants.APP_VERSION

const ApiRequest = async (
  method: 'GET' | 'POST' | 'DELETE',
  endpoint: string,
  params?: Record<string, any>
) => {
  const userId = store.get('accounts.emby.userId') as string
  const accessToken = store.get('accounts.emby.accessToken') as string
  const baseUrl = store.get('accounts.emby.url') as string

  params.UserId = userId
  const headers = { 'X-Emby-Token': accessToken, timeout: 15000 }
  const url = `${baseUrl}/emby/${endpoint}`

  const response = await axios({ method, url, data: params, headers })
  return response
}

const getLyricFromExtraData = (data: any): string | null => {
  if (!data.MediaStreams) return null
  for (const stream of data.MediaStreams) {
    if (stream.Extradata) return stream.Extradata
  }
  return null
}

export interface EmbyImpl {
  doLogin: (
    baseUrl: string,
    username: string,
    password: string
  ) => Promise<{ code: number; message?: string }>

  getTracks: () => Promise<{ code: number; data?: any; message?: any }>
  getPlaylists: () => Promise<any>
  getLyric: (id: number) => Promise<any>
  getStrem: (id: string) => string
  createPlaylist: (name: string) => Promise<{ status: string; data?: any }>
  deletePlaylist: (id: number) => Promise<boolean>
  scrobble: (id: number) => void
  addTracksToPlaylist: (op: string, playlistId: number, ids: number[]) => Promise<boolean>
}

class Emby implements EmbyImpl {
  async doLogin(baseUrl: string, username: string, password: string) {
    const endpoint = 'Users/AuthenticateByName'
    const method = 'POST'
    const data = { Username: username, Pw: password }
    const headers = {
      'X-Emby-Authorization': `MediaBrowser Client="Electron Desktop", Device="${client}", DeviceId="${client}", Version="${version}"`,
      'Content-Type': 'application/json',
      timeout: 5000
    }
    const url = `${baseUrl}/${endpoint}`
    try {
      const response = await axios({ method, url, data, headers })
      if (response.status === 200) {
        store.set('accounts.emby.accessToken', response.data.AccessToken)
        store.set('accounts.emby.userId', response.data.User.Id)
        return { code: 200 }
      }
    } catch (error) {
      return { code: 404, message: error.response.data as string }
    }
  }

  async getTracks() {
    const endpoint = 'Items'
    const params = {
      IncludeItemTypes: 'Audio',
      Fields: 'DateCreated, Size, Bitrate',
      Recursive: true
    }
    const [response, response2] = await Promise.all([
      ApiRequest('GET', endpoint, params),
      this.getArtists()
    ])
    if (response.status === 200) {
      const tracks = response?.data?.Items.map((song) => {
        const picUrl = song?.ImageTags?.Primary
          ? `atom://get-stream-pic/${song.Id}/${song.ImageTags?.Primary}/64`
          : 'https://p2.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg'
        const artists = song.ArtistItems.map((t) => {
          const art = response2.find((a) => a.Id === t.Id)!
          const artUrl = art?.ImageTags?.Primary
            ? `atom://get-stream-pic/${t.Id}/${art?.ImageTags?.Primary}/64`
            : 'http://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg?param=64y64'
          return {
            name: t.Name,
            id: t.Id,
            matched: false,
            picUrl: artUrl
          }
        })
        const track = {
          id: song.Id,
          name: song.Name,
          dt: song.RunTimeTicks / 10000,
          size: song.Size,
          source: 'emby',
          url: `atom://get-stream-music/${song.Id}`,
          gain: 0,
          peak: 1,
          br: song.Bitrate,
          type: 'stream',
          matched: false,
          offset: 0,
          createTime: new Date(song.DateCreated).getTime(),
          alias: [],
          album: {
            id: song.AlbumId,
            name: song.Album,
            matched: false,
            picUrl
          },
          artists,
          picUrl
        }
        return track
      })
      return { code: 200, data: tracks }
    }
    return { code: 404 }
  }

  async createPlaylist(name: string) {
    const endpoint = 'Playlists'
    const params = { Name: name, Ids: '' }

    const response = await ApiRequest('POST', endpoint, params)
    if (response.status === 200) {
      return { status: 'ok', pid: response.data.Id }
    }
    return { status: 'failed' }
  }

  async deletePlaylist(id: number) {
    const endpoint = 'Items/Delete'
    const params = { Ids: id }

    const response = await ApiRequest('POST', endpoint, params).catch((err) => {
      console.log('111111111', err)
      return err
    })
    return response.status === 204
  }

  async addTracksToPlaylist(op: string, pid: number, ids: number[]) {
    const endpoint = `Playlists/${pid}/Items` + (op === 'del' ? `/Delete` : '')
    const params = op === 'add' ? { Ids: ids.join(',') } : { EntryIds: ids.join(',') }
    const response = await ApiRequest('POST', endpoint, params)
    return response.status === (op === 'add' ? 200 : 204)
  }

  async getArtists() {
    const endpoint = 'Artists'
    const params = {
      Recursive: true,
      Fields: 'PrimaryImageAspectRatio'
    }
    return ApiRequest('GET', endpoint, params).then((res) => res?.data?.Items)
  }

  async getPlaylists() {
    const endpoint = 'Items'
    const params = {
      IncludeItemTypes: 'Playlist',
      Fields: 'DateCreated, Overview',
      Recursive: true
    }
    const username = (store.get('accounts.emby.username') as string) || ''
    const response = await ApiRequest('GET', endpoint, params)
    if (response?.status === 200) {
      const playlists = await Promise.all(
        response.data.Items.map(async (p) => {
          const tracks = await this.getPlaylistTracks(p.Id)
          const trackIds = tracks?.map((track) => track.Id)
          const trackItemIds = tracks.reduce((acc, item) => {
            acc[item.Id.toString()] = item.PlaylistItemId
            return acc
          }, {})
          const url = p.ImageTags?.Primary
            ? `atom://get-stream-pic/${p.Id}/${p.ImageTags?.Primary}/512`
            : 'https://p1.music.126.net/jWE3OEZUlwdz0ARvyQ9wWw==/109951165474121408.jpg?param=512y512?param=512y512'
          const playlist = {
            id: p.Id,
            name: p.Name,
            description: p.Overview,
            updateTime: new Date(p.DateCreated).getTime(),
            trackCount: trackIds.length || 0,
            coverImgUrl: url,
            trackIds,
            trackItemIds,
            creator: { nickname: username }
          }
          return playlist
        })
      )
      return { code: 200, massage: 'ok', data: playlists }
    }
    return { code: 404 }
  }

  async getPlaylistTracks(id: string) {
    const endpoint = `Playlists/${id}/Items`
    const params = { Recursive: true }
    const response = await ApiRequest('GET', endpoint, params).catch((err) => {
      console.log('122223333', err)
      return err
    })
    return (response?.data?.Items as any[]) ?? []
  }

  scrobble(id: number) {
    const userId = store.get('accounts.emby.userId') as string
    const accessToken = store.get('accounts.emby.accessToken') as string
    const baseUrl = store.get('accounts.emby.url') as string
    const headers = { 'X-Emby-Token': accessToken, timeout: 15000 }

    const url = `${baseUrl}/Users/${userId}/PlayedItems/${id}`
    axios({ method: 'POST', url, headers })
  }

  getStrem(id: string) {
    const userId = store.get('accounts.emby.userId') as string
    const accessToken = store.get('accounts.emby.accessToken') as string
    const baseUrl = store.get('accounts.emby.url') as string

    const url = `${baseUrl}/Audio/${id}/universal?UserId=${userId}&MaxStreamingBitrate=1145761093&Container=opus%2Cwebm%7Copus%2Cts%7Cmp3%2Cmp3%2Caac%2Cm4a%7Caac%2Cm4b%7Caac%2Cflac%2Cwebma%2Cwebm%7Cwebma%2Cwav%2Cogg&TranscodingContainer=mp4&TranscodingProtocol=hls&AudioCodec=aac&api_key=${accessToken}&StartTimeTicks=0&EnableRedirection=true&EnableRemoteMedia=false&EnableAudioVbrEncoding=true`
    return url
  }

  getPic(id: number, primary: string, size: number) {
    const baseUrl = store.get('accounts.emby.url') as string

    const url = `${baseUrl}/emby/Items/${id}/Images/Primary?maxHeight=${size}&maxWidth=${size}&tag=${primary}&quality=90`
    return url
  }

  async getLyric(id: number) {
    let result = {
      lrc: { lyric: [] },
      tlyric: { lyric: [] },
      romalrc: { lyric: [] },
      yrc: { lyric: [] },
      ytlrc: { lyric: [] },
      yromalrc: { lyric: [] }
    }
    const userId = store.get('accounts.emby.userId') as string
    const accessToken = store.get('accounts.emby.accessToken') as string
    const baseUrl = store.get('accounts.emby.url') as string

    const url = `${baseUrl}/emby/Users/${userId}/Items/${id}?fields=ShareLevel&ExcludeFields=VideoChapters%2CVideoMediaSources%2CMediaStreams&api_key=${accessToken}`
    const response = await axios.get(url)
    const lrc = getLyricFromExtraData(response.data)
    if (!lrc) return result
    const lyrics = parseLyricString(lrc)
    result = {
      lrc: { lyric: lyrics[0] || [] },
      tlyric: { lyric: lyrics[1] || [] },
      romalrc: { lyric: lyrics[2] || [] },
      yrc: { lyric: [] },
      ytlrc: { lyric: [] },
      yromalrc: { lyric: [] }
    }
    return result
  }
}

const emby = new Emby()

export default emby
