/**
 * 本地音乐插件
 *
 * 与自建流媒体插件不同，本地音乐的数据存储在本地 SQLite 数据库中，
 * 插件通过 apis.db 接口读取缓存数据，并通过 vutron:// 协议提供播放和封面能力。
 *
 * 注意：数据方法（getAllTracks、getTrackDetail）目前依赖 CacheAPIs.LocalMusic
 * 缓存填充，在缓存机制完善前可能返回空数据。
 */

/**
 * @typedef {Object} PluginHttp
 * @property {(url: string, params?: object, headers?: object, raw?: boolean) => Promise<any>} get
 * @property {(url: string, data?: object, headers?: object, raw?: boolean) => Promise<any>} post
 */

/**
 * @typedef {Object} PluginStore
 * @property {(key: string) => Promise<any>} get
 * @property {(key: string, value: any) => void} set
 */

/**
 * @typedef {Object} DB
 * @property {(key: 'PluginData' | 'Track') => Promise<any>} get
 * @property {(key: 'PluginData' | 'Track', value: any) => void} set
 */

/**
 * @typedef {Object} Utils
 * @property {(msg: string) => Promise<LyricLine[]>} parseLyric
 * @property {(input: string) => string} md5
 */

/**
 * @typedef {Object} PluginApi
 * @property {PluginHttp} http
 * @property {(msg: string) => void} log
 * @property {PluginStore} store
 * @property {DB} db
 * @property {Utils} utils
 */

/** @type {PluginApi} */
// eslint-disable-next-line no-undef
const apis = api

const meta = {
  name: '本地音乐',
  type: 'local'
}
exports.meta = meta

// ===================================================
// 辅助函数
// ===================================================

/**
 * 构建本地音频流 URL（继续走自定义协议）
 */
const streamUrl = (id) => `vutron://local-asset?type=stream&id=${id}`

/**
 * 构建本地封面 URL（走 HTTP 服务器）
 *
 * 开发环境端口为 40001，生产环境为 41830。
 * 可通过 updateBaseUrl 配置 localServerUrl 覆盖默认值。
 */
let localServerUrl = 'http://127.0.0.1:41830'

apis.store.get('').then((store) => {
  if (store?.localServerUrl) localServerUrl = store.localServerUrl
})

const picUrl = (id, size = 512) => `${localServerUrl}/local-asset?trackId=${id}&size=${size}`
const singerPicUrl = `${localServerUrl}/local-asset/singer-cover`

/**
 * 格式化 Track
 */
const formatTrack = (item) => ({
  id: item.id || '',
  name: item.name || '未知歌曲',
  duration: item.duration || 0,
  alias: item.alias || [],
  playable: true,
  reason: '',
  createTime: item.createTime || Date.now(),
  no: item.no || 0,
  mvid: 0,
  playCount: item.playCount || 0,
  size: item.size || 0,
  filePath: item.filePath || '',
  album: {
    id: item.albumId || '',
    name: item.albumName || '',
    picUrl: picUrl(item.albumId || item.id, 64),
    pluginId: '',
    sourceContext: { id: item.albumId || '' }
  },
  picUrl: picUrl(item.id, 64),
  artists: (item.artists || []).map((a) => ({
    id: a.id || '',
    name: a.name || '未知艺人',
    picUrl: singerPicUrl,
    pluginId: '',
    sourceContext: { id: a.id || '' }
  })),
  albumArtists: (item.albumArtists || item.artists || []).map((a) => ({
    id: a.id || '',
    name: a.name || '未知艺人',
    picUrl: singerPicUrl,
    pluginId: '',
    sourceContext: { id: a.id || '' }
  })),
  pluginId: '',
  type: meta.type,
  sourceContext: { id: item.id || '', filePath: item.filePath || '' }
})

/**
 * 格式化 Album
 */
const formatAlbum = (item) => ({
  id: item.albumId || item.id || '',
  name: item.albumName || item.name || '未知专辑',
  picUrl: picUrl(item.albumId || item.id, 256),
  artists: (item.artists || []).map((a) => ({
    id: a.id || '',
    name: a.name || '',
    picUrl: '',
    pluginId: '',
    sourceContext: { id: a.id || '' }
  })),
  createTime: item.createTime || Date.now(),
  copywriter: item.copywriter || '',
  type: '专辑',
  pluginId: '',
  sourceContext: { id: item.albumId || item.id || '' }
})

/**
 * 格式化 Artist
 */
const formatArtist = (item) => ({
  id: item.id || '',
  name: item.name || '未知艺人',
  picUrl: item.picUrl || singerPicUrl,
  pluginId: '',
  sourceContext: { id: item.id || '' }
})

/**
 * 格式化 Playlist
 */
const formatPlaylist = (item) => ({
  id: item.id || '',
  name: item.name || '本地歌单',
  picUrl: picUrl(item.id, 256),
  isMine: true,
  trackCount: item.trackCount || 0,
  playCount: 0,
  creator: {
    userId: 'local',
    avatarUrl: '',
    nickname: '本地音乐',
    isVip: true,
    signature: '',
    sourceContext: { userId: 'local' }
  },
  isPrivate: false,
  pluginId: '',
  copywriter: '',
  sourceContext: { id: item.id || '' }
})

/**
 * 格式化 Playlist 详情
 */
const formatPlaylistDetail = (item) => ({
  id: item.id || '',
  name: item.name || '本地歌单',
  picUrl: picUrl(item.id, 256),
  subscribed: item.subscribed || false,
  trackCount: item.trackCount || 0,
  updateTime: item.updateTime || item.createTime || Date.now(),
  description: item.description || '',
  isPrivate: false,
  pluginId: '',
  copywriter: '',
  updateFrequency: '',
  specialPlaylistInfo: null,
  trackIds: item.trackIds || [],
  tracks: item.tracks || [],
  tags: [],
  creator: {
    userId: 'local',
    avatarUrl: '',
    nickname: '本地音乐',
    isVip: true,
    signature: '',
    sourceContext: { userId: 'local' }
  },
  sourceContext: { id: item.id || '' }
})

// ===================================================
// 身份验证（本地音乐始终可用）
// ===================================================

exports.updateBaseUrl = async (params) => {
  if (params?.url) {
    localServerUrl = params.url.replace(/\/$/, '')
    apis.store.set('localServerUrl', localServerUrl)
  }
  return { code: 200 }
}

exports.getAccount = () => {
  return { code: 200, baseUrl: '', userName: 'Local', pwd: '' }
}

exports.doLogin = async () => {
  return {
    code: 200,
    data: {
      userId: 'local',
      avatarUrl: '',
      nickname: '本地音乐',
      isVip: true,
      signature: ''
    }
  }
}

exports.doLogout = () => {
  return { code: 200 }
}

exports.systemPing = async () => {
  return { code: 200, status: 'login' }
}

// ===================================================
// 数据方法
// ===================================================

/**
 * 获取所有本地歌曲
 *
 * 从缓存中读取本地音乐列表。当前缓存通过 CacheAPIs.LocalMusic 提供数据，
 * 需确保扫描本地音乐后缓存已填充。
 */
exports.getAllTracks = async (_params) => {
  try {
    const result = await apis.db.get('Track')
    const items = result?.songs || []
    const data = items.map(formatTrack)
    return { code: 200, data, count: data.length, sourceContext: {} }
  } catch {
    return { code: 200, data: [], count: 0, sourceContext: {} }
  }
}

/**
 * 获取单首或多首歌曲详情
 */
exports.getTrackDetail = async (params) => {
  try {
    const result = await apis.db.get('Track')
    const items = result?.songs || []
    const ids = params.tracks.map((t) => t.id)
    const data = items.filter((item) => ids.includes(item.id)).map(formatTrack)
    return { code: 200, data }
  } catch (e) {
    return { code: 200, data: [] }
  }
}

/**
 * 获取歌曲播放地址
 */
exports.songUrl = async (params) => {
  return { code: 200, data: { url: [streamUrl(params.id)], replayGain: 0, peak: 1 } }
}

/**
 * 调整封面图片尺寸
 */
exports.resizePicUrl = (params) => {
  const { url, size } = params
  if (!url || url.startsWith('vutron://')) {
    if (url && url.includes('?') && size) {
      const u = new URL(url)
      u.searchParams.set('size', `${size}`)
      return { code: 200, data: u.href }
    }
    return { code: 200, data: url }
  }
  // 对于 HTTP 类型的 URL，直接修改 size 参数
  try {
    const u = new URL(url)
    u.searchParams.set('size', `${size}`)
    return { code: 200, data: u.href }
  } catch {
    return { code: 200, data: url }
  }
}

/**
 * 获取歌词
 *
 * 优先级：内嵌歌词 → 同目录 .lrc 文件
 * 需要 audioUtils.getEmbeddedLyric / getPathLyric 支持，
 * 这两个方法通过 Worker 消息向主进程发起请求，
 * 由主进程调用 music-metadata / fs 完成解析。
 */
exports.getLyric = async (params) => {
  const filePath = params.filePath
  if (!filePath) return { code: 200, data: [] }

  try {
    const lrcFilePath = filePath.replace(/\.[^/.]+$/, '.lrc')
    const pathLyric = await apis.utils.getPathLyric(lrcFilePath)
    if (pathLyric && pathLyric.length) return { code: 200, data: pathLyric }

    const embedded = await apis.utils.getEmbeddedLyric(filePath)
    if (embedded && embedded.length) return { code: 200, data: embedded }

    return { code: 200, data: [] }
  } catch {
    return { code: 200, data: [] }
  }
}

// ===================================================
// 搜索
// ===================================================

exports.search = async (_params) => {
  const { tab, keywords, reset } = _params
  const _start = reset ? 0 : (_params._start || 0)
  if (!keywords) return { code: 200, data: [], count: 0, sourceContext: {} }

  const kw = keywords.toLowerCase()
  const pageSize = 50

  switch (tab) {
    case 'tracks': {
      const result = await apis.db.get('Track')
      const items = result?.songs || []
      const filtered = items.filter(
        (item) =>
          item.name.toLowerCase().includes(kw) ||
          (item.artists || []).some((a) => a.name.toLowerCase().includes(kw))
      )
      const page = filtered.slice(_start, _start + pageSize).map(formatTrack)
      return { code: 200, data: page, count: filtered.length, sourceContext: { _start: _start + page.length } }
    }
    case 'albums': {
      const allAlbums = (await apis.db.get('Album')) || []
      const filtered = allAlbums.filter((item) => item.name.toLowerCase().includes(kw))
      const page = filtered.slice(_start, _start + pageSize).map(formatAlbum)
      return { code: 200, data: page, count: filtered.length, sourceContext: { _start: _start + page.length } }
    }
    case 'artists': {
      const allArtists = (await apis.db.get('Artist')) || []
      const filtered = allArtists.filter((item) => item.name.toLowerCase().includes(kw))
      const page = filtered.slice(_start, _start + pageSize).map(formatArtist)
      return { code: 200, data: page, count: filtered.length, sourceContext: { _start: _start + page.length } }
    }
    case 'playlists': {
      const pd = await loadPluginData()
      const playlists = pd.playlists || []
      const filtered = playlists.filter((p) => p.name.toLowerCase().includes(kw))
      const page = filtered.slice(_start, _start + pageSize).map((p) =>
        formatPlaylist({ ...p, trackCount: (p.trackIds || []).length })
      )
      return { code: 200, data: page, count: filtered.length, sourceContext: { _start: _start + page.length } }
    }
    default:
      return { code: 200, data: [], count: 0, sourceContext: {} }
  }
}
// ===================================================
// 辅助：读取本地所有歌曲（含关联 artist/album）
// ===================================================

const loadAllTracks = async () => {
  try {
    const result = await apis.db.get('Track')
    return result?.songs || []
  } catch {
    return []
  }
}

const loadPluginData = async () => {
  try {
    const data = await apis.db.get('PluginData')
    return data || {}
  } catch {
    return {}
  }
}

const savePluginData = (data) => {
  apis.db.set('PluginData', data)
}

function generateId() {
  return 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

// ===================================================
// 收藏 / 社交功能（存储在 SQLite PluginData 中）
// ===================================================

exports.likeATrack = async (params) => {
  const { op, tracks } = params
  const liked = op === 'add' ? 1 : 0
  tracks.forEach((t) => {
    if (t.id) apis.db.set('Track', { id: t.id, liked })
  })
  return { code: 200 }
}

exports.followArtist = async (params) => {
  const { op, id } = params
  const pd = await loadPluginData()
  const followed = pd.followedArtists || []
  if (op === 'follow' || op === 'add') {
    if (id && !followed.includes(id)) followed.push(id)
  } else {
    pd.followedArtists = followed.filter((a) => a !== id)
  }
  pd.followedArtists = followed
  apis.db.set('PluginData', pd)
  // 同步更新 Artist 表的 followed 字段
  if (id) apis.db.set('Artist', { id, followed: op === 'follow' || op === 'add' })
  return { code: 200 }
}

exports.subscribeAlbum = async (params) => {
  const { op, id } = params
  // 直接更新 Album 表的 subscribed 字段
  apis.db.set('Album', { id, subscribed: op === 'add' })
  return { code: 200 }
}

exports.userLikedArtists = async () => {
  const pd = await loadPluginData()
  const followedIds = pd.followedArtists || []
  if (!followedIds.length) return { code: 200, data: [], sourceContext: {} }

  // 从 Artist 表读取被关注的艺人
  const allArtists = (await apis.db.get('Artist')) || []
  const data = allArtists.filter((a) => followedIds.includes(a.id)).map(formatArtist)

  // 如果 Artist 表里还没有（本地音乐首次扫描时未写全），从 tracks 中提取
  if (!data.length) {
    const items = await loadAllTracks()
    const seen = new Set()
    for (const item of items) {
      for (const a of item.artists || []) {
        if (followedIds.includes(a.id) && !seen.has(a.id)) {
          seen.add(a.id)
          data.push(formatArtist(a))
        }
      }
    }
  }
  return { code: 200, data, sourceContext: {} }
}

exports.userLikedMVs = () => ({ code: 200, data: [], sourceContext: {} })
exports.cloudDisk = () => ({ code: 200, data: [], sourceContext: {} })

exports.albumDetail = async (params) => {
  const [items, albumRows] = await Promise.all([loadAllTracks(), apis.db.get('Album')])
  const albumItems = items.filter((t) => t.albumId === params.id)
  if (!albumItems.length) return { code: 200, data: null }

  const first = albumItems[0]
  const album = formatAlbum(first)
  const songs = albumItems.map(formatTrack)
  const dbAlbum = (albumRows || []).find((r) => r.id === params.id)
  return {
    code: 200,
    data: {
      ...album,
      songs,
      size: albumItems.length,
      description: '',
      company: '',
      isExplicit: false,
      subscribed: !!dbAlbum?.subscribed,
      publishTime: first.createTime || Date.now()
    }
  }
}

exports.artistDetail = async (params) => {
  const [items, artistRows] = await Promise.all([loadAllTracks(), apis.db.get('Artist')])
  const artistTracks = items.filter(
    (t) =>
      (t.artists || []).some((a) => a.id === params.id) ||
      (t.albumArtists || []).some((a) => a.id === params.id)
  )
  if (!artistTracks.length) return { code: 200, artist: null, songs: [], sourceContext: {} }

  const first = artistTracks[0]
  const artistInfo = (first.artists || []).find((a) => a.id === params.id) || first.artists[0]

  const songs = artistTracks.map(formatTrack)
  const dbArtist = (artistRows || []).find((r) => r.id === params.id)

  return {
    code: 200,
    artist: {
      id: artistInfo.id,
      name: artistInfo.name,
      picUrl: dbArtist?.picUrl || singerPicUrl,
      musicSize: songs.length,
      albumSize: 0,
      mvSize: 0,
      description: dbArtist?.description || '',
      followed: !!dbArtist?.followed,
      pluginId: '',
      sourceContext: { id: artistInfo.id }
    },
    songs,
    sourceContext: {}
  }
}

exports.artistAlbums = async (params) => {
  const items = await loadAllTracks()
  const seen = new Set()
  const albums = items
    .filter((t) => (t.artists || []).some((a) => a.id === params.id))
    .map((t) => formatAlbum(t))
    .filter((a) => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
  return { code: 200, data: albums, sourceContext: {} }
}

exports.addOrRemoveTracksToPlaylist = async (_params) => {
  const { op, playlist, tracks } = _params
  const pd = await loadPluginData()
  const pl = (pd.playlists || []).find((p) => p.id === playlist?.id)
  if (!pl) return { code: 404 }
  const trackIds = tracks.map((t) => t.id).filter(Boolean)
  if (op === 'add') {
    trackIds.forEach((id) => {
      if (!pl.trackIds.includes(id)) pl.trackIds.push(id)
    })
  } else {
    pl.trackIds = pl.trackIds.filter((id) => !trackIds.includes(id))
  }
  savePluginData(pd)
  return { code: 200 }
}

exports.createPlaylist = async (_params) => {
  const { name, description = '' } = _params
  const pd = await loadPluginData()
  const playlists = pd.playlists || []
  const newPlaylist = {
    id: generateId(),
    name: name || '新建歌单',
    description,
    trackIds: [],
    createTime: Date.now()
  }
  playlists.push(newPlaylist)
  pd.playlists = playlists
  savePluginData(pd)
  return { code: 200, data: formatPlaylist(newPlaylist) }
}

exports.deletePlaylist = async (_params) => {
  const { id } = _params
  const pd = await loadPluginData()
  pd.playlists = (pd.playlists || []).filter((p) => p.id !== id)
  savePluginData(pd)
  return { code: 200 }
}

exports.userPlaylist = async () => {
  const pd = await loadPluginData()
  const allTracks = await loadAllTracks()
  const likedCount = allTracks.filter((t) => t.liked).length
  const liked = formatPlaylist({
    id: '-1',
    name: '我喜欢的音乐',
    trackCount: likedCount
  })
  const playlists = (pd.playlists || []).map((p) =>
    formatPlaylist({ ...p, trackCount: (p.trackIds || []).length })
  )
  const allAlbums = (await apis.db.get('Album')) || []
  const albums = allAlbums.filter((a) => a.subscribed).map(formatAlbum)
  return { code: 200, liked, playlists, albums, sourceContext: { offset: 0 } }
}

exports.getPlaylistDetail = async (_params) => {
  const { id } = _params
  const pd = await loadPluginData()
  const allTracks = await loadAllTracks()

  if (id === '-1') {
    const tracks = allTracks.filter((t) => t.liked).map(formatTrack)
    const data = formatPlaylistDetail({
      id: '-1',
      name: '我喜欢的音乐',
      trackCount: tracks.length,
      tracks
    })
    return { code: 200, data }
  }

  const pl = (pd.playlists || []).find((p) => p.id === id)
  if (!pl) return { code: 200, data: null }
  const tracks = allTracks.filter((t) => (pl.trackIds || []).includes(t.id)).map(formatTrack)
  const data = formatPlaylistDetail({
    id: pl.id,
    name: pl.name,
    description: pl.description,
    trackCount: (pl.trackIds || []).length,
    tracks,
    createTime: pl.createTime
  })
  return { code: 200, data }
}

exports.getPlaylistTracks = async (_params) => {
  const { id } = _params
  const pd = await loadPluginData()
  const allTracks = await loadAllTracks()

  if (id === '-1') {
    const data = allTracks.filter((t) => t.liked).map(formatTrack)
    return { code: 200, data, sourceContext: { id } }
  }

  const pl = (pd.playlists || []).find((p) => p.id === id)
  if (!pl) return { code: 200, data: [], sourceContext: { id } }
  const matchedIds = pl.trackIds || []
  const data = allTracks.filter((t) => matchedIds.includes(t.id)).map(formatTrack)
  return { code: 200, data, sourceContext: { id } }
}

exports.scrobble = async (_params) => {
  const { id } = _params
  if (!id) return { code: 200 }
  try {
    const result = await apis.db.get('Track')
    const track = (result?.songs || []).find((t) => t.id === id)
    if (track) {
      apis.db.set('Track', { id, playCount: (track.playCount || 0) + 1 })
    }
  } catch (e) {
    // 静默失败，不影响播放
  }
  return { code: 200 }
}

exports.artistMVs = () => ({ code: 200, data: [], sourceContext: {} })
exports.simiArtists = () => ({ code: 200, data: [], sourceContext: {} })
exports.getBanner = () => ({ code: 404, data: [] })
exports.topSong = () => ({ code: 404, data: [], sourceContext: {} })
exports.topArtists = () => ({ code: 404, data: [], sourceContext: {} })
exports.artistsList = () => ({ code: 404, data: [], sourceContext: {} })
exports.topAlbums = () => ({ code: 404, hasMore: false, albums: [], sourceContext: {} })
exports.rankTop = () => ({ code: 404, data: [] })
exports.rankList = () => ({ code: 404, data: [], sourceContext: {} })
exports.getRecommendPlaylist = () => ({ code: 404, data: [] })
exports.getRecommendTracks = () => ({ code: 404, data: [], sourceContext: {} })
exports.catlist = () => ({ code: 404, data: null })
exports.getCategoryPlaylist = () => ({ code: 404, data: [], sourceContext: {} })
exports.getTrackCatlist = () => ({ code: 404, data: [] })
exports.getAlbumCatlist = () => ({ code: 404, data: [] })
exports.getArtistCatlist = () => ({ code: 404, data: [] })
exports.newAlbums = () => ({ code: 404, data: [], sourceContext: {} })
exports.getCommentTab = () => ({ code: 404, data: [] })
exports.getComments = () => ({ code: 404, data: [], count: 0, sourceContext: {} })
exports.likeAComment = () => ({ code: 404 })
exports.submitAComment = () => ({ code: 404, data: null })
exports.getFloorComments = () => ({ code: 404, data: [], count: 0, sourceContext: {} })
exports.loginQrKey = () => ({ code: 404, data: { url: '', qrcode: '' } })
exports.loginQrCodeCheck = () => ({ code: 800, message: '' })
exports.mvDetail = () => ({ code: 404, data: null })
exports.subAMV = () => ({ code: 404 })
exports.likeAMV = () => ({ code: 404 })
exports.likelist = () => ({ code: 404, data: [], sourceContext: {} })
exports.vipStatus = () => ({ code: 404 })
exports.receiveVip = () => ({ code: 404 })
exports.updateVip = () => ({ code: 404 })
exports.personerFM = () => ({ code: 404 })
exports.getSongUrl = () => ({ code: 404, data: '' })
