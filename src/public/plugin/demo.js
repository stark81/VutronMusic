/**
 * 插件规范：
 * - 禁止 export / import / require，写了也会在***运行时***报错
 * - 只能通过 exports.xxx = fn 或者 exports.xxx = { xxx } 来导出给外部使用；
 * - 插件需要提供的内容如下，可复制后进行相对应的修改，其中的函数允许修改传参等；
 * - 插件内部只允许使用
 *   - apis.http.get/post/delete 发送网络请求；
 *   - apis.log.info/error 来把一些重要信息保存到本地的log文件中；
 *   - apis.store.get/set 从electron-store中获取/设置，建议用来保存一些类似于插件服务的域名等信息；
 *   - apis.db.get/set 建议用来保存帐号 + 业务核心数据，如 token、cookie 信息等；
 *   - apis.utils.parseLyric/md5/generateSalt/generateToken 等工具函数；
 *   - apis.utils.getEmbeddedLyric/getPathLyric 读取嵌入式歌词和 lrc 文件
 */

/**
 * =======================================================================================
 *                             插件 api 定义。插件内部能使用的权限暂定如下
 * =======================================================================================
 */

/**
 * @typedef {Object} PluginHttp
 * @property {(url: string, params?: object, headers?: object, raw?: boolean) => Promise<any>} get
 * @property {(url: string, data?: object, headers?: object, raw?: boolean) => Promise<any>} post
 * @property {(url: string, data?: object, headers?: object, raw?: boolean) => Promise<any>} delete
 */

/**
 * @typedef {Object} PluginLog
 * @property {(msg: string) => void} info
 * @property {(msg: string) => void} error
 */

/**
 * @typedef {Object} PluginStore
 * @property {(key: string) => Promise<any>} get — key 为 '' 时表示获取整个插件的 store 数据
 * @property {(key: string, value: any) => void} set
 */

/**
 * @typedef {Object} PluginDb
 * @property {(key: 'PluginData' | 'Track' | 'Album' | 'Artist', filter?: { ids?: string[] }) => Promise<any>} get — 第二个可选参数 filter.ids 可按 ID 列表精确查询 Track
 * @property {(key: 'PluginData' | 'Track' | 'Album' | 'Artist', value: any) => void} set
 */

/**
 * @typedef {Object} PluginUtils
 * @property {(msg: string) => Promise<LyricLine[]>} parseLyric
 * @property {(input: string) => string} md5
 * @property {() => string} generateSalt
 * @property {(password: string, salt: string) => string} generateToken
 * @property {(filePath: string) => Promise<LyricLine[]>} getEmbeddedLyric
 * @property {(filePath: string) => Promise<LyricLine[]>} getPathLyric
 */

/**
 * @typedef {Object} PluginApi
 * @property {PluginHttp} http
 * @property {PluginLog} log
 * @property {PluginStore} store
 * @property {PluginDb} db
 * @property {PluginUtils} utils
 */

/**
 * =======================================================================================
 *                                     返回结果类型定义
 * =======================================================================================
 */

/**
 * @typedef {Object} Word
 * @property {string} text
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} LyricLine
 * @property {number} start
 * @property {number} end
 * @property {{ text: string, info?: Word[] }} lyric
 * @property {{ text: string, info?: Word[] }} [tlyric]
 * @property {{ text: string, info?: Word[] }} [rlyric]
 */

/**
 * @typedef {Object} Banner
 * @property {string} id
 * @property {string} picUrl
 * @property {string} url
 * @property {string} sourceId
 * @property {'track' | 'album' | 'playlist' | 'mv' | 'activity'} type
 * @property {string} typeTitle
 * @property {string} pluginId
 */

/**
 * @typedef {Object} Album
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {string} pluginId
 * @property {string=} copywriter
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} Artist
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {string} pluginId
 * @property {string=} copywriter
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} Track
 * @property {string} id
 * @property {string} name
 * @property {number} duration
 * @property {string[]} alias
 * @property {number} createTime
 * @property {Album} album
 * @property {number} no
 * @property {Artist[]} artists
 * @property {Artist[]} albumArtists
 * @property {string} picUrl
 * @property {string} pluginId
 * @property {'local' | 'library' | 'stream'} type
 * @property {boolean} playable
 * @property {string} reason
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} Playlist
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {number} playCount
 * @property {string} pluginId
 * @property {string} copywriter
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} PlaylistDetail
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {boolean} subscribed
 * @property {number} trackCount
 * @property {number} updateTime
 * @property {string} description
 * @property {boolean} isPrivate
 * @property {number[]} trackIds
 * @property {Track[]} tracks
 * @property {string} pluginId
 * @property {string} copywriter
 * @property {string | null} updateFrequency
 * @property {Object} creator
 * @property {string[]} tags
 * @property {{ id: number, trackIds: number[], loadedIDs: number[] }} sourceContext
 */

/**
 * @typedef {Object} MvDetail
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {number} duration
 * @property {Artist[]} artists
 * @property {string} publishTime
 * @property {string} pluginId
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} Mv
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {number} duration
 * @property {Artist[]} artists
 * @property {string} pluginId
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} CommentTab
 * @property {string} name — 排序名称，如 "推荐"、"最新"
 */

/**
 * @typedef {Object} CommentUser
 * @property {string} userId
 * @property {string} nickname
 * @property {string} avatarUrl
 */

/**
 * @typedef {Object} Comment
 * @property {string} id
 * @property {string} content
 * @property {number} time
 * @property {number} likedCount
 * @property {boolean} liked
 * @property {boolean} owner
 * @property {number} replyCount
 * @property {string=} ipLocation
 * @property {CommentUser} user
 * @property {Object=} beReplied
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} ArtistCatlist
 * @property {string} name
 * @property {string} category
 * @property {number} hot
 * @property {number} type
 * @property {Object[]} sub
 */

/**
 * @typedef {Object} TrackCatlist
 * @property {string} name
 * @property {string} category
 * @property {number} hot
 * @property {number} type
 * @property {number} resourceCount
 * @property {Object[]} sub
 */

/**
 * @typedef {Object} PlaylistCatlist
 * @property {string} name
 * @property {number} type
 * @property {Object[]} sub
 */

/**
 * @typedef {Object} UserResult
 * @property {string} userId
 * @property {string} avatarUrl
 * @property {string} nickname
 * @property {boolean} isVip
 * @property {string} signature
 */

/**
 * 由宿主注入的 API（仅用于类型提示）
 * @type {PluginApi}
 */
/* eslint-disable no-undef */
const apis = api

/**
 * =======================================================================================
 *                          插件元信息 — 必须提供
 * =======================================================================================
 * - meta.name: 中英文均可，用来表示这个插件的数据来源；
 * - meta.type: 插件类型
 *   - 'library':  线上音源（网易云/酷狗等），拥有完整的音乐库
 *   - 'stream':   自建流媒体服务（Emby/Jellyfin/Navidrome 等）
 *   - 'local':    本地音乐
 * - meta.capabilities: 插件能力声明（选填）
 *   - matchTrack: 是否支持歌曲匹配，'official' = 官方匹配 / 'search' = 搜索匹配 / false = 不支持
 *   - getLyric:   是否提供歌词
 *   - getComments: 是否提供评论（向后兼容）
 *   - comment:    评论细粒度能力
 *     - read:     是否可读取评论
 *     - like:     是否可点赞评论
 *     - submit:   是否可发送/删除评论
 *     - floor:    是否可读取楼层评论
 *     - types:    支持评论的内容类型 ['track', 'album', 'playlist', 'mv']
 *   - mv:         MV 相关能力
 *     - detail:   是否可获取 MV 详情
 *     - like:     是否可点赞 MV
 *     - subscribe: 是否可收藏 MV
 */
exports.meta = {
  name: '测试',
  icon: '',
  type: 'library', // 'library' | 'stream' | 'local'
  capabilities: {
    matchTrack: false,
    getLyric: false,
    getComments: false,
    comment: { read: false, like: false, submit: false, floor: false, types: [] },
    mv: { detail: false, like: false, subscribe: false }
  }
}

/**
 * =======================================================================================
 *                          以下是所有可能的导出函数。
 *                          新插件可复制此文件，根据实际情况实现/删除对应函数。
 *                          未实现的函数返回 { code: 404 }，框架会自动兜底处理。
 * =======================================================================================
 *
 * 函数命名约定（与 PluginResultSchema 的 key 一一对应）：
 *   账号类：   updateBaseUrl / getAccount / loginQrKey / loginQrCodeCheck / doLogin / doLogout
 *   歌曲类：   songUrl / getLyric / getTrackDetail / matchTrack
 *   歌单类：   userPlaylist / getPlaylistDetail / getPlaylistTracks
 *   专辑类：   albumDetail / artistAlbums / topAlbums / newAlbums
 *   艺人类：   artistDetail / artistMVs / simiArtists / topArtists / artistsList
 *   推荐类：   getRecommendPlaylist / getRecommendTracks
 *   评论类：   getCommentTab / getComments / likeAComment / submitAComment / getFloorComments
 *   搜索类：   search
 *   其他：     resizePicUrl / scrobble / systemPing / ...
 */

// ====================================================================
//  账号类
// ====================================================================

/**
 * 更新插件服务地址
 * @param {Object} params
 * @param {string} params.baseUrl
 * @returns {Promise<{ code: number }>}
 */
exports.updateBaseUrl = async (params) => {
  return { code: 404 }
}

/**
 * 获取已保存的账号信息
 * @returns {Promise<{ code: number, baseUrl: string, userName: string, pwd: string }>}
 */
exports.getAccount = async () => {
  return { code: 404, baseUrl: '', userName: '', pwd: '' }
}

/**
 * 获取二维码登录的 key / url
 * @returns {Promise<{ code: number, data: { url: string, qrcode: string } }>}
 */
exports.loginQrKey = async () => {
  return { code: 404, data: { url: '', qrcode: '' } }
}

/**
 * 轮询检查二维码登录状态
 * @param {Object} params
 * @returns {Promise<{ code: number, message?: string, user?: UserResult }>}
 */
exports.loginQrCodeCheck = async (params) => {
  return { code: 404, message: '未实现' }
}

/**
 * 执行登录（用户名密码 / token 等方式）
 * @param {Object} params
 * @returns {Promise<{ code: number, data?: UserResult, message?: string }>}
 */
exports.doLogin = async (params) => {
  return { code: 404 }
}

/**
 * 退出登录
 * @returns {Promise<{ code: number }>}
 */
exports.doLogout = async () => {
  return { code: 404 }
}

// ====================================================================
//  平台状态
// ====================================================================

/**
 * 平台连通性测试
 * @returns {Promise<{ code: number, status: 'logout' | 'login' | 'offline' }>}
 */
exports.systemPing = async () => {
  return { code: 200, status: 'logout' }
}

// ====================================================================
//  歌曲类
// ====================================================================

/**
 * 获取歌曲 URL（新签名，返回多个 url）
 * @param {Object} params
 * @returns {Promise<{ code: number, data: { url: string[], replayGain: number, peak: number } }>}
 */
exports.songUrl = async (params) => {
  return { code: 404, data: { url: [], replayGain: 0, peak: 0 } }
}

/**
 * 获取歌词
 * @param {Object} params
 * @returns {Promise<{ code: number, data: LyricLine[] }>}
 */
exports.getLyric = async (params) => {
  return { code: 404, data: [] }
}

/**
 * 获取歌曲详情
 * @param {Object} params
 * @param {{ tracks: { id: string }[] }} params.tracks
 * @returns {Promise<{ code: number, data: Track[] }>}
 */
exports.getTrackDetail = async (params) => {
  return { code: 404, data: [] }
}

/**
 * 歌曲匹配（用于本地/stream 歌曲匹配到本插件的线上资源）
 * @param {Object} params
 * @param {string} params.name
 * @param {string=} params.album
 * @param {string[]} params.artists
 * @param {number} params.duration — 单位 ms
 * @param {string=} params.md5
 * @returns {Promise<{ code: number, data?: { id, name, duration, artists, album, sourceContext, confidence? } }>}
 */
exports.matchTrack = async (params) => {
  return { code: 404 }
}

/**
 * 调整图片大小
 * @param {Object} params
 * @param {string} params.url
 * @param {number} params.size
 * @returns {Promise<{ code: number, data: string }>}
 */
exports.resizePicUrl = async (params) => {
  return { code: 404, data: '' }
}

/**
 * 歌曲红心/取消红心
 * @param {Object} params
 * @param {'add' | 'del'} params.op
 * @param {Object[]} params.tracks
 * @returns {Promise<{ code: number }>}
 */
exports.likeATrack = async (params) => {
  return { code: 404 }
}

/**
 * 获取收藏的歌曲列表
 * @returns {Promise<{ code: number, data: Track[], sourceContext: Record<string, any> }>}
 */
exports.likelist = async () => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 歌曲上报（Scrobble，用于 Last.fm 等记录播放历史）
 * @param {Object} params
 * @returns {Promise<{ code: number }>}
 */
exports.scrobble = async (params) => {
  return { code: 404 }
}

exports.reportPlayback = async () => {
  return { code: 200 }
}

/**
 * FM 模式（私人电台）
 * @returns {Promise<{ code: number }>}
 */
exports.personalFM = async () => {
  return { code: 404, data: [], sourceContext: {} }
}

// ====================================================================
//  歌单类
// ====================================================================

/**
 * 获取用户的歌单、收藏专辑、创建的歌单
 * @returns {Promise<{ code: number, liked: Playlist|null, playlists: Playlist[], albums: Album[], sourceContext: Record<string, any> }>}
 */
exports.userPlaylist = async () => {
  return { code: 404, liked: null, playlists: [], albums: [], sourceContext: {} }
}

/**
 * 获取歌单详情
 * @param {Object} params
 * @returns {Promise<{ code: number, data: PlaylistDetail|null }>}
 */
exports.getPlaylistDetail = async (params) => {
  return { code: 404, data: null }
}

/**
 * 获取歌单中的歌曲
 * @param {Object} params
 * @returns {Promise<{ code: number, data: Track[], sourceContext: Record<string, any> }>}
 */
exports.getPlaylistTracks = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 创建歌单
 * @param {Object} params
 * @param {string} params.name
 * @returns {Promise<{ code: number, data?: Playlist }>}
 */
exports.createPlaylist = async (params) => {
  return { code: 404 }
}

/**
 * 删除歌单
 * @param {Object} params
 * @returns {Promise<{ code: number }>}
 */
exports.deletePlaylist = async (params) => {
  return { code: 404 }
}

/**
 * 编辑歌单信息
 * @param {Object} params
 * @param {number|string} params.id
 * @param {string} params.name
 * @param {string} params.desc
 * @param {string} params.tags
 * @returns {Promise<{ code: number }>}
 */
exports.editPlaylist = async (_params) => {
  return { code: 404 }
}

/**
 * 收藏/取消收藏歌单
 * @param {Object} params
 * @param {number|string} params.id
 * @param {'sub' | 'unsub'} params.t
 * @returns {Promise<{ code: number }>}
 */
exports.subscribePlaylist = async (params) => {
  return { code: 404 }
}

/**
 * 歌单分类列表
 * @returns {Promise<{ code: number, data: PlaylistCatlist|null }>}
 */
exports.catlist = async () => {
  return { code: 404, data: null }
}

/**
 * 按分类获取歌单
 * @returns {Promise<{ code: number, data: Playlist[], sourceContext: Record<string, any> }>}
 */
exports.getCategoryPlaylist = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 获取所有歌曲（用于全量加载/同步）
 * @returns {Promise<{ code: number, data: Track[], count: number, sourceContext: Record<string, any> }>}
 */
exports.getAllTracks = async (params) => {
  return { code: 404, data: [], count: 0, sourceContext: {} }
}

/**
 * 向歌单中添加/移除歌曲
 * @param {Object} params
 * @param {'add' | 'del'} params.op
 * @param {Object} params.playlist
 * @param {Object[]} params.tracks
 * @returns {Promise<{ code: number }>}
 */
exports.addOrRemoveTracksToPlaylist = async (params) => {
  return { code: 404 }
}

// ====================================================================
//  推荐类
// ====================================================================

/**
 * 获取推荐歌单
 * @returns {Promise<{ code: number, data: Playlist[] }>}
 */
exports.getRecommendPlaylist = async () => {
  return { code: 404, data: [] }
}

/**
 * 获取推荐歌曲
 * @returns {Promise<{ code: number, data: Track[], sourceContext: Record<string, any> }>}
 */
exports.getRecommendTracks = async () => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 排行榜列表
 * @returns {Promise<{ code: number, data: Playlist[] }>}
 */
exports.rankTop = async () => {
  return { code: 404, data: [] }
}

/**
 * 排行榜详情
 * @returns {Promise<{ code: number, data: Playlist[], sourceContext: Record<string, any> }>}
 */
exports.rankList = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 获取 Banner / 轮播图
 * @returns {Promise<{ code: number, data: Banner[] }>}
 */
exports.getBanner = async () => {
  return { code: 404, data: [] }
}

// ====================================================================
//  专辑类
// ====================================================================

/**
 * 获取专辑详情
 * @param {Object} params
 * @returns {Promise<{ code: number, data: AlbumDetail|null }>}
 */
exports.albumDetail = async (params) => {
  return { code: 404, data: null }
}

/**
 * 获取艺人专辑列表
 * @returns {Promise<{ code: number, data: Album[], sourceContext: Record<string, any> }>}
 */
exports.artistAlbums = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 新碟上架
 * @returns {Promise<{ code: number, hasMore: boolean, albums: Album[], sourceContext: Record<string, any> }>}
 */
exports.topAlbums = async (params) => {
  return { code: 404, hasMore: false, albums: [], sourceContext: {} }
}

/**
 * 最新专辑
 * @returns {Promise<{ code: number, data: Album[], sourceContext: Record<string, any> }>}
 */
exports.newAlbums = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 收藏/取消收藏专辑
 * @param {Object} params
 * @returns {Promise<{ code: number }>}
 */
exports.subscribeAlbum = async (params) => {
  return { code: 404 }
}

/**
 * 专辑分类列表
 * @returns {Promise<{ code: number, data: TrackCatlist[] }>}
 */
exports.getAlbumCatlist = async () => {
  return { code: 404, data: [] }
}

// ====================================================================
//  艺人类
// ====================================================================

/**
 * 获取艺人详情
 * @returns {Promise<{ code: number, artist: ArtistDetail|null, songs: Track[], sourceContext: Record<string, any> }>}
 */
exports.artistDetail = async (params) => {
  return { code: 404, artist: null, songs: [], sourceContext: {} }
}

/**
 * 获取艺人 MV 列表
 * @returns {Promise<{ code: number, data: Mv[], sourceContext: Record<string, any> }>}
 */
exports.artistMVs = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 获取相似艺人
 * @returns {Promise<{ code: number, data: Artist[], sourceContext: Record<string, any> }>}
 */
exports.simiArtists = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 热门艺人
 * @returns {Promise<{ code: number, data: Artist[], sourceContext: Record<string, any> }>}
 */
exports.topArtists = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 艺人分类列表
 * @returns {Promise<{ code: number, data: Artist[], sourceContext: Record<string, any> }>}
 */
exports.artistsList = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 关注/取消关注艺人
 * @param {Object} params
 * @returns {Promise<{ code: number }>}
 */
exports.followArtist = async (params) => {
  return { code: 404 }
}

/**
 * 收藏的艺人列表
 * @returns {Promise<{ code: number, data: Artist[], sourceContext: Record<string, any> }>}
 */
exports.userLikedArtists = async () => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 艺人分类列表元数据
 * @returns {Promise<{ code: number, data: ArtistCatlist[] }>}
 */
exports.getArtistCatlist = async () => {
  return { code: 404, data: [] }
}

// ====================================================================
//  MV / 视频
// ====================================================================

/**
 * MV 详情
 * @returns {Promise<{ code: number, data: MvDetail|null }>}
 */
exports.mvDetail = async (params) => {
  return { code: 404, data: null }
}

/**
 * 收藏/取消收藏 MV
 * @param {Object} params
 * @returns {Promise<{ code: number }>}
 */
exports.subAMV = async (params) => {
  return { code: 404 }
}

/**
 * 点赞 MV
 * @param {Object} params
 * @returns {Promise<{ code: number }>}
 */
exports.likeAMV = async (params) => {
  return { code: 404 }
}

/**
 * 收藏的 MV 列表
 * @returns {Promise<{ code: number, data: Mv[], sourceContext: Record<string, any> }>}
 */
exports.userLikedMVs = async () => {
  return { code: 404, data: [], sourceContext: {} }
}

// ====================================================================
//  歌曲分类 / 标签
// ====================================================================

/**
 * 新歌速递
 * @returns {Promise<{ code: number, data: Track[], sourceContext: Record<string, any> }>}
 */
exports.topSong = async (params) => {
  return { code: 404, data: [], sourceContext: {} }
}

/**
 * 歌曲分类列表
 * @returns {Promise<{ code: number, data: TrackCatlist[] }>}
 */
exports.getTrackCatlist = async () => {
  return { code: 404, data: [] }
}

// ====================================================================
//  云盘
// ====================================================================

/**
 * 云盘歌曲列表
 * @returns {Promise<{ code: number, data: Track[], sourceContext: Record<string, any> }>}
 */
exports.cloudDisk = async () => {
  return { code: 404, data: [], sourceContext: {} }
}

// ====================================================================
//  评论
// ====================================================================

/**
 * 获取评论 Tab（如 "推荐" / "最新"）
 * @returns {Promise<{ code: number, data: CommentTab[] }>}
 */
exports.getCommentTab = async (params) => {
  return { code: 404, data: [] }
}

/**
 * 获取评论
 * @param {Object} params
 * @param {boolean=} params.reset  — 是否重置分页
 * @param {string=} params.sortType — 排序类型
 * @param {'track'|'album'|'playlist'|'mv'} params.type
 * @returns {Promise<{ code: number, data: Comment[], count: number, sourceContext: Record<string, any> }>}
 */
exports.getComments = async (params) => {
  return { code: 404, data: [], count: 0, sourceContext: {} }
}

/**
 * 点赞评论
 * @param {Object} params
 * @param {Record<string, any>} params.commentInfo
 * @param {boolean} params.currentStatus
 * @param {string} params.type
 * @returns {Promise<{ code: number }>}
 */
exports.likeAComment = async (params) => {
  return { code: 404 }
}

/**
 * 提交/删除评论
 * @param {Object} params
 * @param {'sub'|'del'|'reply'} params.t
 * @param {string} params.type
 * @param {string=} params.comment
 * @param {string=} params.commentId
 * @returns {Promise<{ code: number, data?: Comment|null }>}
 */
exports.submitAComment = async (params) => {
  return { code: 404, data: null }
}

/**
 * 获取楼层评论（回复列表）
 * @param {Object} params
 * @param {Record<string, any>} params.commentInfo
 * @param {string} params.type
 * @returns {Promise<{ code: number, data: Comment[], count: number, sourceContext: Record<string, any> }>}
 */
exports.getFloorComments = async (params) => {
  return { code: 404, data: [], count: 0, sourceContext: {} }
}

// ====================================================================
//  搜索
// ====================================================================

/**
 * 搜索
 * @param {Object} params
 * @param {'tracks'|'albums'|'artists'|'playlists'|'mvs'} params.tab
 * @param {string} params.keywords
 * @param {number=} params.page
 * @returns {Promise<{ code: number, data: (Track|Album|Artist|Playlist|Mv)[], count: number, sourceContext: Record<string, any> }>}
 */
exports.search = async (params) => {
  return { code: 404, data: [], count: 0, sourceContext: {} }
}

exports.userRecord = async () => ({ code: 404, weekData: [], allData: [], sourceContext: {} })
