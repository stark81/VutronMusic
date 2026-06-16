import { app, ipcMain, IpcMainEvent, BrowserWindow } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { YPMTray } from './tray'
import { MprisImpl } from './mpris'
import { checkUpdate, downloadUpdate } from './checkUpdate'
import Constants from './utils/Constants'
import store from './store'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { db, Tables } from './db'
import { CacheAPIs } from './utils/CacheApis'
import { deleteExcessCache, createWorker, getTrackDetail } from './utils'
// import cache from './cache'
import { registerGlobalShortcuts } from './globalShortcut'
import { createMenu } from './menu'
import log from './log'
import navidrome from './streaming/navidrome'
import emby from './streaming/emby'
import jellyfin from './streaming/jellyfin'
import { Worker } from 'worker_threads'
import { Track, Album, Artist, scanTrack, serviceName } from '@/types/music'
import type { Track as NewTrack } from '@/types/plugin'
// @ts-ignore
import _ from 'lodash'
import { requestUserAuth, scrobbleTrack, updateNowPlaying } from './utils/lastfm'
import { pluginManager } from './pluginManager'
import { PluginInstance } from './utils/pluginManager'

let isLock = store.get('osdWin.isLock') as boolean
let blockerId: number | null = null
let isScanningLocalMusic = false
let coverWorker: Worker
let cacheWorker: Worker | null = null

const closeCacheWorker = async () => {
  await cacheWorker?.terminate()
  cacheWorker = null
}

/*
 * IPC Communications
 * */
export default class IPCs {
  static initialize(
    win: BrowserWindow,
    tray: YPMTray,
    mpris: MprisImpl,
    lrc: Record<string, Function>
  ): void {
    initWindowIpcMain(win)
    initOSDWindowIpcMain(win, lrc)
    initTrayIpcMain(win, tray)
    initTaskbarIpcMain()
    initMprisIpcMain(win, mpris)
    initOtherIpcMain(win)
    initStreaming()
    initPluginIpcMain()

    coverWorker = createWorker('writeCover')
    coverWorker.on('message', (msg) => {
      if (msg.status === 'done') app.exit(0)
    })

    app.on('before-quit', (event) => {
      event.preventDefault()
      win.hide()
      coverWorker.postMessage({ type: 'finished' })
    })
  }
}

async function exitAsk(event: IpcMainEvent, win: BrowserWindow | null) {
  const { dialog } = await import('electron')
  event.preventDefault()
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Infomation',
      cancelId: 2,
      defaultId: 0,
      message: '确定要关闭吗？',
      buttons: ['最小化到托盘', '直接退出'],
      checkboxLabel: '记住我的选择'
    })
    .then((result) => {
      if (result.checkboxChecked && result.response !== 2) {
        win?.webContents.send(
          'rememberCloseAppOption',
          result.response === 0 ? 'minimizeToTray' : 'exit'
        )
      }
      if (result.response === 0) {
        event.preventDefault()
        win?.hide()
      } else if (result.response === 1) {
        setTimeout(() => {
          win = null
          app.exit()
        }, 100)
      }
    })
    .catch()
}

function initWindowIpcMain(win: BrowserWindow | null): void {
  ipcMain.on('minimize', () => {
    win?.minimize()
  })

  ipcMain.handle('maximizeOrUnmaximize', () => {
    win?.isMaximized() ? win?.unmaximize() : win?.maximize()
    return !win?.isMaximized()
  })

  ipcMain.on('close', (event: IpcMainEvent) => {
    const closeAppOption = store.get('settings.closeAppOption') || 'ask'
    if (closeAppOption === 'exit') {
      win = null
      app.exit()
    } else if (closeAppOption === 'minimizeToTray') {
      event.preventDefault()
      win?.hide()
    } else {
      exitAsk(event, win)
    }
  })
}

function initTrayIpcMain(win: BrowserWindow, tray: YPMTray): void {
  ipcMain.on(
    'updateTray',
    (event: IpcMainEvent, data: { img: string; width: number; height: number }) => {
      tray.updateTray(data.img, data.width, data.height)
    }
  )
  ipcMain.on('showWindow', () => {
    win.show()
  })

  ipcMain.on('updatePlayerState', (event: IpcMainEvent, data: any) => {
    for (const [key, value] of Object.entries(data) as [string, any]) {
      if (key === 'playing') {
        tray.setPlayState(value)
      } else if (key === 'repeatMode') {
        tray.setRepeatMode(value)
      } else if (key === 'shuffle') {
        tray.setShuffleMode(value)
      } else if (key === 'like') {
        tray.setLikeState(value)
      }
    }
  })

  ipcMain.on('setStoreSettings', async (event: IpcMainEvent, data: any) => {
    for (const [key, value] of Object.entries(data) as [string, any]) {
      store.set(`settings.${key}`, value)
      if (key === 'enableTrayMenu') {
        tray.setContextMenu()
      } else if (key === 'lang') {
        tray.setContextMenu()
      } else if (key === 'trayColor') {
        tray.updateTrayColor()
      } else if (key === 'enableGlobalShortcut') {
        const { globalShortcut } = await import('electron')
        if (value) {
          registerGlobalShortcuts(win)
        } else {
          globalShortcut.unregisterAll()
        }
      } else if (key === 'shortcuts') {
        createMenu(win)
        const global = store.get('settings.enableGlobalShortcut') as boolean
        if (global) {
          const { globalShortcut } = await import('electron')
          globalShortcut.unregisterAll()
          registerGlobalShortcuts(win)
        }
      } else if (key === 'autoCacheTrack') {
        const autoCache = (store.get('settings.autoCacheTrack.enable') as boolean) || false
        if (autoCache) {
          cacheWorker = createWorker('cacheTrack')
          cacheWorker?.on('message', async (msg) => {
            if (msg.type === 'task-done') {
              // const track = msg.data
              // await cache.set(CacheAPIs.LocalMusic, { newTracks: [track] })
              await deleteExcessCache()
              // const tracks = cache.get(CacheAPIs.LocalMusic, { sql: "type = 'online'" })
              // const size = tracks.songs
              //   .map((track: any) => track.size)
              //   .reduce((acc: string, cur: string) => Number(acc) + Number(cur), 0)

              win.webContents.send('receiveCacheInfo', { length: 0, size: 0 })
            } else if (msg.type === 'finished') {
              closeCacheWorker()
            }
          })
        } else {
          cacheWorker?.postMessage({ type: 'quit' })
        }
      } else if (key === 'proxy') {
        const map = { 1: 'http', 2: 'https' }
        if (value.type === 0) {
          win.webContents.session.setProxy({})
        } else {
          const proxyRules = `${map[value.type as keyof typeof map]}://${value.address}:${value.port}`
          win.webContents.session.setProxy({ proxyRules })
        }
      }
    }
  })

  ipcMain.on('updateOsdState', (event, data) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'show') {
      tray.setShowOSD(value)
    } else if (key === 'isLock') {
      tray.setOSDLock(value)
    }
  })

  ipcMain.on('updateTooltip', (event: IpcMainEvent, title: string) => {
    tray.updateTooltip(title)
  })
}

function initOSDWindowIpcMain(win: BrowserWindow, lrc: { [key: string]: Function }): void {
  ipcMain.on('updateOsdState', (event, data) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    store.set(`osdWin.${key}`, value)
    if (key === 'show') {
      lrc.toggleOSDWindow()
    } else if (key === 'type') {
      lrc.switchOSDWindow(value)
    } else if (key === 'isLock') {
      isLock = value
      lrc.toggleMouseIgnore()
    }
  })
  ipcMain.on('from-osd', (event, message: string) => {
    if (message === 'showMainWin') {
      win.show()
    } else if (message === 'playPrev') {
      win.webContents.send('previous')
    } else if (message === 'playNext') {
      win.webContents.send('next')
    } else if (message === 'playOrPause') {
      win.webContents.send('play')
    }
  })
  ipcMain.on('osd-resize', (event, height) => {
    lrc.updateOsdHeight(height)
  })
  ipcMain.on('updatePlayerState', (event: IpcMainEvent, data: any) => {
    for (const [key, value] of Object.entries(data) as [string, any]) {
      if (key === 'playing') {
        lrc.updateOSDPlayingState(value)
      }
    }
  })
  ipcMain.on('set-ignore-mouse', (event, ignore) => {
    store.set('osdWin.isLock', ignore)
    lrc.toggleMouseIgnore()
  })
  ipcMain.on('mouseleave', () => {
    store.set('osdWin.isLock', isLock)
    lrc.toggleMouseIgnore()
  })
  ipcMain.on('window-drag', (event, data: any) => {
    lrc.dragOsdWindow(data)
  })
  ipcMain.on('windowMouseleave', () => {
    lrc.windowMouseleave()
  })
}

function initTaskbarIpcMain(): void {}

async function initOtherIpcMain(win: BrowserWindow): Promise<void> {
  const client = require('discord-rich-presence')('1450799847962574868')

  ipcMain.on('playDiscordPresence', (event: IpcMainEvent, track: NewTrack) => {
    client.updatePresence({
      details:
        track.name + ' - ' + track.artists.map((ar: Record<string, any>) => ar.name).join(','),
      state: track.album.name,
      endTimestamp: Date.now() + track.duration,
      largeImageKey: track.album.picUrl + '?param=256y256',
      largeImageText: track.album.name,
      smallImageKey: 'play',
      smallImageText: '正在播放',
      instance: true
    })
  })

  ipcMain.on('pauseDiscordPresence', (event: IpcMainEvent, track: NewTrack) => {
    client.updatePresence({
      details:
        track.name + ' - ' + track.artists.map((ar: Record<string, any>) => ar.name).join(','),
      state: track.album.name,
      largeImageKey: track.album.picUrl + '?param=256y256',
      largeImageText: track.album.name,
      smallImageKey: 'pause',
      smallImageText: '已暂停',
      instance: true
    })
  })

  ipcMain.handle('lastfm-auth', async () => {
    const result = await requestUserAuth()
    return result
  })

  ipcMain.handle('get-lastfm-session', () => {
    const session = store.get('settings.lastfmSession') as {
      name: string
      key: string
      subscriber: number
    }
    return { name: session?.name || '' }
  })

  ipcMain.on('disconnect-lastfm', () => {
    store.set('settings.lastfmSession', { name: '', key: '', subscriber: 0 })
  })

  ipcMain.on('track-scrobble', (event, params: Record<string, any>) => {
    scrobbleTrack(params)
  })

  ipcMain.on('update-now-playing', (event, params: Record<string, any>) => {
    updateNowPlaying(params)
  })

  ipcMain.handle('msgRequestGetVersion', () => {
    return Constants.APP_VERSION
  })

  // Open url via web browser
  ipcMain.on('msgOpenExternalLink', async (event: IpcMainEvent, url: string) => {
    const { shell } = await import('electron')
    await shell.openExternal(url)
  })

  ipcMain.on('openLogFile', async () => {
    const { shell } = await import('electron')
    const logFilePath = log.transports.file.getFile().path
    shell.showItemInFolder(logFilePath)
  })

  // Open file
  ipcMain.handle('msgOpenFile', async (event, filter: string) => {
    const { dialog } = await import('electron')
    const filters = []
    if (filter === 'text') {
      filters.push({ name: 'Text', extensions: ['txt', 'json'] })
    } else if (filter === 'zip') {
      filters.push({ name: 'Zip', extensions: ['zip'] })
    }
    const dialogResult = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters
    })
    return dialogResult
  })

  ipcMain.handle('msgCheckFileExist', async (event, paths: string[]) => {
    const results = await Promise.all(
      paths.map(async (path) => {
        try {
          await fs.promises.access(path)
          return { path, exist: true }
        } catch {
          return { path, exist: false }
        }
      })
    )
    return results
  })

  ipcMain.handle('selecteFolder', async (event, data: { multi: boolean }) => {
    const { dialog } = await import('electron')

    const option: OpenDialogOptions['properties'] = ['openDirectory']
    if (data.multi) {
      option.push('multiSelections')
    }

    const result = await dialog.showOpenDialog({
      properties: option
    })
    if (!result.canceled) {
      return result.filePaths
    }
    return []
  })

  ipcMain.handle('showOpenDialog', async (event, options) => {
    const { dialog } = await import('electron')
    return await dialog.showOpenDialog(options)
  })

  ipcMain.handle('getFilesInFolder', async (event, folderPath: string, extensions: string[]) => {
    try {
      const files = fs.readdirSync(folderPath)
      const filteredFiles = files.filter((file: string) => {
        const ext = file.split('.').pop()?.toLowerCase()
        return ext && extensions.includes(ext)
      })
      return filteredFiles.map((file: string) => path.join(folderPath, file))
    } catch (error) {
      console.error('Error reading folder:', error)
      return []
    }
  })

  ipcMain.handle('getLocalMusic', () => {
    const tracks = db.findAll(Tables.Track)
    const albums = db.findAll(Tables.Album)
    const artists = db.findAll(Tables.Artist)
    const audios = db.findAll(Tables.Audio)
    const trackArtists = db.findAll(Tables.TrackArtist)
    const artistAlbums = db.findAll(Tables.ArtistAlbum)
    const playlists: any[] = []
    return { tracks, albums, artists, audios, trackArtists, artistAlbums, playlists }
  })

  ipcMain.handle('upsertLocalPlaylist', async (event, playlist: object) => {
    // const result = await cache.set(CacheAPIs.LocalPlaylist, playlist)
    return false
  })

  ipcMain.on('clearDeletedMusic', () => {
    // const { songs } = cache.get(CacheAPIs.LocalMusic)
    // const deletedTracks = []
    // if (songs.length === 0) return
    // for (let i = songs.length - 1; i >= 0; i--) {
    //   const track = songs[i]
    //   try {
    //     fs.accessSync(track.filePath, fs.constants.F_OK)
    //   } catch {
    //     deletedTracks.push(track.id)
    //   }
    // }
    // if (deletedTracks.length > 0) {
    //   try {
    //     db.deleteManyByIds(Tables.Track, deletedTracks, 'xxx')
    //     win.webContents.send('msgDeletedTracks', deletedTracks)
    //   } catch (e) {
    //     log.error(e)
    //   }
    // }
  })

  /**
   * @param {Object} data
   * @param data.filePath 待扫描的歌曲目录列表
   * @param data.cb 扫描完成后是否通知渲染进程
   */
  ipcMain.on('msgScanLocalMusic', async (event, data: { filePath: string[]; cb: boolean }) => {
    let piscina: any = null
    if (isScanningLocalMusic) {
      if (data.cb) win.webContents.send('scanLocalMusicDone')
      return
    }
    isScanningLocalMusic = true
    try {
      const { default: Piscina } = (await import('piscina')) as typeof import('piscina')
      const fg = await import('fast-glob')
      const os = await import('os')
      const existingArtists = db.findAll<{ id: string; name: string }>(Tables.Artist)
      const existingAlbums = db.findAll<{
        id: string
        name: string
      }>(Tables.Album)
      const existingTracks = db.findAll<{
        id: string
        name: string
        albumId: string
        duration: number
        musicBrainzTrackId?: string
      }>(Tables.Track)
      const existingAudios = db.findAll<{ id: string; trackId: string; filePath: string }>(
        Tables.Audio
      )
      const existingTrackArtists = db.findAll<{
        trackId: string
        artistId: string
      }>(Tables.TrackArtist)
      const existingArtistAlbums = db.findAll<{
        artistId: string
        albumId: string
      }>(Tables.ArtistAlbum)
      const existingTrackSources = db.findAll<{
        trackId: string
        pluginId: string
      }>(Tables.TrackSource)

      // 归一化函数：trim空格、统一全角/半角字符、忽略大小写
      const normalize = (str: string) => {
        return str
          .trim()
          .toLowerCase()
          .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      }

      const artistMap = new Map(existingArtists.map((a) => [normalize(a.name), a.id]))
      const existingAudioPathSet = new Set(existingAudios.map((a) => a.filePath))

      // 构建Track去重键（不含duration，允许时长误差）
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

      // Album去重键：albumName + albumArtists（排序）
      const buildAlbumDedupKey = (albumName: string, albumArtists: string[]): string => {
        const normalizedAlbumName = normalize(albumName)
        const normalizedAlbumArtists = albumArtists.map(normalize).sort().join(',')
        return `${normalizedAlbumName}|${normalizedAlbumArtists}`
      }

      // 创建去重索引
      const musicBrainzTrackMap = new Map<string, string>() // musicBrainzTrackId -> trackId
      const trackDedupMap = new Map<string, Array<{ trackId: string; duration: number }>>() // normalizedKey -> [{trackId, duration}]

      // 构建Track的关联信息用于去重
      const trackAlbumMap = new Map<string, string>() // trackId -> albumId
      const albumArtistMap = new Map<string, string[]>() // albumId -> artistIds (专辑艺术家，可能多个)
      const trackArtistMap = new Map<string, string[]>() // trackId -> artistIds (歌曲艺术家)

      for (const track of existingTracks) {
        // 强信号：MusicBrainz Track ID
        if (track.musicBrainzTrackId) {
          musicBrainzTrackMap.set(track.musicBrainzTrackId, track.id)
        }
        trackAlbumMap.set(track.id, track.albumId)
      }

      // 构建专辑-艺术家关系（一个专辑可能有多个艺术家）
      for (const aa of existingArtistAlbums) {
        const artists = albumArtistMap.get(aa.albumId) || []
        if (!artists.includes(aa.artistId)) {
          artists.push(aa.artistId)
          albumArtistMap.set(aa.albumId, artists)
        }
      }

      // 构建歌曲-艺术家关系
      for (const ta of existingTrackArtists) {
        const artists = trackArtistMap.get(ta.trackId) || []
        if (!artists.includes(ta.artistId)) {
          artists.push(ta.artistId)
          trackArtistMap.set(ta.trackId, artists)
        }
      }

      // 获取艺术家名称用于归一化（O(1)查找）
      const artistNameMap = new Map(existingArtists.map((a) => [a.id, a.name]))
      const getArtistName = (artistId: string) => {
        return artistNameMap.get(artistId) || ''
      }

      const albumById = new Map(existingAlbums.map((a) => [a.id, a]))

      // 构建trackDedupMap：normalizedKey -> [{trackId, duration}]
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

      const makeId = (prefix: string, value: string) =>
        crypto.createHash('md5').update(`${prefix}:${value}`).digest('hex')
      const patterns = ['**/*.{mp3,aiff,flac,alac,m4a,aac,wav,opus}']
      const results = await Promise.all(
        data.filePath.map((dir) => fg.glob(patterns, { cwd: dir, absolute: true, onlyFiles: true }))
      )
      const allFiles = [...new Set(results.flat())]
      // 只扫描新文件（不存在于 Audio 表中的）
      const filesToProcess = allFiles.filter((f) => !existingAudioPathSet.has(f))
      if (filesToProcess.length === 0) {
        if (data.cb) win.webContents.send('scanLocalMusicDone')
        return
      }
      const workerPath = path.join(__dirname, 'workers/scanMusic.js')
      piscina = new Piscina({
        filename: workerPath,
        minThreads: 2,
        maxThreads: Math.min(os.cpus().length / 2, 6)
      })
      const batchSize = 100
      const dataToInsert = {
        Artist: [] as any[],
        Album: [] as any[],
        Track: [] as any[],
        Audio: [] as any[],
        TrackArtist: [] as any[],
        ArtistAlbum: [] as any[],
        TrackSource: [] as any[]
      }

      // 去重Set，防止重复插入（初始化已有关系）
      const trackArtistSet = new Set<string>(
        existingTrackArtists.map((ta) => `${ta.trackId}:${ta.artistId}`)
      ) // trackId:artistId
      const artistAlbumSet = new Set<string>(
        existingArtistAlbums.map((aa) => `${aa.artistId}:${aa.albumId}`)
      ) // artistId:albumId

      const trackSourceSet = new Set<string>(
        existingTrackSources.map((ts) => `${ts.trackId}:${ts.pluginId}`)
      )

      // albumMap: albumDedupKey -> albumId
      const albumMap = new Map<string, string>()
      for (const album of existingAlbums) {
        const albumArtistIds = albumArtistMap.get(album.id) || []
        const albumArtistNames = albumArtistIds.map(getArtistName).filter(Boolean)
        const key = buildAlbumDedupKey(album.name, albumArtistNames)
        albumMap.set(key, album.id)
      }

      for (let i = 0; i < filesToProcess.length; i += batchSize) {
        const batch = filesToProcess.slice(i, i + batchSize)
        const batchResults = await Promise.allSettled(
          batch.map((file) => piscina.run({ filePath: file }))
        )
        for (const item of batchResults
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value)) {
          if (!item) continue
          const now = Date.now()
          let trackId: string
          let isNewTrack = true

          // albumArtist为空时用artists作为fallback
          const effectiveAlbumArtists =
            item.albumArtist?.length > 0 ? item.albumArtist : item.artists || []

          // 文件已被 existingAudioPathSet 过滤，走到这里的一定没有重复的 Audio
          // 强信号匹配：MusicBrainz Track ID
          if (item.musicBrainzTrackId && musicBrainzTrackMap.has(item.musicBrainzTrackId)) {
            trackId = musicBrainzTrackMap.get(item.musicBrainzTrackId)!
            isNewTrack = false
          } else {
            // 中信号匹配：使用trackDedupMap进行O(1)查找，允许2秒时长误差
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
            } else {
              // 没有匹配到，创建新Track（使用UUID，而非filePath）
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
              // 同步更新 artistNameMap
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
          const artistIdMap = new Map(artistIds.map((a: any) => [a.name, a.id]))

          // Album去重：albumName + albumArtists（排序）
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

          // 如果是新Track，创建Track记录
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

            // 创建TrackArtist关系（使用Set去重）
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

            // 创建ArtistAlbum关系（albumArtist为空时用artists，使用Set去重）
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

            // 将新Track加入trackDedupMap
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

          // 检查Audio是否已存在，避免重复插入
          if (!existingAudioPathSet.has(item.filePath)) {
            const audioId = makeId('audio', item.filePath)
            dataToInsert.Audio.push({
              id: audioId,
              trackId,
              filePath: item.filePath,
              md5: item.md5 || '',
              bitrate: item.br || 0,
              gain: item.gain || 0,
              peak: item.peak || 1,
              size: item.size || 0
            })
            existingAudioPathSet.add(item.filePath) // 防止同批次重复
          }

          // TrackSource：标记该 Track 有本地来源（仅当尚未存在时）
          const trackSourceKey = `${trackId}:local`
          if (!trackSourceSet.has(trackSourceKey)) {
            trackSourceSet.add(trackSourceKey)
            dataToInsert.TrackSource.push({
              trackId,
              pluginId: 'local',
              sourceContext: '{}',
              matched: 1,
              createTime: now,
              updateTime: now
            })
          }
        }
      }
      // 单事务批量写入，避免嵌套事务
      db.sqlite.transaction(() => {
        for (const [table, rows] of Object.entries(dataToInsert)) {
          if (!rows.length) continue
          const keys = Object.keys(rows[0])
          const columns = keys.join(',')
          const placeholders = keys.map(() => '?').join(',')
          const stmt = db.sqlite.prepare(
            `INSERT OR IGNORE INTO ${Tables[table as keyof typeof Tables]} (${columns}) VALUES (${placeholders})`
          )
          for (const row of rows) {
            stmt.run(...Object.values(row as any))
          }
        }
      })()
      if (data.cb) win.webContents.send('scanLocalMusicDone')
    } catch (error: any) {
      log.error('扫描本地歌曲失败:', error?.stack || error)
      try {
        // 通知渲染进程
        win.webContents.send('msgHandleScanLocalMusicError', {
          err: String(error?.stack || error),
          filePath: ''
        })
      } catch (_) {}
    } finally {
      isScanningLocalMusic = false
      if (piscina) await piscina.destroy().catch(() => {})
    }
  })

  ipcMain.on('msgShowInFolder', async (event, path: string) => {
    const { shell } = await import('electron')
    shell.showItemInFolder(path)
  })

  ipcMain.on('deleteLocalMusicDB', () => {
    // const trackIDs = cache.get(CacheAPIs.LocalMusic)?.songs.map((track: { id: number }) => track.id)
    // if (!trackIDs.length) return
    // db.deleteManyByIds(Tables.Track, trackIDs, 'xxx')
    // const playlistIDs = cache
    //   .get(CacheAPIs.LocalPlaylist)
    //   ?.map((playlist: { id: number }) => playlist.id)
    // if (!playlistIDs.length) return
    // db.deleteManyByIds(Tables.Playlist, playlistIDs, 'xxx')
  })

  ipcMain.handle('clearCacheTracks', async (event, clearAll: boolean) => {
    const result = await deleteExcessCache(clearAll)
    return result
  })

  ipcMain.handle('getCacheTracksInfo', () => {
    // const tracks = cache.get(CacheAPIs.LocalMusic, { sql: "type = 'online'" })
    // const result = db.sqlite.prepare(`SELECT * from Track WHERE type != 'local'`).all() as {
    //   json: string
    // }[]
    // const tracks = result.map((item) => JSON.parse(item.json))
    // const size = tracks
    //   .map((track: any) => track.size)
    //   .reduce((acc: string, cur: string) => Number(acc) + Number(cur), 0)
    // return { length: tracks.length, size }
    return { length: 0, size: 0 }
  })

  /**
   * 歌曲id，用来获取track信息，url 是歌曲链接，可能是官方链接也可能是解灰链接，
   * 用来获取歌曲音频流
   */
  ipcMain.on('cacheATrack', async (event, da: { id: number; url: string }) => {
    const res = await getTrackDetail(da.id.toString())
    if (!res || !res.songs?.length) {
      log.error('Get track failed, id = ', da.id)
      return
    }
    const track = res.songs[0]
    const audioCachePath =
      (store.get('settings.autoCacheTrack.path') as string) ||
      path.join(app.getPath('userData'), 'audioCache')
    if (!fs.existsSync(audioCachePath)) {
      fs.mkdirSync(audioCachePath)
    }
    cacheWorker?.postMessage({ type: 'task', track, url: da.url, audioCachePath })
  })

  ipcMain.handle('accurateMatch', (event, track, id) => {
    // const data = { result: { songs: [track] } }
    // const result = cache.set(CacheAPIs.searchMatch, data, { localID: id })
    return false
  })

  ipcMain.handle('updateLocalTrackInfo', (event, trackId: number, data: any) => {
    // const result = cache.set(CacheAPIs.Track, data, { id: trackId })
    return false
  })

  ipcMain.handle('updateLocalPlaylist', (event, playlistId: number, data: any) => {
    // const result = cache.set(CacheAPIs.LocalPlaylist, data, { id: playlistId })
    return false
  })

  ipcMain.handle('deleteACacheTrack', (event, trackId: number) => {
    // try {
    //   db.deleteManyByIds(Tables.Track, [trackId], 'xxx')
    //   return true
    // } catch {
    //   return false
    // }
    return false
  })

  ipcMain.handle('deleteLocalPlaylist', (event, pid: number) => {
    // try {
    //   db.deleteManyByIds(Tables.Playlist, [pid], 'xxx')
    //   return true
    // } catch (error) {
    //   log.error('删除本地歌单失败:', error)
    //   return false
    // }
    return false
  })

  ipcMain.handle('logout', (event, uid: string) => {
    // try {
    //   db.deleteManyByIds(Tables.PluginData, [uid], 'xxxx')
    //   return true
    // } catch (error) {
    //   log.error('登出失败:', error)
    //   return false
    // }
    return false
  })

  ipcMain.handle('check-update', async () => {
    const info = await checkUpdate()
    return info
  })
  ipcMain.on('downloadUpdate', () => {
    downloadUpdate()
  })

  ipcMain.on('update-powersave', async (event, enable: boolean) => {
    const { powerSaveBlocker } = await import('electron')
    if (enable) {
      blockerId = powerSaveBlocker.start('prevent-app-suspension')
    } else {
      if (blockerId && powerSaveBlocker.isStarted(blockerId)) {
        powerSaveBlocker.stop(blockerId)
        blockerId = null
      }
    }
  })

  ipcMain.handle('getFontList', async () => {
    try {
      const { getFonts2 } = require('font-list') as typeof import('font-list')
      const fonts = await getFonts2({ disableQuoting: true })

      return fonts.sort((a, b) => {
        if (a.familyName === 'system-ui') return -1
        if (b.familyName === 'system-ui') return 1
        return a.familyName.localeCompare(b.familyName)
      })
    } catch (error) {
      log.error('获取字体列表失败:', error)
      return ['system-ui']
    }
  })

  ipcMain.on(
    'write-cover',
    (
      event,
      data: { filePath: null | string; picUrl: string | null; currentPlayingPath?: string }
    ) => {
      const embedOption = (store.get('settings.embedCoverArt') as number) || 0
      const embedStyle = (store.get('settings.embedStyle') as number) || 0
      coverWorker.postMessage({ type: 'normal', ...data, embedOption, embedStyle })
    }
  )

  ipcMain.handle('get-screenshot', async (event, name: string) => {
    const image = await win.capturePage()
    const buffer = image.toPNG()

    const userDataPath = app.getPath('userData')
    const screenshotsDir = path.join(userDataPath, 'screenshots')

    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }

    const fileName = `screenshot_${name}.png`
    const filePath = path.join(screenshotsDir, fileName)

    try {
      fs.writeFileSync(filePath, buffer)
      return filePath
    } catch (err) {
      console.error('保存失败:', err)
      return ''
    }
  })

  ipcMain.on('delete-screenshot', (event, name: string) => {
    try {
      if (fs.existsSync(name)) {
        fs.unlinkSync(name)
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  })

  ipcMain.handle('get-cache-path', () => {
    return path.join(app.getPath('userData'), 'audioCache')
  })
}

async function initMprisIpcMain(win: BrowserWindow, mpris: MprisImpl): Promise<void> {
  if (!Constants.IS_LINUX || !mpris) return

  // 下面这一段注释请勿删除。它是本程序作为插件歌词服务端的实现方式，可供以后参考。
  // 目前插件和本程序所采用的实现方式是：插件为服务端，本程序为客户端。

  // const dbus = createDBus(win)
  // ipcMain.on('updateCurrentLyric', (event, data) => {
  //   dbus.iface?.emit(signalNameEnum.currentLrc, data)
  // })

  const createDBus = (await import('./dbusClient')).createDBus

  const busName = 'org.gnome.Shell.TrayLyric'
  const dbus = createDBus(busName, win)

  ipcMain.handle('askExtensionStatus', async () => {
    return dbus.status
  })

  ipcMain.on('updateLyricInfo', (event: IpcMainEvent, data: any) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'currentLyric') {
      value.sender = 'VutronMusic'
      dbus.iface?.UpdateLyric(JSON.stringify(value))
    }
  })

  ipcMain.on('metadata', (event: IpcMainEvent, metadata: any) => {
    mpris?.setMetadata(metadata)
  })
  ipcMain.on('updatePlayerState', (event: IpcMainEvent, data: any) => {
    for (const [key, value] of Object.entries(data) as [string, any]) {
      if (key === 'playing') {
        mpris?.setPlayState(value)
      } else if (key === 'repeatMode') {
        mpris?.setRepeatMode(value)
      } else if (key === 'shuffle') {
        mpris?.setShuffleMode(value)
      } else if (key === 'like') {
        // dbus.iface?.LikeThisTrack(value)
        // dbus.iface?.emit(signalNameEnum.updateLikeStatus, value)
      } else if (key === 'isPersonalFM') {
        mpris?.setPersonalFM(value)
      } else if (key === 'progress') {
        mpris?.setPosition({ progress: value })
      } else if (key === 'rate') {
        mpris?.setRate({ rate: value })
      }
    }
  })
}

async function initStreaming() {
  ipcMain.handle('stream-login', async (event, data: any) => {
    const { platform } = data
    store.set('accounts.selected', platform)
    store.set(`accounts.${data.platform}.url`, data.baseURL)
    store.set(`accounts.${data.platform}.username`, data.username)
    store.set(`accounts.${data.platform}.password`, data.password)
    if (platform === 'navidrome') {
      const response = await navidrome.doLogin(data.baseURL, data.username, data.password)
      return response
    } else if (platform === 'emby') {
      const response = await emby.doLogin(data.baseURL, data.username, data.password)
      return response
    } else if (platform === 'jellyfin') {
      const response = await jellyfin.doLogin(data.baseURL, data.username, data.password)
      return response
    }
  })

  ipcMain.handle(
    'get-stream-songs',
    async (event, data: { platforms: ('navidrome' | 'emby' | 'jellyfin')[] }) => {
      const platformMap = { navidrome, emby, jellyfin }
      const result = await Promise.all(
        data.platforms.map(async (platform) => {
          const tracks = await platformMap[platform].getTracks()
          return { platform, tracks: tracks.data }
        })
      )
      return result
    }
  )

  ipcMain.handle('get-stream-account', (event, data) => {
    const url = (store.get(`accounts.${data.platform}.url`) as string) || ''
    const username = (store.get(`accounts.${data.platform}.username`) as string) || ''
    const password = (store.get(`accounts.${data.platform}.password`) as string) || ''
    return { url, username, password }
  })

  ipcMain.handle(
    'get-stream-lyric',
    async (event, data: { platform: 'navidrome' | 'emby' | 'jellyfin'; id: number | string }) => {
      const platformMap = { navidrome, emby, jellyfin }
      const lyric = await platformMap[data.platform].getLyric(data.id.toString())
      return lyric
    }
  )

  ipcMain.handle(
    'get-stream-playlists',
    async (event, data: { platforms: ('navidrome' | 'emby' | 'jellyfin')[] }) => {
      const platformMap = { navidrome, emby, jellyfin }
      const result = await Promise.all(
        data.platforms.map(async (platform) => {
          const playlists = await platformMap[platform].getPlaylists()
          return { platform, playlists: playlists.data }
        })
      )
      return result
    }
  )

  ipcMain.handle('logoutStreamMusic', (event, data) => {
    if (data.platform === 'navidrome') {
      store.set('accounts.navidrome.clientID', '')
      store.set('accounts.navidrome.anthorization', '')
      store.set('accounts.navidrome.token', '')
      store.set('accounts.navidrome.salt', '')
      store.set('accounts.navidrome.status', 'logout')
      return true
    } else if (data.platform === 'emby') {
      store.set('accounts.emby.userId', '')
      store.set('accounts.emby.accessToken', '')
      store.set('accounts.emby.status', 'logout')
      return true
    } else if (data.platform === 'jellyfin') {
      store.set('accounts.jellyfin.userId', '')
      store.set('accounts.jellyfin.accessToken', '')
      store.set('accounts.jellyfin.status', 'logout')
      return true
    }
  })

  ipcMain.handle('deleteStreamPlaylist', async (event, data) => {
    if (data.platform === 'navidrome') {
      const result = await navidrome.deletePlaylist(data.id)
      return result
    } else if (data.platform === 'emby') {
      const result = await emby.deletePlaylist(data.id)
      return result
    } else if (data.platform === 'jellyfin') {
      const result = await jellyfin.deletePlaylist(data.id)
      return result
    }
  })

  ipcMain.handle('createStreamPlaylist', async (event, data) => {
    if (data.platform === 'navidrome') {
      const result = await navidrome.createPlaylist(data.name)
      return result
    } else if (data.platform === 'emby') {
      const result = await emby.createPlaylist(data.name)
      return result
    } else if (data.platform === 'jellyfin') {
      const result = await jellyfin.createPlaylist(data.name)
      return result
    }
  })

  ipcMain.handle('updateStreamPlaylist', async (event, data) => {
    if (data.platform === 'navidrome') {
      const result = await navidrome.addTracksToPlaylist(data.op, data.playlistId, data.ids)
      return result
    } else if (data.platform === 'emby') {
      const result = await emby.addTracksToPlaylist(data.op, data.playlistId, data.ids)
      return result
    } else if (data.platform === 'jellyfin') {
      const result = await jellyfin.addTracksToPlaylist(data.op, data.playlistId, data.ids)
      return result
    }
  })

  ipcMain.on('scrobbleStreamMusic', (event, data) => {
    if (data.platform === 'navidrome') {
      navidrome.scrobble(data.id)
    } else if (data.platform === 'emby') {
      emby.scrobble(data.id)
    } else if (data.platform === 'jellyfin') {
      jellyfin.scrobble(data.id)
    }
  })

  ipcMain.handle('likeAStreamTrack', async (event, data) => {
    if (data.platform === 'navidrome') {
      const result = await navidrome.likeATrack(data.operation, data.id)
      return result
    } else if (data.platform === 'emby') {
      const result = await emby.likeATrack(data.operation, data.id)
      return result
    } else if (data.platform === 'jellyfin') {
      const result = await jellyfin.likeATrack(data.operation, data.id)
      return result
    }
  })

  ipcMain.handle('systemPing', async () => {
    const res = await Promise.all([
      navidrome.systemPing(),
      emby.systemPing(),
      jellyfin.systemPing()
    ])
    return { navidrome: res[0], emby: res[1], jellyfin: res[2] }
  })

  ipcMain.handle(
    'updateStreamPlaylistInfo',
    async (
      event,
      data: { platform: serviceName; id: string; info: { name: string; desc: string } }
    ) => {
      const platformMap = { navidrome, emby, jellyfin }
      const client = platformMap[data.platform]
      const result = await client.updatePlaylistInfo(data.id, data.info)
      return result
    }
  )
}

async function initPluginIpcMain() {
  const pluginDir = Constants.IS_DEV_ENV
    ? path.join(process.cwd(), `./src/public/plugin`)
    : path.join(__dirname, `../plugin`)

  const uploadDir = path.join(app.getPath('userData'), 'plugins')

  const files = (
    await Promise.all([
      fs.promises
        .readdir(pluginDir)
        .then((files) =>
          files
            .map((file) => path.join(pluginDir, file))
            .filter((file) => file.endsWith('.js') && !file.includes('demo.js'))
        )
        .catch(() => [] as string[]),
      fs.promises
        .readdir(uploadDir)
        .then((files) => files.map((file) => path.join(uploadDir, file)))
        .catch(() => [] as string[])
    ])
  ).flat()

  files.forEach((file) => {
    try {
      const id = path.basename(file, '.js')
      const plugin = new PluginInstance(file, id)
      pluginManager.register(id, plugin)
    } catch {}
  })

  ipcMain.handle('upload-plugin', () => {
    try {
      const { dialog } = require('electron')

      const result = dialog.showOpenDialogSync({
        properties: ['openFile'],
        filters: [{ name: 'JavaScript', extensions: ['js'] }]
      })

      if (!result || result.length === 0) {
        return { code: 404, error: 'No file selected' }
      }
      const filePath = result[0]

      const targetDir = path.join(app.getPath('userData'), 'plugins')
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir)
      }

      const fileName = path.basename(filePath)
      const targetPath = path.join(targetDir, fileName)
      fs.copyFileSync(filePath, targetPath)

      const id = path.basename(fileName, '.js')
      const plugin = new PluginInstance(targetPath, id)
      pluginManager.register(id, plugin)

      store.set(`plugins.${id}`, { path: targetPath })
      return { code: 200, message: 'Plugin uploaded successfully' }
    } catch (error) {
      log.error('上传插件失败:', error)
      return { code: 500, error: 'Failed to upload plugin' }
    }
  })

  ipcMain.handle('get-plugins', () => {
    const result: Record<string, any> = {}
    pluginManager.plugins.forEach((instance, id) => {
      result[id] = { name: instance.meta.name, type: instance.meta.type }
    })
    return result
  })

  ipcMain.handle(
    'plugin-method-call',
    (
      event,
      data: {
        pluginId: string
        methodName: string
        params: Record<string, any>
      }
    ) => {
      return pluginManager.call(data.pluginId, data.methodName, data.params)
    }
  )
}
