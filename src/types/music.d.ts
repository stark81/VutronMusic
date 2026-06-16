import { PluginId } from './plugin'

export type TrackType = 'online' | 'local' | 'stream'

export interface Artist {
  id: string
  pluginId: string
  name: string
  picUrl: string
  description: string
  followed: boolean
  updatedAt: number
}

export interface Album {
  id: string
  pluginId: string
  name: string
  picUrl: string
  type: string
  company: string
  description: string
  subscribed: boolean
  isExplicit: boolean

  createTime: number
  updatedAt: number
}

export interface scanTrack {
  name: string
  duration: number
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

// 数据库的Track类型，和渲染进程的类型不一致
export interface Track {
  id: string
  pluginId: string
  name: string
  duration: number
  picUrl: string
  no: number
  alias: string
  mvid: string
  albumId: string

  filePath: string
  md5: string
  playCount: number
  bitrate: string
  gain: number
  peak: number
  offset: number

  type: TrackType
  deleted: boolean
  size: number

  createTime: number
  updatedAt: number
}

// export interface Playlist {
//   id: number
//   name: string
//   description: string
//   coverImgUrl: string
//   updateTime: number
//   trackCount: number
//   trackIds: number[]
//   creator?: any
// }

// Playlist/PlaylistEntry 数据库行类型
export interface PlaylistRow {
  id: string
  pluginId: string
  name: string
  picUrl: string
  description: string
  createTime: number
  updateTime: number
}

export interface PlaylistEntryRow {
  id: number
  playlistId: string
  pluginId: string
  sourceContext: string
  position: number
  createTime: number
}

// export interface StreamPlaylist extends Omit<Playlist, 'id'> {
//   id: string
//   trackItemIds: Record<number, number>
// }

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

export type RepeatMode = 'off' | 'on' | 'one'

export type CoverType = 'Playlist' | 'Album' | 'Artist' | 'User'

export type SourceType =
  | 'Playlist'
  | 'Album'
  | 'Artist'
  | 'Track'
  | 'LocalTrack'
  | 'TrackList'
  | 'DailySongs'
  | 'ExploreTrack'
  | 'SearchTrack'
  | 'History'
  | 'CloudDisk'

export type PlaylistSourceInfo = {
  type: SourceType
  plugin: PluginId | 'all'
  sourceContext: Record<string, any>
}
