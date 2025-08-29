import axios from 'axios'
import store from '../store'
import log from '../log'

const client = 'VutronMusic'
const version = '1.6.5'

const sendItemsList = async (
  endpoint: string,
  params?: any,
  method: 'GET' | 'POST' | 'DELETE' = 'GET'
) => {
  const baseUrl = store.get('accounts.jellyfin.url') as string
  const userId = store.get('accounts.jellyfin.userId') as string
  const accessToken = store.get('accounts.jellyfin.accessToken') as string

  if (!baseUrl || !userId || !accessToken) {
    return Promise.reject(new Error('Jellyfin not logged in'))
  }

  const url = `${baseUrl}/${endpoint}`
  const headers = {
    Authorization: `MediaBrowser Token="${accessToken}", Client="${client}", Device="${client}", DeviceId="${client}", Version="${version}"`,
    'Content-Type': 'application/json',
    timeout: 5000
  }

  const res = await axios({ method, url, headers, params }).catch((err) => err)
  return res
}

interface JellyfinImpl {
  systemPing: () => Promise<'logout' | 'login' | 'offline'>
  doLogin: (baseURL: string, username: string, password: string) => Promise<any>
  getTracks: () => Promise<{ code: number; message?: string; data?: any }>
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

class Jellyfin implements JellyfinImpl {
  async systemPing() {
    const baseUrl = store.get('accounts.jellyfin.url') as string
    const status = store.get('accounts.jellyfin.status') as 'logout' | 'login' | 'offline'
    if (!baseUrl || status === 'logout') return 'logout'
    const response = await axios
      .get(`${baseUrl}/System/Ping`, { timeout: 5000 })
      .then((res) => {
        store.set('accounts.jellyfin.status', 'login')
        return res
      })
      .catch(() => ({ status: 504 }))

    switch (response.status) {
      case 200:
        return 'login'
      case 503:
      case 504:
        return 'offline'
      default:
        return 'logout'
    }
  }

  async doLogin(baseURL: string, Username: string, password: string) {
    const baseUrl = store.get('accounts.jellyfin.url') as string
    const url = `${baseUrl}/Users/AuthenticateByName`
    const AccessToken = ''
    const headers = {
      Authorization: `MediaBrowser Token="${AccessToken}", Client="${client}", Device="${client}", DeviceId="${client}", Version="${version}"`,
      'Content-Type': 'application/json',
      timeout: 5000
    }
    const params = { Username, Pw: password }
    const response = await axios({ method: 'POST', url, headers, data: params })
    try {
      if (response.status === 200) {
        store.set('accounts.jellyfin.userId', response.data.User.Id)
        store.set('accounts.jellyfin.accessToken', response.data.AccessToken)
        store.set('accounts.jellyfin.status', 'login')
        return { code: 200 }
      }
    } catch (err) {
      log.error('==== jellyfin doLogin err ====', err)
      return { code: 404, message: 'Login failed', data: undefined }
    }
  }

  async getPlaylistTracks(id: string) {
    const userId = store.get('accounts.jellyfin.userId') as string
    if (!userId) {
      return { code: 401, message: 'User not logged in', data: [] }
    }
    const endpoint = `Playlists/${id}/Items`
    const params = {
      userId,
      Fields: 'DateCreated, MediaSources, AudioInfo',
      Recursive: true
    }
    const response = await sendItemsList(endpoint, params)
    return response.data.Items
  }

  async getPlaylists() {
    const userId = store.get('accounts.jellyfin.userId') as string
    if (!userId) {
      return { code: 401, message: 'User not logged in', data: [] }
    }
    try {
      const endpoint = `Users/${userId}/Items`
      const params = {
        IncludeItemTypes: 'Playlist',
        Fields: 'DateCreated, Overview',
        Recursive: true
      }
      const username = (store.get('accounts.jellyfin.username') as string) || ''
      const response = await sendItemsList(endpoint, params)
      const playlists = await Promise.all(
        response.data.Items.map(async (p) => {
          const tracks = await this.getPlaylistTracks(p.Id)
          const trackIds = tracks.map((t: any) => t.Id) as string[]
          const trackItemIds = tracks.reduce((acc, item) => {
            acc[item.Id.toString()] = item.PlaylistItemId
            return acc
          }, {})
          const url = p.ImageTags?.Primary
            ? this.getPic(p.Id, 512)
            : 'https://p1.music.126.net/jWE3OEZUlwdz0ARvyQ9wWw==/109951165474121408.jpg?param=512y512'
          const playlist = {
            id: p.Id,
            name: p.Name,
            description: p.Overview || '',
            updateTime: new Date(p.DateCreated).getTime(),
            trackCount: p.ChildCount,
            coverImgUrl: url,
            service: 'jellyfin',
            trackIds,
            trackItemIds,
            creator: { nickname: username }
          }
          return playlist
        })
      )
      return { code: 200, message: 'Playlists fetched successfully', data: playlists }
    } catch (error) {
      log.error('Error fetching playlists:', error)
      return { code: 500, message: 'Failed to fetch playlists', data: [] }
    }
  }

  async getArtists() {
    const endpoint = 'Artists'
    const params = {
      Recursive: true,
      Fields: 'PrimaryImageAspectRatio'
    }
    const res = await sendItemsList(endpoint, params)
    return res
  }

  async getLyric(id: string) {
    const endpoint = `Audio/${id}/Lyrics`
    const response = await sendItemsList(endpoint)
    return response.data?.Lyrics || []
  }

  async createPlaylist(name: string) {
    const endpoint = 'Playlists'
    const userId = store.get('accounts.jellyfin.userId') as string
    const params = { Name: name, UserId: userId, Ids: [], MediaType: 'Audio' }
    const response = await sendItemsList(endpoint, params, 'POST')
    if (response.status === 200) {
      return { status: 'ok', pid: response.data.Id }
    }
    return { status: 'failed', pid: null }
  }

  async deletePlaylist(id: string) {
    const endpoint = `Items/${id}`
    const response = await sendItemsList(endpoint, {}, 'DELETE')
    return response.status === 204
  }

  async addTracksToPlaylist(op: 'add' | 'del', playlistId: string, ids: string[]) {
    const endpoint = `Playlists/${playlistId}/Items`
    const userId = store.get('accounts.jellyfin.userId') as string
    const params =
      op === 'add' ? { Ids: ids.join(','), UserId: userId } : { entryIds: ids.join(',') }
    const method = op === 'add' ? 'POST' : 'DELETE'
    const response = await sendItemsList(endpoint, params, method)
    return response.status === 204 || response.status === 200
  }

  async likeATrack(operation: 'unstar' | 'star', id: string) {
    const userId = store.get('accounts.jellyfin.userId') as string
    if (!userId) return false
    const endpoint = `Users/${userId}/FavoriteItems/${id}`
    const method = operation === 'star' ? 'POST' : 'DELETE'
    const result = await sendItemsList(endpoint, {}, method)
    return result.status === 204 || result.status === 200
  }

  getStream(id: string) {
    const userId = store.get('accounts.jellyfin.userId') as string
    const accessToken = store.get('accounts.jellyfin.accessToken') as string
    const baseUrl = store.get('accounts.jellyfin.url') as string

    const url = `${baseUrl}/Audio/${id}/stream?static=true&audioCodec=aac&deviceId=${client}&userId=${userId}&access_token=${accessToken}`
    return url
  }

  scrobble(id: string) {
    const userId = store.get('accounts.jellyfin.userId') as string

    const endpoint = `Users/${userId}/PlayedItems/${id}`
    const time = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14)
    const params = { datePlayed: time }
    sendItemsList(endpoint, params, 'POST')
  }

  getPic(id: string, size: number) {
    const baseUrl = store.get('accounts.jellyfin.url') as string
    const url = `${baseUrl}/Items/${id}/Images/Primary?fillHeight=${size}&fillWidth=${size}`
    return url
  }

  async getTracks() {
    const userId = store.get('accounts.jellyfin.userId') as string
    if (!userId) {
      return { code: 401, message: 'User not logged in', data: [] }
    }
    const endpoint = `Users/${userId}/Items`
    const params = {
      IncludeItemTypes: 'Audio',
      Fields: 'DateCreated, MediaSources',
      Recursive: true
    }
    const [res1, res2] = await Promise.all([sendItemsList(endpoint, params), this.getArtists()])

    if (res1.status !== 200) {
      return { code: res1.status, message: 'Failed to fetch tracks', data: [] }
    }
    const tracks = res1.data.Items.map((song: any) => {
      const artists = song.ArtistItems?.map((artist: any) => {
        const art = res2.data.Items.find((a: any) => a.Id === artist.Id)!
        const artUrl = art?.ImageTags?.Primary
          ? this.getPic(artist.Id, 64)
          : 'http://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg?param=64y64'
        return { name: artist.Name, id: artist.Id, picUrl: artUrl, matched: false }
      })
      const track = {
        id: song.Id,
        name: song.Name,
        dt: song.RunTimeTicks / 10000 || 0,
        starred: song.UserData?.IsFavorite || false,
        size: song.MediaSources[0]?.Size || 0,
        source: 'jellyfin',
        url: this.getStream(song.Id),
        gain: song.NormalizationGain || 0,
        peak: 1,
        br: song.MediaSources?.[0].Bitrate || 0,
        type: 'stream',
        matched: false,
        no: song.IndexNumber || 1,
        offset: 0,
        createTime: new Date(song.DateCreated).getTime() || new Date(song.PremiereDate).getTime(),
        alias: [],
        album: {
          id: song.AlbumId ?? '',
          name: song.Album ?? '',
          matched: false,
          picUrl: song.AlbumId
            ? `/stream-asset?service=jellyfin&id=${song.Id}&primary=${song.ImageTags?.Primary}&size=64`
            : 'http://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg?param=64y64'
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
        picUrl: this.getPic(song.Id, 64)
      }
      return track
    })
    return { code: 200, data: tracks }
  }
}

const jellyfin: JellyfinImpl = new Jellyfin()
export default jellyfin
