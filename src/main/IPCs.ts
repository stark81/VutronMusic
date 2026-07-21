import { app, ipcMain, IpcMainEvent, BrowserWindow } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { YPMTray } from './tray'
import { YPMTouchBar } from './touchBar'
import { MprisImpl } from './mpris'
import { checkUpdate, downloadUpdate } from './checkUpdate'
import Constants from './utils/Constants'
import store from './store'
import fs from 'fs'
import path from 'path'
import * as db from './dbHelpers'
import { deleteExcessCache, createWorker } from './utils'
import { scanLocalMusic } from './utils/localMusicScanner'
import { registerGlobalShortcuts } from './globalShortcut'
import { createMenu } from './menu'
import log from './log'
import { Worker } from 'worker_threads'
import type { Track as NewTrack, PluginId, Track } from '@/types/plugin'
import { requestUserAuth, scrobbleTrack, updateNowPlaying } from './utils/lastfm'
import { pluginManager } from './pluginManager'
import { PluginInstance } from './utils/pluginManager'
import { initMap, osdMap, settingMap, statusMap } from '@/types/music'

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
    touchBar: YPMTouchBar | null,
    mpris: MprisImpl | null,
    lrc: Record<string, Function>
  ): void {
    initWindowIpcMain(win)
    initOSDWindowIpcMain(win, lrc)
    initTrayIpcMain(win, tray, touchBar)
    // initTaskbarIpcMain()
    // initMprisIpcMain(win, mediaController)
    initOtherIpcMain(win)
    initPluginIpcMain()
    initSynchronizeIpcMain(win, lrc, tray, touchBar, mpris)

    coverWorker = createWorker('writeCover')
    coverWorker.on('message', (msg) => {
      if (msg.status === 'done') app.exit(0)
    })

    app.on('before-quit', (event) => {
      event.preventDefault()
      tray.destroyTray()
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

function initTrayIpcMain(win: BrowserWindow, tray: YPMTray, touchBar: YPMTouchBar | null): void {
  ipcMain.on('setStoreSettings', async (event: IpcMainEvent, data: Partial<settingMap>) => {
    Object.entries(data).forEach(([key, value]) => {
      store.set(`settings.${key}`, value)
    })

    if (data.enableGlobalShortcut !== undefined) {
      const { globalShortcut } = await import('electron')
      if (data.enableGlobalShortcut) {
        registerGlobalShortcuts(win)
      } else {
        globalShortcut.unregisterAll()
      }
    }

    if (data.shortcuts !== undefined) {
      createMenu(win)
      const global = store.get('settings.enableGlobalShortcut') as boolean
      if (global) {
        const { globalShortcut } = await import('electron')
        globalShortcut.unregisterAll()
        registerGlobalShortcuts(win)
      }
    }

    if (data.autoCacheTrack !== undefined) {
      const autoCache = (store.get('settings.autoCacheTrack.enable') as boolean) || false
      if (autoCache) {
        cacheWorker = createWorker('cacheTrack')
        cacheWorker?.on('message', async (msg) => {
          if (msg.type === 'task-done') {
            const data = msg.data
            const meta = pendingCacheMeta.get(String(data.id))
            pendingCacheMeta.delete(String(data.id))

            if (data.url && data.size !== undefined) {
              db.saveCacheResult(data, meta)
            }

            await deleteExcessCache()
            const audioCachePath =
              (store.get('settings.autoCacheTrack.path') as string) ||
              path.join(app.getPath('userData'), 'audioCache')
            const stats = db.getAudioCacheStats(audioCachePath)
            win.webContents.send('receiveCacheInfo', stats)
          } else if (msg.type === 'finished') {
            closeCacheWorker()
          }
        })
      } else {
        cacheWorker?.postMessage({ type: 'quit' })
      }
    }

    if (data.proxy !== undefined) {
      const map = { 1: 'http', 2: 'https' }
      const value = data.proxy
      if (value.type === 0) {
        win.webContents.session.setProxy({})
      } else {
        const proxyRules = `${map[value.type as keyof typeof map]}://${value.address}:${value.port}`
        win.webContents.session.setProxy({ proxyRules })
      }
    }

    tray.updateSetting(data)
    touchBar?.updateSetting(data)
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

  // 悬浮到解锁按钮上：只是临时允许交互，不应该把这个临时状态写进持久化的
  // osdWin.isLock（之前的写法在 store 落盘的时间窗口内有把“锁定”误存成“未锁定”的风险）。
  // 直接把临时值透传给 toggleMouseIgnore 的 overrideLock 参数即可。
  ipcMain.on('set-ignore-mouse', (event, ignore) => {
    lrc.toggleMouseIgnore(ignore)
  })
  ipcMain.on('mouseleave', () => {
    lrc.toggleMouseIgnore(isLock)
  })
  ipcMain.on('get-seek', () => {
    win.webContents.send('get-seek')
  })
  ipcMain.on('init-from-osd', () => {
    win.webContents.send('init-from-osd')
  })
}

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
   */
  ipcMain.on('msgScanLocalMusic', async (event, data: { filePath: string[] }) => {
    if (isScanningLocalMusic) {
      log.warn('扫描已在执行中，忽略重复请求')
      return
    }
    isScanningLocalMusic = true
    try {
      const result = await scanLocalMusic(data.filePath, (progress) => {
        win.webContents.send('scanLocalMusicProgress', progress)
      })
      win.webContents.send('scanLocalMusicDone', { hasNewData: result.hasNewData })
    } catch (error: any) {
      log.error('扫描本地歌曲失败:', error?.stack || error)
      try {
        db.restoreAllLocalMusic()
      } catch (rollbackError: any) {
        log.error('回滚 deleted 标记失败:', rollbackError?.stack || rollbackError)
      }
      try {
        win.webContents.send('msgHandleScanLocalMusicError', {
          err: String(error?.stack || error),
          filePath: ''
        })
      } catch {}
    } finally {
      isScanningLocalMusic = false
    }
  })

  ipcMain.on('msgShowInFolder', async (event, path: string) => {
    const { shell } = await import('electron')
    shell.showItemInFolder(path)
  })

  ipcMain.on('deleteLocalMusicDB', () => {
    db.deleteAllLocalMusicData()
    pluginManager.call('local', 'doLogout', {})
  })

  ipcMain.handle('clearCacheTracks', async (event, clearAll: boolean) => {
    const result = await deleteExcessCache(clearAll)
    return result
  })

  ipcMain.handle('getStreamMatchCount', () => {
    return db.getStreamMatchCount()
  })

  ipcMain.handle('clearStreamMatches', () => {
    db.clearStreamMatches()
    return true
  })

  ipcMain.handle('getCacheTracksInfo', () => {
    const audioCachePath =
      (store.get('settings.autoCacheTrack.path') as string) ||
      path.join(app.getPath('userData'), 'audioCache')
    return db.getAudioCacheStatsAll(audioCachePath)
  })

  ipcMain.handle('create-plugin-instance', (_, params: { basePluginId: string; name: string }) => {
    const pluginDir = Constants.IS_DEV_ENV
      ? path.join(process.cwd(), './src/public/plugin')
      : path.join(__dirname, '../plugin')

    // 解析基础插件的实际文件路径
    const baseRow = db.getPluginById(params.basePluginId)!
    const resolvedPath = baseRow?.path || path.join(pluginDir, `${params.basePluginId}.js`)

    const dbResult = db.createPluginInstance(params.basePluginId, params.name, resolvedPath)
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
      const dbRow = db.getPluginById(dbResult.id!)
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
    const success = db.deletePluginInstance(pluginId)
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

      const cached = db.findCachedAudio(String(track.id), audioCachePath)

      if (cached?.filePath && fs.existsSync(cached.filePath)) {
        return {
          url: [`vutron://local-asset?type=stream&path=${cached.filePath}`],
          replayGain: cached.gain,
          peak: cached.peak
        }
      }

      if (cached?.filePath && !fs.existsSync(cached.filePath)) {
        db.deleteCacheAudio(String(cached.id))
        const libPluginIds = [...pluginManager.plugins.entries()]
          .filter(([, p]) => p.meta.type === 'library')
          .map(([id]) => id)
        if (libPluginIds.length) {
          db.deleteCacheTrackSources(String(track.id), libPluginIds)
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
            if (!db.hasCachedAudio(String(track?.id || ''))) {
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
      const existingTrackId = db.findTrackIdBySourceContext(pluginId, sourceContext)
      if (existingTrackId && existingTrackId !== trackId) {
        // 已有 canonical trackId → 将其 TrackSource 等关联数据迁到本地 trackId 下
        db.reassignTrackId(existingTrackId, trackId)
      }

      db.insertTrackSourceOnce(trackId, pluginId, JSON.stringify(sourceContext))
      if (picUrl) {
        db.updateTrackPicUrl(trackId, picUrl)
        db.updateAlbumPicUrlByTrackId(trackId, picUrl)
      }
      db.refreshPlaylistCoverAfterMatch(trackId, picUrl)

      // 写入封面：仅对本地歌曲触发
      if (picUrl) {
        const audioInfo = db.findLocalTrackAudio(trackId)
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
  const pluginRows = db.getAllPlugins()

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
      db.upsertPlugin(id, targetPath)

      store.set(`plugins.${id}`, { path: targetPath })
      return { code: 200, message: 'Plugin uploaded successfully' }
    } catch (error) {
      log.error('上传插件失败:', error)
      return { code: 500, error: 'Failed to upload plugin' }
    }
  })

  ipcMain.handle('get-plugins', () => {
    const result: [string, any][] = []

    pluginManager.plugins.forEach((instance, id) => {
      const dbRow = db.getPluginById(id)
      result.push([
        id,
        {
          name: dbRow?.name || instance.meta.name,
          type: instance.meta.type,
          icon: instance.meta.icon,
          capabilities: instance.meta.capabilities,
          builtIn: dbRow ? dbRow.builtIn === 1 : instance.builtIn
        }
      ])
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
      // 收集首次匹配成功的封面 URL，用于 write-cover
      let matchedPicUrl: string | null = null

      if (sourceType === 'library') return { code: 200, data: results }

      // trackMatch 仅匹配 library 类插件
      const pluginEnable = store.get('pluginEnable') as PluginEnableState
      if (!pluginEnable.library) {
        if (sourcePlugin && sourceType && sourceType !== 'library') {
          db.insertTrackSourceOnce(trackId, sourcePlugin, JSON.stringify(sourceContext ?? {}))
        }
        return { code: 200, data: results }
      }

      for (const [pluginId, instance] of pluginManager.plugins) {
        const meta = instance.meta
        if (meta.type !== 'library') continue
        if (!meta.capabilities?.matchTrack) continue

        if (db.checkTrackSourceExists(trackId, pluginId)) continue

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
            const existingTrackId = db.findTrackIdBySourceContext(
              pluginId,
              result.data.sourceContext
            )

            if (existingTrackId && existingTrackId !== trackId) {
              // 已有 canonical trackId → 将其 TrackSource 等迁到本地 trackId 下
              db.reassignTrackId(existingTrackId, trackId)
            }

            db.upsertTrackSource(
              trackId,
              pluginId,
              JSON.stringify(result.data.sourceContext ?? {}),
              matched
            )

            // 匹配成功且返回了封面时，更新本地歌曲的 picUrl
            if (result.data.picUrl) {
              db.updateTrackPicUrl(trackId, result.data.picUrl)
              db.updateAlbumPicUrlByTrackId(trackId, result.data.picUrl)
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

      // 用最终的 trackId 写入自身来源
      if (sourcePlugin && sourceType && sourceType !== 'library') {
        db.insertTrackSourceOnce(trackId, sourcePlugin, JSON.stringify(sourceContext ?? {}))
      }

      // 写入封面：仅对本地歌曲、且匹配到了封面时触发
      if (sourceType === 'local' && matchedPicUrl) {
        const audioInfo = db.findLocalTrackAudio(trackId)
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
          const trackId = db.findTrackIdBySourceContext(pluginId, rawCtx)
          if (trackId) {
            const rows = db.findTrackSourcesByTrackId(trackId)
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
        const trackId = db.findTrackIdBySourceContext(pluginId, rawCtx)
        if (trackId) {
          const rows = db.findTrackSourcesByTrackId(trackId)
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
      return db.getLyricOffsetFromDB(pluginId, trackId)
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
      db.saveLyricOffsetToDB(pluginId, trackId, offset)
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
        const trackId = db.findTrackIdBySourceContext(pluginId, rawCtx)
        if (pluginEnable.library && trackId) {
          const rows = db.findTrackSourcesByTrackId(trackId)
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
        console.error('[reportPlayback error]: ', error)
      }

      // 3. Plugin scrobble 广播（仅 end + 条件满足）
      if (type === 'end' && condMet) {
        try {
          const pluginEnable = store.get('pluginEnable') as PluginEnableState
          const trackId = db.findTrackIdBySourceContext(pluginId, rawCtx)
          if (pluginEnable.library && trackId) {
            const rows = db.findTrackSourcesByTrackId(trackId)
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
          console.error('[scrobble error]: ', error)
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
    'plugin-intelligence',
    async (event, data: Record<PluginId, Record<string, any>>) => {
      const result = {
        code: 200,
        data: [] as Track[],
        sourceContexts: {} as Record<PluginId, Record<string, any>>
      }
      await Promise.all(
        Object.entries(data).map(async ([plugin, param]) => {
          const res = await pluginManager.call(plugin, 'intelligencePlaylist', param)
          const tracks = res.data.map((item: Track) => ({
            ...item,
            album: { ...item.album, pluginId: plugin },
            artists: item.artists.map((it) => ({ ...it, pluginId: plugin })),
            albumArtists: item.albumArtists.map((it) => ({ ...it, pluginId: plugin })),
            pluginId: plugin
          }))
          result.data.push(...tracks)
          result.sourceContexts[plugin as PluginId] = res.sourceContext
        })
      )
      return result
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

async function initSynchronizeIpcMain(
  win: BrowserWindow,
  lrc: { [key: string]: Function },
  tray: YPMTray,
  touchBar: YPMTouchBar | null,
  mpris: MprisImpl | null
) {
  const busName = 'org.gnome.Shell.TrayLyric'
  const dbus = Constants.IS_LINUX ? (await import('./dbusClient')).createDBus(busName, win) : null

  ipcMain.handle('askExtensionStatus', async () => {
    return dbus?.status || false
  })

  ipcMain.on('synchronize-player-info', (event: IpcMainEvent, data: Partial<statusMap>) => {
    if (lrc.sendToOSD) {
      lrc.sendToOSD('update-osd-status', data)
    }

    tray.updateInfo(data)
    touchBar?.updateInfo(data)
    mpris?.updateInfo(data)

    if (dbus && data.lyric !== undefined) {
      const lrc = {
        content: data.lyric.lyric.text,
        start: data.lyric.start,
        time: data.lyric.end - data.lyric.start,
        sender: 'VutronMusic'
      }
      dbus.iface?.UpdateLyric(JSON.stringify(lrc))
    }
  })

  ipcMain.on('initTrayState', (event: IpcMainEvent, data: initMap) => {
    tray.initTrayState(data)
    touchBar?.initTrayState(data)
  })

  ipcMain.on(
    'updateTrayVisibility',
    (
      event: IpcMainEvent,
      data: { lyric?: boolean; buttons?: boolean; icon?: boolean; width?: number }
    ) => {
      tray.setVisibility(data)
    }
  )

  ipcMain.on('metadata', (event: IpcMainEvent, metadata: any) => {
    mpris?.setMetadata(metadata)
  })

  ipcMain.on('updateOsdState', (event, data: Partial<osdMap>) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    store.set(`osdWin.${key}`, value)
    if (key === 'show') {
      lrc.toggleOSDWindow()
      tray.updateOsdStatus({ show: value })
    } else if (key === 'type') {
      lrc.switchOSDWindow(value)
    } else if (key === 'isLock') {
      isLock = value
      lrc.toggleMouseIgnore()
      tray.updateOsdStatus({ isLock: value })
    }
  })
}
