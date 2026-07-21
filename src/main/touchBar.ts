import { BrowserWindow, nativeImage, TouchBar } from 'electron'
import Constants from './utils/Constants'
import type { NativeTouchBarAddon } from '../types/native-touchbar'
import type { settingMap, statusMap, initMap, lyricLine } from '@/types/music'
import store from './store'
import path from 'path'
import fs from 'fs'

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
    try {
      if (fs.existsSync(p)) {
        nativeAddon = require(p) as NativeTouchBarAddon
        return nativeAddon
      }
    } catch (err) {
      console.error('[TouchBar] ❌ require 失败:', err)
    }
  }
  return null
}

export interface YPMTouchBar {
  updateInfo(data: Partial<statusMap>): void
  initTrayState(data: initMap): void
  updateSetting(data: Partial<settingMap>): void
  destroy(): void
}

class TouchBarImpl implements YPMTouchBar {
  private _win: BrowserWindow
  private _nativeItem: ReturnType<NativeTouchBarAddon['createTouchBarItem']> | null = null
  private _installCalled = false
  private _lastLyric: lyricLine | null = null

  // Electron 回退路径
  private _touchBar: InstanceType<typeof TouchBar> | null = null
  private _playBtn!: InstanceType<typeof TouchBar.TouchBarButton>
  private _prevBtn!: InstanceType<typeof TouchBar.TouchBarButton>
  private _nextBtn!: InstanceType<typeof TouchBar.TouchBarButton>
  private _likeBtn!: InstanceType<typeof TouchBar.TouchBarButton>
  private _lyricBtn!: InstanceType<typeof TouchBar.TouchBarButton>
  private _fmBtn!: InstanceType<typeof TouchBar.TouchBarButton>

  constructor(win: BrowserWindow) {
    this._win = win

    // macOS → 尝试原生插件
    if (Constants.IS_MAC) {
      const addon = loadNativeTouchBarAddon()
      if (addon) {
        this._nativeItem = addon.createTouchBarItem({})

        // 延迟安装（窗口 show 后执行）
        const tryInstall = () => {
          if (this._installCalled) return
          if (!win.isVisible()) return
          const handle = win.getNativeWindowHandle()
          this._nativeItem!.install(handle)
          this._installCalled = true
        }
        win.once('show', tryInstall)

        // 按钮点击
        this._nativeItem.onButtonClick((index: number) => {
          const isPersonalFM = store.get('settings.isPersonalFM') as boolean
          const channels = isPersonalFM
            ? ['fm-trash', 'play', 'next', 'like']
            : ['previous', 'play', 'next', 'like']
          const channel = channels[index]
          if (channel) {
            win.webContents.send(channel)
          }
        })
        return // 原生模式成功
      }
    }

    // ================ Electron TouchBar 回退 ================
    const { TouchBarButton, TouchBarSpacer } = TouchBar
    this._playBtn = new TouchBarButton({
      icon: createNativeImage('play.png'),
      click: () => win.webContents.send('play')
    })
    this._fmBtn = new TouchBarButton({
      icon: createNativeImage('thumbs_down.png'),
      click: () => win.webContents.send('fm-trash')
    })
    this._prevBtn = new TouchBarButton({
      icon: createNativeImage('backward.png'),
      click: () => win.webContents.send('previous')
    })
    this._nextBtn = new TouchBarButton({
      icon: createNativeImage('forward.png'),
      click: () => win.webContents.send('next')
    })
    this._likeBtn = new TouchBarButton({
      icon: createNativeImage('like.png'),
      click: () => win.webContents.send('like')
    })
    this._lyricBtn = new TouchBarButton({ icon: nativeImage.createEmpty() })

    const touchBar = new TouchBar({
      items: [
        this._prevBtn,
        this._playBtn,
        this._nextBtn,
        this._likeBtn,
        new TouchBarSpacer({ size: 'flexible' }),
        this._lyricBtn
      ]
    })
    this._touchBar = touchBar
    win.setTouchBar(touchBar)
  }

  // ================ 对外接口 ================

  initTrayState(data: initMap): void {
    if (this._nativeItem) {
      this.updateLyricNative(data.lyric, data.seek)
      this._nativeItem.setPlaying(!!data.playing, data.seek || 0)
      this._nativeItem.setPlaybackRate(data.rate)
      this._nativeItem.setLikeState(!!data.like)
      this._nativeItem.setFMMode(!!data.isFM)

      // 尝试安装 TouchBar
      if (!this._installCalled && this._win.isVisible()) {
        const handle = this._win.getNativeWindowHandle()
        this._nativeItem.install(handle)
        this._installCalled = true
      }
    } else if (this._touchBar) {
      this.updateTouchBarElectron({
        playing: !!data.playing,
        like: !!data.like,
        isFM: !!data.isFM
      })
    }
  }

  updateInfo(data: Partial<statusMap>): void {
    if (this._nativeItem) {
      if (data.playing !== undefined) {
        this._nativeItem.setPlaying(data.playing, typeof data.seek === 'number' ? data.seek : 0)
      }
      if (data.like !== undefined) {
        this._nativeItem.setLikeState(data.like)
      }
      if (data.isFM !== undefined) {
        this._nativeItem.setFMMode(data.isFM)
      }
      if (data.lyric !== undefined) {
        this.updateLyricNative(data.lyric, data.seek)
      }
      if (data.line !== undefined) {
        // line: [lineIndex, seekTime]
        this.updateSeek(data.line[1])
      }
      if (data.setSeek !== undefined) {
        this.updateSeek(data.setSeek)
      }
      if (data.tWByW !== undefined) {
        this._nativeItem.setWordByWord(data.tWByW)
      }
      if (data.rate !== undefined) {
        this._nativeItem.setPlaybackRate(data.rate)
      }
    } else if (this._touchBar) {
      this.updateTouchBarElectron(data)
    }
  }

  updateSetting(data: Partial<settingMap>): void {
    if (!this._nativeItem) return
    if (data.isWordByWord !== undefined) {
      this._nativeItem.setWordByWord(data.isWordByWord)
    }
    if (data.playedColor !== undefined) {
      this._nativeItem.setPlayedColor(data.playedColor)
    }
    if (data.playedColorLight !== undefined) {
      this._nativeItem.setPlayedColorLight(data.playedColorLight)
    }
  }

  destroy(): void {
    if (this._nativeItem) {
      this._nativeItem.destroy()
      this._nativeItem = null
    }
    if (this._touchBar) {
      this._win.setTouchBar(null)
      this._touchBar = null
    }
  }

  // ================ 内部方法 ================

  private updateLyricNative(_data: lyricLine, seekOverride?: number): void {
    if (!this._nativeItem) return
    this._lastLyric = _data
    let offset = 0
    if (seekOverride !== undefined) {
      offset = Math.max(0, seekOverride * 1000 - _data.start * 1000 + 50)
    }
    this._nativeItem.setLyric(
      _data.lyric?.text || '',
      _data.lyric?.info || [],
      _data.start * 1000,
      _data.end * 1000,
      !!_data.lyric?.info?.length,
      0,
      offset
    )
  }

  private updateSeek(seek: number): void {
    if (!this._nativeItem || !this._lastLyric) return
    const offset = Math.max(0, seek * 1000 - this._lastLyric.start * 1000 + 50)
    this._nativeItem.setLyric(
      this._lastLyric.lyric?.text || '',
      this._lastLyric.lyric?.info || [],
      this._lastLyric.start * 1000,
      this._lastLyric.end * 1000,
      !!this._lastLyric.lyric?.info?.length,
      0,
      offset
    )
  }

  private updateTouchBarElectron(data: Partial<statusMap>): void {
    let changed = false
    if ('playing' in data) {
      this._playBtn.icon = data.playing
        ? createNativeImage('pause.png')
        : createNativeImage('play.png')
      changed = true
    }
    if ('like' in data) {
      this._likeBtn.icon = data.like
        ? createNativeImage('like_fill.png')
        : createNativeImage('like.png')
      changed = true
    }
    if ('isFM' in data && this._touchBar) {
      // FM 模式切换第一个按钮
      const items = [...(this._touchBar as any).items]
      items[0] = data.isFM ? this._fmBtn : this._prevBtn
      const touchBar = new TouchBar({ items })
      this._touchBar = touchBar
      this._win.setTouchBar(touchBar)
      changed = false // already rebuilt
    }
    if (changed && this._touchBar) {
      this._win.setTouchBar(this._touchBar)
    }
  }
}

export const createTouchBar = (win: BrowserWindow): YPMTouchBar => {
  return new TouchBarImpl(win)
}
