import { z } from 'zod'
import {
  AlbumSchema,
  AlbumDetailSchema,
  ArtistSchema,
  ArtistDetailSchema,
  BannerSchema,
  LoginQrCodeCheckResultSchema,
  LoginQrKeySchema,
  LyricLineSchema,
  PlaylistSchema,
  PlaylistDetailSchema,
  TrackSchema,
  MvSchema,
  MvDetailSchema,
  CommentSchema,
  UserSchema,
  WordSchema,
  PluginResultSchema,
  MusicTypeSchema,
  PlaylistCatlistSchema,
  CategorySchema,
  TrackCatlistSchema,
  ArtistCatlistSchema,
  CommentTabSchema,
  PluginId
} from './schemas'

export type MusicType = z.infer<typeof MusicTypeSchema>
export type Artist = z.infer<typeof ArtistSchema>
export type ArtistDetail = z.infer<typeof ArtistDetailSchema>
export type Album = z.infer<typeof AlbumSchema>
export type AlbumDetail = z.infer<typeof AlbumDetailSchema>
export type Track = z.infer<typeof TrackSchema>
export type Mv = z.infer<typeof MvSchema>
export type MvDetail = z.infer<typeof MvDetailSchema>
export type User = z.infer<typeof UserSchema>
export type Playlist = z.infer<typeof PlaylistSchema>
export type PlaylistDetail = z.infer<typeof PlaylistDetailSchema>
export type Word = z.infer<typeof WordSchema>
export type LyricLine = z.infer<typeof LyricLineSchema>
export type Banner = z.infer<typeof BannerSchema>
export type LoginQrKeyResult = z.infer<typeof LoginQrKeySchema>
export type LoginQrCodeCheckResult = z.infer<typeof LoginQrCodeCheckResultSchema>
export type PlaylistCatlist = z.infer<typeof PlaylistCatlistSchema>
export type CommentType = z.infer<typeof CommentSchema>
export type { PluginId }
export type sortType = 'name' | 'createTime' | 'playCount'
export type orderType = 'ASC' | 'DESC'
export type ArtistType = 'artists' | 'albumArtists'
export type CatType = z.infer<typeof CategorySchema>
export type TrackCatlist = z.infer<typeof TrackCatlistSchema>
export type ArtistCatlist = z.infer<typeof ArtistCatlistSchema>
export type CommentTab = z.infer<typeof CommentTabSchema>

export type service = {
  code: PluginId
  name: string
  active: boolean
  loadFull: boolean
  type: 'local' | 'library' | 'stream'
  status: 'logout' | 'login' | 'offline'
}

export interface Lyrics {
  lyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
  tlyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
  rlyric: { start: number; end: number; content: string; contentInfo?: Word[] }[]
}

export const exploreTabList = ['playlist', 'artist', 'chart', 'newTrack', 'newAlbum'] as const
export const searchTabList = ['tracks', 'albums', 'artists', 'playlists', 'mvs', 'lyrics'] as const

export type ExploreTab = (typeof exploreTabList)[number]
export type SearchTab = (typeof searchTabList)[number]

export type PluginAPI = {
  [K in keyof typeof PluginResultSchema]: {
    params: Record<string, any> | void
    result: z.infer<(typeof PluginResultSchema)[K]>
  }
}

export const defaultMap: {
  [K in keyof PluginAPI]: PluginAPI[K]['result']
} = {
  updateBaseUrl: { code: 404 },
  getAccount: { code: 404, baseUrl: '', userName: '', pwd: '' },
  search: { code: 404, data: [], count: 0, sourceContext: {} },
  getSongUrl: { code: 404, data: '' },
  getLyric: { code: 404, data: [] },
  getBanner: { code: 404, data: [] },
  userPlaylist: { code: 404, liked: null, playlists: [], albums: [], sourceContext: {} },
  vipStatus: { code: 404 },
  receiveVip: { code: 404 },
  updateVip: { code: 404 },
  getRecommendPlaylist: { code: 404, data: [] },
  getRecommendTracks: { code: 404, data: [], sourceContext: {} },
  getPlaylistDetail: { code: 404, data: null },
  getPlaylistTracks: { code: 404, data: [], sourceContext: {} },
  personerFM: { code: 404 },
  topSong: { code: 404, data: [], sourceContext: {} },
  topArtists: { code: 404, data: [], sourceContext: {} },
  artistsList: { code: 404, data: [], sourceContext: {} },
  topAlbums: { code: 404, hasMore: false, albums: [], sourceContext: {} },
  rankTop: { code: 404, data: [] },
  rankList: { code: 404, data: [], sourceContext: {} },
  songUrl: { code: 404, data: { url: [], replayGain: -14, peak: 1 } },
  loginQrKey: { code: 404, data: { url: '', qrcode: '' } },
  loginQrCodeCheck: { code: 800 as const, message: '' },
  catlist: { code: 404, data: null },
  getCategoryPlaylist: { code: 404, data: [], sourceContext: { id: 0, offset: 0 } },
  systemPing: { code: 404, status: 'logout' },
  likelist: { code: 404, data: [], sourceContext: {} },
  // userLikedAlbums: { code: 404, data: [], sourceContext: {} },
  userLikedArtists: { code: 404, data: [], sourceContext: {} },
  userLikedMVs: { code: 404, data: [], sourceContext: {} },
  cloudDisk: { code: 404, data: [], sourceContext: {} },
  resizePicUrl: { code: 404, data: '' },
  albumDetail: { code: 404, data: null },
  artistAlbums: { code: 404, data: [], sourceContext: {} },
  artistDetail: { code: 404, artist: null, songs: [], sourceContext: {} },
  artistMVs: { code: 404, data: [], sourceContext: {} },
  // artistTracks: { code: 404, data: [], sourceContext: {} },
  simiArtists: { code: 404, data: [], sourceContext: {} },
  getTrackDetail: { code: 404, data: [] },
  likeATrack: { code: 404 },
  addOrRemoveTracksToPlaylist: { code: 404 },
  createPlaylist: { code: 404 },
  deletePlaylist: { code: 404 },
  subscribePlaylist: { code: 404 },
  followArtist: { code: 404 },
  subscribeAlbum: { code: 404 },
  getTrackCatlist: { code: 404, data: [] },
  getAlbumCatlist: { code: 404, data: [] },
  newAlbums: { code: 404, data: [], sourceContext: {} },
  getArtistCatlist: { code: 404, data: [] },
  doLogin: { code: 404, message: '' },
  doLogout: { code: 404 },
  getAllTracks: { code: 404, data: [], count: 0, sourceContext: {} },
  scrobble: { code: 404 },
  mvDetail: { code: 404, data: null },
  subAMV: { code: 404 },
  likeAMV: { code: 404 },
  getCommentTab: { code: 404, data: [] },
  getComments: { code: 404, data: [], count: 0, sourceContext: {} },
  likeAComment: { code: 404 },
  submitAComment: { code: 404, data: null },
  getFloorComments: { code: 404, data: [], count: 0, sourceContext: {} }
}

export type PluginMethodCall = <K extends keyof PluginAPI>(
  pluginId: PluginId,
  methodName: K,
  ...args: PluginAPI[K]['params'] extends void ? [] : [PluginAPI[K]['params']]
) => Promise<PluginAPI[K]['result']>

export type Tool = {
  groundBy: 'all' | PluginId
  sortBy: sortType
  orderBy: orderType
  artistBy: ArtistType
}

export type LoginType = 'Username' | 'Phone' | 'Email' | 'QrCode' | 'Cookie'
