import * as db from '../dbHelpers'
import log from '../log'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import type { ScanBatchData, ScanProgress, ScanResult, ParsedTrackItem } from '@/types/localMusic'

// ============ 辅助函数（模块级） ============

/** 归一化：trim + 小写 + 全角→半角 */
const normalize = (str: string) =>
  str
    .trim()
    .toLowerCase()
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))

/** 构建 Track 去重键（不含 duration，用时长容差外配） */
const buildTrackDedupKey = (
  title: string,
  album: string,
  artists: string[],
  albumArtists: string[]
): string => {
  const normalizedTitle = normalize(title)
  const normalizedAlbum = normalize(album)
  const normalizedArtists = artists.map(normalize).sort().join(',')
  const normalizedAlbumArtists = albumArtists.map(normalize).sort().join(',')
  return `${normalizedTitle}|${normalizedAlbum}|${normalizedArtists}|${normalizedAlbumArtists}`
}

/** 构建 Album 去重键 */
const buildAlbumDedupKey = (albumName: string, albumArtists: string[]): string => {
  const normalizedAlbumName = normalize(albumName)
  const normalizedAlbumArtists = albumArtists.map(normalize).sort().join(',')
  return `${normalizedAlbumName}|${normalizedAlbumArtists}`
}

/** 用前缀+值生成确定性 ID */
const makeId = (prefix: string, value: string) =>
  crypto.createHash('md5').update(`${prefix}:${value}`).digest('hex')

/**
 * 执行本地音乐扫描的主逻辑。
 *
 * 职责范围：
 * - 加载去重快照、软删除、构建索引、glob 文件、Piscina 并发解析、去重/入库、
 *   事务写入、恢复 deleted 状态
 * - 创建并销毁 Piscina 线程池
 *
 * 不处理：
 * - 并发保护（调用方负责 isScanningLocalMusic 检查）
 * - isScanningLocalMusic 标志管理
 * - 出错后的 db.restoreAllLocalMusic() 回滚（由调用方决定）
 * - win.webContents.send 事件通知（通过 onProgress 回调透传进度）
 */
export async function scanLocalMusic(
  filePaths: string[],
  onProgress: (progress: ScanProgress) => void
): Promise<ScanResult> {
  const { default: Piscina } = (await import('piscina')) as typeof import('piscina')
  const fg = await import('fast-glob')
  const os = await import('os')

  const {
    existingArtists,
    existingAlbums,
    existingTracks,
    existingAudios,
    existingTrackArtists,
    existingArtistAlbums,
    existingTrackSources
  } = db.loadScanDedupData()

  // 软删除：先把所有本地 Track/Audio 标记为 deleted=1。
  // 注意：必须在 db.loadScanDedupData() 读取快照之后调用，
  // 否则去重比对数据会被清空，导致全表重复插入。
  // 本轮扫描命中的文件稍后通过 db.restoreLocalMusicDeleted 恢复为 deleted=0。
  db.markAllLocalMusicDeleted()

  const artistMap = new Map(existingArtists.map((a) => [normalize(a.name), a.id]))
  const existingAudioPathSet = new Set(
    existingAudios.map((a) => a.filePath + '@' + (a.cueOffset || 0))
  )

  // 创建去重索引
  const musicBrainzTrackMap = new Map<string, string>()
  const trackDedupMap = new Map<string, Array<{ trackId: string; duration: number }>>()

  // 构建 Track 的关联信息用于去重
  const trackAlbumMap = new Map<string, string>()
  const albumArtistMap = new Map<string, string[]>()
  const trackArtistMap = new Map<string, string[]>()

  for (const track of existingTracks) {
    if (track.musicBrainzTrackId) {
      musicBrainzTrackMap.set(track.musicBrainzTrackId, track.id)
    }
    trackAlbumMap.set(track.id, track.albumId)
  }

  for (const aa of existingArtistAlbums) {
    const artists = albumArtistMap.get(aa.albumId) || []
    if (!artists.includes(aa.artistId)) {
      artists.push(aa.artistId)
      albumArtistMap.set(aa.albumId, artists)
    }
  }

  for (const ta of existingTrackArtists) {
    const artists = trackArtistMap.get(ta.trackId) || []
    if (!artists.includes(ta.artistId)) {
      artists.push(ta.artistId)
      trackArtistMap.set(ta.trackId, artists)
    }
  }

  const artistNameMap = new Map(existingArtists.map((a) => [a.id, a.name]))
  const getArtistName = (artistId: string) => artistNameMap.get(artistId) || ''

  const albumById = new Map(existingAlbums.map((a) => [a.id, a]))

  // 构建 trackDedupMap：normalizedKey → [{trackId, duration}]
  for (const track of existingTracks) {
    const albumId = trackAlbumMap.get(track.id) || ''
    const album = albumById.get(albumId)
    const albumArtistIds = albumArtistMap.get(albumId) || []
    const albumArtistNames = albumArtistIds.map(getArtistName).filter(Boolean)
    const trackArtistIds = trackArtistMap.get(track.id) || []
    const trackArtistNames = trackArtistIds.map(getArtistName).filter(Boolean)

    const normalizedKey = buildTrackDedupKey(
      track.name,
      album?.name || '',
      trackArtistNames,
      albumArtistNames
    )
    if (normalizedKey) {
      const entries = trackDedupMap.get(normalizedKey) || []
      entries.push({ trackId: track.id, duration: track.duration })
      trackDedupMap.set(normalizedKey, entries)
    }
  }

  const patterns = ['**/*.{mp3,aiff,flac,alac,m4a,aac,wav,opus}']
  const results = await Promise.all(
    filePaths.map((dir) => fg.glob(patterns, { cwd: dir, absolute: true, onlyFiles: true }))
  )
  const allFiles = [...new Set(results.flat())]

  // 命中文件为空：可能是目录暂时不可达（启动时机、权限等），
  // 回滚 db.markAllLocalMusicDeleted，保留已有数据。
  if (allFiles.length === 0) {
    db.restoreAllLocalMusic()
    return { hasNewData: false }
  }

  // 扫描 .cue 搭配
  const cueCompanions = new Set<string>()
  for (const file of allFiles) {
    const dir = path.dirname(file)
    const base = path.basename(file, path.extname(file))
    if (fs.existsSync(path.join(dir, base + '.cue'))) {
      cueCompanions.add(file)
    }
  }

  // 有 CUE 的 FLAC 强制重扫（移除所有复合键，使重扫时重新创建 CUE 分轨条目）
  for (const file of cueCompanions) {
    const keysToDelete = [...existingAudioPathSet].filter((k) => k.startsWith(file + '@'))
    for (const k of keysToDelete) {
      existingAudioPathSet.delete(k)
    }
  }

  // 只扫描新文件（不存在于 Audio 表中的）
  const filesToProcess = allFiles.filter((f) => !existingAudioPathSet.has(f + '@0'))
  const workerPath = path.join(__dirname, 'workers/scanMusic.js')
  const piscina = new Piscina({
    filename: workerPath,
    minThreads: 2,
    maxThreads: Math.min(os.cpus().length / 2, 6)
  })

  const batchSize = 100
  const dataToInsert: ScanBatchData = {
    Artist: [],
    Album: [],
    Track: [],
    Audio: [],
    TrackArtist: [],
    ArtistAlbum: [],
    TrackSource: []
  }

  // 去重 Set，防止重复插入（初始化已有关系）
  const trackArtistSet = new Set<string>(
    existingTrackArtists.map((ta) => `${ta.trackId}:${ta.artistId}`)
  )
  const artistAlbumSet = new Set<string>(
    existingArtistAlbums.map((aa) => `${aa.artistId}:${aa.albumId}`)
  )
  const trackSourceSet = new Set<string>(
    existingTrackSources.map((ts) => `${ts.trackId}:${ts.pluginId}`)
  )

  // albumMap：albumDedupKey → albumId
  const albumMap = new Map<string, string>()
  for (const album of existingAlbums) {
    const albumArtistIds = albumArtistMap.get(album.id) || []
    const albumArtistNames = albumArtistIds.map(getArtistName).filter(Boolean)
    const key = buildAlbumDedupKey(album.name, albumArtistNames)
    albumMap.set(key, album.id)
  }

  // 收集因去重匹配而需恢复的 CUE 分轨（软删除后被 INSERT OR IGNORE 阻挡无法重新插入）
  const restoredTrackIds = new Set<string>()

  try {
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map((file) => piscina.run({ filePath: file }))
      )
      const _beforeTrack = dataToInsert.Track.length

      for (const result of batchResults) {
        if (result.status === 'rejected') {
          log.warn('文件解析失败:', result.reason)
          continue
        }
        const items: ParsedTrackItem[] | undefined = result.value
        if (!items || !items.length) continue

        for (const item of items) {
          const now = Date.now()
          let trackId: string
          let isNewTrack = true

          // albumArtist 为空时用 artists 作为 fallback
          const effectiveAlbumArtists =
            item.albumArtist?.length > 0 ? item.albumArtist : item.artists || []

          // 文件已被 existingAudioPathSet 过滤，走到这里的一定没有重复的 Audio
          // 强信号匹配：MusicBrainz Track ID
          if (item.musicBrainzTrackId && musicBrainzTrackMap.has(item.musicBrainzTrackId)) {
            trackId = musicBrainzTrackMap.get(item.musicBrainzTrackId)!
            isNewTrack = false
            if (cueCompanions.has(item.filePath)) restoredTrackIds.add(trackId)
          } else {
            // 中信号匹配：使用 trackDedupMap 进行 O(1) 查找，允许 2 秒时长误差
            const normalizedKey = buildTrackDedupKey(
              item.name,
              item.album || '未知专辑',
              item.artists || [],
              effectiveAlbumArtists
            )

            const candidates = trackDedupMap.get(normalizedKey) || []
            const matchedCandidate = candidates.find(
              (c) => Math.abs(c.duration - item.duration) <= 2000
            )

            if (matchedCandidate) {
              trackId = matchedCandidate.trackId
              isNewTrack = false
              if (cueCompanions.has(item.filePath)) restoredTrackIds.add(trackId)
            } else {
              trackId = crypto.randomUUID().replace(/-/g, '')
            }
          }

          // 创建艺术家
          const allArtistNames = [...new Set([...(item.artists || []), ...effectiveAlbumArtists])]
          const artistIds = allArtistNames.map((name: string) => {
            const normName = normalize(name)
            if (!artistMap.has(normName)) {
              const id = makeId('local_artist', normName)
              artistMap.set(normName, id)
              artistNameMap.set(id, name)
              dataToInsert.Artist.push({
                id,
                name,
                picUrl: '',
                description: '',
                followed: 0,
                createTime: now,
                updateTime: now
              })
            }
            return { name, id: artistMap.get(normName)! }
          })
          const artistIdMap = new Map(artistIds.map((a) => [a.name, a.id] as const))

          // Album 去重：albumName + albumArtists（排序）
          const albumName = item.album || '未知专辑'
          const albumDedupKey = buildAlbumDedupKey(albumName, effectiveAlbumArtists)
          let albumId: string

          if (albumMap.has(albumDedupKey)) {
            albumId = albumMap.get(albumDedupKey)!
          } else {
            albumId = makeId(
              'local_album',
              `${albumName}:${[...effectiveAlbumArtists].sort().join(',')}`
            )
            albumMap.set(albumDedupKey, albumId)
            dataToInsert.Album.push({
              id: albumId,
              name: albumName,
              picUrl: '',
              type: '',
              company: '',
              description: '',
              subscribed: 0,
              isExplicit: 0,
              publishTime: 0,
              createTime: now,
              updateTime: now
            })
          }

          // 如果是新 Track，创建 Track 记录
          if (isNewTrack) {
            dataToInsert.Track.push({
              id: trackId,
              name: item.name,
              duration: item.duration,
              albumId,
              no: 0,
              alias: '',
              picUrl: '',
              playCount: 0,
              musicBrainzTrackId: item.musicBrainzTrackId || null,
              createTime: item.createTime || now,
              updateTime: now
            })

            // 注册强信号：批次内后续文件可匹配
            if (item.musicBrainzTrackId) {
              musicBrainzTrackMap.set(item.musicBrainzTrackId, trackId)
            }

            // 创建 TrackArtist 关系
            for (const name of item.artists || []) {
              const artistId = artistIdMap.get(name)
              if (artistId) {
                const key = `${trackId}:${artistId}`
                if (!trackArtistSet.has(key)) {
                  trackArtistSet.add(key)
                  dataToInsert.TrackArtist.push({ trackId, artistId })
                }
              }
            }

            // 创建 ArtistAlbum 关系
            const albumArtistsToUse =
              effectiveAlbumArtists.length > 0 ? effectiveAlbumArtists : item.artists || []
            for (const name of albumArtistsToUse) {
              const artistId = artistIdMap.get(name)
              if (artistId) {
                const key = `${artistId}:${albumId}`
                if (!artistAlbumSet.has(key)) {
                  artistAlbumSet.add(key)
                  dataToInsert.ArtistAlbum.push({ artistId, albumId })
                  // 同步更新 albumArtistMap
                  const artists = albumArtistMap.get(albumId) || []
                  if (!artists.includes(artistId)) {
                    artists.push(artistId)
                    albumArtistMap.set(albumId, artists)
                  }
                }
              }
            }

            // 将新 Track 加入 trackDedupMap
            const normalizedKey = buildTrackDedupKey(
              item.name,
              albumName,
              item.artists || [],
              effectiveAlbumArtists
            )
            const entries = trackDedupMap.get(normalizedKey) || []
            entries.push({ trackId, duration: item.duration })
            trackDedupMap.set(normalizedKey, entries)
          }

          const audioKey = item.filePath + '@' + (item.cueOffset || 0)
          const audioId =
            item.cueOffset > 0
              ? makeId('audio', item.filePath + '@' + item.cueOffset)
              : makeId('audio', item.filePath)
          dataToInsert.Audio.push({
            id: audioId,
            trackId,
            filePath: item.filePath,
            md5: item.md5 || '',
            bitrate: item.br || 0,
            gain: item.gain || 0,
            peak: item.peak || 1,
            size: item.size || 0,
            cueOffset: item.cueOffset || 0,
            cueDuration: item.cueDuration || 0
          })
          existingAudioPathSet.add(audioKey)

          // TrackSource：标记该 Track 有本地来源
          const trackSourceKey = `${trackId}:local`
          if (!trackSourceSet.has(trackSourceKey)) {
            trackSourceSet.add(trackSourceKey)
            dataToInsert.TrackSource.push({
              trackId,
              pluginId: 'local',
              sourceContext: JSON.stringify({
                id: trackId,
                filePath: item.filePath,
                md5: item.md5 || '',
                cueOffset: item.cueOffset || 0,
                cueDuration: item.cueDuration || 0
              }),
              matched: 1,
              createTime: now,
              updateTime: now
            })
          }
        }
      }

      // 通知进度（每批次）
      onProgress({
        newTracks: dataToInsert.Track.length - _beforeTrack,
        processed: Math.min(i + batchSize, filesToProcess.length),
        total: filesToProcess.length
      })
    }

    // 单事务批量写入
    const hasNewData = Object.values(dataToInsert).some((arr) => arr.length > 0)
    db.writeBatchData(dataToInsert)
    // CUE 分轨：恢复去重匹配到的 Track/Audio
    db.restoreCueTracks([...restoredTrackIds])
    // 恢复本轮命中的文件
    db.restoreLocalMusicDeleted(allFiles)

    return { hasNewData }
  } finally {
    await piscina.destroy().catch(() => {})
  }
}
