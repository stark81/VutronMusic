import axios from 'axios'
import Constants from '../utils/Constants'
import { parseLyricString } from '../utils/utils'
import store from '../store'
import log from '../log'

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
  const headers = { 'X-Emby-Token': accessToken, timeout: 5000 }
  const url = `${baseUrl}/emby/${endpoint}`

  const response = await axios({ method, url, data: params, headers }).catch((error) => {
    log.info('======================== emby error: ', error.code, error.status)
    return error
  })
  return response
}

export interface EmbyImpl {
  systemPing: () => Promise<'logout' | 'login' | 'offline'>
  doLogin: (
    baseUrl: string,
    username: string,
    password: string
  ) => Promise<{ code: number; message?: string }>

  getTracks: () => Promise<{ code: number; data?: any; message?: any }>
  getPlaylists: () => Promise<any>
  getLyric: (id: string) => Promise<any>
  getStream: (id: string) => string
  createPlaylist: (name: string) => Promise<{ status: string; data?: any }>
  deletePlaylist: (id: number) => Promise<boolean>
  scrobble: (id: number) => void
  addTracksToPlaylist: (op: string, playlistId: number, ids: number[]) => Promise<boolean>
  likeATrack: (operation: 'unstar' | 'star', id: number) => void
}

class Emby implements EmbyImpl {
  async systemPing() {
    const baseUrl = store.get('accounts.emby.url') as string
    const status = store.get('accounts.emby.status') as 'logout' | 'login' | 'offline'
    if (!baseUrl || status === 'logout') return 'logout'
    const response = await axios
      .get(`${baseUrl}/System/Ping`, { timeout: 5000 })
      .then((res) => {
        store.set('accounts.emby.status', 'login')
        return res
      })
      .catch(() => ({ status: 504 }))

    switch (response.status) {
      case 200:
        return 'login'
      case 504:
        return 'offline'
      default:
        return 'logout'
    }
  }

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
        store.set('accounts.emby.status', 'login')
        return { code: 200 }
      }
    } catch (error) {
      log.error('======= Emby login error =======', error)
      return {
        code: 404,
        message: (error?.response?.data as string) || error.message || 'Login failed'
      }
    }
  }

  async getTracks() {
    const endpoint = 'Items'
    const params = {
      IncludeItemTypes: 'Audio',
      Fields: 'DateCreated, Size, Bitrate, IsFavorite, MediaSources',
      Recursive: true
    }
    const [response, response2] = await Promise.all([
      ApiRequest('GET', endpoint, params),
      this.getArtists()
    ])
    if (response.status === 200) {
      const tracks = response?.data?.Items.map((song) => {
        const artists = song.ArtistItems.map((t) => {
          const art = response2.find((a) => a.Id === t.Id)!
          const artUrl = art?.ImageTags?.Primary
            ? this.getPic(t.Id, art.ImageTags.Primary, 64)
            : 'http://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg?param=64y64'
          return {
            name: t.Name,
            id: t.Id,
            matched: false,
            picUrl: artUrl
          }
        })
        const lrcItem = song.MediaSources[0].MediaStreams.find((item) => item.Codec === 'lrc')
        const lrcId = lrcItem ? `${song.Id}/${song.MediaSources[0].Id}/${lrcItem.Index}` : song.Id
        const track = {
          id: song.Id,
          name: song.Name,
          dt: song.RunTimeTicks / 10000,
          starred: song.UserData.IsFavorite,
          size: song.Size,
          source: 'emby',
          url: this.getStream(song.Id),
          lrcId,
          gain: 0,
          peak: 1,
          br: song.Bitrate,
          type: 'stream',
          matched: false,
          no: song.IndexNumber || 1,
          offset: 0,
          createTime: new Date(song.DateCreated).getTime(),
          alias: [],
          album: {
            id: song.AlbumId ?? '',
            name: song.Album ?? '',
            matched: false,
            picUrl: `/stream-asset?service=emby&id=${song.Id}&primary=${song.ImageTags?.Primary}&size=64`
          },
          artists: artists.length
            ? artists
            : [
                {
                  name: '',
                  id: '',
                  picUrl:
                    'http://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg?param=64y64',
                  matched: false
                }
              ],
          picUrl: this.getPic(song.Id, song.ImageTags?.Primary, 64)
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

    const response = await ApiRequest('POST', endpoint, params)
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
    return ApiRequest('GET', endpoint, params)
      .then((res) => res?.data?.Items)
      .catch((err) => err)
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

          const trackIds = tracks.map((track) => track.Id)
          const trackItemIds = tracks.reduce(
            (acc, item) => {
              acc[item.Id.toString()] = item.PlaylistItemId
              return acc
            },
            {} as Record<string, string>
          )

          const url = p.ImageTags?.Primary
            ? this.getPic(p.Id, p.ImageTags.Primary, 512)
            : 'https://p1.music.126.net/jWE3OEZUlwdz0ARvyQ9wWw==/109951165474121408.jpg?param=512y512'

          return {
            id: p.Id,
            name: p.Name,
            description: p.Overview,
            updateTime: new Date(p.DateCreated).getTime(),
            trackCount: trackIds.length,
            coverImgUrl: url,
            service: 'emby',
            trackIds,
            trackItemIds,
            creator: { nickname: username }
          }
        })
      )
      return { code: 200, message: 'ok', data: playlists }
    }
    return { code: 404 }
  }

  async getPlaylistTracks(id: string) {
    const endpoint = `Playlists/${id}/Items`
    const params = { Recursive: true }
    const response = await ApiRequest('GET', endpoint, params)
    return (response?.data?.Items as any[]) || []
  }

  async likeATrack(op: 'star' | 'unstar', id: number) {
    const userId = store.get('accounts.emby.userId') as string
    const accessToken = store.get('accounts.emby.accessToken') as string
    const baseUrl = store.get('accounts.emby.url') as string

    const url = `${baseUrl}/emby/Users/${userId}/FavoriteItems/${id}${op === 'unstar' ? '/Delete' : ''}?api_key=${accessToken}`
    const result = await axios({ method: 'POST', url }).then((res) => res.status === 200)
    return result
  }

  scrobble(id: number) {
    const userId = store.get('accounts.emby.userId') as string
    const accessToken = store.get('accounts.emby.accessToken') as string
    const baseUrl = store.get('accounts.emby.url') as string
    const headers = { 'X-Emby-Token': accessToken, timeout: 15000 }

    const time = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14)

    const url = `${baseUrl}/Users/${userId}/PlayedItems/${id}?datePlayed=${time}`
    axios({ method: 'POST', url, headers })
  }

  getStream(id: string) {
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

  async getLyric(id: string) {
    const result = {
      lrc: { lyric: [] },
      tlyric: { lyric: [] },
      romalrc: { lyric: [] },
      yrc: { lyric: [] },
      ytlrc: { lyric: [] },
      yromalrc: { lyric: [] }
    }
    const pool = [
      { fn: getFileLyric, id },
      { fn: getEmbeddedLyric, id }
    ]
    for (const { fn, id } of pool) {
      const result = await fn(id)
      if (result.lrc.lyric.length) return result
    }

    return result
  }
}

const emby = new Emby()

const getLyricFromExtraData = (data: any): string | null => {
  if (!data.MediaStreams) return null
  for (const stream of data.MediaStreams) {
    if (stream.Extradata) return stream.Extradata
  }
  return null
}

const getEmbeddedLyric = async (idString: string) => {
  const result = {
    lrc: { lyric: [] },
    tlyric: { lyric: [] },
    romalrc: { lyric: [] },
    yrc: { lyric: [] },
    ytlrc: { lyric: [] },
    yromalrc: { lyric: [] }
  }

  const baseUrl = store.get('accounts.emby.url') as string
  const userId = store.get('accounts.emby.userId') as string
  const accessToken = store.get('accounts.emby.accessToken') as string

  const res = idString.split('/')

  const url = `${baseUrl}/emby/Users/${userId}/Items/${res[0]}?fields=ShareLevel&ExcludeFields=VideoChapters%2CVideoMediaSources%2CMediaStreams&api_key=${accessToken}`
  const response = await axios.get(url)
  const lrc = getLyricFromExtraData(response.data)
  if (!lrc) return result
  const lyrics = parseLyricString(lrc)
  return lyrics
}

const getFileLyric = async (idString: string) => {
  let result = {
    lrc: { lyric: [] },
    tlyric: { lyric: [] },
    romalrc: { lyric: [] },
    yrc: { lyric: [] },
    ytlrc: { lyric: [] },
    yromalrc: { lyric: [] }
  }
  const res = idString.split('/')
  if (res.length !== 3) return result
  const baseUrl = store.get('accounts.emby.url') as string
  const accessToken = store.get('accounts.emby.accessToken') as string

  const url = `${baseUrl}/Items/${res[0]}/${res[1]}/Subtitles/${res[2]}/Stream.js`
  const headers = { 'X-Emby-Token': accessToken, timeout: 5000 }
  const response = await axios({ method: 'GET', url, headers })
  result = parseLyric(response.data?.TrackEvents ?? [])
  return result
}

const parseLyric = (
  lrcItem: { Text: string; StartPositionTicks: number; EndPositionTicks?: number }[]
) => {
  const result = {
    lrc: { lyric: [] },
    tlyric: { lyric: [] },
    romalrc: { lyric: [] },
    yrc: { lyric: [] },
    ytlrc: { lyric: [] },
    yromalrc: { lyric: [] }
  }
  const lyricMap = new Map()
  const chineseRegex = /[\u4E00-\u9FFF]/

  for (const line of lrcItem) {
    const timeStamps = formatMilliseconds(line.StartPositionTicks)
    if (!lyricMap.has(line.StartPositionTicks)) {
      lyricMap.set(line.StartPositionTicks, [])
    }
    lyricMap.get(line.StartPositionTicks).push(timeStamps + line.Text)
  }

  for (const lyricArray of lyricMap.values()) {
    for (let i = 0; i < lyricArray.length; i++) {
      if (i === 0) {
        result.lrc.lyric.push(lyricArray[0])
      } else {
        const lyric = lyricArray[i].replace(
          /(?!^\[\d{2}:\d{2}\.\d{3}\])\[\d{2}:\d{2}\.\d{3}\]/g,
          ''
        )
        if (chineseRegex.test(lyric)) {
          result.tlyric.lyric.push(lyric)
        } else {
          result.romalrc.lyric.push(lyric)
        }
      }
    }
  }

  return result
}

const formatMilliseconds = (num: number) => {
  const milliseconds = num / 10000

  const minutes = Math.floor(milliseconds / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  const remainingMilliseconds = Math.floor(milliseconds % 1000)

  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = seconds.toString().padStart(2, '0')
  const formattedMilliseconds = remainingMilliseconds.toString().padStart(3, '0')

  return `[${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}]`
}

export default emby
