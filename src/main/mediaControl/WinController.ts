import { BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { MediaController, RawMetadata } from './types'
import { statusMap } from '@/types/music'
import type { NativeSMTCAddon, NativeSMTCSession } from '@/types/native-smtc'

// ================ 原生插件加载 ================
let nativeAddon: NativeSMTCAddon | null = null

function loadNativeAddon(): NativeSMTCAddon | null {
  if (nativeAddon) return nativeAddon

  const paths = [
    path.join(__dirname, '../../src/native/smtc/build/Release/smtc_addon.node'),
    path.join(process.cwd(), 'src/native/smtc/build/Release/smtc_addon.node'),
    path.join(__dirname, '../../dist-native/vutron_smtc_win32_' + process.arch + '.node'),
    path.join(process.cwd(), 'dist-native/vutron_smtc_win32_' + process.arch + '.node')
  ]

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        nativeAddon = require(p) as NativeSMTCAddon
        return nativeAddon
      }
    } catch (err) {
      console.error('[WinController] 加载原生 addon 失败:', err)
    }
  }
  return null
}

export class WinController implements MediaController {
  private _win: BrowserWindow
  private _native: NativeSMTCSession | null = null
  private _lastMeta: RawMetadata | null = null

  constructor(win: BrowserWindow) {
    this._win = win

    const addon = loadNativeAddon()
    if (!addon) {
      console.warn('[WinController] 原生 addon 未找到，Windows SMTC 不可用')
      return
    }

    try {
      this._native = addon.createSMTCSession()
      this._native.onButtonClick((command: string) => {
        switch (command) {
          case 'play':
            win.webContents.send('play')
            break
          case 'pause':
            win.webContents.send('pause')
            break
          case 'next':
            win.webContents.send('next')
            break
          case 'previous':
            win.webContents.send('previous')
            break
        }
      })
    } catch (err) {
      console.error('[WinController] 创建 SMTCSession 失败:', err)
    }
  }

  setMetadata(meta: RawMetadata) {
    this._lastMeta = meta
    if (!this._native) return

    this._native.setMetadata({
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      thumbnail: meta.artwork[0]?.src,
      duration: meta.length
    })
  }

  updateInfo(data: Partial<statusMap>) {
    if (!this._native) return

    const playing = data.playing !== undefined ? data.playing : false
    const position = data.seek !== undefined ? data.seek : 0
    const duration = this._lastMeta?.length || 0
    const rate = data.rate !== undefined ? data.rate : this._lastMeta?.rate || 1

    this._native.setPlaybackState(playing, position, duration, rate)
  }

  destroy() {
    if (this._native) {
      try {
        this._native.clearMetadata()
        this._native.destroy()
      } catch (err) {
        console.error('[WinController] destroy 失败:', err)
      }
      this._native = null
    }
  }
}
