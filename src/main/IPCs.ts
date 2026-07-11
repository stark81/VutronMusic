import { app, ipcMain, IpcMainEvent, BrowserWindow } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { YPMTray, LyricData } from './tray'
import { MprisImpl } from './mpris'
import { checkUpdate, downloadUpdate } from './checkUpdate'
import Constants from './utils/Constants'
import store from './store'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {
  getLocalMusicData,
  loadScanDedupData,
  writeBatchData,
  markAllLocalMusicDeleted,
  restoreLocalMusicDeleted,
  restoreAllLocalMusic,
  findTrackIdBySourceContext,
  findTrackSourcesByTrackId,
  findLocalTrackAudio,
  insertTrackSourceOnce,
  upsertTrackSource,
  checkTrackSourceExists,
  updateTrackPicUrl,
  updateAlbumPicUrlByTrackId,
  refreshPlaylistCoverAfterMatch,
  deleteAllLocalMusicData,
  saveCacheResult,
  getAudioCacheStats,
  getAudioCacheStatsAll,
  findCachedAudio,
  hasCachedAudio,
  getLyricOffsetFromDB,
  saveLyricOffsetToDB,
  deleteCacheAudio,
  deleteCacheTrackSources,
  restoreCueTracks,
  getAllPlugins,
  upsertPlugin,
  getPluginById,
  createPluginInstance,
  deletePluginInstance,
  getStreamMatchCount,
  clearStreamMatches
} from './dbHelpers'
import { deleteExcessCache, createWorker } from './utils'
import { registerGlobalShortcuts } from './globalShortcut'
import { createMenu } from './menu'
import log from './log'
import { Worker } from 'worker_threads'
import type { Track as NewTrack, PluginId } from '@/types/plugin'
// @ts-ignore
// import _ from 'lodash'
import { requestUserAuth, scrobbleTrack, updateNowPlaying } from './utils/lastfm'
import { pluginManager } from './pluginManager'
import { PluginInstance } from './utils/pluginManager'

let isLock = store.get('osdWin.isLock') as boolean
let blockerId: number | null = null
let isScanningLocalMusic = false
let coverWorker: Worker
let cacheWorker: Worker | null = null
/** 暂存待缓存的歌曲播放参数（gain/peak/pluginId），task-done 时取出写入 Audio 和 TrackSource */
const pendingCacheMeta = new Map<string, { gain: number; peak: number; plugin: string }>()

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
    initPluginIpcMain()

    // 转发 OSD 同步数据到 OSD 窗口和 native tray
    ipcMain.on('update-osd-lyric', (event: IpcMainEvent, data: any) => {
      // 转发到 OSD 窗口
      if (lrc.sendToOSD) {
        lrc.sendToOSD('update-osd-status', data)
      }
      // macOS: 转发播放状态到原生 tray
      if (Constants.IS_MAC && tray) {
        if (data.playing !== undefined) {
          tray.setPlayState(data.playing, data.line?.[1] || 0)
        }
        if (data.rate !== undefined) {
          tray.setPlaybackRate(data.rate)
        }
      }
    })

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
  ipcMain.on('updateTrayLyric', (event: IpcMainEvent, data: LyricData) => {
    tray.updateLyric(data)
  })
  ipcMain.on(
    'initTrayState',
    (
      event: IpcMainEvent,
      data: {
        lyric: LyricData
        playing: boolean
        rate: number
        like: boolean
        isFM: boolean
      }
    ) => {
      tray.updateLyric(data.lyric)
      tray.setPlayState(!!data.playing)
      tray.setPlaybackRate(data.rate)
      tray.setLikeState(!!data.like)
      tray.setFMMode(!!data.isFM)
      tray.updateTrayColor()
    }
  )
  ipcMain.on(
    'updateTrayVisibility',
    (
      event: IpcMainEvent,
      data: { lyric?: boolean; buttons?: boolean; icon?: boolean; width?: number }
    ) => {
      tray.setVisibility(data)
    }
  )
  ipcMain.on('setTrayFMMode', (event: IpcMainEvent, isFM: boolean) => {
    tray.setFMMode(isFM)
  })
  ipcMain.on('showWindow', () => {
    win.show()
  })

  ipcMain.on('updatePlayerState', (event: IpcMainEvent, data: any) => {
    // 从同一条消息中提取 progress（可能和 playing 一起发送）
    const progress = typeof data.progress === 'number' ? data.progress : 0
    for (const [key, value] of Object.entries(data) as [string, any]) {
      if (key === 'playing') {
        tray.setPlayState(value, progress)
      } else if (key === 'rate') {
        tray.setPlaybackRate(value)
      } else if (key === 'repeatMode') {
        tray.setRepeatMode(value)
      } else if (key === 'shuffle') {
        tray.setShuffleMode(value)
      } else if (key === 'like') {
        tray.setLikeState(!!value)
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
      } else if (key === 'showIcon') {
        tray.setVisibility({ icon: value })
      } else if (key === 'isWordByWord') {
        tray.setWordByWord(value)
      } else if (key === 'playedColor') {
        tray.setPlayedColor(value)
      } else if (key === 'playedColorLight') {
        tray.setPlayedColorLight(value)
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
              const data = msg.data
              const meta = pendingCacheMeta.get(String(data.id))
              pendingCacheMeta.delete(String(data.id))

              if (data.url && data.size !== undefined) {
                saveCacheResult(data, meta)
              }

              await deleteExcessCache()
              const audioCachePath =
                (store.get('settings.autoCacheTrack.path') as string) ||
                path.join(app.getPath('userData'), 'audioCache')
              const stats = getAudioCacheStats(audioCachePath)
              win.webContents.send('receiveCacheInfo', stats)
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
  let osdResizeState: {
    direction: string
    startMouseX: number
    startMouseY: number
    startBounds: { x: number; y: number; width: number; height: number }
    startTime: number
    interval: ReturnType<typeof setInterval>
  } | null = null

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
  ipcMain.on(
    'osd-start-resize',
    (event, data: { direction: string; mouseX: number; mouseY: number }) => {
      if (osdResizeState) {
        clearInterval(osdResizeState.interval)
        osdResizeState = null
      }
      const bounds = lrc.getOsdBounds()
      if (!bounds) return

      const screen = require('electron').screen
      const display = screen.getDisplayMatching(bounds)
      const osdMode = (store.get('osdWin.type') as string) || 'small'
      const minBounds = {
        width: osdMode === 'small' ? 700 : 400,
        height: osdMode === 'small' ? 140 : 400
      }

      osdResizeState = {
        direction: data.direction,
        startMouseX: data.mouseX,
        startMouseY: data.mouseY,
        startBounds: { ...bounds },
        startTime: Date.now(),
        interval: setInterval(() => {
          if (!osdResizeState) return

          // 硬性兜底：正常手动 resize 不太可能持续超过 60 秒。
          // 如果渲染进程异常（崩溃/被杀/pointerup 因故没发出）导致 osd-stop-resize
          // 一直没收到，这里强制停止，避免 interval 无限空转吃 CPU。
          // 正常情况下（渲染端已用 setPointerCapture 保证会发 stop 信号）不会触发这里。
          if (Date.now() - osdResizeState.startTime > 60000) {
            clearInterval(osdResizeState.interval)
            osdResizeState = null
            return
          }

          const cursorPos = screen.getCursorScreenPoint()
          const dx = cursorPos.x - osdResizeState.startMouseX
          const dy = cursorPos.y - osdResizeState.startMouseY
          const dir = osdResizeState.direction
          const sb = osdResizeState.startBounds

          let newX = sb.x
          let newY = sb.y
          let newW = sb.width
          let newH = sb.height

          if (dir.includes('right')) {
            newW = Math.max(minBounds.width, sb.width + dx)
          }
          if (dir.includes('left')) {
            const delta = Math.min(dx, sb.width - minBounds.width)
            newX = sb.x + delta
            newW = sb.width - delta
          }
          if (dir.includes('bottom')) {
            newH = Math.max(minBounds.height, sb.height + dy)
          }
          if (dir.includes('top')) {
            const delta = Math.min(dy, sb.height - minBounds.height)
            newY = sb.y + delta
            newH = sb.height - delta
          }

          const displayBounds = display.bounds
          newX = Math.max(
            displayBounds.x,
            Math.min(newX, displayBounds.x + displayBounds.width - newW)
          )
          newY = Math.max(
            displayBounds.y,
            Math.min(newY, displayBounds.y + displayBounds.height - newH)
          )

          lrc.setOsdBounds({ x: newX, y: newY, width: newW, height: newH })
        }, 16)
      }
    }
  )
  ipcMain.on('osd-stop-resize', () => {
    if (osdResizeState) {
      clearInterval(osdResizeState.interval)
      const bounds = lrc.getOsdBounds()
      if (bounds) {
        const osdMode = (store.get('osdWin.type') as string) || 'small'
        store.set(osdMode === 'small' ? 'osdWin.width' : 'osdWin.width2', bounds.width)
        store.set(osdMode === 'small' ? 'osdWin.height' : 'osdWin.height2', bounds.height)
        store.set(osdMode === 'small' ? 'osdWin.x' : 'osdWin.x2', bounds.x)
        store.set(osdMode === 'small' ? 'osdWin.y' : 'osdWin.y2', bounds.y)
      }
      osdResizeState = null
    }
  })
  ipcMain.on('updatePlayerState', (event: IpcMainEvent, data: any) => {
    for (const [key, value] of Object.entries(data) as [string, any]) {
      if (key === 'playing') {
        lrc.updateOSDPlayingState(value)
      }
    }
  })
  // 悬浮到解锁按钮上：只是临时允许交互，不应该把这个临时状态写进持久化的
  // osdWin.isLock（之前的写法在 store 落盘的时间窗口内有把“锁定”误存成“未锁定”的风险）。
  // 直接把临时值透传给 toggleMouseIgnore 的 overrideLock 参数即可。
  ipcMain.on('set-ignore-mouse', (event, ignore) => {
    lrc.toggleMouseIgnore(ignore)
  })
  ipcMain.on('mouseleave', () => {
    // 恢复为真实的锁定状态（isLock 是模块级变量，随 updateOsdState/isLock 同步，
    // 这里不再需要也不应该再写 store）
    lrc.toggleMouseIgnore(isLock)
  })
  ipcMain.on('get-seek', () => {
    win.webContents.send('get-seek')
  })
  ipcMain.on('init-from-osd', () => {
    win.webContents.send('init-from-osd')
  })
}

function initTaskbarIpcMain(): void {}

async function initOtherIpcMain(win: BrowserWindow): Promise<void> {
  let client: any = null
  try {
    client = require('discord-rich-presence')('1450799847962574868')
  } catch (e) {
    log.warn('Discord Rich Presence 不可用:', (e as Error).message)
  }

  ipcMain.on('playDiscordPresence', (event: IpcMainEvent, track: NewTrack) => {
    if (!client) return
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
    if (!client) return
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
    const data = getLocalMusicData()
    return { ...data, playlists: [] }
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
      log.warn('扫描已在执行中，忽略重复请求')
      return
    }
    isScanningLocalMusic = true
    try {
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
      } = loadScanDedupData()

      // 软删除：先把所有本地 Track/Audio 标记为 deleted=1。
      // 注意：必须在 loadScanDedupData() 读取快照之后调用，
      // 否则去重比对数据会被清空，导致全表重复插入。
      // 本轮扫描命中的文件稍后通过 restoreLocalMusicDeleted 恢复为 deleted=0。
      markAllLocalMusicDeleted()

      // 归一化函数：trim空格、统一全角/半角字符、忽略大小写
      const normalize = (str: string) => {
        return str
          .trim()
          .toLowerCase()
          .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      }

      const artistMap = new Map(existingArtists.map((a) => [normalize(a.name), a.id]))
      const existingAudioPathSet = new Set(
        existingAudios.map((a) => a.filePath + '@' + (a.cueOffset || 0))
      )

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
      // 命中文件为空：扫描目录下无音频文件或暂时不可达（启动时机、权限等）。
      // 回滚 markAllLocalMusicDeleted，保留已有数据。
      if (allFiles.length === 0) {
        // 空文件列表：可能是目录暂时不可达（启动时机、权限等），
        // 回滚 markAllLocalMusicDeleted，保留已有数据。
        restoreAllLocalMusic()
        win.webContents.send('scanLocalMusicDone')
        return
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

      // 收集因去重匹配而需恢复的 CUE 分轨（软删除后被 INSERT OR IGNORE 阻挡无法重新插入）
      const restoredTrackIds = new Set<string>()
      for (let i = 0; i < filesToProcess.length; i += batchSize) {
        const batch = filesToProcess.slice(i, i + batchSize)
        const batchResults = await Promise.allSettled(
          batch.map((file) => piscina.run({ filePath: file }))
        )
        const _beforeTrack = dataToInsert.Track.length
        for (const items of batchResults
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value)) {
          if (!items || !items.length) continue
          for (const item of items) {
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
              if (cueCompanions.has(item.filePath)) restoredTrackIds.add(trackId)
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
                // CUE 分轨去重匹配：后续需要恢复 deleted=0
                if (cueCompanions.has(item.filePath)) restoredTrackIds.add(trackId)
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
            existingAudioPathSet.add(audioKey) // 防止同批次重复

            // TrackSource：标记该 Track 有本地来源（仅当尚未存在时）
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
        win.webContents.send('scanLocalMusicProgress', {
          newTracks: dataToInsert.Track.length - _beforeTrack
        })
      }
      // 单事务批量写入
      const hasNewData = Object.values(dataToInsert).some((arr) => arr.length > 0)
      writeBatchData(dataToInsert)
      // CUE 分轨：恢复去重匹配到的 Track/Audio（软删除后被 INSERT OR IGNORE 阻挡无法重新插入）
      restoreCueTracks([...restoredTrackIds])
      // 恢复本轮命中的文件：writeBatchData 之后调用，
      // 以便反查到新插入 Audio 关联的 trackId，一并恢复。
      // CUE 文件也走 restoreLocalMusicDeleted（通过 filePath 恢复 Audio → 反查 trackId 恢复 Track），
      // 确保即使去重匹配失败，CUE 关联的 Track 也不会停留在 deleted=1。
      restoreLocalMusicDeleted(allFiles)
      win.webContents.send('scanLocalMusicDone', { hasNewData })
    } catch (error: any) {
      log.error('扫描本地歌曲失败:', error?.stack || error)
      // 回滚 markAllLocalMusicDeleted：扫描失败时恢复数据到扫描前状态，
      // 避免所有歌曲被错误标记为 deleted 导致列表清空。
      try {
        restoreAllLocalMusic()
      } catch (rollbackError: any) {
        log.error('回滚 deleted 标记失败:', rollbackError?.stack || rollbackError)
      }
      try {
        // 通知渲染进程
        win.webContents.send('msgHandleScanLocalMusicError', {
          err: String(error?.stack || error),
          filePath: ''
        })
      } catch {}
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
    deleteAllLocalMusicData()
    pluginManager.call('local', 'doLogout', {})
  })

  ipcMain.handle('clearCacheTracks', async (event, clearAll: boolean) => {
    const result = await deleteExcessCache(clearAll)
    return result
  })

  ipcMain.handle('getStreamMatchCount', () => {
    return getStreamMatchCount()
  })

  ipcMain.handle('clearStreamMatches', () => {
    clearStreamMatches()
    return true
  })

  ipcMain.handle('getCacheTracksInfo', () => {
    const audioCachePath =
      (store.get('settings.autoCacheTrack.path') as string) ||
      path.join(app.getPath('userData'), 'audioCache')
    return getAudioCacheStatsAll(audioCachePath)
  })

  ipcMain.handle('create-plugin-instance', (_, params: { basePluginId: string; name: string }) => {
    const pluginDir = Constants.IS_DEV_ENV
      ? path.join(process.cwd(), './src/public/plugin')
      : path.join(__dirname, '../plugin')

    // 解析基础插件的实际文件路径
    const baseRow = getPluginById(params.basePluginId)!
    const resolvedPath = baseRow?.path || path.join(pluginDir, `${params.basePluginId}.js`)

    const dbResult = createPluginInstance(params.basePluginId, params.name, resolvedPath)
    if (!dbResult.success) {
      return dbResult
    }

    if (!fs.existsSync(resolvedPath)) {
      console.error(`[create-plugin-instance] Plugin file not found: ${resolvedPath}`)
      return { success: false, error: '插件文件不存在' }
    }

    try {
      const plugin = new PluginInstance(resolvedPath, dbResult.id!, false)
      pluginManager.register(dbResult.id!, plugin)
      const dbRow = getPluginById(dbResult.id!)
      const baseInstance = pluginManager.get(params.basePluginId)
      return {
        success: true,
        id: dbResult.id,
        plugin: {
          name: dbRow?.name || plugin.meta.name,
          type: baseRow.type,
          icon: baseInstance?.meta?.icon || plugin.meta.icon,
          capabilities: baseInstance?.meta?.capabilities,
          builtIn: false
        }
      }
    } catch (err) {
      console.error(`[create-plugin-instance] Failed to create instance:`, err)
      return { success: false, error: '插件加载失败' }
    }
  })

  ipcMain.handle('delete-plugin-instance', (_, pluginId: string) => {
    const success = deletePluginInstance(pluginId)
    if (success) {
      pluginManager.plugins.delete(pluginId)
      store.delete(`plugins.${pluginId}` as any)
    }
    return { success }
  })

  ipcMain.handle(
    'get-song-url',
    async (
      _,
      params: {
        pluginId: string
        sourceContext: Record<string, any>
        track: NewTrack
      }
    ) => {
      const { pluginId, sourceContext, track } = params

      // 1. 查缓存， 线上歌曲缓存之后继续播放好像获取不到，可能需要去TrackSource表里进行查询
      const audioCachePath =
        (store.get('settings.autoCacheTrack.path') as string) ||
        path.join(app.getPath('userData'), 'audioCache')

      const cached = findCachedAudio(String(track.id), audioCachePath)

      if (cached?.filePath && fs.existsSync(cached.filePath)) {
        return {
          url: [`vutron://local-asset?type=stream&path=${cached.filePath}`],
          replayGain: cached.gain,
          peak: cached.peak
        }
      }

      if (cached?.filePath && !fs.existsSync(cached.filePath)) {
        deleteCacheAudio(String(cached.id))
        const libPluginIds = [...pluginManager.plugins.entries()]
          .filter(([, p]) => p.meta.type === 'library')
          .map(([id]) => id)
        if (libPluginIds.length) {
          deleteCacheTrackSources(String(track.id), libPluginIds)
        }
      }

      // 2. 无缓存，调插件获取线上地址
      try {
        const result = await pluginManager.call(pluginId, 'songUrl', sourceContext)
        if (result?.code === 200 && result.data?.url?.length) {
          const { url, replayGain, peak, cueOffset, cueDuration } = result.data

          // 3. 异步触发缓存（仅 library 插件）
          const autoCacheSettings = store.get('settings.autoCacheTrack') as any
          const pType = pluginManager.get(pluginId)?.meta?.type
          if (autoCacheSettings?.enable && pType === 'library' && cacheWorker && url[0]) {
            if (!fs.existsSync(audioCachePath)) {
              fs.mkdirSync(audioCachePath, { recursive: true })
            }
            if (!hasCachedAudio(String(track?.id || ''))) {
              pendingCacheMeta.set(track.id.toString(), {
                gain: replayGain,
                peak,
                plugin: pluginId
              })
              cacheWorker.postMessage({ type: 'task', track, url: url[0], audioCachePath })
            }
          }

          return { url, replayGain, peak, cueOffset: cueOffset || 0, cueDuration: cueDuration || 0 }
        }
      } catch (err) {
        log.error('[get-song-url] 获取失败:', err)
      }

      return { url: '', replayGain: 0, peak: 1, cueOffset: 0, cueDuration: 0 }
    }
  )

  ipcMain.handle(
    'accurateMatch',
    (event, { trackId, pluginId, sourceContext, picUrl, currentPlayingPath }) => {
      // 检查匹配到的 sourceContext 是否已关联到其他 trackId
      const existingTrackId = findTrackIdBySourceContext(pluginId, sourceContext)
      const effectiveTrackId =
        existingTrackId && existingTrackId !== trackId ? existingTrackId : trackId

      insertTrackSourceOnce(effectiveTrackId, pluginId, JSON.stringify(sourceContext))
      if (picUrl) {
        updateTrackPicUrl(effectiveTrackId, picUrl)
        updateAlbumPicUrlByTrackId(effectiveTrackId, picUrl)
      }
      refreshPlaylistCoverAfterMatch(effectiveTrackId, picUrl)

      // 写入封面：仅对本地歌曲触发
      if (picUrl) {
        const audioInfo = findLocalTrackAudio(trackId)
        if (audioInfo) {
          const embedOption = (store.get('settings.embedCoverArt') as number) || 0
          const embedStyle = (store.get('settings.embedStyle') as number) || 0
          if (embedOption !== 0) {
            coverWorker.postMessage({
              type: 'normal',
              filePath: audioInfo.filePath,
              picUrl,
              embedOption,
              embedStyle,
              currentPlayingPath: currentPlayingPath ?? null
            })
          }
        }
      }

      return { code: 200, picUrl: picUrl ?? null }
    }
  )

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

type PluginEnableState = { library: boolean; stream: boolean; local: boolean }

function isPluginTypeEnabled(enable: PluginEnableState, type: string | undefined): boolean {
  if (type === 'library') return enable.library
  if (type === 'stream') return enable.stream
  if (type === 'local') return enable.local
  return true // 未知类型放行
}

async function initPluginIpcMain() {
  const pluginDir = Constants.IS_DEV_ENV
    ? path.join(process.cwd(), `./src/public/plugin`)
    : path.join(__dirname, `../plugin`)

  const uploadDir = path.join(app.getPath('userData'), 'plugins')

  // 加载所有已注册插件（从 DB 读取，文件不存在则跳过）
  const pluginRows = getAllPlugins()

  for (const row of pluginRows) {
    const filePath = row.builtIn
      ? path.join(pluginDir, `${row.id}.js`)
      : row.path || path.join(uploadDir, `${row.id}.js`)

    if (!fs.existsSync(filePath)) continue

    try {
      const plugin = new PluginInstance(filePath, row.id, row.builtIn === 1)
      pluginManager.register(row.id, plugin)
    } catch {}
  }

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

      // 同名文件已存在则跳过复制
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(filePath, targetPath)
      }

      const id = path.basename(fileName, '.js')
      const plugin = new PluginInstance(targetPath, id)
      pluginManager.register(id, plugin)

      // 写入 Plugins 表
      upsertPlugin(id, targetPath)

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
      const dbRow = getPluginById(id)
      result[id] = {
        name: dbRow?.name || instance.meta.name,
        type: instance.meta.type,
        icon: instance.meta.icon,
        capabilities: instance.meta.capabilities,
        builtIn: dbRow ? dbRow.builtIn === 1 : instance.builtIn
      }
    })
    return result
  })

  ipcMain.handle(
    'trackMatch',
    async (
      _event,
      params: {
        trackId: string
        name: string
        album?: string
        artists: string[]
        duration: number
        sourcePlugin?: string
        sourceType?: string // 'local' | 'stream' | 'library'
        sourceContext?: Record<string, any>
        currentPlayingPath?: string | null
      }
    ) => {
      const {
        trackId,
        name,
        album,
        artists,
        duration,
        sourcePlugin,
        sourceType,
        sourceContext,
        currentPlayingPath
      } = params
      const results: { pluginId: string; matched: number; confidence: number }[] = []
      // 匹配过程中可能发现的 canonical trackId（来自已有的 TrackSource 记录）
      let effectiveTrackId = trackId
      // 收集首次匹配成功的封面 URL，用于 write-cover
      let matchedPicUrl: string | null = null

      if (sourceType === 'library') return { code: 200, data: results }

      // trackMatch 仅匹配 library 类插件
      const pluginEnable = store.get('pluginEnable') as PluginEnableState
      if (!pluginEnable.library) {
        if (sourcePlugin && sourceType && sourceType !== 'library') {
          insertTrackSourceOnce(effectiveTrackId, sourcePlugin, JSON.stringify(sourceContext ?? {}))
        }
        return { code: 200, data: results }
      }

      for (const [pluginId, instance] of pluginManager.plugins) {
        const meta = instance.meta
        if (meta.type !== 'library') continue
        if (!meta.capabilities?.matchTrack) continue

        if (checkTrackSourceExists(effectiveTrackId, pluginId)) continue

        try {
          const result = await instance.call('matchTrack', {
            name,
            album,
            artists,
            duration,
            ...sourceContext
          })
          if (result.code !== 200 || !result.data) continue

          const confidence = result.data.confidence ?? 100

          let matched: number
          if (meta.capabilities.matchTrack === 'official') {
            matched = 1
          } else {
            if (confidence >= 80) matched = 1
            else if (confidence >= 50) matched = 0
            else continue
          }

          try {
            // 检查匹配到的 library sourceContext 是否已关联到其他 trackId
            const existingTrackId = findTrackIdBySourceContext(pluginId, result.data.sourceContext)

            if (existingTrackId && existingTrackId !== effectiveTrackId) {
              // 已有其他 trackId 关联了同一个 library 来源 → 沿用 canonical trackId
              effectiveTrackId = existingTrackId
              // canonical trackId 可能已存在该 plugin 的匹配记录
              if (checkTrackSourceExists(effectiveTrackId, pluginId)) continue
            }

            upsertTrackSource(
              effectiveTrackId,
              pluginId,
              JSON.stringify(result.data.sourceContext ?? {}),
              matched
            )

            // 匹配成功且返回了封面时，更新本地歌曲的 picUrl
            if (result.data.picUrl) {
              updateTrackPicUrl(effectiveTrackId, result.data.picUrl)
              updateAlbumPicUrlByTrackId(effectiveTrackId, result.data.picUrl)
              if (!matchedPicUrl) matchedPicUrl = result.data.picUrl
            }

            results.push({ pluginId, matched, confidence })
          } catch (dbErr) {
            console.error(`[trackMatch] Failed to write TrackSource for ${pluginId}:`, dbErr)
          }
        } catch (err) {
          console.error(`[trackMatch] Plugin ${pluginId} matchTrack failed:`, err)
          continue
        }
      }

      // 匹配完成后，用最终的 effectiveTrackId 写入自身来源
      if (sourcePlugin && sourceType && sourceType !== 'library') {
        insertTrackSourceOnce(effectiveTrackId, sourcePlugin, JSON.stringify(sourceContext ?? {}))
      }

      // 写入封面：仅对本地歌曲、且匹配到了封面时触发
      if (sourceType === 'local' && matchedPicUrl) {
        const audioInfo = findLocalTrackAudio(trackId)
        if (audioInfo) {
          const embedOption = (store.get('settings.embedCoverArt') as number) || 0
          const embedStyle = (store.get('settings.embedStyle') as number) || 0
          if (embedOption !== 0) {
            coverWorker.postMessage({
              type: 'normal',
              filePath: audioInfo.filePath,
              picUrl: matchedPicUrl,
              embedOption,
              embedStyle,
              currentPlayingPath: currentPlayingPath ?? null
            })
          }
        }
      }

      return { code: 200, data: results, picUrl: matchedPicUrl }
    }
  )

  ipcMain.handle(
    'plugin-comment',
    async (
      _event,
      params: {
        pluginId: string
        sourceContext: Record<string, any> // { rawCtx, mapCtx, mapPlugin, ...callParams }
        method: string // 'getCommentTab' | 'getComments' | 'likeAComment' | 'submitAComment' | 'getFloorComments'
        extraParams?: Record<string, any>
      }
    ) => {
      const { pluginId, sourceContext, method, extraParams = {} } = params
      const { rawCtx, mapCtx, mapPlugin, ...callParams } = sourceContext

      const isDataMethod =
        method === 'getComments' || method === 'getCommentTab' || method === 'getFloorComments'

      // 构建候选列表
      const candidates: { pluginId: string; ctx: Record<string, any> }[] = []

      if (mapPlugin && Object.keys(mapCtx || {}).length > 0) {
        candidates.push({ pluginId: mapPlugin, ctx: mapCtx })
      } else {
        const matchedMap = new Map<string, number>()
        try {
          const trackId = findTrackIdBySourceContext(pluginId, rawCtx)
          if (trackId) {
            const rows = findTrackSourcesByTrackId(trackId)
            for (const row of rows) {
              if (row.pluginId === pluginId) {
                matchedMap.set(row.pluginId, row.matched)
                continue
              }
              const plugin = pluginManager.get(row.pluginId)
              if (!plugin?.meta?.capabilities?.getComments) continue
              candidates.push({ pluginId: row.pluginId, ctx: JSON.parse(row.sourceContext) })
              matchedMap.set(row.pluginId, row.matched)
            }
          }
        } catch {}
        // 自身插件兜底
        candidates.push({ pluginId, ctx: { ...rawCtx } })

        const priority: string[] = store.get('settings.sourcePriority.comment', ['self'])
        const resolved = priority.map((p) => (p === 'self' ? pluginId : p))
        candidates.sort((a, b) => {
          const ma = matchedMap.get(a.pluginId) ?? 0
          const mb = matchedMap.get(b.pluginId) ?? 0
          if (ma !== mb) return mb - ma
          const pa = resolved.indexOf(a.pluginId)
          const pb = resolved.indexOf(b.pluginId)
          if (pa === -1 && pb === -1) return 0
          if (pa === -1) return 1
          if (pb === -1) return -1
          return pa - pb
        })
      }

      // 遍历候选，第一个成功且（非数据类方法 或 有数据）即返回
      const pluginEnable = store.get('pluginEnable') as PluginEnableState
      for (const candidate of candidates) {
        const pType = pluginManager.get(candidate.pluginId)?.meta?.type
        if (!isPluginTypeEnabled(pluginEnable, pType)) continue
        try {
          const result = await pluginManager.call(candidate.pluginId, method, {
            ...candidate.ctx,
            ...callParams,
            ...extraParams
          })
          if (result?.code !== 200) continue
          // 数据类方法返回空数据时继续尝试下一个候选人
          if (isDataMethod && !result.data?.length) continue
          return {
            ...result,
            mapPlugin: candidate.pluginId,
            mapCtx: { ...candidate.ctx, ...result?.sourceContext }
          }
        } catch {
          continue
        }
      }

      // 全部候选均失败
      return {
        code: 200,
        data: [],
        count: 0,
        mapPlugin: pluginId,
        mapCtx: { ...rawCtx }
      }
    }
  )

  ipcMain.handle(
    'plugin-lyric',
    async (
      _event,
      params: {
        pluginId: string
        sourceContext: Record<string, any> // { rawCtx }
      }
    ) => {
      const { pluginId, sourceContext } = params
      const { rawCtx } = sourceContext

      // 收集候选人
      const candidates: { pluginId: string; ctx: Record<string, any> }[] = []
      const matchedMap = new Map<string, number>()

      try {
        // 通过 rawCtx 匹配 TrackSource sourceContext 来找 trackId
        const trackId = findTrackIdBySourceContext(pluginId, rawCtx)
        if (trackId) {
          const rows = findTrackSourcesByTrackId(trackId)
          for (const row of rows) {
            if (row.pluginId === pluginId) {
              matchedMap.set(row.pluginId, row.matched)
              continue
            }
            const plugin = pluginManager.get(row.pluginId)
            if (!plugin?.meta?.capabilities?.getLyric) continue
            candidates.push({ pluginId: row.pluginId, ctx: JSON.parse(row.sourceContext) })
            matchedMap.set(row.pluginId, row.matched)
          }
        }
      } catch {}

      // 自身插件兜底（matched=0 即视为未匹配）
      candidates.push({ pluginId, ctx: { ...rawCtx } })

      // 按匹配度 + 用户优先级排序
      // library 类型插件调用时，self 不参与排序
      const callingPluginType = pluginManager.get(pluginId)?.meta?.type
      const rawPriority: string[] = store.get('settings.sourcePriority.lyric', ['self'])
      const priority =
        callingPluginType === 'library' ? rawPriority.filter((p) => p !== 'self') : rawPriority
      const resolved = priority.map((p) => (p === 'self' ? pluginId : p))
      candidates.sort((a, b) => {
        const ma = matchedMap.get(a.pluginId) ?? 0
        const mb = matchedMap.get(b.pluginId) ?? 0
        if (ma !== mb) return mb - ma
        const pa = resolved.indexOf(a.pluginId)
        const pb = resolved.indexOf(b.pluginId)
        if (pa === -1 && pb === -1) return 0
        if (pa === -1) return 1
        if (pb === -1) return -1
        return pa - pb
      })

      // 遍历候选，返回第一个成功的
      const pluginEnable = store.get('pluginEnable') as PluginEnableState
      for (const candidate of candidates) {
        const pType = pluginManager.get(candidate.pluginId)?.meta?.type
        if (!isPluginTypeEnabled(pluginEnable, pType)) continue
        try {
          const result = await pluginManager.call(candidate.pluginId, 'getLyric', candidate.ctx)
          if (result?.code === 200 && result.data?.length) return result
        } catch {
          continue
        }
      }

      return { code: 200, data: [] }
    }
  )

  ipcMain.handle(
    'get-lyric-offset',
    async (
      _event,
      params: {
        pluginId: string
        trackId: string
      }
    ) => {
      const { pluginId, trackId } = params
      return getLyricOffsetFromDB(pluginId, trackId)
    }
  )

  ipcMain.handle(
    'set-lyric-offset',
    async (
      _event,
      params: {
        pluginId: string
        trackId: string
        offset: number
      }
    ) => {
      const { pluginId, trackId, offset } = params
      saveLyricOffsetToDB(pluginId, trackId, offset)
      return true
    }
  )

  ipcMain.handle('get-source-priority', async () => {
    // 迁移兼容：旧路径 settings.trackInfoOrder -> settings.sourcePriority.trackInfoOrder
    let trackInfoOrder = store.get('settings.sourcePriority.trackInfoOrder') as string[] | undefined
    if (!trackInfoOrder || trackInfoOrder.length === 0) {
      const oldValue = store.get('settings.trackInfoOrder') as string[] | undefined
      if (oldValue && oldValue.length > 0) {
        trackInfoOrder = oldValue
        store.set('settings.sourcePriority.trackInfoOrder', oldValue)
      } else {
        trackInfoOrder = ['path', 'online', 'embedded']
      }
    }
    return {
      lyric: store.get('settings.sourcePriority.lyric'),
      comment: store.get('settings.sourcePriority.comment'),
      trackInfoOrder
    }
  })

  ipcMain.on(
    'report-playback',
    (
      _,
      params: {
        type: 'start' | 'progress' | 'end'
        pluginId: PluginId
        rawCtx: Record<string, any>
        track: { name: string; artist: string; album: string; duration: number; no: number }
        playing: number
        position: number
        duration: number
        sourceCtx: Record<string, any>
      }
    ) => {
      const { type, pluginId, rawCtx, track, position, playing, duration, sourceCtx } = params
      const condMet = position >= duration / 2 || position >= 30

      // 1. Last.fm — 未认证时跳过，不尝试提交
      const lastfmSession = store.get('settings.lastfmSession') as {
        name: string
        key: string
        subscriber: number
      } | null
      if (lastfmSession?.key) {
        if (type === 'start') {
          updateNowPlaying({
            artist: track.artist,
            track: track.name,
            album: track.album,
            duration: track.duration
          })
        } else if (type === 'end' && condMet) {
          scrobbleTrack({
            artist: track.artist,
            track: track.name,
            timestamp: ~~(Date.now() / 1000) - position,
            album: track.album,
            trackNumber: track.no || 1,
            duration: track.duration
          })
        }
      }

      // 2. Plugin reportPlayback 广播
      try {
        const pluginEnable = store.get('pluginEnable') as PluginEnableState
        const trackId = findTrackIdBySourceContext(pluginId, rawCtx)
        if (pluginEnable.library && trackId) {
          const rows = findTrackSourcesByTrackId(trackId)
          for (const row of rows) {
            pluginManager.call(row.pluginId, 'reportPlayback', {
              type,
              ...JSON.parse(row.sourceContext),
              playing,
              duration,
              position
            })
          }
        } else {
          pluginManager.call(sourceCtx.plugin || pluginId, 'reportPlayback', {
            type,
            ...rawCtx,
            playing,
            duration,
            position
          })
        }
      } catch (error) {
        console.log('[reportPlayback error]: ', error)
      }

      // 3. Plugin scrobble 广播（仅 end + 条件满足）
      if (type === 'end' && condMet) {
        try {
          const pluginEnable = store.get('pluginEnable') as PluginEnableState
          const trackId = findTrackIdBySourceContext(pluginId, rawCtx)
          if (pluginEnable.library && trackId) {
            const rows = findTrackSourcesByTrackId(trackId)
            for (const row of rows) {
              pluginManager.call(row.pluginId, 'scrobble', {
                ...JSON.parse(row.sourceContext),
                time: position * 1000,
                sourceCtx
              })
            }
          } else {
            pluginManager.call(sourceCtx.plugin || pluginId, 'scrobble', {
              ...rawCtx,
              time: position * 1000,
              sourceCtx
            })
          }
        } catch (error) {
          console.log('[scrobble error]: ', error)
        }
      }
    }
  )

  ipcMain.on(
    'set-source-priority',
    (_event, data: { lyric?: string[]; comment?: string[]; trackInfoOrder?: string[] }) => {
      if (data.lyric) store.set('settings.sourcePriority.lyric', data.lyric)
      if (data.comment) store.set('settings.sourcePriority.comment', data.comment)
      if (data.trackInfoOrder)
        store.set('settings.sourcePriority.trackInfoOrder', data.trackInfoOrder)
    }
  )

  ipcMain.on(
    'setPluginEnable',
    (_event, data: { enableLibrary: boolean; enableStream: boolean; enableLocal: boolean }) => {
      store.set('pluginEnable', {
        library: data.enableLibrary,
        stream: data.enableStream,
        local: data.enableLocal
      })
    }
  )

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
      try {
        return pluginManager.call(data.pluginId, data.methodName, data.params)
      } catch (error) {
        return Promise.reject(error)
      }
    }
  )
}
