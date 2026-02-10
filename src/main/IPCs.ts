import { app, ipcMain, IpcMainEvent, BrowserWindow } from 'electron'
import { YPMTray } from './tray'
import { MprisImpl } from './mpris'
import { checkUpdate, downloadUpdate } from './checkUpdate'
import Constants from './utils/Constants'
import store from './store'
import fs from 'fs'
import path from 'path'
import { db, Tables } from './db'
import { CacheAPIs } from './utils/CacheApis'
import { deleteExcessCache, createWorker, getTrackDetail } from './utils'
import cache from './cache'
import { registerGlobalShortcuts } from './globalShortcut'
import { createMenu } from './menu'
import log from './log'
import navidrome from './streaming/navidrome'
import emby from './streaming/emby'
import jellyfin from './streaming/jellyfin'
import { Worker } from 'worker_threads'
import { Track, Album, Artist, scanTrack } from '@/types/music'
import _ from 'lodash'
import { requestUserAuth, scrobbleTrack, updateNowPlaying } from './utils/lastfm'
import { PluginInstance } from './utils/pluginManager'

let isLock = store.get('osdWin.isLock') as boolean
let blockerId: number | null = null
let coverWorker: Worker
let cacheWorker: Worker | null = null

const closeCacheWorker = async () => {
  await cacheWorker.terminate()
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
    initPluginIpcMain(win)

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

function exitAsk(event: IpcMainEvent, win: BrowserWindow) {
  const { dialog } = require('electron')
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
        win.webContents.send(
          'rememberCloseAppOption',
          result.response === 0 ? 'minimizeToTray' : 'exit'
        )
      }
      if (result.response === 0) {
        event.preventDefault()
        win.hide()
      } else if (result.response === 1) {
        setTimeout(() => {
          win = null
          app.exit()
        }, 100)
      }
    })
    .catch()
}

function initWindowIpcMain(win: BrowserWindow): void {
  ipcMain.on('minimize', () => {
    win.minimize()
  })

  ipcMain.handle('maximizeOrUnmaximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize()
    return !win.isMaximized()
  })

  ipcMain.on('close', (event: IpcMainEvent) => {
    const closeAppOption = store.get('settings.closeAppOption') || 'ask'
    if (closeAppOption === 'exit') {
      win = null
      app.exit()
    } else if (closeAppOption === 'minimizeToTray') {
      event.preventDefault()
      win.hide()
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

  ipcMain.on('setStoreSettings', (event: IpcMainEvent, data: any) => {
    for (const [key, value] of Object.entries(data) as [string, any]) {
      store.set(`settings.${key}`, value)
      if (key === 'enableTrayMenu') {
        tray.setContextMenu()
      } else if (key === 'lang') {
        tray.setContextMenu()
      } else if (key === 'trayColor') {
        tray.updateTrayColor()
      } else if (key === 'enableGlobalShortcut') {
        const { globalShortcut } = require('electron')
        if (value) {
          registerGlobalShortcuts(win)
        } else {
          globalShortcut.unregisterAll()
        }
      } else if (key === 'shortcuts') {
        createMenu(win)
        const global = store.get('settings.enableGlobalShortcut') as boolean
        if (global) {
          const { globalShortcut } = require('electron')
          globalShortcut.unregisterAll()
          registerGlobalShortcuts(win)
        }
      } else if (key === 'autoCacheTrack') {
        const autoCache = (store.get('settings.autoCacheTrack.enable') as boolean) || false
        if (autoCache) {
          cacheWorker = createWorker('cacheTrack')
          cacheWorker?.on('message', async (msg) => {
            if (msg.type === 'task-done') {
              const track = msg.data
              await cache.set(CacheAPIs.LocalMusic, { newTracks: [track] })
              await deleteExcessCache()
              const tracks = cache.get(CacheAPIs.LocalMusic, { sql: "type = 'online'" })
              const size = tracks.songs
                .map((track: any) => track.size)
                .reduce((acc: string, cur: string) => Number(acc) + Number(cur), 0)

              win.webContents.send('receiveCacheInfo', { length: tracks.songs.length, size })
            } else if (msg.type === 'finished') {
              closeCacheWorker()
            }
          })
        } else {
          cacheWorker?.postMessage({ type: 'quit' })
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

  ipcMain.on('playDiscordPresence', (event: IpcMainEvent, track: Track) => {
    client.updatePresence({
      details: track.name + ' - ' + (track.ar || track.artists).map((ar) => ar.name).join(','),
      state: (track.al || track.album).name,
      endTimestamp: Date.now() + track.dt,
      largeImageKey: (track.al || track.album).picUrl + '?param=256y256',
      largeImageText: (track.al || track.album).name,
      smallImageKey: 'play',
      smallImageText: '正在播放',
      instance: true
    })
  })

  ipcMain.on('pauseDiscordPresence', (event: IpcMainEvent, track: Track) => {
    client.updatePresence({
      details: track.name + ' - ' + (track.ar || track.artists).map((ar) => ar.name).join(','),
      state: (track.al || track.album).name,
      largeImageKey: (track.al || track.album).picUrl + '?param=256y256',
      largeImageText: (track.al || track.album).name,
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
    const { shell } = require('electron')
    await shell.openExternal(url)
  })

  ipcMain.on('openLogFile', () => {
    const { shell } = require('electron')
    const logFilePath = log.transports.file.getFile().path
    shell.showItemInFolder(logFilePath)
  })

  // Open file
  ipcMain.handle('msgOpenFile', async (event, filter: string) => {
    const { dialog } = require('electron')
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

  ipcMain.handle('msgCheckFileExist', (event, path: string) => {
    try {
      fs.accessSync(path, fs.constants.F_OK)
      return true
    } catch (e) {
      return false
    }
  })

  ipcMain.handle('selecteFolder', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (!result.canceled) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('showOpenDialog', async (event, options) => {
    const { dialog } = require('electron')
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
    const { songs } = cache.get(CacheAPIs.LocalMusic)
    const playlists = cache.get(CacheAPIs.LocalPlaylist)
    return { songs, playlists }
  })

  ipcMain.handle('upsertLocalPlaylist', async (event, playlist: object) => {
    const result = await cache.set(CacheAPIs.LocalPlaylist, playlist)
    return result
  })

  ipcMain.on('clearDeletedMusic', () => {
    const { songs } = cache.get(CacheAPIs.LocalMusic)
    const deletedTracks = []
    if (songs.length === 0) return
    for (let i = songs.length - 1; i >= 0; i--) {
      const track = songs[i]
      try {
        fs.accessSync(track.filePath, fs.constants.F_OK)
      } catch (e) {
        deletedTracks.push(track.id)
      }
    }

    if (deletedTracks.length > 0) {
      try {
        db.deleteMany(Tables.Track, deletedTracks)
        win.webContents.send('msgDeletedTracks', deletedTracks)
      } catch (e) {
        log.error(e)
      }
    }
  })

  ipcMain.on('msgScanLocalMusic', async (event, data: { filePath: string; update: boolean }) => {
    try {
      const { default: Piscina } = (await import('piscina')) as typeof import('piscina')
      const fg = await import('fast-glob')
      const os = await import('os')

      const existingTracks = new Map<string, Track>()
      const existingAlbums = new Map<string, Album>()
      const existingArtists = new Map<string, Artist>()
      const existingAlArtists = new Map<string, Artist>()

      const newTracks: Track[] = []

      const { songs } = cache.get(CacheAPIs.LocalMusic)
      const existingPaths = songs.map((song: Track) => {
        if (!existingTracks.has(song.filePath)) {
          existingTracks.set(song.filePath, song)

          if (!existingAlbums.has(song.album.name) || song.album.matched) {
            existingAlbums.set(song.album.name, song.album)
          }

          song.artists.forEach((artist) => {
            if (!existingArtists.has(artist.name) || artist.matched) {
              existingArtists.set(artist.name, artist)
            }
          })
        }
        return song.filePath
      }) as string[]

      const allFiles = await fg.glob(['**/*.{mp3,aiff,flac,alac,m4a,aac,wav,opus}'], {
        cwd: data.filePath,
        absolute: true,
        onlyFiles: true
      })

      const newFiles = data.update ? allFiles : allFiles.filter((f) => !existingPaths.includes(f))

      const workerPath = path.join(__dirname, 'workers/scanMusic.js')
      const piscina = new Piscina({
        filename: workerPath,
        minThreads: 2,
        maxThreads: Math.min(os.cpus().length / 2, 6)
      })

      const batchSize = 100
      for (let i = 0; i < newFiles.length; i += batchSize) {
        const batch = newFiles.slice(i, i + batchSize)
        const batchResults: scanTrack[] = await Promise.all(
          batch.map((file) => piscina.run({ filePath: file }))
        )

        batchResults.forEach((track) => {
          if (!existingTracks.has(track.filePath)) {
            // @ts-ignore
            let newTrack: Track = {}
            const id = existingTracks.size + 1
            newTrack.id = id
            newTrack.picUrl = `atom://local-asset?type=pic&id=${id}`

            if (existingAlbums.has(track.album)) {
              newTrack.album = existingAlbums.get(track.album)
            } else {
              const newAl = {
                id: existingAlbums.size + 1,
                name: track.album,
                picUrl: `atom://local-asset?type=pic&id=${id}`,
                matched: false
              }
              newTrack.album = newAl
              existingAlbums.set(track.album, newAl)
            }
            newTrack.artists = track.artists.map((artist) => {
              let newAr: Artist
              if (existingArtists.has(artist)) {
                newAr = existingArtists.get(artist)
              } else {
                newAr = {
                  id: existingArtists.size + 1,
                  name: artist,
                  matched: false,
                  picUrl: 'https://p1.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg'
                }
                existingArtists.set(artist, newAr)
              }
              return newAr
            })

            newTrack.albumArtist = track.albumArtist.map((artist) => {
              let newAr: Artist
              if (existingAlArtists.has(artist)) {
                newAr = existingAlArtists.get(artist)
              } else {
                newAr = {
                  id: existingAlArtists.size + 1,
                  name: artist,
                  matched: false,
                  picUrl: 'https://p1.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg'
                }
                existingAlArtists.set(artist, newAr)
              }
              return newAr
            })

            newTrack = _.merge({}, track, newTrack)

            win.webContents.send('msgHandleScanLocalMusic', { track: newTrack })
            existingTracks.set(track.filePath, newTrack)
            newTracks.push(newTrack)
          } else {
            const originTrack = existingTracks.get(track.filePath)

            originTrack.artists = track.artists.map((artist) => {
              let newAr: Artist
              if (existingArtists.has(artist)) {
                newAr = existingArtists.get(artist)
              } else {
                newAr = {
                  id: existingArtists.size + 1,
                  name: artist,
                  matched: false,
                  picUrl: 'https://p1.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg'
                }
                existingArtists.set(artist, newAr)
              }
              return newAr
            })

            originTrack.albumArtist = track.albumArtist.map((artist) => {
              let newAr: Artist
              if (existingAlArtists.has(artist)) {
                newAr = existingAlArtists.get(artist)
              } else {
                newAr = {
                  id: existingAlArtists.size + 1,
                  name: artist,
                  matched: false,
                  picUrl: 'https://p1.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg'
                }
                existingAlArtists.set(artist, newAr)
              }
              return newAr
            })

            const updatedTrack = _.merge({}, track, originTrack)
            existingTracks.set(updatedTrack.filePath, updatedTrack)
          }
        })
      }

      if (newTracks.length > 0) {
        await cache.set(CacheAPIs.LocalMusic, { newTracks })
      }
      if (data.update) {
        cache.set(CacheAPIs.LocalMusic, { newTracks: [...existingTracks.values()] })
        win.webContents.send('updateLocalMusic', { tracks: [...existingTracks.values()] })
      }
      win.webContents.send('scanLocalMusicDone')
    } catch (error) {
      log.error('+++++++++++++++++++++++++++++', error.stack || error)
    }
  })

  ipcMain.on('msgShowInFolder', (event, path: string) => {
    const { shell } = require('electron')
    shell.showItemInFolder(path)
  })

  ipcMain.on('deleteLocalMusicDB', () => {
    const trackIDs = cache.get(CacheAPIs.LocalMusic)?.songs.map((track: any) => track.id)
    if (!trackIDs.length) return
    db.deleteMany(Tables.Track, trackIDs)

    const playlistIDs = cache.get(CacheAPIs.LocalPlaylist)?.map((playlist) => playlist.id)
    if (!playlistIDs.length) return
    db.deleteMany(Tables.Playlist, playlistIDs)
  })

  ipcMain.handle('clearCacheTracks', async (event, clearAll: boolean) => {
    const result = await deleteExcessCache(clearAll)
    return result
  })

  ipcMain.handle('getCacheTracksInfo', () => {
    const tracks = cache.get(CacheAPIs.LocalMusic, { sql: "type = 'online'" })
    const size = tracks.songs
      .map((track: any) => track.size)
      .reduce((acc: string, cur: string) => Number(acc) + Number(cur), 0)
    return { length: tracks.songs.length, size }
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
    const data = { result: { songs: [track] } }
    const result = cache.set(CacheAPIs.searchMatch, data, { localID: id })
    return result
  })

  ipcMain.handle('updateLocalTrackInfo', (event, trackId: number, data: any) => {
    const result = cache.set(CacheAPIs.Track, data, { id: trackId })
    return result
  })

  ipcMain.handle('deleteACacheTrack', (event, trackId: number) => {
    try {
      db.delete(Tables.Track, trackId)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('deleteLocalPlaylist', (event, pid: number) => {
    try {
      db.delete(Tables.Playlist, pid)
      return true
    } catch (error) {
      log.error('删除本地歌单失败:', error)
      return false
    }
  })

  ipcMain.handle('logout', (event, uid: string) => {
    try {
      db.delete(Tables.AccountData, uid)
      return true
    } catch (error) {
      log.error('登出失败:', error)
      return false
    }
  })

  ipcMain.handle('check-update', async () => {
    const info = await checkUpdate()
    return info
  })
  ipcMain.on('downloadUpdate', () => {
    downloadUpdate()
  })

  ipcMain.on('update-powersave', (event, enable: boolean) => {
    const { powerSaveBlocker } = require('electron')
    if (enable) {
      blockerId = powerSaveBlocker.start('prevent-app-suspension')
    } else {
      if (powerSaveBlocker.isStarted(blockerId)) {
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
    } catch (error) {}
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
  ipcMain.handle('stream-login', async (event: IpcMainEvent, data: any) => {
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
}

function initPluginIpcMain(win: BrowserWindow) {
  const plugMap = new Map<string, PluginInstance>()

  const pluginDir = Constants.IS_DEV_ENV
    ? path.join(process.cwd(), `./src/public/plugin`)
    : path.join(__dirname, `../plugin`)

  const files = fs
    .readdirSync(pluginDir)
    .filter((file) => file.endsWith('.js') && !file.includes('demo.js'))

  files.forEach((file) => {
    const id = path.basename(file, '.js')
    const url = path.join(pluginDir, file)
    const plugin = new PluginInstance(url, id)
    plugMap.set(id, plugin)
  })

  win.webContents.send('loadedPlugins', [...plugMap.keys()])

  // ipcMain.on('', () => {})
}
