export type TrackType = 'online' | 'local' | 'stream'

export interface TongrenluRecord {
  cloudMusicId: number
  cloudMusicName: string
  cloudMusicPicUrl: string
  [key: string]: any
}

export interface TongrenluResponse {
  records: TongrenluRecord[]
  total: number
  current: number
  pages: number
  [key: string]: any
}

export interface Artist {
  id: number
  name: string
  picUrl: string
  matched: boolean
  [key: string]: any
}

export interface Album {
  id: number
  name: string
  picUrl: string
  matched: boolean
  artist?: Artist
  [key: string]: any
}

export interface scanTrack {
  id: number
  name: string
  dt: number
  filePath: string
  type?: TrackType
  matched?: boolean
  offset?: number
  md5?: string
  createTime: number
  alias: string[]
  album: string
  artists: string[]
  albumArtist: string[]
  source?: string
  size?: number
  gain: number
  peak: number
  picUrl: string
}

export interface Track {
  id: number
  name: string
  dt: number
  filePath: string
  type?: TrackType
  matched?: boolean
  offset?: number
  md5?: string
  createTime: number
  alias: string[]
  album: Album
  artists: Artist[]
  albumArtist: Artist[]
  picUrl: string
  source?: string
  size?: number
  gain: number
  peak: number
  [key: string]: any
}

export interface Playlist {
  id: number
  name: string
  description: string
  coverImgUrl: string
  updateTime: number
  trackCount: number
  trackIds: number[]
  creator?: any
}

export interface StreamPlaylist extends Omit<Playlist, 'id'> {
  id: string
  trackItemIds: Record<number, number>
}

export type serviceName = 'navidrome' | 'jellyfin' | 'emby'
export type streamStatus = 'logout' | 'login' | 'offline'

export type serviceType = {
  name: serviceName
  status: streamStatus
}

export interface word {
  start: number
  end: number
  word: string
}

export interface lyrics {
  lyric: { start: number; end: number; content: string; contentInfo?: word[] }[]
  tlyric: { start: number; end: number; content: string; contentInfo?: word[] }[]
  rlyric: { start: number; end: number; content: string; contentInfo?: word[] }[]
}

export type lyricLine = {
  start: number
  end: number
  lyric: { text: string; info?: word[] }
  tlyric?: { text: string; info?: word[] }
  rlyric?: { text: string; info?: word[] }
}

export type Type = 'small' | 'normal'
export type Mode = 'oneLine' | 'twoLines'
export type TranslationMode = 'none' | 'tlyric' | 'rlyric'
export type TrackInfoOrder = 'path' | 'online' | 'embedded'

export type TrackSourceType = 'online' | 'local' | 'navidrome' | 'emby' | 'jellyfin'

export enum ProxyType {
  Disable = 0,
  Http = 1,
  Https = 2
}

export interface MiscSettings {
  enableAmuseServer: boolean
}

type CommonName = '默认' | '旋转封面' | '信笺歌词' | '歌词环游'
type LyricType = 'common' | 'creative' | 'customize'
type LyricLayer = 'Normal' | 'Creative'
export type Appearance = 'auto' | 'light' | 'dark'

export interface CommonTheme {
  name: CommonName
  selected: boolean
  type: LyricType
  layer: LyricLayer
  senseInfo: {
    index: number
    font: string
    appearance: Appearance
    background?: string
    lyricPosition?: { top: string; left: string }
  }
  proxy: {
    type: ProxyType
    address: string
    port: string
  }
  realIp: { enable: boolean; ip: string }
}
