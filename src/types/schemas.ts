import { z } from 'zod'

/**
 * - 本地文件
 * - 公共平台
 * - 私有媒体库
 */
export const MusicTypeSchema = z.enum(['local', 'library', 'stream'])
export type PluginId = string & { __brand: 'PluginId' }
const asPluginId = (str: string): PluginId => str as PluginId

/** 搜索框中选择"流媒体"时的虚拟插件 ID */
export const STREAM_SENTINEL = asPluginId('__stream__')

export type CommentContentType = 'track' | 'album' | 'playlist' | 'mv'

export interface PluginCapabilities {
  matchTrack?: 'official' | 'search' | false
  getLyric?: boolean
  getComments?: boolean
  comment?: {
    read?: boolean
    like?: boolean
    submit?: boolean
    floor?: boolean
    types?: CommentContentType[]
  }
  mv?: {
    detail?: boolean
    like?: boolean
    subscribe?: boolean
  }
}

export const ArtistSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  picUrl: z.string(),
  pluginId: z.string().transform(asPluginId),
  copywriter: z.string().optional(),
  sourceContext: z.record(z.string(), z.any())
})

export const AlbumSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  picUrl: z.string(),
  type: z.enum(['专辑', 'EP', '单曲', 'liveCD', '精选集', '合集', '其他']).optional(),
  createTime: z.number().optional(),
  pluginId: z.string().transform(asPluginId),
  copywriter: z.string().optional(),
  artists: z.array(ArtistSchema).optional(),
  sourceContext: z.record(z.string(), z.any())
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
  albumArtists: z.array(ArtistSchema),
  mvid: z.string().or(z.number()),
  playCount: z.number(),
  pluginId: z.string().transform(asPluginId),
  playable: z.boolean(),
  reason: z.string(),
  type: MusicTypeSchema,

  // 本地音乐专用
  filePath: z.string().optional(),
  size: z.number().default(0),

  /**
   * 插件上下文。
   *
   * 保存插件后续操作所需的最小上下文信息。
   * 该对象由插件生成并维护，
   * 主程序只负责透传，不解析其内容。
   *
   * 例如：
   * - 网易云：songId
   * - 酷狗：hash、fileid、mixsongid
   * - Emby：itemId、mediaSourceId
   * - Jellyfin：itemId、userId
   */
  sourceContext: z.record(z.string(), z.any())
})

export const ArtistDetailSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  picUrl: z.string(),
  musicSize: z.number(),
  albumSize: z.number(),
  mvSize: z.number(),
  description: z.string(),
  followed: z.boolean(),

  pluginId: z.string().transform(asPluginId),
  sourceContext: z.record(z.string(), z.any())
})

export const AlbumDetailSchema = z.object({
  id: z.string().or(z.number()),
  name: z.string(),
  picUrl: z.string(),
  artists: z.array(ArtistSchema),
  type: z.string(),
  isExplicit: z.boolean(),
  publishTime: z.number(),
  songs: z.array(TrackSchema),
  size: z.number(),
  company: z.string(),
  subscribed: z.boolean(),
  description: z.string(),

  pluginId: z.string().transform(asPluginId),
  /**
   * 保存插件继续执行后续操作所需的上下文
   * - 如：专辑id，专辑歌曲分页的相关信息
   */
  sourceContext: z.record(z.string(), z.any())
})

export const MvSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  picUrl: z.string(),
  publishTime: z.number(),
  pluginId: z.string().transform(asPluginId),
  artists: z.array(ArtistSchema),
  sourceContext: z.record(z.string(), z.any())
})

export const MvDetailSchema = z.object({
  id: z.number().or(z.string()),
  name: z.string(),
  desc: z.string(),
  publishTime: z.number(),
  playCount: z.number(),

  subCount: z.number(),
  subed: z.boolean(),
  likedCount: z.number(),
  liked: z.boolean(),

  picUrl: z.string(),
  sources: z.array(z.object({ url: z.string(), quality: z.string(), type: z.string() })),

  pluginId: z.string().transform(asPluginId),
  artists: z.array(ArtistSchema),
  sourceContext: z.record(z.string(), z.any())
})

export const CommentSchema = z.object({
  id: z.string().or(z.number()),
  content: z.string(),
  time: z.number(),
  ipLocation: z.string(),
  owner: z.boolean(),
  liked: z.boolean(),
  likedCount: z.number(),
  replyCount: z.number(),
  parentCommentId: z.string().or(z.number()),
  beReplied: z
    .object({
      id: z.string().or(z.number()),
      beRepliedCommentId: z.string().or(z.number()),
      content: z.string(),
      nickname: z.string()
    })
    .or(z.null()),
  user: z.object({
    id: z.string().or(z.number()),
    nickname: z.string(),
    avatarUrl: z.string()
  }),
  sourceContext: z.record(z.string(), z.any())
})

export const UserSchema = z
  .object({
    userId: z.number().or(z.string()),
    avatarUrl: z.string(),
    nickname: z.string(),
    isVip: z.boolean(),
    signature: z.string(),
    sourceContext: z.record(z.string(), z.any()).optional()
  })
  .catchall(z.any())

export const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  parentId: z.number(),
  sourceContext: z.record(z.string(), z.any())
})

const StaticCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  sourceContext: z.record(z.string(), z.any())
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
  isMine: z.boolean(),
  trackCount: z.number(),
  isPrivate: z.boolean(),
  pluginId: z.string().transform(asPluginId),
  creator: UserSchema,
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
  pluginId: z.string().transform(asPluginId),
  tracks: z.array(TrackSchema),
  copywriter: z.string().or(z.null()),
  updateFrequency: z.string().or(z.null()),
  creator: UserSchema,
  specialPlaylistInfo: z.object({ name: z.string(), gradient: z.string() }).or(z.null()),
  tags: z.array(z.string()),
  /**
   * 保存插件继续执行后续操作所需的上下文
   * - 如：歌单id，歌单歌曲分页的相关信息
   */
  sourceContext: z.record(z.string(), z.any())
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
  typeTitle: z.string(),
  pluginId: z.string().transform(asPluginId),
  sourceContext: z.record(z.string(), z.any())
})

export const LoginQrKeySchema = z.object({
  code: z.number(),
  data: z.object({ url: z.string(), qrcode: z.string() })
})

const UserResultSchema = z.object({
  userId: z.string().or(z.number()),
  avatarUrl: z.string(),
  nickname: z.string(),
  isVip: z.boolean(),
  signature: z.string()
})

export const LoginQrCodeCheckResultSchema = z.object({
  code: z.union([z.literal(800), z.literal(801), z.literal(802), z.literal(803)]),
  message: z.string(),
  user: UserResultSchema.optional()
})

export const TrackCatlistSchema = z.object({
  name: z.string(),
  code: z.number().or(z.string()),
  sourceContext: z.record(z.string(), z.any())
})

export const ArtistCatlistSchema = z.object({
  name: z.string(),
  code: z.number().or(z.string()),
  sub: z.array(TrackCatlistSchema)
})

export const CommentTabSchema = z.object({
  name: z.string(),
  code: z.string().or(z.number()),
  active: z.boolean()
})

export const PluginResultSchema = {
  updateBaseUrl: z.object({ code: z.number() }),
  getAccount: z.object({
    code: z.number(),
    baseUrl: z.string(),
    userName: z.string(),
    pwd: z.string()
  }),
  loginQrKey: LoginQrKeySchema,
  loginQrCodeCheck: LoginQrCodeCheckResultSchema,
  doLogin: z.object({
    code: z.number(),
    data: z
      .object({
        userId: z.string().or(z.number()),
        avatarUrl: z.string(),
        nickname: z.string(),
        isVip: z.boolean(),
        signature: z.string(),
        scanDir: z.array(z.string()).optional()
      })
      .optional(),
    message: z.string().optional()
  }),
  doLogout: z.object({ code: z.number() }),
  getLyric: z.object({ code: z.number(), data: z.array(LyricLineSchema) }),
  getBanner: z.object({ code: z.number(), data: z.array(BannerSchema) }),
  userPlaylist: z.object({
    code: z.number(),
    liked: PlaylistSchema.or(z.null()),
    playlists: z.array(PlaylistSchema),
    albums: z.array(AlbumSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  getPlaylistDetail: z.object({ code: z.number(), data: PlaylistDetailSchema.or(z.null()) }),
  getPlaylistTracks: z.object({
    code: z.number(),
    data: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  getRecommendPlaylist: z.object({ code: z.number(), data: z.array(PlaylistSchema) }),
  getRecommendTracks: z.object({
    code: z.number(),
    data: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  personalFM: z.object({
    code: z.number(),
    data: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  fmTrash: z.object({ code: z.number() }),
  topSong: z.object({
    code: z.number(),
    data: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  topArtists: z.object({
    code: z.number(),
    data: z.array(ArtistSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  artistsList: z.object({
    code: z.number(),
    data: z.array(ArtistSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  topAlbums: z.object({
    code: z.number(),
    hasMore: z.boolean(),
    albums: z.array(AlbumSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  rankTop: z.object({ code: z.number(), data: z.array(PlaylistSchema) }),
  rankList: z.object({
    code: z.number(),
    data: z.array(PlaylistSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  songUrl: z.object({
    code: z.number(),
    data: z.object({
      url: z.array(z.string()),
      replayGain: z.number(),
      peak: z.number(),
      cueOffset: z.number().optional(),
      cueDuration: z.number().optional()
    })
  }),
  catlist: z.object({ code: z.number(), data: PlaylistCatlistSchema.or(z.null()) }),
  getCategoryPlaylist: z.object({
    code: z.number(),
    data: z.array(PlaylistSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  systemPing: z.object({
    code: z.number(),
    status: z.enum(['logout', 'login', 'offline']),
    scanDir: z.array(z.string()).optional()
  }),
  likelist: z.object({
    code: z.number(),
    data: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  userLikedArtists: z.object({
    code: z.number(),
    data: z.array(ArtistSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  userLikedMVs: z.object({
    code: z.number(),
    data: z.array(MvSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  cloudDisk: z.object({
    code: z.number(),
    data: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  userRecord: z.object({
    code: z.number(),
    weekData: z.array(TrackSchema),
    allData: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  resizePicUrl: z.object({
    code: z.number(),
    data: z.string()
  }),
  albumDetail: z.object({ code: z.number(), data: AlbumDetailSchema.or(z.null()) }),
  artistAlbums: z.object({
    code: z.number(),
    data: z.array(AlbumSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  artistDetail: z.object({
    code: z.number(),
    artist: ArtistDetailSchema.or(z.null()),
    songs: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  artistMVs: z.object({
    code: z.number(),
    data: z.array(MvSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  simiArtists: z.object({
    code: z.number(),
    data: z.array(ArtistSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  getTrackDetail: z.object({
    code: z.number(),
    data: z.array(TrackSchema)
  }),
  likeATrack: z.object({ code: z.number() }),
  addOrRemoveTracksToPlaylist: z.object({ code: z.number() }),
  reorderPlaylistTracks: z.object({ code: z.number() }),
  createPlaylist: z.object({ code: z.number(), data: PlaylistSchema.optional() }),
  editPlaylist: z.object({ code: z.number() }),
  deletePlaylist: z.object({ code: z.number() }),
  subscribePlaylist: z.object({ code: z.number() }),
  followArtist: z.object({ code: z.number() }),
  subscribeAlbum: z.object({ code: z.number() }),
  getTrackCatlist: z.object({ code: z.number(), data: z.array(TrackCatlistSchema) }),
  getAlbumCatlist: z.object({ code: z.number(), data: z.array(TrackCatlistSchema) }),
  newAlbums: z.object({
    code: z.number(),
    data: z.array(AlbumSchema),
    sourceContext: z.record(z.string(), z.any())
  }),
  getArtistCatlist: z.object({
    code: z.number(),
    data: z.array(ArtistCatlistSchema)
  }),
  getAllTracks: z.object({
    code: z.number(),
    data: z.array(TrackSchema),
    count: z.number(),
    sourceContext: z.record(z.string(), z.any())
  }),
  scrobble: z.object({
    code: z.number()
  }),
  search: z.object({
    code: z.number(),
    data: z.array(TrackSchema.or(AlbumSchema).or(ArtistSchema).or(PlaylistSchema).or(MvSchema)),
    count: z.number(),
    sourceContext: z.record(z.string(), z.any())
  }),
  mvDetail: z.object({
    code: z.number(),
    data: MvDetailSchema.or(z.null())
  }),
  subAMV: z.object({
    code: z.number()
  }),
  likeAMV: z.object({
    code: z.number()
  }),
  getCommentTab: z.object({
    code: z.number(),
    data: z.array(CommentTabSchema)
  }),
  getComments: z.object({
    code: z.number(),
    data: z.array(CommentSchema),
    count: z.number(),
    sourceContext: z.record(z.string(), z.any())
  }),
  likeAComment: z.object({ code: z.number() }),
  submitAComment: z.object({ code: z.number(), data: CommentSchema.or(z.null()) }),
  getFloorComments: z.object({
    code: z.number(),
    data: z.array(CommentSchema),
    count: z.number(),
    sourceContext: z.record(z.string(), z.any())
  }),
  reportPlayback: z.object({
    code: z.number()
  }),
  matchTrack: z.object({
    code: z.number(),
    data: z
      .object({
        id: z.string().or(z.number()),
        name: z.string(),
        duration: z.number(),
        artists: z.array(z.object({ id: z.string().or(z.number()), name: z.string() })),
        album: z.object({ id: z.string().or(z.number()), name: z.string() }),
        sourceContext: z.record(z.string(), z.any()),
        confidence: z.number().optional()
      })
      .optional()
  })
} as const
