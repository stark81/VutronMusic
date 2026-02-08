export type MusicType =
  | 'local' // 本地文件
  | 'platform' // 公共平台（网易云、酷狗）
  | 'library' // 私有媒体库（Navidrome、Emby）

export type PluginId = string & { __brand: 'PluginId' }

type TrackRights = {
  canPlay: boolean
  canDownload: boolean

  requiresVip?: boolean
  isPreview?: boolean
  maxBitrate?: number

  reason?: string
}

export interface Artist {
  id: string
  name: string
  picUrl: string
  matched: boolean
}

export interface Album {
  id: string
  name: string
  picUrl: string
  matched: boolean
}

export interface Track {
  id: string
  name: string
  duration: number
  alias: string[]
  createTime: number
  album: Album
  artists: Artist[]
  picUrl: string
  rights: TrackRights

  source: PluginId
  type: MusicType

  /**
   * 用于保存各自插件音源的特殊数据
   * 如：原数据里的id是number类型，转成string的id，则保留原类型的id
   * sourceContext: { id: number, linkTo: string }
   */
  sourceContext: Record<string, any>
}

export interface Playlist {}

export interface RankTop {}

export interface RankList {}

export interface Word {
  start: number
  end: number
  word: string
}

export interface Lyrics {
  lyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
  tlyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
  rlyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
}

export type LyricLine = {
  start: number
  end: number
  lyric: { text: string; info?: Word[] }
  tlyric?: { text: string; info?: Word[] }
  rlyric?: { text: string; info?: Word[] }
}

export interface Banner {}

export type service = {
  code: PluginId
  name: string
  type: 'online' | 'stream' | 'local'
  status: 'logout' | 'login' | 'offline'
  tracks: Track[]
  playlists: Playlist[]
  lastRefreshCookieDate?: number
  linkTo?: string // 仅本地音乐可用，音乐匹配的线上数据服务，如网易云、酷狗
  liked?: {
    likedSongPlaylistID: number
    songs: number[]
    songsWithDetails: Track[]
    playlists: Playlist[]
    albums: Album[]
    artists: Artist[]
    mvs: any[]
    cloudDisk: Track[]
    playHistory: {
      weekData: Track[]
      allData: Track[]
    }
  }
}

export type PluginAPI = {
  loginQrKey: {
    params: Record<string, any> | void
    result: { url: string }
  }

  loginQrCreate: {
    params: Record<string, any> | void
    result: any
  }

  loginQrCodeCheck: {
    params: Record<string, any> | void
    result: any
  }

  search: {
    params: Record<string, any> | void
    result: Track[]
  }

  getSongUrl: {
    params: Record<string, any> | void
    result: string
  }

  getLyric: {
    params: Record<string, any> | void
    result: LyricLine[]
  }

  getBanner: {
    params: Record<string, any> | void
    result: Banner[]
  }

  userPlaylist: {
    params: Record<string, any> | void
    result: Playlist[]
  }

  vipStatus: {
    params: Record<string, any> | void
    result: any
  }

  receiveVip: {
    params: Record<string, any> | void
    result: any
  }

  updateVip: {
    params: Record<string, any> | void
    result: any
  }

  getRecommendPlaylist: {
    params: Record<string, any> | void
    result: Playlist[]
  }

  getRecommendTracks: {
    params: Record<string, any> | void
    result: Track[]
  }

  personerFM: {
    params: Record<string, any> | void
    result: any
  }

  topSong: {
    params: Record<string, any> | void
    result: Track[]
  }

  topArtists: {
    params: Record<string, any> | void
    result: Artist[]
  }

  topAlbums: {
    params: Record<string, any> | void
    result: Album[]
  }

  rankTop: {
    params: Record<string, any> | void
    result: RankTop[]
  }

  rankList: {
    params: Record<string, any> | void
    result: RankList[]
  }

  registerDev: {
    params: Record<string, any> | void
    result: any
  }

  songUrl: {
    params: Record<string, any> | void
    result: any
  }
}

export type PluginMethodCall = <K extends keyof PluginAPI>(
  pluginId: PluginId,
  methodName: K,
  ...args: PluginAPI[K]['params'] extends void ? [] : [PluginAPI[K]['params']]
) => Promise<PluginAPI[K]['result']>
