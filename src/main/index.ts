import { app, BrowserWindow, dialog, globalShortcut, Menu, net, protocol, screen } from 'electron'
import { release } from 'os'
import fs from 'fs'
import Constants from './utils/Constants'
import store from './store'
import { createTray, YPMTray } from './tray'
// import { createTray, YPMTray } from './testTray'
import { createMenu } from './menu'
import { createDockMenu } from './dock'
import { createTouchBar } from './touchBar'
import { createMpris, MprisImpl } from './mpris'
import fastify, { FastifyInstance } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import netease from './appServer/netease'
import IPCs from './IPCs'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { parseFile, IAudioMetadata } from 'music-metadata'
import mime from 'mime-types'
import cache from './cache'
import {
  getReplayGainFromMetadata,
  getPic,
  getLyric,
  getPicColor,
  getTrackDetail,
  getAudioSource
} from './utils/utils'
import { CacheAPIs } from './utils/CacheApis'
import { registerGlobalShortcuts } from './globalShortcut'
import { AmuseServerManager, MainWindowAmuseInfoGetter, emptyInfoGetter } from './amuseServer'

const cacheTracks = new Map<string, any>()

const closeOnLinux = (e: any, win: BrowserWindow) => {
  const closeOpt = store.get('settings.closeAppOption') || 'ask'
  if (closeOpt !== 'exit') {
    e.preventDefault()
  }

  if (closeOpt === 'ask') {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Information',
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
          win.hide()
        } else if (result.response === 1) {
          setTimeout(() => {
            win = null
            app.exit()
          }, 100)
        }
      })
      .catch()
  } else if (closeOpt === 'exit') {
    win = null
    app.quit()
  } else {
    win.hide()
  }
}

class BackGround {
  win: BrowserWindow | null = null
  osdMode: string
  lyricWin: BrowserWindow | null = null
  tray: YPMTray | null = null
  menu: Menu | null = null
  mpris: MprisImpl | null = null
  fastifyApp: FastifyInstance | null = null
  amuseServer: AmuseServerManager | null = null
  willQuitApp: boolean = !Constants.IS_MAC

  async init() {
    if (release().startsWith('6.1')) app.disableHardwareAcceleration()
    if (process.platform === 'win32') app.setAppUserModelId(app.getName())
    if (!app.requestSingleInstanceLock()) {
      app.quit()
      process.exit(0)
    }

    if (Constants.IS_LINUX) {
      app.commandLine.appendSwitch(
        'disable-features',
        'HardwareMediaKeyHandling,MediaSessionService'
      )
    }

    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'atom',
        privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
      }
    ])

    // create fastify app
    this.fastifyApp = await this.createFastifyApp()

    this.amuseServer = new AmuseServerManager(emptyInfoGetter)
    this.amuseServer.restart()

    this.handleAppEvents()
  }

  async createFastifyApp() {
    const server = fastify({
      ignoreTrailingSlash: true
    })
    // server.register(fastifyCors, {
    //   origin: '*'
    // })
    server.register(fastifyCookie)
    server.register(fastifyStatic, {
      root: path.join(__dirname, '../')
    })
    server.register(netease)
    const port = Number(
      Constants.IS_DEV_ENV
        ? Constants.ELECTRON_DEV_NETEASE_API_PORT || 40001
        : Constants.ELECTRON_WEB_SERVER_PORT || 41830
    )
    await server.listen({ port })
    console.log(`AppServer is running at http://localhost:${port}`)
    return server
  }

  async createMainWindow() {
    const option = {
      title: Constants.APP_NAME,
      show: false,
      width: (store.get('window.width') as number) || 1080,
      height: (store.get('window.height') as number) || 720,
      x: (store.get('window.x') as number) || undefined,
      y: (store.get('window.y') as number) || undefined,
      minWidth: 1080,
      minHeight: 720,
      frame: !(
        Constants.IS_WINDOWS ||
        (Constants.IS_LINUX && store.get('settings.useCustomTitlebar'))
      ),
      useContentSize: true,
      titleBarStyle: 'hiddenInset' as const,
      webPreferences: Constants.DEFAULT_WEB_PREFERENCES
    }

    if (store.get('window.x') && store.get('window.y')) {
      const x = store.get('window.x') as number
      const y = store.get('window.y') as number

      const displays = screen.getAllDisplays()
      let isResetWindow = false
      if (displays.length === 1) {
        const { bounds } = displays[0]
        if (
          x < bounds.x ||
          x > bounds.x + bounds.width - 50 ||
          y < bounds.y ||
          y > bounds.y + bounds.height - 50
        ) {
          isResetWindow = true
        }
      } else {
        isResetWindow = true

        for (let i = 0; i < displays.length; i++) {
          const { bounds } = displays[i]
          if (
            x > bounds.x &&
            x < bounds.x + bounds.width &&
            y > bounds.y &&
            y < bounds.y + bounds.height
          ) {
            isResetWindow = false
            break
          }
        }
      }

      if (!isResetWindow) {
        option.x = x
        option.y = y
      }
    }

    this.win = new BrowserWindow(option)
    this.win.setMenuBarVisibility(false)

    if (Constants.IS_DEV_ENV) {
      await this.win.loadURL(Constants.APP_INDEX_URL_DEV)
      this.win.webContents.openDevTools()
    } else {
      await this.win.loadURL(Constants.APP_INDEX_URL_PROD)
    }

    if (this.amuseServer) {
      this.amuseServer.infoGetter = new MainWindowAmuseInfoGetter(this.win)
    }
  }

  async createOSDWindow(type: string) {
    this.osdMode = type
    store.set('osdWin.type', type)
    const option = {
      title: '桌面歌词',
      show: false,
      // width: store.get('osdWin.type') === 'small' ? 700 : 400,
      // height: store.get('osdWin.type') === 'small' ? 140 : 700,
      width:
        type === 'small'
          ? ((store.get('osdWin.width') || 700) as number)
          : ((store.get('osdWin.width2') || 500) as number),
      height:
        type === 'small'
          ? ((store.get('osdWin.height') || 140) as number)
          : ((store.get('osdWin.height2') || 600) as number),
      minHeight: type === 'small' ? 140 : 400,
      maxHeight: type === 'small' ? 200 : undefined,
      minWidth: type === 'small' ? 700 : 400,
      maxWidth: type === 'small' ? undefined : undefined,
      useContentSize: true,
      x:
        ((type === 'small' ? store.get('osdWin.x') : store.get('osdWin.x2')) as number) ||
        undefined,
      y:
        ((type === 'small' ? store.get('osdWin.y') : store.get('osdWin.y2')) as number) ||
        undefined,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      hasShadow: false,
      hiddenInMissionControl: true,
      skipTaskbar: true,
      maximizable: false,
      webPreferences: Constants.DEFAULT_OSD_PREFERENCES
    }

    if (option.x && option.y) {
      const x = option.x
      const y = option.y

      const displays = screen.getAllDisplays()
      let isResetWindow = false
      if (displays.length === 1) {
        const { bounds } = displays[0]
        if (
          x < bounds.x ||
          x > bounds.x + bounds.width - 50 ||
          y < bounds.y ||
          y > bounds.y + bounds.height - 50
        ) {
          isResetWindow = true
        }
      } else {
        isResetWindow = true

        for (let i = 0; i < displays.length; i++) {
          const { bounds } = displays[i]
          if (
            x > bounds.x &&
            x < bounds.x + bounds.width &&
            y > bounds.y &&
            y < bounds.y + bounds.height
          ) {
            isResetWindow = false
            break
          }
        }
      }

      if (!isResetWindow) {
        option.x = x
        option.y = y
      }
    }
    this.lyricWin = new BrowserWindow(option)
    await this.lyricWin.loadURL(Constants.APP_OSD_URL)
  }

  toggleMouseIgnore() {
    const isLock = (store.get('osdWin.isLock') as boolean) || false
    this.lyricWin?.setIgnoreMouseEvents(isLock, { forward: !Constants.IS_LINUX })
    this.lyricWin?.setVisibleOnAllWorkspaces(isLock)
  }

  toggleOSDWindow() {
    const osdLyric = (store.get('osdWin.show') as boolean) || false
    const showMode = (store.get('osdWin.type') as string) || 'small'
    if (osdLyric) {
      this.showOSDWindow(showMode)
    } else {
      this.hideOSDWindow()
    }
  }

  updateOsdHeight(height: number) {
    const bounds = this.lyricWin?.getBounds()
    this.lyricWin?.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height
    })
  }

  updateOSDPlayingState(playing: boolean) {
    this.lyricWin?.webContents.send('update-osd-playing-status', playing)
  }

  switchOSDWindow(showMode: string) {
    this.hideOSDWindow()
    this.showOSDWindow(showMode)
  }

  updateLyricInfo(data: any) {
    this.lyricWin?.webContents.send('updateLyricInfo', data)
  }

  handleOSDWindowEvents() {
    this.lyricWin.once('ready-to-show', () => {
      this.lyricWin.showInactive()
      if (!Constants.IS_LINUX) this.toggleMouseIgnore()
    })
    this.lyricWin.on('resize', () => {
      const data = this.lyricWin.getBounds()
      store.set(this.osdMode === 'small' ? 'osdWin.width' : 'osdWin.width2', data.width)
      store.set(this.osdMode === 'small' ? 'osdWin.height' : 'osdWin.height2', data.height)
    })

    let moveTimeout
    this.lyricWin.on('move', () => {
      if (moveTimeout) {
        clearTimeout(moveTimeout)
      }
      moveTimeout = setTimeout(() => {
        const data = this.lyricWin.getBounds()
        store.set(this.osdMode === 'small' ? 'osdWin.x' : 'osdWin.x2', data.x)
        store.set(this.osdMode === 'small' ? 'osdWin.y' : 'osdWin.y2', data.y)
      }, 500)
    })
  }

  hideOSDWindow() {
    if (this.lyricWin) {
      this.lyricWin.close()
      this.lyricWin = null
    }
  }

  showOSDWindow(type = 'small') {
    if (!this.lyricWin) {
      this.createOSDWindow(type)
      this.handleOSDWindowEvents()
    }
  }

  initOSDWindow() {
    const osd = store.get('osdWin.show') || false
    const showMode = (store.get('osdWin.type') as string) || 'small'
    if (osd) {
      this.showOSDWindow(showMode)
    }
  }

  handleProtocol() {
    protocol.handle('atom', async (request) => {
      const { host, pathname } = new URL(request.url)
      if (host === 'online-pic') {
        const url = pathname.slice(1).replace('http://', 'https://')
        return net.fetch(url)
      } else if (host === 'get-pic') {
        const ids = pathname.slice(1)
        const res = cache.get(CacheAPIs.Track, { ids })
        let track
        if (res) {
          track = res.songs[0]
        } else {
          const res = await getTrackDetail(ids)
          track = res.songs[0]
        }
        let url = track.album?.picUrl || track.al?.picUrl
        if (url.startsWith('http://')) {
          url = url.replace('http://', 'https://')
          url = `${url}?param=64y64`
        }
        let metadata = null

        if (track.isLocal) {
          metadata = await parseFile(decodeURI(track.filePath))
        }

        const result = await getPic(url, track.matched, metadata)

        const pic = result.pic
        const format = result.format

        return new Response(pic, { headers: { 'Content-Type': format } })
      } else if (host === 'get-pic-path') {
        const filePath = pathname.slice(1)
        const url = 'https://p2.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg'
        const metadata = await parseFile(decodeURI(filePath))

        const result = await getPic(url, false, metadata)
        return new Response(result.pic, { headers: { 'Content-Type': result.format } })
      } else if (host === 'get-playlist-pic') {
        const ids = pathname.slice(1)
        const res = cache.get(CacheAPIs.Track, { ids })
        const track = res.songs[0]

        const url = track.matched
          ? track.album.picUrl + '?param=512y512'
          : 'https://p1.music.126.net/jWE3OEZUlwdz0ARvyQ9wWw==/109951165474121408.jpg?param=512y512'

        let metadata = null
        if (track.isLocal) {
          metadata = await parseFile(decodeURI(track.filePath))
        }

        const result = await getPic(url, track.matched, metadata)
        return new Response(result.pic, { headers: { 'Content-Type': result.format } })
      } else if (host === 'get-lyric') {
        const ids = pathname.slice(1)
        const res = cache.get(CacheAPIs.Track, { ids })
        let lyrics = {
          lrc: { lyric: [] },
          tlyric: { lyric: [] },
          romalrc: { lyric: [] },
          yrc: { lyric: [] },
          ytlrc: { lyric: [] },
          yromalrc: { lyric: [] }
        }

        if (res?.songs?.length > 0) {
          const track = res.songs[0]

          lyrics = await getLyric(track.id, track.matched, track.filePath)
        } else {
          lyrics = await getLyric(Number(ids), true, null)
        }

        return new Response(JSON.stringify(lyrics), {
          headers: { 'content-type': 'application/json' }
        })
      } else if (host === 'get-track-info') {
        const ids = pathname.slice(1)
        let track
        const res = cache.get(CacheAPIs.Track, { ids })
        if (res?.songs?.length > 0) {
          track = res.songs[0]
        } else {
          track = cacheTracks.get(ids)
          if (track) {
            cacheTracks.delete(ids)
          } else {
            const res = await getTrackDetail(ids)
            track = res.songs[0]
          }
          track.matched = true
        }

        let url = track.album?.picUrl || track.al?.picUrl
        if (url.startsWith('http://')) {
          url = url.replace('http://', 'https://')
        }
        url = `${url}?param=512y512`
        let metadata: IAudioMetadata | null = null

        // const useInnerFirst = store.get('settings.innerFirst') as boolean
        if (track.isLocal && !track.matched) {
          metadata = await parseFile(decodeURI(track.filePath))
        }

        // 获取歌词信息
        const paramForLocal = metadata ?? track.filePath ?? null
        const lyrics = await getLyric(track.id, track.matched, paramForLocal)

        // 获取封面
        const { pic, format } = await getPic(url, track.matched, metadata)

        // 获取颜色
        const { color, color2 } = await getPicColor(pic)

        const gain = getReplayGainFromMetadata(metadata)
        return new Response(JSON.stringify({ pic, format, color, color2, gain, lyrics }), {
          headers: { 'content-type': 'application/json' }
        })
      } else if (host === 'get-track') {
        const ids = pathname.slice(1)
        const res = cache.get(CacheAPIs.Track, { ids })
        if (res) {
          const track = res.songs[0]
          track.source = 'localTrack'
          return new Response(JSON.stringify(track), {
            headers: { 'content-type': 'application/json' }
          })
        } else {
          const res = await getTrackDetail(ids)
          const track = res.songs[0]
          const { url, source } = await getAudioSource(track)
          track.url = url
          track.source = source
          cacheTracks.set(ids, track)
          return new Response(JSON.stringify(track), {
            headers: { 'content-type': 'application/json' }
          })
        }
      } else if (host === 'get-color') {
        const url = pathname.slice(1)
        const { pic } = await getPic(url, true, null)
        const { color, color2 } = await getPicColor(pic)
        return new Response(JSON.stringify({ color, color2 }), {
          headers: { 'content-type': 'application/json' }
        })
      } else if (host === 'get-music') {
        const filePath = decodeURI(pathname.slice(1))
        if (!fs.existsSync(filePath)) {
          return new Response('Not Found', { status: 404 })
        }
        const fileStat = fs.statSync(filePath)
        const range = request.headers.get('range')
        let start = 0
        let end = fileStat.size - 1
        if (range) {
          const match = range.match(/bytes=(\d*)-(\d*)/)
          if (match) {
            start = match[1] ? parseInt(match[1], 10) : start
            end = match[2] ? parseInt(match[2], 10) : end
          }
        }
        const chunkSize = end - start + 1
        const stream = fs.createReadStream(filePath, { start, end })
        const mimeType = mime.lookup(filePath)
        // @ts-ignore
        return new Response(stream, {
          status: range ? 206 : 200,
          headers: {
            'content-type': mimeType,
            'content-length': chunkSize.toString(),
            'accept-ranges': 'bytes',
            'content-range': `bytes ${start}-${end}/${fileStat.size}`
          }
        })
      } else if (host === 'get-online-music') {
        const url = pathname.slice(1)
        const headers = request.headers
        return fetch(url, { headers })
      }
    })
  }

  handleAppEvents() {
    this.handleProtocol()
    app.whenReady().then(() => {
      // handle protocol
      // this.handleProtocol()

      // create window
      this.createMainWindow()
      this.initOSDWindow()

      // window events
      this.handleWindowEvents()

      this.tray = createTray(this.win)
      createTouchBar(this.win)
      if (Constants.IS_LINUX) {
        this.mpris = createMpris(this.win)
      }

      if (store.get('settings.enableGlobalShortcut')) {
        registerGlobalShortcuts(this.win)
      }

      const lrc = {
        toggleOSDWindow: () => this.toggleOSDWindow(),
        toggleMouseIgnore: () => this.toggleMouseIgnore(),
        updateLyricInfo: (data: any) => this.updateLyricInfo(data),
        switchOSDWindow: (showMode: string) => this.switchOSDWindow(showMode),
        updateOSDPlayingState: (state: boolean) => this.updateOSDPlayingState(state),
        updateOsdHeight: (height: number) => this.updateOsdHeight(height)
      }
      IPCs.initialize(this.win, this.tray, this.mpris, lrc)
      createMenu(this.win)
      createDockMenu(this.win)
    })

    app.on('activate', () => {
      if (this.win === null) {
        this.createMainWindow()
      } else {
        this.win.show()
      }
    })

    app.on('window-all-closed', () => {
      if (!Constants.IS_MAC) app.quit()
    })

    app.on('before-quit', () => {
      this.willQuitApp = true
    })

    app.on('quit', () => {
      this.fastifyApp?.close()
    })

    app.on('will-quit', () => {
      globalShortcut.unregisterAll()
    })

    if (!Constants.IS_MAC) {
      app.on('second-instance', () => {
        if (this.win) {
          this.win.show()
          if (this.win.isMinimized()) {
            this.win.restore()
          }
          this.win.focus()
        }
      })
    }
  }

  handleWindowEvents() {
    this.win.once('ready-to-show', () => {
      this.win.show()
      this.win.focus()
    })

    this.win.on('close', (e) => {
      if (Constants.IS_MAC) {
        if (this.willQuitApp) {
          this.win = null
          app.quit()
        } else {
          e.preventDefault()
          this.win.hide()
        }
      } else {
        closeOnLinux(e, this.win)
      }
    })

    this.win.on('maximize', () => {
      this.win.webContents.send('isMaximized', true)
    })

    this.win.on('unmaximize', () => {
      this.win.webContents.send('isMaximized', false)
    })

    this.win.on('resize', () => {
      store.set('window', this.win.getBounds())
    })

    let moveTimeout
    this.win.on('move', () => {
      if (moveTimeout) {
        clearTimeout(moveTimeout)
      }
      moveTimeout = setTimeout(() => {
        store.set('window', this.win.getBounds())
      }, 500)
    })
  }
}

const bgProcess = new BackGround()
bgProcess.init()
