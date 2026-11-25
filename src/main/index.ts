import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  Menu,
  protocol,
  screen,
  powerMonitor
} from 'electron'
import fs from 'fs'
import Constants from './utils/Constants'
import store from './store'
import { createTray, YPMTray } from './tray'
import { createTouchBar, YPMTouchBar } from './touchBar'
import { createMenu } from './menu'
import { MprisImpl } from './mpris'
import fastify, { FastifyInstance } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import netease from './appServer/netease'
import httpHandler from './appServer/httpHandler'
import { startInstance as startAmuseFastifyInstance } from './appServer/6kLabsAmuse'
import IPCs from './IPCs'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { db, Tables } from './db'
import { getPic, getPicFromApi, getPicColor } from './utils'
import { proxyFetch } from './utils/proxyFetch'
import { registerGlobalShortcuts } from './globalShortcut'
import { initAutoUpdater } from './checkUpdate'
import log from './log'
import { pluginManager } from './pluginManager'
import { installIpcGuard } from './utils/ipcGuard'
import { hardenWindow } from './utils/windowHardening'
import { isGrantedLocalResource } from './utils/pathGrants'
import { applyUiScale, getMinWindowSize, getUiScale } from './utils/uiScale'

const closeOnLinux = (e: any, win: BrowserWindow | null) => {
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
          win!.webContents.send(
            'rememberCloseAppOption',
            result.response === 0 ? 'minimizeToTray' : 'exit'
          )
        }

        if (result.response === 0) {
          win!.hide()
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
    win!.hide()
  }
}

/**
 * 把窗口收进它所在显示器的工作区。
 *
 * 低分辨率屏幕（issue #432：1024×600）下，恢复出来的窗口尺寸或窗口最小尺寸
 * 可能大于屏幕可用区域，导致普通窗口 / 最大化 / 全屏都按更大的尺寸排版，
 * 界面右侧与底部被裁掉。这里在窗口创建后做最后一次兜底。
 */
function fitWindowToWorkArea(win: BrowserWindow): void {
  const bounds = win.getBounds()
  const { workArea } = screen.getDisplayMatching(bounds)
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  if (width === bounds.width && height === bounds.height) return

  win.setBounds({
    x: Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - height)),
    width,
    height
  })
  log.info(`[window] 窗口超出显示器工作区，已收缩为 ${width}×${height}`)
}

const defaultImagePath = Constants.IS_DEV_ENV
  ? path.join(process.cwd(), `./src/public/images/default.jpg`)
  : path.join(__dirname, `../images/default.jpg`)

const singerImagePath = Constants.IS_DEV_ENV
  ? path.join(process.cwd(), `./src/public/images/singer.png`)
  : path.join(__dirname, `../images/singer.png`)

/**
 * vutron:// 的 CORS 响应头。
 *
 * 渲染层用 `<audio crossOrigin="anonymous">` 播放 vutron:// 资源（流媒体插件、本地
 * 缓存、netease 解锁源），Chromium 会以 CORS 模式请求。自定义协议要同时具备
 * `corsEnabled` 权限与 `Access-Control-Allow-Origin` 响应头，否则音频被网络层拦掉，
 * 播放层拿不到数据，只会表现为「重试 → 跳歌」。
 */
function buildVutronCorsHeaders(origin: string | null): Record<string, string> {
  return {
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'Range, Content-Type, Origin, Authorization',
    'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
  }
}

/** 给实际响应补上 CORS 头；Origin 为空表示不是 CORS 请求，原样返回 */
function withVutronCors(response: Response, origin: string | null): Response {
  if (!origin) return response

  const headers = new Headers(response.headers)
  const cors = buildVutronCorsHeaders(origin)
  for (const key of Object.keys(cors)) headers.set(key, cors[key])

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/** vutron:// 的路由本体（不含安全边界与 CORS 包装） */
async function routeVutronRequest(request: Request): Promise<Response> {
  const { host, pathname, searchParams, search } = new URL(request.url)

  if (host === 'get-default-pic') {
    const pic = fs.readFileSync(defaultImagePath)
    return new Response(new Uint8Array(pic))
  } else if (host === 'get-singer-pic') {
    const pic = fs.readFileSync(singerImagePath)
    return new Response(new Uint8Array(pic))
  } else if (host === 'get-pic-path') {
    const filePath = pathname.slice(1)
    // 本地文件读取必须落在用户授权目录 / 授权文件 / 应用自身目录内
    if (!isGrantedLocalResource(filePath)) {
      log.warn(`[security] 已拒绝读取未授权的封面路径: ${filePath}`)
      return new Response('Forbidden', { status: 403 })
    }
    const track = { matched: false, filePath, album: { picUrl: 'vutron://get-default-pic' } }

    const result = await getPic(track)
    return new Response(new Uint8Array(result.pic), {
      headers: { 'Content-Type': result.format }
    })
  } else if (host === 'get-color') {
    const urlString = pathname.slice(1)
    const [url, savePic] = urlString.split('/save-pic=')
    const { pic, format } = await getPicFromApi(url)
    const { color, color2 } = await getPicColor(pic!)
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

    switch (type) {
      case 'stream':
        const mime = require('mime-types')
        try {
          let filePath = searchParams.get('path') || ''
          if (!filePath) {
            // id 分支：路径来自数据库，可信
            const trackId = searchParams.get('id') || ''
            if (trackId) {
              const row = db.sqlite
                .prepare(`SELECT filePath FROM ${Tables.Audio} WHERE trackId = ?`)
                .get(trackId) as { filePath: string } | undefined
              if (row) filePath = row.filePath
            }
          } else {
            // path 分支：路径由渲染进程提供，必须落在授权范围内
            filePath = decodeURIComponent(filePath)
            if (!isGrantedLocalResource(filePath)) {
              log.warn(`[security] 已拒绝读取未授权的流资源: ${filePath}`)
              return new Response('Forbidden', { status: 403 })
            }
          }
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
          stream.on('error', () => stream.destroy())

          request.signal?.addEventListener('abort', () => {
            stream.destroy()
          })

          const mimeType = mime.lookup(filePath) || 'application/octet-stream'
          const headers = {
            'content-type': mimeType,
            'accept-ranges': 'bytes'
          }

          if (range) {
            // @ts-ignore
            headers['content-length'] = String(chunkSize)
            // @ts-ignore
            headers['content-range'] = `bytes ${start}-${end}/${fileStat.size}`
          } else {
            // @ts-ignore
            headers['content-length'] = String(fileStat.size)
          }
          // @ts-ignore
          return new Response(stream, {
            status: range ? 206 : 200,
            headers
          })
        } catch (streamErr) {
          console.error('[vutron stream error]', streamErr)
          return new Response('Stream Error', { status: 500 })
        }

      case 'json':
        const jsonFile = searchParams.get('path')!
        if (!isGrantedLocalResource(jsonFile)) {
          log.warn(`[security] 已拒绝读取未授权的 json 资源: ${jsonFile}`)
          return new Response('Forbidden', { status: 403 })
        }
        if (!fs.existsSync(jsonFile)) {
          return new Response('Not Found', { status: 404 })
        }
        try {
          const content = await fs.promises.readFile(jsonFile, 'utf-8')
          const json = JSON.parse(content)
          return new Response(JSON.stringify(json), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
    }
  } else if (host === 'local-resource') {
    const mime = require('mime-types')
    let filePath = decodeURIComponent(pathname.slice(1))
    if (process.platform === 'win32' && filePath.match(/^\/[A-Za-z]:/)) {
      filePath = filePath.slice(1)
    }
    // 本地文件读取必须落在用户授权目录 / 授权文件 / 应用自身目录内
    if (!isGrantedLocalResource(filePath)) {
      log.warn(`[security] 已拒绝读取未授权的本地资源: ${filePath}`)
      return new Response('Forbidden', { status: 403 })
    }
    if (!fs.existsSync(filePath)) {
      return new Response('Not Found', { status: 404 })
    }
    const fileStat = fs.statSync(filePath)
    const mimeType = mime.lookup(filePath) || 'application/octet-stream'

    const range = request.headers.get('range')
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/)
      let start = 0
      let end = fileStat.size - 1
      if (match) {
        start = match[1] ? parseInt(match[1], 10) : start
        end = match[2] ? parseInt(match[2], 10) : end
      }
      const chunkSize = end - start + 1
      const stream = fs.createReadStream(filePath, { start, end })
      // 与 local-asset 的流分支保持一致：流错误 / 客户端中止（拖进度条、切歌）
      // 都要销毁读流，否则 fd 会一直挂到流自然耗尽。
      stream.on('error', () => stream.destroy())
      request.signal?.addEventListener('abort', () => stream.destroy())
      // @ts-ignore
      return new Response(stream, {
        status: 206,
        headers: {
          'content-type': mimeType,
          'content-length': chunkSize.toString(),
          'accept-ranges': 'bytes',
          'content-range': `bytes ${start}-${end}/${fileStat.size}`
        }
      })
    }

    const fileBuffer = fs.readFileSync(filePath)
    return new Response(new Uint8Array(fileBuffer), {
      headers: { 'Content-Type': mimeType }
    })
  } else if (host === 'get-online-music') {
    let url = pathname.slice(1)
    const headers = request.headers
    url += search
    try {
      const response = await proxyFetch(url, { headers })
      if (!response.ok) {
        return new Response(null, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': 'text/plain'
          }
        })
      }
      return response
    } catch (error) {
      log.error('== get-online-music error ==', error)
      return new Response(null, {
        status: 500,
        statusText: 'Internal Server Error'
      })
    }
  } else if (host === 'get-plugin-asset') {
    const pluginId = searchParams.get('plugin')!
    const plugin = pluginManager.get(pluginId)
    if (!plugin) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    const type = searchParams.get('type')
    switch (type) {
      case 'stream':
        const id = searchParams.get('id')
        const { url, headers } = await plugin.call('getStream', { id })
        try {
          const response = await proxyFetch(url, {
            method: 'GET',
            headers: {
              ...Object.fromEntries(request.headers),
              ...headers
            }
          })

          return new Response(response.body, {
            status: response.status,
            headers: response.headers
          })
        } catch (error) {
          log.error('== get-online-music error ==', error)
          return new Response(null, {
            status: 500,
            statusText: 'Internal Server Error'
          })
        }
      default:
        break
    }
  }
  return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
}

class BackGround {
  win: BrowserWindow | null = null
  osdMode: string = 'small'
  lyricWin: BrowserWindow | null = null
  tray: YPMTray | null = null
  touchBar: YPMTouchBar | null = null
  menu: Menu | null = null
  mpris: MprisImpl | null = null
  fastifyApp: FastifyInstance | null = null
  amuseFastifyApp: FastifyInstance | null = null
  createAmuseFastifyAppPromise: Promise<void> = Promise.resolve()
  willQuitApp: boolean = !Constants.IS_MAC
  lockMouseCheckInterval: ReturnType<typeof setInterval> | null = null

  async init() {
    process.on('unhandledRejection', (reason) => {
      console.error('[unhandledRejection]', reason)
    })
    process.on('uncaughtException', (err) => {
      console.error('[uncaughtException]', err)
    })
    if (process.platform === 'win32') app.setAppUserModelId('io.github.stark81.VutronMusic')
    if (!app.requestSingleInstanceLock()) {
      app.quit()
      process.exit(0)
    }

    const forceFactor = (store.get('settings.forceFactor') as boolean) || false
    if (forceFactor) {
      app.commandLine.appendSwitch('force-device-scale-factor', '1.0')
    }

    if (Constants.IS_LINUX) {
      app.commandLine.appendSwitch(
        'disable-features',
        'HardwareMediaKeyHandling,MediaSessionService'
      )
    }

    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'vutron',
        privileges: {
          secure: true,
          standard: true,
          supportFetchAPI: true,
          stream: true,
          /**
           * 必须开启。渲染层用 `<audio crossOrigin="anonymous">` 播放 vutron:// 资源
           * （流媒体插件 / 本地缓存 / netease 解锁源），这属于 CORS 请求；未登记为
           * CORS-enabled 的 scheme 会被 Chromium 直接拒绝：
           * "Cross origin requests are only supported for protocol schemes: ..."
           * → 音频加载失败 → 播放层重试后跳歌。
           */
          corsEnabled: true
        }
      }
    ])

    // create fastify app
    // 失败必须 fail-closed：如果 41830 已被其它进程占用，窗口会加载到不属于本应用
    // 的内容（且 origin 相同，IPC 守卫无法识别），因此宁可退出也不能继续。
    try {
      this.fastifyApp = await this.createFastifyApp()
    } catch (error) {
      const message = `本地服务启动失败（端口 ${Constants.ELECTRON_WEB_SERVER_PORT} 可能已被占用）：${
        (error as Error)?.message || error
      }`
      log.error(`[security] ${message}`)
      dialog.showErrorBox(Constants.APP_NAME, message)
      app.exit(1)
      return
    }

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

    const generateConfig = require('@neteasecloudmusicapienhanced/api/generateConfig')
    await generateConfig()

    server.register(netease)
    server.register(httpHandler)
    server.decorate('win', null)

    // 纵深防御：给本地服务响应补上不会误伤功能的 CSP 与嗅探保护
    server.addHook('onSend', async (_request, reply, payload) => {
      reply.header('Content-Security-Policy', Constants.LOCAL_SERVER_CSP)
      reply.header('X-Content-Type-Options', 'nosniff')
      return payload
    })

    const port = Number(
      Constants.IS_DEV_ENV
        ? Constants.ELECTRON_DEV_NETEASE_API_PORT || 40001
        : Constants.ELECTRON_WEB_SERVER_PORT || 41830
    )
    // 显式只监听回环地址，避免在局域网网卡上暴露本地 API 与静态资源
    await server.listen({ port, host: '127.0.0.1' })
    log.info(`AppServer is running at http://localhost:${port}`)
    return server
  }

  async createMainWindow() {
    const DEFAULT_WIDTH = 1080
    const DEFAULT_HEIGHT = 720
    // 界面缩放：默认 100% 时最小尺寸仍是 1080×720（历史行为），
    // 调小缩放后按比例缩小最小尺寸，低分辨率屏幕才能完整显示（issue #432）
    const uiScale = getUiScale()
    const primaryWorkArea = screen.getPrimaryDisplay().workAreaSize
    const minWindowSize = getMinWindowSize(primaryWorkArea, uiScale)

    const option = {
      title: Constants.APP_NAME,
      show: false,
      width: Math.min(
        (store.get('window.width') as number) || DEFAULT_WIDTH,
        primaryWorkArea.width
      ),
      height: Math.min(
        (store.get('window.height') as number) || DEFAULT_HEIGHT,
        primaryWorkArea.height
      ),
      x: undefined as number | undefined,
      y: undefined as number | undefined,
      minWidth: minWindowSize.width,
      minHeight: minWindowSize.height,
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
    // 恢复的位置/尺寸可能来自更大的显示器，或含标题栏的窗口尺寸略大于工作区
    fitWindowToWorkArea(this.win)
    // 页面缩放要在加载前设一次，加载后再补一次（Chromium 会按 origin 记住缩放级别）
    applyUiScale(this.win, uiScale)
    // 注意这里不能闭包捕获 uiScale：渲染层在页面加载期间会同步设置（可能改过缩放），
    // 用旧值覆盖会把用户刚改的缩放又改回去
    this.win.webContents.on('did-finish-load', () => applyUiScale(this.win))
    // 安全边界：锁定导航 + 登记可信 IPC 调用方，必须在 loadURL 之前完成
    hardenWindow(this.win, 'main')

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
      // maxHeight: type === 'small' ? 220 : undefined,
      minWidth: type === 'small' ? 700 : 400,
      maxWidth: type === 'small' ? undefined : undefined,
      useContentSize: true,
      x: undefined as number | undefined,
      y: undefined as number | undefined,
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
    // 安全边界：锁定导航 + 登记可信 IPC 调用方（仅限 OSD 专用通道）
    hardenWindow(this.lyricWin, 'osd')
    await this.lyricWin.loadURL(Constants.APP_OSD_URL)
  }

  toggleMouseIgnore(overrideLock?: boolean) {
    const realLock = (store.get('osdWin.isLock') as boolean) || false
    const applyLock = overrideLock !== undefined ? overrideLock : realLock

    this.lyricWin?.setIgnoreMouseEvents(applyLock, { forward: !Constants.IS_LINUX })
    this.lyricWin?.setVisibleOnAllWorkspaces(applyLock)

    this.startLockMouseWatcher()
  }

  startLockMouseWatcher() {
    this.stopLockMouseWatcher()
    this.lockMouseCheckInterval = setInterval(() => {
      if (!this.lyricWin) return
      const bounds = this.lyricWin.getBounds()
      const p = screen.getCursorScreenPoint()
      const inside =
        p.x >= bounds.x &&
        p.x <= bounds.x + bounds.width &&
        p.y >= bounds.y &&
        p.y <= bounds.y + bounds.height
      this.lyricWin.webContents.send('osd-lock-mouse-state', { inside, x: p.x, y: p.y })
    }, 50)
  }

  stopLockMouseWatcher() {
    if (this.lockMouseCheckInterval) {
      clearInterval(this.lockMouseCheckInterval)
      this.lockMouseCheckInterval = null
    }
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

  getOsdBounds() {
    return this.lyricWin?.getBounds() || null
  }

  setOsdBounds(bounds: { x?: number; y?: number; width?: number; height?: number }) {
    if (!this.lyricWin) return
    const current = this.lyricWin.getBounds()
    this.lyricWin.setBounds({
      x: bounds.x !== undefined ? bounds.x : current.x,
      y: bounds.y !== undefined ? bounds.y : current.y,
      width: bounds.width !== undefined ? bounds.width : current.width,
      height: bounds.height !== undefined ? bounds.height : current.height
    })
  }

  updateOSDPlayingState(playing: boolean) {
    this.lyricWin?.webContents.send('update-osd-playing-status', playing)
  }

  sendToOSD(channel: string, data: any) {
    this.lyricWin?.webContents?.send(channel, data)
  }

  switchOSDWindow(showMode: string) {
    this.hideOSDWindow()
    this.showOSDWindow(showMode)
  }

  updateLyricInfo(data: any) {
    this.lyricWin?.webContents.send('updateLyricInfo', data)
  }

  handleOSDWindowEvents() {
    this.lyricWin!.once('ready-to-show', () => {
      this.lyricWin!.showInactive()
    })
    this.lyricWin!.webContents.on('did-finish-load', () => {
      this.toggleMouseIgnore()
      setTimeout(() => {
        this.lyricWin!.setFocusable(false)
        this.lyricWin!.setAlwaysOnTop(true)
      }, 100)
    })

    this.lyricWin!.on('resize', () => {
      const data = this.lyricWin!.getBounds()
      store.set(this.osdMode === 'small' ? 'osdWin.width' : 'osdWin.width2', data.width)
      store.set(this.osdMode === 'small' ? 'osdWin.height' : 'osdWin.height2', data.height)
    })

    let moveTimeout: ReturnType<typeof setTimeout>
    this.lyricWin!.on('move', () => {
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
      this.stopLockMouseWatcher()
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

  initOSDWindow() {
    const osd = store.get('osdWin.show') || false
    const showMode = (store.get('osdWin.type') as string) || 'small'
    if (osd) {
      this.showOSDWindow(showMode)
    }
  }

  handleProtocol() {
    protocol.handle('vutron', async (request) => {
      const { host } = new URL(request.url)

      // 安全边界：vutron:// 只服务于应用自身页面。
      // <img>/<video> 默认不带 Origin；带 crossOrigin 的媒体与跨源 fetch 一定带 Origin。
      const requestOrigin = request.headers.get('Origin')
      if (requestOrigin && requestOrigin !== Constants.APP_ORIGIN) {
        log.warn(`[security] 已拒绝来自 ${requestOrigin} 的 vutron:// 请求: ${host}`)
        return new Response('Forbidden', { status: 403 })
      }

      // <audio crossOrigin="anonymous"> 以 CORS 模式请求 vutron://，预检必须先放行，
      // 否则 Chromium 直接拒绝加载音频（Cross origin requests are only supported ...）。
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: buildVutronCorsHeaders(requestOrigin) })
      }

      return withVutronCors(await routeVutronRequest(request), requestOrigin)
    })
  }

  handleAppEvents() {
    this.handleProtocol()
    app.whenReady().then(async () => {
      // 安全边界必须在任何 IPC 通道注册、任何窗口创建之前安装
      installIpcGuard()

      this.createMainWindow().then(() => {
        // @ts-ignore
        this.fastifyApp.win = this.win
      })

      // window events
      this.handleWindowEvents()
      this.handleAmuseServer()

      initAutoUpdater(this.win!)
      this.tray = createTray(this.win!)
      if (Constants.IS_LINUX) {
        const { createMpris } = await import('./mpris')
        this.mpris = await createMpris(this.win!)
      }

      if (store.get('settings.enableGlobalShortcut') || false) {
        registerGlobalShortcuts(this.win!)
      }

      const lrc = {
        toggleOSDWindow: () => this.toggleOSDWindow(),
        toggleMouseIgnore: (overrideLock?: boolean) => this.toggleMouseIgnore(overrideLock),
        updateLyricInfo: (data: any) => this.updateLyricInfo(data),
        switchOSDWindow: (showMode: string) => this.switchOSDWindow(showMode),
        updateOSDPlayingState: (state: boolean) => this.updateOSDPlayingState(state),
        getOsdBounds: () => this.getOsdBounds(),
        setOsdBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) =>
          this.setOsdBounds(bounds),
        sendToOSD: (channel: string, data: any) => this.sendToOSD(channel, data)
      }

      if (Constants.IS_MAC) {
        this.touchBar = createTouchBar(this.win!)
      }
      IPCs.initialize(this.win!, this.tray, this.touchBar, this.mpris, lrc)

      const proxy = (store.get('settings.proxy') || { type: 0, address: '', port: '' }) as {
        type: 0 | 1 | 2
        address: string
        port: string
      }

      if (proxy.type === 0) {
        this.win!.webContents.session.setProxy({})
      } else {
        const map = { 1: 'http', 2: 'https' }
        const proxyRules = `${map[proxy.type]}://${proxy.address}:${proxy.port}`
        this.win!.webContents.session.setProxy({ proxyRules })
      }

      createMenu(this.win!)
      if (Constants.IS_MAC) {
        const createDockMenu = (await import('./dock')).createDockMenu
        createDockMenu(this.win!)
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
        createThumBar(this.win!)
      }
    })

    app.on('window-all-closed', () => {
      if (!Constants.IS_MAC) app.quit()
    })

    app.on('before-quit', () => {
      this.willQuitApp = true
      this.tray?.destroyTray()
      this.touchBar?.destroy()
    })

    app.on('quit', () => {
      globalShortcut.unregisterAll()
      this.fastifyApp?.close()
      this.amuseFastifyApp?.close()
    })

    powerMonitor.on('resume', () => {
      this.win!.webContents.send('resume')
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
    this.win!.once('ready-to-show', async () => {
      this.win!.show()
      this.win!.focus()
      if (Constants.IS_WINDOWS) {
        const createThumBar = (await import('./thumBar')).createThumBar
        createThumBar(this.win!)
      }
    })

    this.win!.on('close', (e) => {
      if (Constants.IS_MAC) {
        if (this.willQuitApp) {
          this.win = null
          app.quit()
        } else {
          e.preventDefault()
          this.win!.hide()
        }
      } else {
        closeOnLinux(e, this.win!)
      }
    })

    this.win!.on('maximize', () => {
      this.win!.webContents.send('isMaximized', true)
    })

    this.win!.on('unmaximize', () => {
      this.win!.webContents.send('isMaximized', false)
    })

    this.win!.on('resize', () => {
      store.set('window', this.win!.getBounds())
    })

    let moveTimeout: ReturnType<typeof setTimeout>
    this.win!.on('move', () => {
      if (moveTimeout) {
        clearTimeout(moveTimeout)
      }
      moveTimeout = setTimeout(() => {
        if (!this.win) return
        store.set('window', this.win.getBounds())
      }, 500)
    })
  }

  handleAmuseServer() {
    const storeCallback = (x: (typeof store)['store']) => {
      if (x.settings.enableAmuseServer) {
        if (this.amuseFastifyApp) return
        this.createAmuseFastifyAppPromise.then(async () => {
          try {
            // @ts-ignore
            this.amuseFastifyApp = await startAmuseFastifyInstance(this.win!)
          } catch (e) {
            console.error('Failed to start Amuse Fastify App:', e)
            this.win!.webContents.send('updateAmuseServerStatus', false, `${e}`)
          }
          this.win!.webContents.send('updateAmuseServerStatus', true, null)
        })
      } else {
        this.createAmuseFastifyAppPromise
          .then(() => {
            this.amuseFastifyApp?.close()
            this.amuseFastifyApp = null
          })
          .then(() => this.win!.webContents.send('updateAmuseServerStatus', false, null))
      }
    }
    // @ts-ignore
    store.onDidAnyChange(storeCallback)
    storeCallback(store.store)
  }
}

const MAIN_PROCESS_INITIALIZED_KEY = '__VUTRON_MAIN_INITIALIZED__'
// @ts-ignore
if (!global[MAIN_PROCESS_INITIALIZED_KEY]) {
  // @ts-ignore
  global[MAIN_PROCESS_INITIALIZED_KEY] = true

  const bgProcess = new BackGround()
  bgProcess.init()
}
