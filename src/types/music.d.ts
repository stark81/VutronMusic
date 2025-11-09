export type TrackType = 'online' | 'local' | 'stream'

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
