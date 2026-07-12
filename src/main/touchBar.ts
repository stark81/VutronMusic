import { BrowserWindow, nativeImage, TouchBar, ipcMain } from 'electron'
import Constants from './utils/Constants'
import type { NativeTouchBarAddon } from '../types/native-touchbar' // NativeTouchBarItem
import store from './store'
import path from 'path'
import fs from 'fs'

interface LyricWord {
  word: string
  start: number
  end: number
}

interface LyricDataParams {
  text: string
  words: LyricWord[]
  lineStart: number
  lineEnd: number
  hasWordTiming: boolean
  lyricWidth?: number
  offset?: number
}

interface InitTouchBarState {
  lyric: LyricDataParams
  playing: boolean
  rate: number
  like: boolean
  isFM: boolean
}

const { TouchBarButton, TouchBarSpacer } = TouchBar

const createNativeImage = (name: string) => {
  return nativeImage.createFromPath(
    Constants.IS_DEV_ENV
      ? path.join(process.cwd(), `./src/public/images/touchBar/${name}`)
      : path.join(__dirname, `../images/touchbar/${name}`)
  )
}

// ================ 原生插件加载 ================
let nativeAddon: NativeTouchBarAddon | null = null

function loadNativeTouchBarAddon(): NativeTouchBarAddon | null {
  if (!Constants.IS_MAC) return null
  if (nativeAddon) return nativeAddon

  const paths = [
    path.join(__dirname, '../../src/native/touchbar/build/Release/touchbar_addon.node'),
    path.join(process.cwd(), 'src/native/touchbar/build/Release/touchbar_addon.node'),
    path.join(__dirname, `../../dist-native/vutron_touchbar_addon_darwin_${process.arch}.node`),
    path.join(process.cwd(), `dist-native/vutron_touchbar_addon_darwin_${process.arch}.node`)
  ]

  for (const p of paths) {
    console.log('[TouchBar] 尝试加载:', p)
    try {
      if (fs.existsSync(p)) {
        console.log('[TouchBar] 文件存在，开始 require')
        nativeAddon = require(p) as NativeTouchBarAddon
        console.log('[TouchBar] ✅ 加载成功')
        return nativeAddon
      }
    } catch (err) {
      console.error('[TouchBar] ❌ require 失败:', err)
    }
  }
  console.warn('[TouchBar] 所有路径均无法加载，回退到 Electron TouchBar')
  return null
}

export const createTouchBar = (win: BrowserWindow) => {
  console.log('[TouchBar] createTouchBar 被调用了')
  // macOS → 尝试原生插件
  if (Constants.IS_MAC) {
    const addon = loadNativeTouchBarAddon()
    if (addon) {
      const nativeItem = addon.createTouchBarItem({})
      console.log('[TouchBar] nativeItem 创建成功')

      // ── install() 时序安全封装 ──
      // TouchBar 原生插件必须通过 install(handle) 安装到窗口才能显示。
      // 如果在窗口 show 之前调用 install()，[view window] 或 [NSApp keyWindow]
      // 可能返回 nil，导致安装静默失败。这里延迟到窗口可见后才执行 install。
      let installCalled = false
      const tryInstall = () => {
        if (installCalled) return
        if (!win.isVisible()) {
          console.log('[TouchBar] 窗口尚未 show，等待 show 事件')
          return
        }
        const handle = win.getNativeWindowHandle()
        console.log('[TouchBar] window handle length:', handle.length)
        nativeItem.install(handle)
        installCalled = true
        console.log('[TouchBar] install() 完成')
      }

      // 窗口 show 后立即尝试安装（兜底 initTouchBarState 先到的情况）
      win.once('show', tryInstall)

      // 按钮点击 → Electron webContents.send
      nativeItem.onButtonClick((index: number) => {
        // 0: prev/FM-trash, 1: play/pause, 2: next, 3: like
        const isPersonalFM = store.get('settings.isPersonalFM') as boolean
        const channels = isPersonalFM
          ? ['fm-trash', 'play', 'next', 'like']
          : ['previous', 'play', 'next', 'like']
        const channel = channels[index]
        if (channel) {
          win.webContents.send(channel)
        }
      })

      // IPC: 歌词数据
      ipcMain.on('updateTouchBarLyricData', (_event, data: LyricDataParams) => {
        nativeItem.setLyric(
          data.text,
          data.words,
          data.lineStart,
          data.lineEnd,
          data.hasWordTiming,
          data.lyricWidth ?? 0,
          data.offset ?? 0
        )
      })

      // IPC: 播放状态（复用 updatePlayerState，与 tray 共享）
      ipcMain.on('updatePlayerState', (_event, data: any) => {
        if ('playing' in data) {
          nativeItem.setPlaying(data.playing, typeof data.progress === 'number' ? data.progress : 0)
        }
        if ('rate' in data) {
          nativeItem.setPlaybackRate(data.rate)
        }
        if ('like' in data) {
          nativeItem.setLikeState(!!data.like)
        }
      })

      // IPC: 初始化全量状态
      ipcMain.on('initTouchBarState', (_event, data: InitTouchBarState) => {
        console.log('[TouchBar] initTouchBarState 收到')
        nativeItem.setLyric(
          data.lyric.text,
          data.lyric.words,
          data.lyric.lineStart,
          data.lyric.lineEnd,
          data.lyric.hasWordTiming,
          data.lyric.lyricWidth ?? 0,
          data.lyric.offset ?? 0
        )
        nativeItem.setPlaying(data.playing)
        nativeItem.setPlaybackRate(data.rate)
        nativeItem.setLikeState(!!data.like)
        nativeItem.setFMMode(!!data.isFM)

        // 尝试安装 TouchBar（窗口可能已 show，也可能需要等待 show 事件）
        tryInstall()
      })

      // IPC: FM 模式切换
      ipcMain.on('setTrayFMMode', (_event, isFM: boolean) => {
        nativeItem.setFMMode(isFM)
      })

      // IPC: 设置变化（逐字高亮、颜色等）
      ipcMain.on('setStoreSettings', (_event, data: any) => {
        if ('isWordByWord' in data) {
          nativeItem.setWordByWord(data.isWordByWord)
        }
        if ('playedColor' in data) {
          nativeItem.setPlayedColor(data.playedColor)
        }
        if ('playedColorLight' in data) {
          nativeItem.setPlayedColorLight(data.playedColorLight)
        }
      })

      return // 原生模式成功，跳过 Electron TouchBar
    }
    // 回退：使用 Electron TouchBar
  }

  // ================ Electron TouchBar（回退方案） ================
  const playButton = new TouchBarButton({
    icon: createNativeImage('play.png'),
    click: () => {
      win.webContents.send('play')
    }
  })
  const fmTrashButton = new TouchBarButton({
    icon: createNativeImage('thumbs_down.png'),
    click: () => {
      win.webContents.send('fm-trash')
    }
  })
  const previousTrackButton = new TouchBarButton({
    icon: createNativeImage('backward.png'),
    click: () => {
      win.webContents.send('previous')
    }
  })
  const nextTrackButton = new TouchBarButton({
    icon: createNativeImage('forward.png'),
    click: () => {
      win.webContents.send('next')
    }
  })
  const likeButton = new TouchBarButton({
    icon: createNativeImage('like.png'),
    click: () => {
      win.webContents.send('like')
    }
  })

  const showLyric = new TouchBarButton({ icon: nativeImage.createEmpty() })

  const updateLyric = (img: string, width: number, height: number) => {
    const image = nativeImage.createFromDataURL(img).resize({ width, height })
    image.setTemplateImage(true)
    showLyric.icon = image
  }

  ipcMain.on('updateTouchBarLyric', (_event, { img, width, height }) => {
    updateLyric(img, width, height)
  })
  ipcMain.on('updatePlayerState', (_event, data) => {
    if ('playing' in data) {
      playButton.icon = data.playing
        ? createNativeImage('pause.png')
        : createNativeImage('play.png')
    }
    if ('like' in data) {
      likeButton.icon = data.like
        ? createNativeImage('like_fill.png')
        : createNativeImage('like.png')
    }
    if ('isPersonalFM' in data) {
      options.items[0] = data.isPersonalFM ? fmTrashButton : previousTrackButton
    }
    const touchBar = new TouchBar(options)
    if (touchBar) win.setTouchBar(touchBar)
  })

  const options = {
    items: [
      previousTrackButton,
      playButton,
      nextTrackButton,
      likeButton,
      new TouchBarSpacer({ size: 'flexible' }),
      showLyric
    ]
  }

  const touchBar = new TouchBar(options)
  if (touchBar) win.setTouchBar(touchBar)
}
