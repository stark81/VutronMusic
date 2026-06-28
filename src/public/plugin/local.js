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
 * @property {(key: 'PluginData' | 'Track' | 'Album' | 'Artist' | 'Playlist' | 'PlaylistEntry', filter?: object) => Promise<any>} get
 *   Playlist 支持 filter: { id }，PlaylistEntry 支持 filter: { playlistId } 或 { playlistIds, $count }
 * @property {(key: 'PluginData' | 'Track' | 'Artist' | 'Album' | 'Playlist' | 'PlaylistEntry', value: any) => void} set
 *   Playlist 支持 { id, name, description } 更新 或 { id, _delete } 删除
 *   PlaylistEntry 支持 { playlistId, pluginId, sourceContext } 添加 或 { id, _delete } 删除
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
  icon: '',
  type: 'local',
  capabilities: {
    matchTrack: false,
    getLyric: true,
    getComments: false,
    comment: { read: false, like: false, submit: false, floor: false },
    mv: { detail: false, like: false, subscribe: false }
  }
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
 */
const localServerUrl = 'http://localhost:41830' // 默认生产端口

const picUrl = (id, size = 512) => `${localServerUrl}/local-asset?trackId=${id}&size=${size}`
const singerPicUrl = `${localServerUrl}/local-asset/singer-cover`

/**
 * 格式化 Track
 */
const formatTrack = (item) => ({
  id: item.id || '',
  name: item.name || '未知歌曲',
  icon: 'common',
  duration: item.duration || 0,
  alias: Array.isArray(item.alias) ? item.alias : item.alias ? [item.alias] : [],
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
  sourceContext: {
    id: item.id || '',
    filePath: item.filePath || '',
    md5: item.md5 || '',
    cueOffset: item.cueOffset || 0,
    cueDuration: item.cueDuration || 0
  }
})

/**
 * 格式化 Album
 */
const formatAlbum = (item) => ({
  id: item.albumId || item.id || '',
  name: item.albumName || item.name || '未知专辑',
  icon: 'common',
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
  icon: 'common',
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
  icon: 'common',
  picUrl: item.picUrl || picUrl(item.id, 256),
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
  icon: 'common',
  picUrl: item.picUrl || picUrl(item.id, 256),
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

exports.updateBaseUrl = async () => {
  return { code: 200 }
}

exports.getAccount = () => {
  return { code: 200, baseUrl: '', userName: 'Local', pwd: '' }
}

exports.doLogin = async (params) => {
  if (params?.dirs) {
    const results = await apis.utils.checkFileExist(params.dirs)
    const validDirs = results.filter((r) => r.exist).map((r) => r.path)

    if (!validDirs.length) {
      return { code: 400, message: '扫描目录无效或不存在' }
    }

    await apis.store.set('scanDir', validDirs)

    return {
      code: 200,
      data: {
        userId: 'local',
        avatarUrl: '',
        nickname: '本地音乐',
        isVip: true,
        signature: '',
        scanDir: validDirs
      }
    }
  }

  const savedDirs = await apis.store.get('scanDir')
  if (savedDirs?.length) {
    const results = await apis.utils.checkFileExist(savedDirs)
    const validDirs = results.filter((r) => r.exist).map((r) => r.path)

    if (validDirs.length) {
      return {
        code: 200,
        data: {
          userId: 'local',
          avatarUrl: '',
          nickname: '本地音乐',
          isVip: true,
          signature: '',
          scanDir: validDirs
        }
      }
    }
  }

  return { code: 400, message: '请先设置扫描目录' }
}

exports.doLogout = async () => {
  await apis.store.set('scanDir', [])
  return { code: 200 }
}

exports.systemPing = async () => {
  const savedDirs = await apis.store.get('scanDir')
  if (!savedDirs?.length) {
    return { code: 200, status: 'logout' }
  }

  const results = await apis.utils.checkFileExist(savedDirs)
  const validDirs = results.filter((r) => r.exist).map((r) => r.path)

  if (!validDirs.length) {
    return { code: 200, status: 'logout' }
  }

  return { code: 200, status: 'login', scanDir: validDirs }
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
exports.getAllTracks = async () => {
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
    const ids = params.tracks.map((t) => t.id)
    const result = await apis.db.get('Track', { ids })
    const items = result?.songs || []
    const data = items.map(formatTrack)
    return { code: 200, data }
  } catch (e) {
    return { code: 200, data: [] }
  }
}

/**
 * 获取歌曲播放地址
 */
exports.songUrl = async (params) => {
  return {
    code: 200,
    data: {
      url: [streamUrl(params.id)],
      replayGain: 0,
      peak: 1,
      cueOffset: params.cueOffset || 0,
      cueDuration: params.cueDuration || 0
    }
  }
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
  const _start = reset ? 0 : _params._start || 0
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
      return {
        code: 200,
        data: page,
        count: filtered.length,
        sourceContext: { _start: _start + page.length }
      }
    }
    case 'albums': {
      const allAlbums = (await apis.db.get('Album')) || []
      const filtered = allAlbums.filter((item) => item.name.toLowerCase().includes(kw))
      const page = filtered.slice(_start, _start + pageSize).map(formatAlbum)
      return {
        code: 200,
        data: page,
        count: filtered.length,
        sourceContext: { _start: _start + page.length }
      }
    }
    case 'artists': {
      const allArtists = (await apis.db.get('Artist')) || []
      const filtered = allArtists.filter((item) => item.name.toLowerCase().includes(kw))
      const page = filtered.slice(_start, _start + pageSize).map(formatArtist)
      return {
        code: 200,
        data: page,
        count: filtered.length,
        sourceContext: { _start: _start + page.length }
      }
    }
    case 'playlists': {
      const playlistRows = (await apis.db.get('Playlist')) || []
      const allIds = playlistRows.map((p) => p.id)
      const countMap = allIds.length
        ? (await apis.db.get('PlaylistEntry', { playlistIds: allIds, $count: true })) || {}
        : {}
      const filtered = playlistRows.filter((p) => p.name.toLowerCase().includes(kw))
      const page = filtered
        .slice(_start, _start + pageSize)
        .map((p) => formatPlaylist({ ...p, trackCount: countMap[p.id] || 0 }))
      return {
        code: 200,
        data: page,
        count: filtered.length,
        sourceContext: { _start: _start + page.length }
      }
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

function generateId() {
  return 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

// ===================================================
// 收藏 / 社交功能（Artist.followed 字段 + Album.subscribed）
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
  // 从 Artist 表读取关注状态
  const allArtists = (await apis.db.get('Artist')) || []
  const data = allArtists.filter((a) => a.followed).map(formatArtist)

  // 如果 Artist 表里还没有（本地音乐首次扫描时未写全），从 tracks 中提取
  if (!data.length) {
    const items = await loadAllTracks()
    const seen = new Set()
    for (const item of items) {
      for (const a of item.artists || []) {
        if (a.followed && !seen.has(a.id)) {
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

// ===================================================
// 歌单操作（使用 Playlist / PlaylistEntry 表）
// ===================================================

/**
 * 从 PlaylistEntry 中提取本地歌曲详情
 * 仅处理 pluginId === 'local' 的条目，跨平台条目暂不处理
 */
const loadPlaylistTracksFromEntries = async (entries) => {
  if (!entries || !entries.length) return []
  const localIds = entries
    .filter((e) => e.pluginId === 'local')
    .map((e) => {
      try {
        const ctx =
          typeof e.sourceContext === 'string' ? JSON.parse(e.sourceContext) : e.sourceContext
        return ctx && ctx.id
      } catch {
        return null
      }
    })
    .filter(Boolean)
  if (!localIds.length) return []
  const result = await apis.db.get('Track', { ids: localIds })
  return (result?.songs || []).map(formatTrack)
}

exports.addOrRemoveTracksToPlaylist = async (_params) => {
  const { op, playlist, tracks } = _params
  if (!playlist?.id) return { code: 404 }

  if (op === 'add') {
    for (const t of tracks) {
      await apis.db.set('PlaylistEntry', {
        playlistId: playlist.id,
        pluginId: t.pluginId || 'local',
        sourceContext: t.sourceContext
      })
    }
    // 取最后添加的那首歌的封面更新歌单封面
    if (tracks.length > 0) {
      const last = tracks[tracks.length - 1]
      if (last.pluginId === 'local' && last.sourceContext?.id) {
        try {
          await apis.db.set('Playlist', {
            id: playlist.id,
            picUrl: picUrl(last.sourceContext.id, 512)
          })
        } catch {
          /* 静默失败，不影响添加操作 */
        }
      }
    }
  } else {
    // 移除时需要查出对应的 PlaylistEntry id
    const entries = await apis.db.get('PlaylistEntry', { playlistId: playlist.id })
    // tracks 为 [{ pluginId, sourceContext }]，按 (pluginId, sourceContext JSON) 匹配
    const targetKeys = new Set(
      tracks.map((t) => `${t.pluginId || 'local'}|${JSON.stringify(t.sourceContext)}`)
    )
    let deletedCount = 0
    for (const entry of entries || []) {
      const key = `${entry.pluginId}|${entry.sourceContext}`
      if (targetKeys.has(key)) {
        await apis.db.set('PlaylistEntry', { id: entry.id, _delete: true })
        deletedCount++
      }
    }
    // 如果删除了歌曲，更新封面为现在排第一（最新添加）的歌
    if (deletedCount > 0) {
      const remaining = await apis.db.get('PlaylistEntry', {
        playlistId: playlist.id,
        $first: true
      })
      if (remaining && remaining.pluginId === 'local') {
        try {
          const ctx =
            typeof remaining.sourceContext === 'string'
              ? JSON.parse(remaining.sourceContext)
              : remaining.sourceContext
          if (ctx?.id)
            await apis.db.set('Playlist', { id: playlist.id, picUrl: picUrl(ctx.id, 512) })
        } catch {}
      } else if (!remaining) {
        // 没有剩余歌曲，回退到默认封面
        await apis.db.set('Playlist', { id: playlist.id, picUrl: picUrl(playlist.id, 256) })
      }
    }
  }
  return { code: 200 }
}

exports.reorderPlaylistTracks = async (params) => {
  const { id, orderedIds } = params
  if (!id || !orderedIds || !orderedIds.length) return { code: 404 }

  const entries = await apis.db.get('PlaylistEntry', { playlistId: id })
  if (!entries || !entries.length) return { code: 200 }

  // 建立 trackId → entryId 映射
  const entryMap = new Map()
  for (const entry of entries) {
    let ctx
    try {
      ctx =
        typeof entry.sourceContext === 'string'
          ? JSON.parse(entry.sourceContext)
          : entry.sourceContext
    } catch {
      continue
    }
    if (ctx && ctx.id != null) entryMap.set(String(ctx.id), entry.id)
  }

  // 按新顺序排列 entryId，只保留能找到映射的
  const orderedEntryIds = orderedIds
    .map((trackId) => entryMap.get(String(trackId)))
    .filter((id) => id != null)

  if (orderedEntryIds.length < 2) return { code: 200 }

  await apis.db.set('PlaylistEntry', {
    _reorder: true,
    playlistId: id,
    orderedEntryIds
  })

  return { code: 200 }
}

exports.createPlaylist = async (_params) => {
  const { name, description = '' } = _params
  const id = generateId()
  await apis.db.set('Playlist', { id, name: name || '新建歌单', description })
  const newPlaylist = {
    id,
    name: name || '新建歌单',
    description,
    trackCount: 0,
    createTime: Date.now()
  }
  return { code: 200, data: formatPlaylist(newPlaylist) }
}

exports.deletePlaylist = async (_params) => {
  const { id } = _params
  if (!id) return { code: 404 }
  await apis.db.set('Playlist', { id, _delete: true })
  return { code: 200 }
}

/**
 * 编辑歌单信息
 * @param {Object} params
 * @param {number|string} params.id
 * @param {string} params.name
 * @param {string} params.desc
 */
exports.editPlaylist = async (params) => {
  const { id, name, desc } = params
  if (!id) return { code: 404 }
  await apis.db.set('Playlist', { id, name, description: desc })
  return { code: 200 }
}

exports.userPlaylist = async () => {
  const allTracks = await loadAllTracks()
  const likedCount = allTracks.filter((t) => t.liked).length
  const liked = formatPlaylist({
    id: '-1',
    name: '我喜欢的音乐',
    trackCount: likedCount
  })
  const playlistRows = (await apis.db.get('Playlist')) || []
  const playlistIds = playlistRows.map((p) => p.id)
  const countMap = playlistIds.length
    ? (await apis.db.get('PlaylistEntry', { playlistIds, $count: true })) || {}
    : {}

  // 批量获取各歌单第一首歌的封面
  const coverMap = {}
  const firstEntryIds = []
  const firstEntryPidMap = {}
  for (const pid of playlistIds) {
    if (countMap[pid] > 0) {
      firstEntryIds.push(pid)
    }
  }
  if (firstEntryIds.length) {
    const firstEntries = await Promise.all(
      firstEntryIds.map((pid) => apis.db.get('PlaylistEntry', { playlistId: pid, $first: true }))
    )
    const trackIds = []
    for (let i = 0; i < firstEntries.length; i++) {
      const entry = firstEntries[i]
      if (entry && entry.pluginId === 'local') {
        try {
          const ctx =
            typeof entry.sourceContext === 'string'
              ? JSON.parse(entry.sourceContext)
              : entry.sourceContext
          if (ctx?.id) {
            trackIds.push(ctx.id)
            firstEntryPidMap[ctx.id] = firstEntryIds[i]
          }
        } catch {}
      }
    }
    if (trackIds.length) {
      const trackResult = await apis.db.get('Track', { ids: trackIds })
      for (const song of trackResult?.songs || []) {
        const pid = firstEntryPidMap[song.id]
        if (pid) coverMap[pid] = song.picUrl || picUrl(song.id, 256)
      }
    }
  }

  const playlists = playlistRows.map((p) =>
    formatPlaylist({
      ...p,
      picUrl: coverMap[p.id] || picUrl(p.id, 256),
      trackCount: countMap[p.id] || 0
    })
  )
  const allAlbums = (await apis.db.get('Album')) || []
  const albums = allAlbums.filter((a) => a.subscribed).map(formatAlbum)
  return { code: 200, liked, playlists, albums, sourceContext: { offset: 0 } }
}

exports.getPlaylistDetail = async (_params) => {
  const { id } = _params
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

  const playlistRows = await apis.db.get('Playlist', { id })
  const pl = playlistRows && playlistRows[0]
  if (!pl) return { code: 200, data: null }
  const entries = await apis.db.get('PlaylistEntry', { playlistId: id })
  const tracks = await loadPlaylistTracksFromEntries(entries)
  const data = formatPlaylistDetail({
    id: pl.id,
    name: pl.name,
    description: pl.description,
    picUrl: tracks.length > 0 ? picUrl(tracks[0].id, 512) : '',
    trackCount: tracks.length,
    tracks,
    createTime: pl.createTime
  })
  return { code: 200, data }
}

exports.getPlaylistTracks = async (_params) => {
  const { id } = _params

  if (id === '-1') {
    const allTracks = await loadAllTracks()
    const data = allTracks.filter((t) => t.liked).map(formatTrack)
    return { code: 200, data, sourceContext: { id } }
  }

  const entries = await apis.db.get('PlaylistEntry', { playlistId: id })
  const data = await loadPlaylistTracksFromEntries(entries)
  return { code: 200, data, sourceContext: { id } }
}

exports.scrobble = async (_params) => {
  const { id } = _params
  if (!id) return { code: 200 }
  try {
    apis.db.set('Track', { id, $inc: { playCount: 1 } })
  } catch {
    // 静默失败，不影响播放
  }
  return { code: 200 }
}

exports.reportPlayback = async () => {
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
exports.personalFM = () => ({ code: 404, data: [], sourceContext: {} })

exports.userRecord = async () => ({ code: 404, weekData: [], allData: [], sourceContext: {} })
