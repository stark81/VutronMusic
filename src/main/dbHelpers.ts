/**
 * 数据库操作辅助层。
 *
 * 与 cache.ts 的区别：
 * - cache.ts：按 CacheAPIs 枚举路由，一个方法处理所有场景，逻辑分散在 switch case 中
 * - dbHelpers.ts：每个场景一个具名函数，职责单一，调用方清晰知道做了什么
 *
 * 当前覆盖两类场景：
 * ① 本地音乐管理（扫描、查询）
 * ② TrackSource 路由查询（plugin-comment / plugin-lyric 的跨插件查找）
 */

import { db, Tables } from './db'

// ============ 本地音乐相关 ============

/** 加载扫描所需的去重数据（Artist/Album/Track/Audio/关系表） */
export function loadScanDedupData() {
  const existingArtists = db.findAll<{ id: string; name: string }>(Tables.Artist)
  const existingAlbums = db.findAll<{ id: string; name: string }>(Tables.Album)
  const existingTracks = db.findAll<{
    id: string
    name: string
    albumId: string
    duration: number
    musicBrainzTrackId?: string
  }>(Tables.Track, { deleted: 0 })
  const existingAudios = db.findAll<{
    id: string
    trackId: string
    filePath: string
    cueOffset?: number
  }>(Tables.Audio, { deleted: 0 })
  const existingTrackArtists = db.findAll<{ trackId: string; artistId: string }>(Tables.TrackArtist)
  const existingArtistAlbums = db.findAll<{ artistId: string; albumId: string }>(Tables.ArtistAlbum)
  const existingTrackSources = db.findAll<{ trackId: string; pluginId: string }>(Tables.TrackSource)
  return {
    existingArtists,
    existingAlbums,
    existingTracks,
    existingAudios,
    existingTrackArtists,
    existingArtistAlbums,
    existingTrackSources
  }
}

/** 获取完整的本地音乐数据（给 getLocalMusic IPC 使用） */
export function getLocalMusicData() {
  const tracks = db.findAll(Tables.Track, { deleted: 0 })
  const albums = db.findAll(Tables.Album)
  const artists = db.findAll(Tables.Artist)
  const audios = db.findAll(Tables.Audio, { deleted: 0 })
  const trackArtists = db.findAll(Tables.TrackArtist)
  const artistAlbums = db.findAll(Tables.ArtistAlbum)
  return { tracks, albums, artists, audios, trackArtists, artistAlbums }
}

/** 事务写入一批数据（扫描结果批量入库） */
export function writeBatchData(dataToInsert: Record<string, any[]>) {
  db.sqlite.transaction(() => {
    for (const [table, rows] of Object.entries(dataToInsert)) {
      if (rows.length) db.insertMany(Tables[table as keyof typeof Tables], rows)
    }
  })()
}

/**
 * 扫描开始前：把本地独占的 Track 及其关联 Audio 标记为 deleted=1。
 *
 * 必须在 loadScanDedupData() 之后调用：
 * 去重快照基于未删除数据，若先调用本函数会把快照清空导致全表重复插入。
 * 本轮扫描命中的记录会随后通过 restoreLocalMusicDeleted 恢复为 deleted=0。
 *
 * 过滤逻辑：
 * - Audio：通过 TrackSource 联表，标记 trackId 关联了 pluginId='local' 的记录
 * - Track：只标记独占 local 的 track（无其他插件来源），避免误删缓存共享歌曲
 */
export function markAllLocalMusicDeleted() {
  db.sqlite.transaction(() => {
    db.sqlite.exec(
      `UPDATE ${Tables.Audio} SET deleted = 1 WHERE trackId IN (SELECT DISTINCT trackId FROM ${Tables.TrackSource} WHERE pluginId = 'local')`
    )
    db.sqlite.exec(
      `UPDATE ${Tables.Track} SET deleted = 1 WHERE id IN (SELECT DISTINCT trackId FROM ${Tables.TrackSource} WHERE pluginId = 'local') AND id NOT IN (SELECT DISTINCT trackId FROM ${Tables.TrackSource} WHERE pluginId != 'local')`
    )
  })()
}

/**
 * 末级清理：删除所有表中已无主实体引用的孤立记录。
 * 应在 Track/Album/Artist 删除后调用。
 */
function cleanupOrphanRefs() {
  db.sqlite.exec(
    `DELETE FROM ${Tables.Album} WHERE id NOT IN (SELECT DISTINCT albumId FROM ${Tables.Track} WHERE albumId IS NOT NULL)`
  )
  db.sqlite.exec(
    `DELETE FROM ${Tables.Artist} WHERE id NOT IN (SELECT DISTINCT artistId FROM ${Tables.TrackArtist})`
  )
  db.sqlite.exec(
    `DELETE FROM ${Tables.ArtistAlbum} WHERE artistId NOT IN (SELECT id FROM ${Tables.Artist}) OR albumId NOT IN (SELECT id FROM ${Tables.Album})`
  )
  db.sqlite.exec(
    `DELETE FROM ${Tables.AlbumSource} WHERE albumId NOT IN (SELECT id FROM ${Tables.Album})`
  )
  db.sqlite.exec(
    `DELETE FROM ${Tables.ArtistSource} WHERE artistId NOT IN (SELECT id FROM ${Tables.Artist})`
  )
  db.sqlite.exec(
    `DELETE FROM ${Tables.Lyrics} WHERE trackId NOT IN (SELECT id FROM ${Tables.Track})`
  )
  db.sqlite.exec(
    `DELETE FROM ${Tables.LyricOffsets} WHERE trackId NOT IN (SELECT id FROM ${Tables.Track})`
  )
}

/**
 * 清理缓存的 DB 记录（deleteExcessCache 使用）。
 *
 * 删除逻辑：
 * - 删除指定 Audio 记录
 * - 删除这些 trackId 的 library 类型 TrackSource
 * - 删除已无 local 或 stream 来源的孤立 Track
 * - 末级清理所有孤立引用
 */
export function deleteCacheFromDB(audioIds: string[], trackIds: string[]) {
  if (audioIds.length === 0) return

  db.sqlite.transaction(() => {
    // 1. 删除 Audio 记录
    const ph = audioIds.map(() => '?').join(',')
    db.sqlite.prepare(`DELETE FROM ${Tables.Audio} WHERE id IN (${ph})`).run(...audioIds)

    // 2. 删除这些 trackId 的 library 类型 TrackSource
    if (trackIds.length > 0) {
      const tph = trackIds.map(() => '?').join(',')
      db.sqlite
        .prepare(
          `DELETE FROM ${Tables.TrackSource} WHERE trackId IN (${tph})
           AND pluginId IN (SELECT id FROM ${Tables.Plugins} WHERE type = 'library')`
        )
        .run(...trackIds)
    }

    // 3. 找出已无 local 或 stream 来源的孤立 Track，删除它们
    if (trackIds.length > 0) {
      const tph = trackIds.map(() => '?').join(',')
      const orphanTrackIds = (
        db.sqlite
          .prepare(
            `SELECT DISTINCT t.id FROM ${Tables.Track} t
             WHERE t.id IN (${tph})
             AND NOT EXISTS (
               SELECT 1 FROM ${Tables.TrackSource} ts
               JOIN ${Tables.Plugins} p ON ts.pluginId = p.id
               WHERE ts.trackId = t.id AND p.type IN ('local', 'stream')
             )`
          )
          .all(...trackIds) as { id: string }[]
      ).map((r) => r.id)

      if (orphanTrackIds.length > 0) {
        const phOnly = orphanTrackIds.map(() => '?').join(',')
        db.sqlite
          .prepare(`DELETE FROM ${Tables.TrackArtist} WHERE trackId IN (${phOnly})`)
          .run(...orphanTrackIds)
        db.sqlite
          .prepare(`DELETE FROM ${Tables.Track} WHERE id IN (${phOnly})`)
          .run(...orphanTrackIds)
      }
    }

    // 4. 末级清理所有孤立引用
    cleanupOrphanRefs()
  })()
}

/**
 * 清空所有本地音乐数据（deleteLocalMusicDB 使用）。
 *
 * 删除逻辑：
 * - 查出所有 local trackId 的 TrackSource（JOIN plugin type），JS 层预判孤立
 * - 删除所有 pluginId='local' 的 TrackSource、Audio、Playlist、PlaylistEntry
 * - 删除孤立 track（排除 local 后剩余全为 library）
 * - 末级清理所有孤立引用
 */
export function deleteAllLocalMusicData() {
  db.sqlite.transaction(() => {
    const localTrackRows = db.sqlite
      .prepare(`SELECT DISTINCT trackId FROM ${Tables.TrackSource} WHERE pluginId = 'local'`)
      .all() as { trackId: string }[]
    const localTrackIds = localTrackRows.map((r) => r.trackId)

    if (localTrackIds.length === 0) return

    const ph = localTrackIds.map(() => '?').join(',')

    // 1. 查出这些 trackId 的所有 TrackSource（JOIN Plugins 获取 type），用于孤立预判
    const allSources = db.sqlite
      .prepare(
        `SELECT ts.trackId, p.type FROM ${Tables.TrackSource} ts
         JOIN ${Tables.Plugins} p ON ts.pluginId = p.id
         WHERE ts.trackId IN (${ph})`
      )
      .all(...localTrackIds) as { trackId: string; type: string }[]

    // 2. JS 层按 trackId 分组，排除 local 后判断是否只剩 library
    const sourceMap = new Map<string, Set<string>>()
    for (const row of allSources) {
      const types = sourceMap.get(row.trackId) || new Set()
      types.add(row.type)
      sourceMap.set(row.trackId, types)
    }

    const orphanTrackIds: string[] = []
    for (const [trackId, types] of sourceMap) {
      // 排除 local 后，无剩余来源或只剩 library → 孤立
      const remaining = new Set([...types].filter((t) => t !== 'local'))
      if (remaining.size === 0 || [...remaining].every((t) => t === 'library')) {
        orphanTrackIds.push(trackId)
      }
    }

    // 3. 删除 local 来源的 TrackSource
    db.sqlite.prepare(`DELETE FROM ${Tables.TrackSource} WHERE pluginId = 'local'`).run()

    // 4. 删除 local 来源的 Audio
    db.sqlite.prepare(`DELETE FROM ${Tables.Audio} WHERE trackId IN (${ph})`).run(...localTrackIds)

    // 5. 删除 local 来源的 Playlist + PlaylistEntry
    db.sqlite.prepare(`DELETE FROM ${Tables.PlaylistEntry} WHERE pluginId = 'local'`).run()
    db.sqlite.prepare(`DELETE FROM ${Tables.Playlist} WHERE pluginId = 'local'`).run()

    // 6. 删除孤立 track（剩余 TrackSource + TrackArtist + Track）
    if (orphanTrackIds.length > 0) {
      const phOnly = orphanTrackIds.map(() => '?').join(',')
      db.sqlite
        .prepare(`DELETE FROM ${Tables.TrackSource} WHERE trackId IN (${phOnly})`)
        .run(...orphanTrackIds)
      db.sqlite
        .prepare(`DELETE FROM ${Tables.TrackArtist} WHERE trackId IN (${phOnly})`)
        .run(...orphanTrackIds)
      db.sqlite
        .prepare(`DELETE FROM ${Tables.Track} WHERE id IN (${phOnly})`)
        .run(...orphanTrackIds)
    }

    // 7. 末级清理所有孤立引用
    cleanupOrphanRefs()
  })()
}

/**
 * 恢复被 markAllLocalMusicDeleted 标记的本地独占 Track/Audio 为 deleted=0。
 *
 * 用于扫描流程异常时回滚，使数据回到扫描前状态。
 * 条件与 markAllLocalMusicDeleted 对称，只恢复它标记过的记录。
 */
export function restoreAllLocalMusic() {
  db.sqlite.transaction(() => {
    db.sqlite.exec(
      `UPDATE ${Tables.Track} SET deleted = 0 WHERE id IN (SELECT DISTINCT trackId FROM ${Tables.TrackSource} WHERE pluginId = 'local') AND id NOT IN (SELECT DISTINCT trackId FROM ${Tables.TrackSource} WHERE pluginId != 'local')`
    )
    db.sqlite.exec(
      `UPDATE ${Tables.Audio} SET deleted = 0 WHERE trackId IN (SELECT DISTINCT trackId FROM ${Tables.TrackSource} WHERE pluginId = 'local')`
    )
  })()
}

/**
 * 扫描命中（或重新命中）的文件恢复 deleted=0。
 *
 * 以 filePath 为基准：先反查这些 filePath 对应的 trackId，
 * 然后把这些 Track（及对应 Audio）从 deleted=1 恢复为 deleted=0。
 * 本轮新插入的 Track/Audio 走 schema 默认值 deleted=0，不受影响。
 *
 * 注意：filePath 数量超过 999 时自动分批处理，避免 SQLite IN 子句参数上限（999）。
 *
 * @param filePaths 本轮扫描命中的所有文件路径（含已存在与新发现）
 */
export function restoreLocalMusicDeleted(filePaths: string[]) {
  if (!filePaths.length) return

  /** SQLite IN 子句参数上限（留余量） */
  const MAX_IN_PARAMS = 900

  const restoreBatch = db.sqlite.transaction((paths: string[]) => {
    // 1. 恢复命中的 Audio
    const placeholders = paths.map(() => '?').join(',')
    db.sqlite
      .prepare(`UPDATE ${Tables.Audio} SET deleted = 0 WHERE filePath IN (${placeholders})`)
      .run(...paths)
    // 2. 反查这些 Audio 关联的 trackId，恢复对应 Track
    const trackRows = db.sqlite
      .prepare(`SELECT DISTINCT trackId FROM ${Tables.Audio} WHERE filePath IN (${placeholders})`)
      .all(...paths) as { trackId: string }[]
    const trackIds = trackRows.map((r) => r.trackId).filter(Boolean)
    if (trackIds.length) {
      const trackPlaceholders = trackIds.map(() => '?').join(',')
      db.sqlite
        .prepare(`UPDATE ${Tables.Track} SET deleted = 0 WHERE id IN (${trackPlaceholders})`)
        .run(...trackIds)
    }
  })

  for (let i = 0; i < filePaths.length; i += MAX_IN_PARAMS) {
    restoreBatch(filePaths.slice(i, i + MAX_IN_PARAMS))
  }
}

// ============ TrackSource 路由查询 ============

/** 通过 (pluginId + sourceContext) 反查 trackId */
export function findTrackIdBySourceContext(
  pluginId: string,
  sourceContext: { id?: number | string } & Record<string, any>
): string | null {
  try {
    const sourceId = sourceContext?.id
    if (sourceId == null) return null

    const row = db.sqlite
      .prepare(
        `SELECT trackId
         FROM TrackSource
         WHERE pluginId = ?
         AND CAST(json_extract(sourceContext, '$.id') AS TEXT) = ?`
      )
      .get(pluginId, String(sourceId)) as { trackId: string } | undefined

    return row?.trackId || null
  } catch (error) {
    console.error('[findTrackIdBySourceContext]: ', error)
    return null
  }
}

/** 查询某个 trackId 关联的所有 TrackSource（用于跨插件路由） */
export function findTrackSourcesByTrackId(trackId: string) {
  try {
    return db.sqlite
      .prepare(
        'SELECT pluginId, sourceContext, matched FROM TrackSource WHERE trackId = ? ORDER BY matched DESC'
      )
      .all(trackId) as { pluginId: string; sourceContext: string; matched: number }[]
  } catch {
    return []
  }
}

/** 根据 sourceContext 反查 TrackSource：先通过 sourceContext.id 找到 canonical trackId，再返回该 trackId 的所有来源 */
export function findTrackSourcesBySourceContext(sourceContext: Record<string, any>) {
  try {
    const ctxStr = JSON.stringify(sourceContext)
    const row = db.sqlite
      .prepare('SELECT trackId FROM TrackSource WHERE sourceContext = ? LIMIT 1')
      .get(ctxStr) as { trackId: string } | undefined

    if (!row) return []
    return findTrackSourcesByTrackId(row.trackId)
  } catch {
    return []
  }
}

/** 插入一条 TrackSource 记录（存在则跳过） */
export function insertTrackSourceOnce(trackId: string, pluginId: string, sourceContext: string) {
  db.sqlite
    .prepare(
      `INSERT OR IGNORE INTO TrackSource(trackId, pluginId, sourceContext, matched, updateTime) VALUES (?, ?, ?, 1, datetime('now'))`
    )
    .run(trackId, pluginId, sourceContext)
}

/** 插入或替换一条 TrackSource 记录 */
export function upsertTrackSource(
  trackId: string,
  pluginId: string,
  sourceContext: string,
  matched: number
) {
  db.sqlite
    .prepare(
      `INSERT OR REPLACE INTO TrackSource(trackId, pluginId, sourceContext, matched, updateTime) VALUES (?, ?, ?, ?, datetime('now'))`
    )
    .run(trackId, pluginId, sourceContext, matched)
}

/** 检查某条 TrackSource 是否已存在 */
export function checkTrackSourceExists(trackId: string, pluginId: string): boolean {
  const row = db.sqlite
    .prepare('SELECT 1 FROM TrackSource WHERE trackId = ? AND pluginId = ?')
    .get(trackId, pluginId)
  return !!row
}

/** 根据 trackId 查找本地音频文件路径和封面（用于本地封面服务，含 albumId fallback） */
export function findLocalTrackAudio(trackId: string): { filePath: string; picUrl: string } | null {
  let _track = db.sqlite
    .prepare(`SELECT id, picUrl FROM ${Tables.Track} WHERE id = ? LIMIT 1`)
    .get(trackId) as { id: string; picUrl: string } | undefined
  let audio: { filePath: string } | undefined

  if (_track) {
    audio = db.sqlite
      .prepare(`SELECT filePath FROM ${Tables.Audio} WHERE trackId = ?`)
      .get(_track.id) as { filePath: string } | undefined
  } else {
    _track = db.sqlite
      .prepare(`SELECT id, picUrl FROM ${Tables.Track} WHERE albumId = ? LIMIT 1`)
      .get(trackId) as { id: string; picUrl: string } | undefined
    if (_track) {
      audio = db.sqlite
        .prepare(`SELECT filePath FROM ${Tables.Audio} WHERE trackId = ?`)
        .get(_track.id) as { filePath: string } | undefined
    } else {
      audio = db.sqlite
        .prepare(`SELECT filePath FROM ${Tables.Audio} WHERE trackId = ?`)
        .get(trackId) as { filePath: string } | undefined
    }
  }
  if (!audio) return null
  return { filePath: audio.filePath, picUrl: _track?.picUrl || '' }
}

// ============ 插件 Worker 数据存取（替代 cache 的 PluginData / LocalMusic 路由） ============

/** 读取插件持久化数据（登录态、token、cookie 等） */
export function getPluginData(pluginId: string) {
  const infos = db.findAll(Tables.PluginData, { pluginId })
  if (infos.length) {
    try {
      return JSON.parse(infos[0].json)
    } catch {
      return infos[0].json
    }
  }
  return { userId: 0, userName: '', pwd: '', isVip: false, cookie: '', token: '' }
}

/** 写入插件持久化数据 */
export function setPluginData(pluginId: string, type: string, data: any) {
  const id = `${pluginId}-1`
  // 先检查是否已有记录
  const existing = db.findAll(Tables.PluginData, { pluginId })
  if (existing.length) {
    const record = existing[0]
    record.json = JSON.stringify(data)
    record.updatedAt = Date.now()
    db.replace(Tables.PluginData, record)
  } else {
    db.upsert(
      Tables.PluginData,
      { id, pluginId, type, json: JSON.stringify(data), updatedAt: Date.now() },
      ['id']
    )
  }
}

/** 读取登录状态 */
export function getLoginStatus(platform: string) {
  const row = db.sqlite
    .prepare(`SELECT * FROM ${Tables.PluginData} WHERE platform = ? LIMIT 1`)
    .get(platform) as Record<string, any> | undefined
  if (!row) return { userId: 0, isVip: false }
  try {
    return JSON.parse(row.json)
  } catch {
    return row.json
  }
}

// ============ 插件 Worker 统一路由（替代 cache.ts 的 get/set，供 pluginManager 使用） ============

/** 通用插件数据查询：根据 key 路由到对应表的查询逻辑 */
export function pluginDbGet(
  key: string,
  params: { pluginId?: string; filter?: Record<string, any> } = {}
): any {
  switch (key) {
    case 'PluginData':
      return getPluginData(params.pluginId || '')
    case 'Track': {
      const filterIds = params.filter?.ids as string[] | undefined
      const pluginJoin = params.pluginId
        ? `JOIN ${Tables.TrackSource} ts ON ts.trackId = t.id AND ts.pluginId = ?`
        : ''
      const pluginParam = params.pluginId ? [params.pluginId] : []
      // 跨表组装：Track + Album + Artist + TrackArtist + ArtistAlbum + Audio
      let trackRows: Record<string, any>[]
      if (filterIds?.length) {
        const placeholders = filterIds.map(() => '?').join(',')
        trackRows = db.sqlite
          .prepare(
            `SELECT t.* FROM ${Tables.Track} t ${pluginJoin} WHERE t.id IN (${placeholders}) AND t.deleted = 0`
          )
          .all(...pluginParam, ...filterIds) as Record<string, any>[]
        // SQLite WHERE IN 不保证返回顺序，按传入 ids 重排
        const idOrder = new Map(filterIds.map((id, i) => [id, i]))
        trackRows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))
      } else {
        trackRows = db.sqlite
          .prepare(`SELECT t.* FROM ${Tables.Track} t ${pluginJoin} WHERE t.deleted = 0`)
          .all(...pluginParam) as Record<string, any>[]
      }
      const albumMap = new Map(
        (
          db.sqlite.prepare(`SELECT id, name FROM ${Tables.Album}`).all() as Record<string, any>[]
        ).map((a) => [a.id, a.name])
      )
      const artistNameMap = new Map(
        (
          db.sqlite.prepare(`SELECT id, name FROM ${Tables.Artist}`).all() as Record<string, any>[]
        ).map((a) => [a.id, a.name])
      )
      const trackArtistMap = new Map<string, { id: string; name: string }[]>()
      const trackArtistSql = filterIds?.length
        ? `SELECT * FROM ${Tables.TrackArtist} WHERE trackId IN (${filterIds.map(() => '?').join(',')})`
        : `SELECT * FROM ${Tables.TrackArtist}`
      for (const ta of (filterIds?.length
        ? db.sqlite.prepare(trackArtistSql).all(...filterIds)
        : db.sqlite.prepare(trackArtistSql).all()) as { trackId: string; artistId: string }[]) {
        const list = trackArtistMap.get(ta.trackId) || []
        const name = artistNameMap.get(ta.artistId)
        if (name) list.push({ id: ta.artistId, name })
        trackArtistMap.set(ta.trackId, list)
      }
      const albumArtistMap = new Map<string, { id: string; name: string }[]>()
      for (const aa of db.sqlite.prepare(`SELECT * FROM ${Tables.ArtistAlbum}`).all() as {
        artistId: string
        albumId: string
      }[]) {
        const list = albumArtistMap.get(aa.albumId) || []
        const name = artistNameMap.get(aa.artistId)
        if (name) list.push({ id: aa.artistId, name })
        albumArtistMap.set(aa.albumId, list)
      }
      const audioSql = filterIds?.length
        ? `SELECT trackId, filePath, size, md5, cueOffset, cueDuration FROM ${Tables.Audio} WHERE trackId IN (${filterIds.map(() => '?').join(',')}) AND deleted = 0`
        : `SELECT trackId, filePath, size, md5, cueOffset, cueDuration FROM ${Tables.Audio} WHERE deleted = 0`
      const audioPathMap = new Map(
        (
          (filterIds?.length
            ? db.sqlite.prepare(audioSql).all(...filterIds)
            : db.sqlite.prepare(audioSql).all()) as Record<string, any>[]
        ).map((a) => [
          a.trackId,
          {
            filePath: a.filePath,
            size: a.size,
            md5: a.md5,
            cueOffset: a.cueOffset || 0,
            cueDuration: a.cueDuration || 0
          }
        ])
      )

      const songs = trackRows.map((track) => {
        const audioInfo = audioPathMap.get(track.id) || {
          filePath: '',
          size: 0,
          md5: '',
          cueOffset: 0,
          cueDuration: 0
        }
        return {
          id: track.id,
          name: track.name,
          duration: track.duration,
          albumId: track.albumId,
          albumName: albumMap.get(track.albumId) || '',
          artists: trackArtistMap.get(track.id) || [],
          albumArtists: albumArtistMap.get(track.albumId) || [],
          filePath: audioInfo.filePath,
          size: audioInfo.size,
          md5: audioInfo.md5,
          cueOffset: audioInfo.cueOffset,
          cueDuration: audioInfo.cueDuration,
          picUrl: track.picUrl,
          playCount: track.playCount,
          liked: track.liked || 0,
          createTime: track.createTime,
          no: track.no,
          alias: track.alias || ''
        }
      })

      return {
        code: 200,
        songs,
        privileges: {}
      }
    }
    case 'Album':
      return db.findAll(Tables.Album)
    case 'Artist':
      return db.findAll(Tables.Artist)
    case 'Playlist': {
      const filterId = params.filter?.id as string | undefined
      return getPlaylists(params.pluginId || '', filterId)
    }
    case 'PlaylistEntry': {
      const playlistId = params.filter?.playlistId as string | undefined
      const playlistIds = params.filter?.playlistIds as string[] | undefined
      const countOnly = params.filter?.$count as boolean | undefined
      const firstOnly = params.filter?.$first as boolean | undefined
      if (countOnly && playlistIds) return getPlaylistEntryCounts(playlistIds)
      if (firstOnly && playlistId) {
        return (
          (db.sqlite
            .prepare(
              `SELECT * FROM ${Tables.PlaylistEntry} WHERE playlistId = ? ORDER BY position DESC LIMIT 1`
            )
            .get(playlistId) as Record<string, any> | undefined) || null
        )
      }
      return playlistId ? getPlaylistEntries(playlistId) : []
    }
    default:
      return null
  }
}

/** 通用插件数据写入：根据 key 路由到对应表的写入逻辑 */
export function pluginDbSet(
  key: string,
  value: any,
  meta: { pluginId?: string; type?: string } = {}
) {
  switch (key) {
    case 'PluginData':
      setPluginData(meta.pluginId || '', meta.type || 'plugin', value)
      break
    case 'Track':
      updateTrackField(value.id, value)
      break
    case 'Artist':
      updateArtistField(value.id, value)
      break
    case 'Album':
      updateAlbumField(value.id, value)
      break
    case 'Playlist':
      if (value._delete) {
        deletePlaylist(value.id, meta.pluginId || '')
      } else if (value.id) {
        upsertPlaylist(value.id, meta.pluginId || '', value)
      }
      break
    case 'PlaylistEntry':
      if (value._delete) {
        removePlaylistEntry(value.id)
      } else if (value._reorder) {
        reorderPlaylistEntries(value.playlistId, value.orderedEntryIds)
      } else if (value.playlistId && value.pluginId) {
        addPlaylistEntry(
          value.playlistId,
          value.pluginId,
          JSON.stringify(value.sourceContext || {})
        )
      }
      break
  }
}

// ============ 插件 Worker Track/Album/Artist 查询（local.js 等插件通过 DB_REQUEST 获取） ============

/** 获取本地歌曲列表（返回格式兼容旧 cache API：{ songs, privileges }） */
export function getLocalTracksForPlugin() {
  const trackRows = db.sqlite
    .prepare(`SELECT * FROM ${Tables.Track} WHERE deleted = 0`)
    .all() as Record<string, any>[]
  return { songs: trackRows, privileges: {} }
}

/** 更新 Track 表中指定 ID 的字段 */
export function updateTrackField(id: string, fields: Record<string, any>) {
  const setClauses: string[] = []
  const values: any[] = []

  // 普通字段赋值
  const plainKeys = Object.keys(fields).filter((k) => k !== 'id' && k !== '$inc')
  for (const k of plainKeys) {
    setClauses.push(`${k} = ?`)
    const v = fields[k]
    values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v)
  }

  // $inc 原子递增：{ $inc: { playCount: 1 } } → playCount = playCount + 1
  const inc = fields.$inc as Record<string, number> | undefined
  if (inc) {
    for (const [k, delta] of Object.entries(inc)) {
      setClauses.push(`${k} = ${k} + ?`)
      values.push(delta)
    }
  }

  if (!setClauses.length) return
  db.sqlite
    .prepare(`UPDATE ${Tables.Track} SET ${setClauses.join(', ')}, updateTime = ? WHERE id = ?`)
    .run(...values, Date.now(), String(id))
}

/** 更新 Artist 表中指定 ID 的字段 */
export function updateArtistField(id: string, fields: Record<string, any>) {
  const keys = Object.keys(fields).filter((k) => k !== 'id')
  if (!keys.length) return
  const setClause = keys.map((k) => `${k} = ?`).join(', ')
  const values = keys.map((k) => {
    const v = fields[k]
    return typeof v === 'boolean' ? (v ? 1 : 0) : v
  })
  db.sqlite
    .prepare(`UPDATE ${Tables.Artist} SET ${setClause}, updateTime = ? WHERE id = ?`)
    .run(...values, Date.now(), String(id))
}

/** 更新 Album 表中指定 ID 的字段 */
export function updateAlbumField(id: string, fields: Record<string, any>) {
  const keys = Object.keys(fields).filter((k) => k !== 'id')
  if (!keys.length) return
  const setClause = keys.map((k) => `${k} = ?`).join(', ')
  const values = keys.map((k) => {
    const v = fields[k]
    return typeof v === 'boolean' ? (v ? 1 : 0) : v
  })
  db.sqlite
    .prepare(`UPDATE ${Tables.Album} SET ${setClause}, updateTime = ? WHERE id = ?`)
    .run(...values, Date.now(), String(id))
}

// ============ Playlist / PlaylistEntry CRUD ============

/** 获取插件下的歌单列表 */
export function getPlaylists(pluginId: string, id?: string): any[] {
  if (id) {
    const row = db.sqlite
      .prepare(`SELECT * FROM ${Tables.Playlist} WHERE id = ? AND pluginId = ?`)
      .get(id, pluginId) as Record<string, any> | undefined
    return row ? [row] : []
  }
  return db.findAll(Tables.Playlist, { pluginId })
}

/** 创建歌单（自动生成 id） */
export function createPlaylist(
  pluginId: string,
  name: string,
  description: string
): Record<string, any> {
  const id = 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
  const now = Date.now()
  db.insert(Tables.Playlist, {
    id,
    pluginId,
    name,
    description,
    picUrl: '',
    createTime: now,
    updateTime: now
  })
  return { id, name, description, createTime: now }
}

/** 创建或更新歌单（只更新传入的字段，未传的字段保留原值） */
export function upsertPlaylist(id: string, pluginId: string, data: Record<string, any>) {
  const existing = db.sqlite
    .prepare(`SELECT * FROM ${Tables.Playlist} WHERE id = ? AND pluginId = ?`)
    .get(id, pluginId) as Record<string, any> | undefined
  const now = Date.now()

  if (existing) {
    const name = data.name ?? existing.name
    const description = data.description ?? existing.description
    const picUrl = data.picUrl ?? existing.picUrl
    db.sqlite
      .prepare(
        `UPDATE ${Tables.Playlist} SET name = ?, description = ?, picUrl = ?, updateTime = ? WHERE id = ? AND pluginId = ?`
      )
      .run(name, description, picUrl, now, id, pluginId)
  } else {
    db.insert(Tables.Playlist, {
      id,
      pluginId,
      name: data.name || '',
      description: data.description || '',
      picUrl: data.picUrl || '',
      createTime: now,
      updateTime: now
    })
  }
}

/** 删除歌单及其所有条目 */
export function deletePlaylist(id: string, pluginId: string) {
  db.sqlite.transaction(() => {
    db.sqlite.prepare(`DELETE FROM ${Tables.PlaylistEntry} WHERE playlistId = ?`).run(id)
    db.sqlite
      .prepare(`DELETE FROM ${Tables.Playlist} WHERE id = ? AND pluginId = ?`)
      .run(id, pluginId)
  })()
}

/** 获取歌单的歌曲条目 */
export function getPlaylistEntries(playlistId: string) {
  return db.sqlite
    .prepare(`SELECT * FROM ${Tables.PlaylistEntry} WHERE playlistId = ? ORDER BY position DESC`)
    .all(playlistId) as Record<string, any>[]
}

/** 匹配后刷新歌单封面：仅当被匹配的歌曲是该歌单显示的第一首时更新 */
export function refreshPlaylistCoverAfterMatch(trackId: string, picUrl: string) {
  if (!picUrl) return
  const entries = db.sqlite
    .prepare(
      `SELECT * FROM ${Tables.PlaylistEntry} WHERE pluginId = 'local' AND json_extract(sourceContext, '$.id') = ?`
    )
    .all(trackId) as Record<string, any>[]
  for (const entry of entries) {
    const maxPos = db.sqlite
      .prepare(`SELECT MAX(position) as m FROM ${Tables.PlaylistEntry} WHERE playlistId = ?`)
      .get(entry.playlistId) as { m: number | null }
    if (maxPos.m != null && maxPos.m === entry.position) {
      db.sqlite
        .prepare(`UPDATE ${Tables.Playlist} SET picUrl = ?, updateTime = ? WHERE id = ?`)
        .run(picUrl, Date.now(), String(entry.playlistId))
    }
  }
}

/** 添加歌曲到歌单（自动分配 position） */
export function addPlaylistEntry(playlistId: string, pluginId: string, sourceContext: string) {
  const maxPos = db.sqlite
    .prepare(
      `SELECT COALESCE(MAX(position), -1) + 1 as nextPos FROM ${Tables.PlaylistEntry} WHERE playlistId = ?`
    )
    .get(playlistId) as { nextPos: number }
  db.insert(Tables.PlaylistEntry, {
    playlistId,
    pluginId,
    sourceContext,
    position: maxPos.nextPos,
    createTime: Date.now()
  })
}

/** 移除歌单中的歌曲条目 */
export function removePlaylistEntry(id: number) {
  db.sqlite.prepare(`DELETE FROM ${Tables.PlaylistEntry} WHERE id = ?`).run(id)
}

/** 批量更新歌单条目顺序（事务内原子操作）
 *  orderedEntryIds 按显示顺序（第1首 → 最后1首）传入。
 *  由于 PlaylistEntry 以 ORDER BY position DESC 读取，
 *  第1首需获最高 position，最后1首 position=0。
 */
export function reorderPlaylistEntries(playlistId: string, orderedEntryIds: number[]) {
  if (!orderedEntryIds.length) return
  const maxPos = orderedEntryIds.length - 1
  db.sqlite.transaction(() => {
    const stmt = db.sqlite.prepare(
      `UPDATE ${Tables.PlaylistEntry} SET position = ? WHERE id = ? AND playlistId = ?`
    )
    for (let i = 0; i < orderedEntryIds.length; i++) {
      stmt.run(maxPos - i, orderedEntryIds[i], playlistId)
    }
  })()
}

/** 批量查询歌单条目数（返回 { playlistId → count } 映射） */
export function getPlaylistEntryCounts(playlistIds: string[]): Record<string, number> {
  if (!playlistIds.length) return {}
  const placeholders = playlistIds.map(() => '?').join(',')
  const rows = db.sqlite
    .prepare(
      `SELECT playlistId, COUNT(*) as count FROM ${Tables.PlaylistEntry} WHERE playlistId IN (${placeholders}) GROUP BY playlistId`
    )
    .all(...playlistIds) as { playlistId: string; count: number }[]
  const result: Record<string, number> = {}
  for (const r of rows) result[r.playlistId] = r.count
  for (const id of playlistIds) if (!result[id]) result[id] = 0
  return result
}

// ============ HTTP 服务用查询（替代 index.ts 中的 cache 调用） ============

/** 根据 song id 获取 Track 信息（目前返回空 stub，后续可按需实现） */
export function getTrackFromDb() {
  // 旧逻辑：cache.get(CacheAPIs.Track, { ids }) → 返回 { code: 200, songs: [], privileges: {} }
  // 新 schema 下需要跨表组装，暂未实现，返回空
  return { code: 200, songs: [], privileges: {} }
}

/** 更新 Track 封面图 */
export function updateTrackPicUrl(trackId: string, picUrl: string) {
  db.sqlite
    .prepare("UPDATE Track SET picUrl = ?, updateTime = datetime('now') WHERE id = ?")
    .run(picUrl, trackId)
}

/** 根据 TrackId 更新其对应 Album 的封面图（无条件覆盖） */
export function updateAlbumPicUrlByTrackId(trackId: string, picUrl: string) {
  const track = db.sqlite.prepare('SELECT albumId FROM Track WHERE id = ?').get(trackId) as
    | { albumId: string }
    | undefined
  if (track?.albumId) {
    db.sqlite
      .prepare("UPDATE Album SET picUrl = ?, updateTime = datetime('now') WHERE id = ?")
      .run(picUrl, track.albumId)
  }
}

// ============ 缓存相关 ============

/** task-done: 缓存完成后写入 Track/Album/Artist/TrackSource/Audio */
export function saveCacheResult(
  data: Record<string, any>,
  meta: { plugin?: string; gain?: number; peak?: number } | undefined
) {
  db.sqlite.transaction(() => {
    const trackId = String(data.id)

    // Track 不存在则插入
    if (!db.sqlite.prepare(`SELECT id FROM ${Tables.Track} WHERE id = ?`).get(trackId)) {
      // Album
      const album = data.album
      if (album?.id) {
        db.sqlite
          .prepare(
            `INSERT OR IGNORE INTO ${Tables.Album} (id, name, picUrl, type, company, description, subscribed, isExplicit, publishTime, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            String(album.id),
            album.name || '',
            album.picUrl || '',
            '',
            '',
            '',
            0,
            0,
            0,
            Date.now(),
            Date.now()
          )
      }
      // Artists（含 albumArtists）
      const allArtists = [...(data.artists || []), ...(data.albumArtists || [])]
      for (const ar of allArtists) {
        if (ar?.id) {
          db.sqlite
            .prepare(
              `INSERT OR IGNORE INTO ${Tables.Artist} (id, name, picUrl, description, followed, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(String(ar.id), ar.name || '', ar.picUrl || '', '', 0, Date.now(), Date.now())
        }
      }
      // Track
      db.sqlite
        .prepare(
          `INSERT OR IGNORE INTO ${Tables.Track} (id, name, duration, albumId, no, alias, picUrl, playCount, liked, deleted, musicBrainzTrackId, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          trackId,
          data.name || '',
          Math.trunc(data.duration || 0),
          album?.id ? String(album.id) : null,
          0,
          '',
          data.picUrl || '',
          0,
          0,
          0,
          '',
          Date.now(),
          Date.now()
        )
      // TrackArtist
      for (const ar of data.artists || []) {
        if (ar?.id) {
          db.sqlite
            .prepare(
              `INSERT OR IGNORE INTO ${Tables.TrackArtist} (trackId, artistId) VALUES (?, ?)`
            )
            .run(trackId, String(ar.id))
        }
      }
      // ArtistAlbum（仅 albumArtists）
      for (const ar of data.albumArtists || []) {
        if (ar?.id && album?.id) {
          db.sqlite
            .prepare(
              `INSERT OR IGNORE INTO ${Tables.ArtistAlbum} (artistId, albumId) VALUES (?, ?)`
            )
            .run(String(ar.id), String(album.id))
        }
      }
    }
    // ② TrackSource
    const srcCtx = data.sourceContext
      ? JSON.stringify({ ...data.sourceContext, filePath: data.url })
      : ''
    db.sqlite
      .prepare(
        `INSERT OR IGNORE INTO ${Tables.TrackSource} (trackId, pluginId, sourceContext) VALUES (?, ?, ?)`
      )
      .run(trackId, meta?.plugin || '', srcCtx)
    // ③ Audio
    db.sqlite
      .prepare(
        `INSERT OR REPLACE INTO ${Tables.Audio} (id, trackId, filePath, md5, bitrate, gain, peak, size, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        `cache:${String(data.id)}`,
        trackId,
        data.url,
        '',
        0,
        meta?.gain ?? 0,
        meta?.peak ?? 1,
        Number(data.size) || 0,
        0
      )
  })()
}

/** 查询缓存统计（filePath LIKE 某路径） */
export function getAudioCacheStats(audioCachePath: string): {
  length: number
  size: number
} {
  return (
    (db.sqlite
      .prepare(
        `SELECT COUNT(*) as length, COALESCE(SUM(size), 0) as size FROM ${Tables.Audio} WHERE filePath LIKE ? AND deleted = 0`
      )
      .get(`${audioCachePath}%`) as { length: number; size: number }) || { length: 0, size: 0 }
  )
}

/** 查询指定 trackId 的缓存音频 */
export function findCachedAudio(
  trackId: string,
  audioCachePath: string
): { id: string; filePath: string; gain: number; peak: number } {
  return (
    (db.sqlite
      .prepare(`SELECT * FROM ${Tables.Audio} WHERE trackId = ? AND filePath LIKE ? LIMIT 1`)
      .get(trackId, `${audioCachePath}%`) as {
      id: string
      filePath: string
      gain: number
      peak: number
    }) || {
      id: '',
      filePath: '',
      gain: 0,
      peak: 1
    }
  )
}

/** 检查指定 trackId 是否已有缓存 */
export function hasCachedAudio(trackId: string): boolean {
  return !!db.sqlite
    .prepare(`SELECT id FROM ${Tables.Audio} WHERE trackId = ? AND deleted = 0`)
    .get(trackId)
}

// ============ LyricOffsets 歌词偏移 ============

/** 获取指定歌曲的歌词偏移量（秒） */
export function getLyricOffsetFromDB(pluginId: string, trackId: string): number {
  try {
    const row = db.sqlite
      .prepare(`SELECT "offset" FROM ${Tables.LyricOffsets} WHERE pluginId = ? AND trackId = ?`)
      .get(pluginId, String(trackId)) as { offset: number } | undefined
    return row?.offset ?? 0
  } catch {
    return 0
  }
}

/** 保存指定歌曲的歌词偏移量到数据库 */
export function saveLyricOffsetToDB(pluginId: string, trackId: string, offset: number) {
  db.sqlite
    .prepare(
      `INSERT OR REPLACE INTO ${Tables.LyricOffsets} (pluginId, trackId, "offset", updateTime) VALUES (?, ?, ?, datetime('now'))`
    )
    .run(pluginId, String(trackId), offset)
}

/** 查询缓存统计（不检查 deleted 标志，用于 getCacheTracksInfo） */
export function getAudioCacheStatsAll(audioCachePath: string): {
  length: number
  size: number
} {
  return (
    (db.sqlite
      .prepare(
        `SELECT COUNT(*) as length, COALESCE(SUM(size), 0) as size FROM ${Tables.Audio} WHERE filePath LIKE ?`
      )
      .get(`${audioCachePath}%`) as { length: number; size: number }) || { length: 0, size: 0 }
  )
}

/** 删除缓存音频对应的 Audio 记录 */
export function deleteCacheAudio(audioId: string) {
  db.sqlite.prepare(`DELETE FROM ${Tables.Audio} WHERE id = ?`).run(audioId)
}

/** 删除缓存音频对应的 TrackSource（仅 library 插件） */
export function deleteCacheTrackSources(trackId: string, libraryPluginIds: string[]) {
  if (libraryPluginIds.length > 0) {
    const pp = libraryPluginIds.map(() => '?').join(',')
    db.sqlite
      .prepare(`DELETE FROM ${Tables.TrackSource} WHERE trackId = ? AND pluginId IN (${pp})`)
      .run(trackId, ...libraryPluginIds)
  }
}

// ============ 插件管理 ============

export interface PluginRow {
  id: string
  name: string
  type: string
  icon: string
  path: string
  builtIn: number
  enabled: number
}

/** 读取所有已注册插件 */
export function getAllPlugins(): PluginRow[] {
  return db.sqlite
    .prepare(`SELECT * FROM ${Tables.Plugins} ORDER BY builtIn DESC, id ASC`)
    .all() as PluginRow[]
}

/** 插入或更新插件记录（INSERT OR IGNORE） */
export function upsertPlugin(id: string, pluginPath: string) {
  db.sqlite
    .prepare(
      `INSERT OR IGNORE INTO ${Tables.Plugins} (id, name, type, path, builtIn, enabled) VALUES (?, ?, ?, ?, 0, 1)`
    )
    .run(id, '', '', pluginPath)
}

/** 根据 id 查询单个插件记录 */
export function getPluginById(id: string): PluginRow | undefined {
  return db.sqlite.prepare(`SELECT * FROM ${Tables.Plugins} WHERE id = ?`).get(id) as
    | PluginRow
    | undefined
}

/** 为已有插件创建新实例（同文件不同 id） */
export function createPluginInstance(
  basePluginId: string,
  newInstanceName: string,
  resolvedPath: string
): { success: boolean; id?: string; error?: string } {
  const base = getPluginById(basePluginId)
  if (!base) return { success: false, error: '基础插件不存在' }

  // 生成新 id：baseId_name（去除特殊字符，只保留字母数字下划线）
  const safeName = newInstanceName.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_')
  const newId = `${basePluginId}_${safeName}`

  // 检查 id 是否已存在
  if (getPluginById(newId)) {
    return { success: false, error: '实例名称已存在' }
  }

  try {
    db.sqlite
      .prepare(
        `INSERT INTO ${Tables.Plugins} (id, name, type, path, builtIn, enabled) VALUES (?, ?, ?, ?, 0, 1)`
      )
      .run(newId, newInstanceName, base.type, resolvedPath)
  } catch (err: any) {
    if (err.message?.includes('UNIQUE') || err.message?.includes('PRIMARY')) {
      return { success: false, error: '实例ID已存在' }
    }
    throw err
  }

  return { success: true, id: newId }
}

/** 删除非内置插件实例 */
export function deletePluginInstance(pluginId: string): boolean {
  const plugin = getPluginById(pluginId)
  if (!plugin || plugin.builtIn === 1) return false

  db.sqlite.prepare(`DELETE FROM ${Tables.Plugins} WHERE id = ? AND builtIn = 0`).run(pluginId)
  return true
}

// ============ 流媒体匹配 ============

/** 查询已匹配流媒体歌曲数量（TrackSource 中 pluginId 为 stream 类型的去重 trackId） */
export function getStreamMatchCount(): number {
  const row = db.sqlite
    .prepare(
      `SELECT COUNT(DISTINCT ts.trackId) as count
       FROM ${Tables.TrackSource} ts
       JOIN ${Tables.Plugins} p ON ts.pluginId = p.id AND p.type = 'stream'`
    )
    .get() as { count: number }
  return row?.count ?? 0
}

/**
 * 清理所有 stream 类型插件的 TrackSource 记录，并清理孤立数据。
 *
 * 删除逻辑：
 * 1. 找出所有 stream 类型插件涉及的 trackId
 * 2. 查出这些 trackId 的所有 TrackSource（含 plugin 类型），在 JS 层按 trackId 分组判断
 * 3. 仅由 library 来源构成的 track → 孤立，删除所有相关数据
 * 4. 有 local 或 stream 来源的 track → 非孤立，仅删除 stream TrackSource
 * 5. 末级清理所有孤立引用
 */
export function clearStreamMatches(): void {
  db.sqlite.transaction(() => {
    const streamPluginIds = (
      db.sqlite.prepare(`SELECT id FROM ${Tables.Plugins} WHERE type = 'stream'`).all() as {
        id: string
      }[]
    ).map((r) => r.id)

    if (streamPluginIds.length === 0) return

    const sph = streamPluginIds.map(() => '?').join(',')

    // 1. 找出涉及 stream 的所有 trackId
    const affectedTrackIds = (
      db.sqlite
        .prepare(
          `SELECT DISTINCT trackId FROM ${Tables.TrackSource}
           WHERE pluginId IN (${sph})`
        )
        .all(...streamPluginIds) as { trackId: string }[]
    ).map((r) => r.trackId)

    if (affectedTrackIds.length === 0) return

    const tph = affectedTrackIds.map(() => '?').join(',')

    // 2. 查出这些 trackId 的所有 TrackSource，JOIN Plugins 获取 type
    const allSources = db.sqlite
      .prepare(
        `SELECT ts.trackId, p.type FROM ${Tables.TrackSource} ts
         JOIN ${Tables.Plugins} p ON ts.pluginId = p.id
         WHERE ts.trackId IN (${tph})`
      )
      .all(...affectedTrackIds) as { trackId: string; type: string }[]

    // 3. JS 层按 trackId 分组，排除 stream 类型，判断剩余类型
    const sourceMap = new Map<string, Set<string>>()
    for (const row of allSources) {
      const types = sourceMap.get(row.trackId) || new Set()
      types.add(row.type)
      sourceMap.set(row.trackId, types)
    }

    const orphanTrackIds: string[] = []
    for (const [trackId, types] of sourceMap) {
      // 排除 stream 后，无剩余来源或只剩 library → 孤立
      const remaining = new Set([...types].filter((t) => t !== 'stream'))
      if (remaining.size === 0 || [...remaining].every((t) => t === 'library')) {
        orphanTrackIds.push(trackId)
      }
    }

    // 4. 删除 stream 类型的 TrackSource
    db.sqlite
      .prepare(`DELETE FROM ${Tables.TrackSource} WHERE pluginId IN (${sph})`)
      .run(...streamPluginIds)

    // 5. 删除孤立 track 的所有剩余 TrackSource + TrackArtist + Track
    if (orphanTrackIds.length > 0) {
      const phOnly = orphanTrackIds.map(() => '?').join(',')
      db.sqlite
        .prepare(`DELETE FROM ${Tables.TrackSource} WHERE trackId IN (${phOnly})`)
        .run(...orphanTrackIds)
      db.sqlite
        .prepare(`DELETE FROM ${Tables.TrackArtist} WHERE trackId IN (${phOnly})`)
        .run(...orphanTrackIds)
      db.sqlite
        .prepare(`DELETE FROM ${Tables.Track} WHERE id IN (${phOnly})`)
        .run(...orphanTrackIds)
    }

    // 6. 末级清理所有孤立引用
    cleanupOrphanRefs()
  })()
}

/** CUE 分轨：恢复因去重匹配而无法重新插入的 Track/Audio 的 deleted=0 */
export function restoreCueTracks(trackIds: string[]) {
  if (!trackIds.length) return
  const ph = trackIds.map(() => '?').join(',')
  db.sqlite.transaction(() => {
    db.sqlite.prepare(`UPDATE ${Tables.Track} SET deleted = 0 WHERE id IN (${ph})`).run(...trackIds)
    db.sqlite
      .prepare(`UPDATE ${Tables.Audio} SET deleted = 0 WHERE trackId IN (${ph})`)
      .run(...trackIds)
  })()
}
