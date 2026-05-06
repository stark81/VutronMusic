import { z } from 'zod'

// type TrackRights = {
//   canPlay: boolean
//   canDownload: boolean

//   requiresVip?: boolean
//   isPreview?: boolean
//   maxBitrate?: number

//   reason?: string
// }

/**
 * - 本地文件
 * - 公共平台
 * - 私有媒体库
 */
export const MusicTypeSchema = z.enum(['local', 'online', 'stream'])

export const ArtistSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  picUrl: z.string(),
  pluginId: z.string().optional()
})

export const AlbumSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  picUrl: z.string(),
  pluginId: z.string().optional()
})

export const TrackSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  picUrl: z.string(),
  duration: z.number(),
  alias: z.array(z.string()),
  createTime: z.number(),
  album: AlbumSchema,
  no: z.number(),
  artists: z.array(ArtistSchema),
  pluginId: z.string(),
  playable: z.boolean(),
  reason: z.string(),
  type: MusicTypeSchema,
  /**
   * - 用于保存各自插件音源的特殊数据，渲染进程把sourceContext作为参数完整传递回插件，由各个插件自主使用里面的参数来完成各自的功能
   * - 例如：酷狗的sourceContext里可以保存歌曲hash，用来获取歌曲链接和歌词等数据；emby的sourceContext里可以保存歌曲的lrcId，用来获取歌词等数据
   * - 该字段的设计初衷是为了确保各个插件的特殊数据能够完整地传递和使用，而不需要担心在渲染进程中丢失或被篡改，同时也避免了在Track对象上添加过多与特定插件相关的字段，从而保持了Track对象的通用性和简洁性
   */
  sourceContext: z.record(z.string(), z.any())
})

export const UserSchema = z
  .object({
    userId: z.number().or(z.string()),
    avatarUrl: z.string(),
    nickname: z.string()
  })
  .catchall(z.any())

const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  parentId: z.number()
})

const StaticCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  active: z.boolean()
})

export const PlaylistCatlistSchema = z.object({
  static: z.array(StaticCategorySchema),
  tagList: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      sub: z.array(CategorySchema)
    })
  )
})

export const PlaylistSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  picUrl: z.string(),
  playCount: z.number(),
  copywriter: z.string(),
  pluginId: z.string(),
  tracks: z.array(z.object({ name: z.string(), artist: z.string() })).optional(),
  sourceContext: z.record(z.string(), z.any())
})

export const PlaylistDetailSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  subscribed: z.boolean(),
  picUrl: z.string(),
  trackIds: z.array(z.number().or(z.string())),
  trackCount: z.number(),
  updateTime: z.number(),
  description: z.string(),
  isPrivate: z.boolean(),
  pluginId: z.string(),
  tracks: z.array(TrackSchema),
  copywriter: z.string().or(z.null()),
  updateFrequency: z.string().or(z.null()),
  creator: UserSchema,
  tags: z.array(z.string()),
  sourceContext: z
    .object({
      id: z.string().or(z.number()),
      trackIds: z.array(z.number().or(z.string())),
      loadedIDs: z.array(z.number().or(z.string()))
    })
    .catchall(z.any())
})

export const WordSchema = z.object({
  start: z.number(),
  end: z.number(),
  word: z.string()
})

export const LyricLineSchema = z.object({
  start: z.number(),
  end: z.number(),
  lyric: z.object({ text: z.string(), info: z.array(WordSchema).optional() }),
  tlyric: z.object({ text: z.string(), info: z.array(WordSchema).optional() }).optional(),
  rlyric: z.object({ text: z.string(), info: z.array(WordSchema).optional() }).optional()
})

export const BannerSchema = z.object({
  id: z.string().or(z.number()),
  picUrl: z.string(),
  url: z.string(),
  sourceId: z.string().or(z.number()),
  type: z.enum(['track', 'album', 'playlist', 'mv', 'activity']),
  typeTitle: z.string()
})

export const LoginQrKeySchema = z.object({
  code: z.number(),
  data: z.object({ url: z.string(), qrcode: z.string() })
})

const UserResultSchema = z.object({
  userId: z.string().or(z.number()),
  avatarUrl: z.string(),
  nickname: z.string(),
  vipType: z.number(),
  signature: z.string()
})

export const LoginQrCodeCheckResultSchema = z.object({
  code: z.union([z.literal(800), z.literal(801), z.literal(802), z.literal(803)]),
  message: z.string(),
  user: UserResultSchema.optional()
})

export const PluginResultSchema = {
  loginQrKey: LoginQrKeySchema,
  loginQrCodeCheck: LoginQrCodeCheckResultSchema,
  search: z.object({ code: z.number(), data: z.array(TrackSchema) }),
  getSongUrl: z.object({ code: z.number(), data: z.string() }),
  getLyric: z.object({ code: z.number(), data: z.array(LyricLineSchema) }),
  getBanner: z.object({ code: z.number(), data: z.array(BannerSchema) }),
  userPlaylist: z.object({ code: z.number(), data: z.array(PlaylistSchema) }),
  getPlaylistDetail: z.object({ code: z.number(), data: PlaylistDetailSchema.or(z.null()) }),
  getPlaylistTracks: z.object({ code: z.number(), data: z.array(TrackSchema) }),
  vipStatus: z.object({ code: z.number() }),
  receiveVip: z.object({ code: z.number() }),
  updateVip: z.object({ code: z.number() }),
  getRecommendPlaylist: z.object({ code: z.number(), data: z.array(PlaylistSchema) }),
  getRecommendTracks: z.object({ code: z.number(), data: z.array(TrackSchema) }),
  personerFM: z.object({ code: z.number() }),
  topSong: z.object({ code: z.number(), data: z.array(TrackSchema) }),
  topArtists: z.object({ code: z.number(), data: z.array(ArtistSchema) }),
  topAlbums: z.object({
    code: z.number(),
    hasMore: z.boolean(),
    albums: z.array(AlbumSchema)
  }),
  rankTop: z.object({ code: z.number(), data: z.array(PlaylistSchema) }),
  rankList: z.object({ code: z.number(), data: z.array(PlaylistSchema) }),
  registerDev: z.object({ code: z.number() }),
  songUrl: z.object({ code: z.number() }),
  catlist: z.object({ code: z.number(), data: PlaylistCatlistSchema.or(z.null()) }),
  getCategoryPlaylist: z.object({
    code: z.number(),
    hasMore: z.boolean(),
    data: z.array(PlaylistSchema),
    sourceContext: z.object({ id: z.string().or(z.number()), offset: z.number() })
  })
} as const
