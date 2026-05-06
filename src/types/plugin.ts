import { z } from 'zod'
import {
  AlbumSchema,
  ArtistSchema,
  BannerSchema,
  LoginQrCodeCheckResultSchema,
  LoginQrKeySchema,
  LyricLineSchema,
  PlaylistSchema,
  PlaylistDetailSchema,
  TrackSchema,
  UserSchema,
  WordSchema,
  PluginResultSchema,
  MusicTypeSchema,
  PlaylistCatlistSchema
} from './schemas'

export type MusicType = z.infer<typeof MusicTypeSchema>
export type Artist = z.infer<typeof ArtistSchema>
export type Album = z.infer<typeof AlbumSchema>
export type Track = z.infer<typeof TrackSchema>
export type User = z.infer<typeof UserSchema>
export type Playlist = z.infer<typeof PlaylistSchema>
export type PlaylistDetail = z.infer<typeof PlaylistDetailSchema>
export type Word = z.infer<typeof WordSchema>
export type LyricLine = z.infer<typeof LyricLineSchema>
export type Banner = z.infer<typeof BannerSchema>
export type LoginQrKeyResult = z.infer<typeof LoginQrKeySchema>
export type LoginQrCodeCheckResult = z.infer<typeof LoginQrCodeCheckResultSchema>
export type PlaylistCatlist = z.infer<typeof PlaylistCatlistSchema>

export type PluginId = string & { __brand: 'PluginId' }
export type sortType = 'name' | 'createTime' | 'playCount' | 'id'
export type orderType = 'ASC' | 'DESC'

export type service = {
  code: PluginId
  name: string
  active: boolean
  type: 'local' | 'online' | 'stream'
  status: 'logout' | 'login' | 'offline'
  options: { sort: sortType; order: orderType }
}

export interface Lyrics {
  lyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
  tlyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
  rlyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
}

export type PluginAPI = {
  [K in keyof typeof PluginResultSchema]: {
    params: Record<string, any> | void
    result: z.infer<(typeof PluginResultSchema)[K]>
  }
}

export const defaultMap: {
  [K in keyof PluginAPI]: PluginAPI[K]['result']
} = {
  search: { code: 404, data: [] },
  getSongUrl: { code: 404, data: '' },
  getLyric: { code: 404, data: [] },
  getBanner: { code: 404, data: [] },
  userPlaylist: { code: 404, data: [] },
  vipStatus: { code: 404 },
  receiveVip: { code: 404 },
  updateVip: { code: 404 },
  getRecommendPlaylist: { code: 404, data: [] },
  getRecommendTracks: { code: 404, data: [] },
  getPlaylistDetail: { code: 404, data: null },
  getPlaylistTracks: { code: 404, data: [] },
  personerFM: { code: 404 },
  topSong: { code: 404, data: [] },
  topArtists: { code: 404, data: [] },
  topAlbums: { code: 404, hasMore: false, albums: [] },
  rankTop: { code: 404, data: [] },
  rankList: { code: 404, data: [] },
  registerDev: { code: 404 },
  songUrl: { code: 404 },
  loginQrKey: { code: 404, data: { url: '', qrcode: '' } },
  loginQrCodeCheck: { code: 800 as const, message: '' },
  catlist: { code: 404, data: null },
  getCategoryPlaylist: { code: 404, hasMore: false, data: [], sourceContext: { id: 0, offset: 0 } }
}

export type PluginMethodCall = <K extends keyof PluginAPI>(
  pluginId: PluginId,
  methodName: K,
  ...args: PluginAPI[K]['params'] extends void ? [] : [PluginAPI[K]['params']]
) => Promise<PluginAPI[K]['result']>
