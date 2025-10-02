import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  Menu,
  protocol,
  screen,
  MessageChannelMain,
  powerMonitor
} from 'electron'
import fs from 'fs'
import Constants from './utils/Constants'
import store from './store'
import { createTray, YPMTray } from './tray'
import { createMenu } from './menu'
import { MprisImpl } from './mpris'
import fastify, { FastifyInstance } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import netease from './appServer/netease'
import httpHandler from './appServer/httpHandler'
import IPCs from './IPCs'
import fastifyStatic from '@fastify/static'
import path from 'path'
import cache from './cache'
import sharp from 'sharp'
import {
  getPic,
  getPicFromApi,
  getLyric,
  getLyricFromApi,
  getPicColor,
  getTrackDetail,
  getAudioSource,
  cacheOnlineTrack
} from './utils/utils'
import { CacheAPIs } from './utils/CacheApis'
import { registerGlobalShortcuts } from './globalShortcut'
import { initAutoUpdater } from './checkUpdate'
import log from './log'

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

const defaultImagePath = Constants.IS_DEV_ENV
  ? path.join(process.cwd(), `./src/public/images/default.jpg`)
  : path.join(__dirname, `../images/default.jpg`)

class BackGround {
  win: BrowserWindow | null = null
  osdMode: string
  lyricWin: BrowserWindow | null = null
  tray: YPMTray | null = null
  menu: Menu | null = null
  mpris: MprisImpl | null = null
  fastifyApp: FastifyInstance | null = null
  willQuitApp: boolean = !Constants.IS_MAC
  checkInterval: any = null
  isInWindow: boolean = false
  lastKnownMousePosition = { x: 0, y: 0 }

  async init() {
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

    this.handleAppEvents()
  }

  async createFastifyApp() {
    const server = fastify({
      ignoreTrailingSlash: true
    })
    server.register(fastifyCookie)
    server.register(fastifyStatic, {
      root: path.join(__dirname, '../')
    })
    server.register(netease)
    server.register(httpHandler)
    server.decorate('win', null)
    const port = Number(
      Constants.IS_DEV_ENV
        ? Constants.ELECTRON_DEV_NETEASE_API_PORT || 40001
        : Constants.ELECTRON_WEB_SERVER_PORT || 41830
    )
    await server.listen({ port })
    log.info(`AppServer is running at http://localhost:${port}`)
    return server
  }

  async createMainWindow() {
    const option = {
      title: Constants.APP_NAME,
      show: false,
      width: (store.get('window.width') as number) || 1080,
      height: (store.get('window.height') as number) || 720,
      x: undefined,
      y: undefined,
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
  }

  async createOSDWindow(type: string) {
    this.osdMode = type
    store.set('osdWin.type', type)
    const option = {
      title: '桌面歌词',
      show: false,
      width:
        type === 'small'
          ? ((store.get('osdWin.width') || 700) as number)
          : ((store.get('osdWin.width2') || 500) as number),
      height:
        type === 'small'
          ? ((store.get('osdWin.height') || 140) as number)
          : ((store.get('osdWin.height2') || 600) as number),
      minHeight: type === 'small' ? 140 : 400,
      maxHeight: type === 'small' ? 220 : undefined,
      minWidth: type === 'small' ? 700 : 400,
      maxWidth: type === 'small' ? undefined : undefined,
      useContentSize: true,
      x: undefined,
      y: undefined,
      transparent: true,
      frame: false,
      hasShadow: false,
      hiddenInMissionControl: true,
      skipTaskbar: true,
      maximizable: false,
      webPreferences: Constants.DEFAULT_OSD_PREFERENCES
    }

    const x = (type === 'small' ? store.get('osdWin.x') : store.get('osdWin.x2')) as number
    const y = (type === 'small' ? store.get('osdWin.y') : store.get('osdWin.y2')) as number
    if (x && y) {
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

  dragOsdWindow(data: { dx: number; dy: number; startHeight: number; startWidth: number }) {
    const bds = this.lyricWin?.getBounds()

    const displays = screen.getAllDisplays()
    let x = bds.x + data.dx
    let y = bds.y + data.dy
    const height = data.startHeight
    const width = data.startWidth
    let isInside = false

    for (let i = 0; i < displays.length; i++) {
      const { bounds } = displays[i]
      if (
        x > bounds.x &&
        x + width < bounds.x + bounds.width &&
        y > bounds.y &&
        y + height < bounds.y + bounds.height
      ) {
        isInside = true
        break
      }
    }

    if (!isInside) {
      x = bds.x
      y = bds.y
    }

    this.lyricWin?.setBounds({ x, y, height, width })
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

  checkOsdMouseLeave(inter = 16) {
    if (!this.isInWindow) {
      this.lyricWin?.webContents.send('mouseInWindow', true)
      this.isInWindow = true
    }
    if (this.checkInterval) clearInterval(this.checkInterval)
    this.checkInterval = setInterval(() => {
      if (!this.lyricWin) {
        clearInterval(this.checkInterval)
        return
      }
      const mousePos = screen.getCursorScreenPoint()
      if (
        mousePos.x !== this.lastKnownMousePosition.x ||
        mousePos.y !== this.lastKnownMousePosition.y
      ) {
        this.lastKnownMousePosition = { x: mousePos.x, y: mousePos.y }
        const bounds = this.lyricWin?.getBounds() || { x: 0, y: 0, width: 0, height: 0 }
        const isInWindow =
          mousePos.x >= bounds.x - 10 &&
          mousePos.x <= bounds.x + bounds.width + 10 &&
          mousePos.y >= bounds.y - 10 &&
          mousePos.y <= bounds.y + bounds.height + 10
        if (!isInWindow) {
          this.lyricWin?.webContents.send('mouseInWindow', false)
          clearInterval(this.checkInterval)
        }
        this.isInWindow = isInWindow
      }
    }, inter)
  }

  updateLyricInfo(data: any) {
    this.lyricWin?.webContents.send('updateLyricInfo', data)
  }

  handleOSDWindowEvents() {
    this.lyricWin.once('ready-to-show', () => {
      this.lyricWin.showInactive()
    })
    this.lyricWin.webContents.on('did-finish-load', () => {
      this.initMessageChannel()
      this.toggleMouseIgnore()
      setTimeout(() => {
        this.lyricWin.setFocusable(false)
        this.lyricWin.setAlwaysOnTop(true)
      }, 100)
    })
    this.lyricWin.on('will-resize', () => {
      this.checkOsdMouseLeave(1000)
    })
    this.lyricWin.on('resize', () => {
      this.checkOsdMouseLeave(1000)

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
        if (!this.lyricWin) return
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
    const osdLyric = (store.get('osdWin.show') as boolean) || false
    if (!this.lyricWin && osdLyric) {
      this.createOSDWindow(type)
      this.handleOSDWindowEvents()
    }
  }

  initMessageChannel() {
    if (!this.lyricWin || !this.win) return
    const { port1, port2 } = new MessageChannelMain()
    this.win?.webContents.postMessage('port-connect', null, [port1])
    this.lyricWin?.webContents.postMessage('port-connect', null, [port2])
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
      const { host, pathname, searchParams } = new URL(request.url)

      if (host === 'get-default-pic') {
        const pic = fs.readFileSync(defaultImagePath)
        return new Response(new Uint8Array(pic))
      } else if (host === 'get-pic-path') {
        const filePath = pathname.slice(1)
        const track = { matched: false, filePath, album: { picUrl: 'atom://get-default-pic' } }

        const result = await getPic(track)
        return new Response(new Uint8Array(result.pic), {
          headers: { 'Content-Type': result.format }
        })
      } else if (host === 'get-color') {
        const urlString = pathname.slice(1)
        const [url, savePic] = urlString.split('/save-pic=')
        const { pic, format } = await getPicFromApi(url)
        const { color, color2 } = await getPicColor(pic)
        const jsonString = savePic
          ? {
              pic,
              format,
              color,
              color2,
              lyrics: {
                lrc: { lyric: [] },
                tlyric: { lyric: [] },
                romalrc: { lyric: [] },
                yrc: { lyric: [] },
                ytlrc: { lyric: [] },
                yromalrc: { lyric: [] }
              }
            }
          : { color, color2 }
        return new Response(JSON.stringify(jsonString), {
          headers: { 'content-type': 'application/json' }
        })
      } else if (host === 'local-asset') {
        const type = searchParams.get('type')
        let ids: string
        let res: Record<string, any>

        switch (type) {
          case 'pic':
            const size = Number(searchParams.get('size'))
            ids = searchParams.get('id')
            res = cache.get(CacheAPIs.Track, { ids })

            const track = res.songs[0]
            const url = new URL((track.album || track.al).picUrl)
            url.searchParams.set('param', `${size}y${size}`)
            ;(track.album || track.al).picUrl = track.matched
              ? url.toString()
              : 'atom://get-default-pic'

            const result = await getPic(track)
            let pic = result.pic
            pic = await sharp(pic).resize(size, size, { fit: 'cover' }).toBuffer()
            const format = result.format

            return new Response(new Uint8Array(pic), { headers: { 'Content-Type': format } })

          case 'stream':
            const mime = require('mime-types')
            const filePath = decodeURIComponent(searchParams.get('path'))
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

          case 'track':
            ids = searchParams.get('id')
            res = cache.get(CacheAPIs.Track, { ids })
            if (res) {
              const track = res.songs[0]
              return new Response(JSON.stringify(track), {
                headers: { 'content-type': 'application/json' }
              })
            } else {
              res = await getTrackDetail(ids)
              if (!res || !res.songs?.length) {
                log.error('======get-track-error=====', ids)
                return new Response(JSON.stringify({ status: 404 }), {
                  headers: { 'content-type': 'application/json' }
                })
              }
              const track = res.songs[0]
              const { url, br, gain, peak, source } = await getAudioSource(track)
              track.url = url
              track.source = source
              track.gain = gain
              track.peak = peak
              track.br = br

              if (store.get('settings.autoCacheTrack.enable')) {
                cacheOnlineTrack({ id: ids, name: track.name, url, br, win: this.win }).then(
                  (res) => {
                    track.url = res.filePath
                    track.size = res.size
                    track.cache = true
                    track.insertTime = Date.now()
                    cache.set(CacheAPIs.LocalMusic, { newTracks: [track] })
                    // this.win.webContents.send('')
                  }
                )
              }

              return new Response(JSON.stringify(track), {
                headers: { 'content-type': 'application/json' }
              })
            }

          case 'lyric':
            ids = searchParams.get('id')
            res = cache.get(CacheAPIs.Track, { ids })
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
              lyrics = await getLyric(track)
            } else {
              lyrics = await getLyricFromApi(Number(ids))
            }

            return new Response(JSON.stringify(lyrics), {
              headers: { 'content-type': 'application/json' }
            })
        }
      } else if (host === 'get-online-music') {
        const url = pathname.slice(1)
        const headers = request.headers
        return fetch(url, { headers })
      }
    })
  }

  handleAppEvents() {
    this.handleProtocol()
    app.whenReady().then(async () => {
      this.createMainWindow().then(() => {
        // @ts-ignore
        this.fastifyApp.win = this.win
      })

      // window events
      this.handleWindowEvents()

      initAutoUpdater(this.win)
      this.tray = createTray(this.win)
      if (Constants.IS_LINUX) {
        const createMpris = (await import('./mpris')).createMpris
        this.mpris = await createMpris(this.win)
      }

      if (store.get('settings.enableGlobalShortcut') || false) {
        registerGlobalShortcuts(this.win)
      }

      const lrc = {
        toggleOSDWindow: () => this.toggleOSDWindow(),
        toggleMouseIgnore: () => this.toggleMouseIgnore(),
        updateLyricInfo: (data: any) => this.updateLyricInfo(data),
        switchOSDWindow: (showMode: string) => this.switchOSDWindow(showMode),
        updateOSDPlayingState: (state: boolean) => this.updateOSDPlayingState(state),
        updateOsdHeight: (height: number) => this.updateOsdHeight(height),
        dragOsdWindow: (data: any) => this.dragOsdWindow(data),
        windowMouseleave: () => this.checkOsdMouseLeave()
      }
      IPCs.initialize(this.win, this.tray, this.mpris, lrc)
      createMenu(this.win)
      if (Constants.IS_MAC) {
        const createDockMenu = (await import('./dock')).createDockMenu
        createDockMenu(this.win)

        const createTouchBar = (await import('./touchBar')).createTouchBar
        createTouchBar(this.win)
      }
    })

    app.on('activate', async () => {
      if (this.win === null) {
        await this.createMainWindow()
      } else {
        this.win.show()
      }
      if (Constants.IS_WINDOWS) {
        const createThumBar = (await import('./thumBar')).createThumBar
        createThumBar(this.win)
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

    powerMonitor.on('resume', () => {
      setTimeout(() => this.initMessageChannel(), 1000)
      this.win.webContents.send('resume')
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
    this.win.once('ready-to-show', async () => {
      this.win.show()
      this.win.focus()
      if (Constants.IS_WINDOWS) {
        const createThumBar = (await import('./thumBar')).createThumBar
        createThumBar(this.win)
      }
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
        if (!this.win) return
        store.set('window', this.win.getBounds())
      }, 500)
    })
  }
}

const bgProcess = new BackGround()
bgProcess.init()
