import {
  Tray,
  BrowserWindow,
  nativeImage,
  Menu,
  MenuItemConstructorOptions,
  nativeTheme,
  app
} from 'electron'
import Constants from './utils/Constants'
import type { NativeTrayItem, NativeTrayAddon } from '../types/native-tray'
import store from './store'
import path from 'path'
import fs from 'fs'
import { initMap, lyricLine, osdMap, settingMap, statusMap } from '@/types/music'

let playState = false
let repeatMode = 'off'
let shuffleMode = false
let isOSDLock = (store.get('osdWin.isLock') as boolean) || false
let _isFmMode = false

const themeList = [
  { id: 0, fileName: 'vutronmusic-icon' },
  { id: 1, fileName: 'vutronmusic-white' },
  { id: 2, fileName: 'vutronmusic-black' }
]

const createNativeImage = (filename: string) => {
  const isDarkMode = nativeTheme.shouldUseDarkColors
  const name = isDarkMode ? `${filename}_white.png` : `${filename}_black.png`
  return nativeImage.createFromPath(
    Constants.IS_DEV_ENV
      ? path.join(process.cwd(), `./src/public/images/tray/${name}`)
      : path.join(__dirname, `../images/tray/${name}`)
  )
}

const getIconPath = () => {
  const themeId = (store.get('settings.trayColor') as number) || 0
  const theme =
    themeId === 3
      ? nativeTheme.shouldUseDarkColors
        ? themeList[1]
        : themeList[2]
      : themeList.find((t) => t.id === themeId) || themeList[0]
  return nativeImage.createFromPath(
    Constants.IS_DEV_ENV
      ? path.join(process.cwd(), `./src/public/images/tray/${theme.fileName}.png`)
      : path.join(__dirname, `../images/tray/${theme.fileName}.png`)
  )
}

const createMenuTemplate = (win: BrowserWindow) => {
  const lang = store.get('settings.lang') as string
  // 定义多语言文本映射
  const i18n = {
    showMainPanel: { zh: '显示主面板', zht: '顯示主面板', en: 'Show Main Panel' },
    openOSD: { zh: '开启歌词', zht: '開啟歌詞', en: 'Open Lyric' },
    closeOSD: { zh: '关闭歌词', zht: '關閉歌詞', en: 'Close Lyric' },
    lockOSD: { zh: '锁定歌词', zht: '鎖定歌詞', en: 'Lock Lyric' },
    unlockOSD: { zh: '解锁歌词', zht: '解鎖歌詞', en: 'Unlock Lyric' },
    play: { zh: '播放', zht: '播放', en: 'Play' },
    pause: { zh: '暂停', zht: '暫停', en: 'Pause' },
    prev: { zh: '上一首', zht: '上一首', en: 'Prev' },
    next: { zh: '下一首', zht: '下一首', en: 'Next' },
    repeatMenu: { zh: '循环播放', zht: '循環播放', en: 'Repeat Mode' },
    repeatOff: { zh: '关闭循环', zht: '關閉循環', en: 'Repeat Off' },
    repeatOn: { zh: '列表循环', zht: '列表循環', en: 'Repeat On' },
    repeatOne: { zh: '单曲循环', zht: '單曲循環', en: 'Repeat One' },
    shuffle: { zh: '随机播放', zht: '隨機播放', en: 'Shuffle' },
    like: { zh: '加入喜欢', zht: '加入喜歡', en: 'Like' },
    unlike: { zh: '取消喜欢', zht: '取消喜歡', en: 'Dislike' },
    quit: { zh: '退出', zht: '退出', en: 'Quit' }
  }

  // 获取对应语言的文本
  const t = (key: keyof typeof i18n) =>
    i18n[key][lang === 'zh' ? 'zh' : lang === 'zht' ? 'zht' : 'en']

  const template: MenuItemConstructorOptions[] = Constants.IS_LINUX
    ? [
        {
          label: t('showMainPanel'),
          click: () => win.show()
        },
        { type: 'separator' }
      ]
    : []

  return template.concat([
    {
      label: t('play'),
      icon: createNativeImage('play'),
      click: () => win.webContents.send('play'),
      id: 'play',
      visible: !playState
    },
    {
      label: t('pause'),
      icon: createNativeImage('pause'),
      click: () => win.webContents.send('play'),
      id: 'pause',
      visible: playState
    },
    {
      label: t('prev'),
      icon: createNativeImage('left'),
      click: () => win.webContents.send('previous')
    },
    {
      label: t('next'),
      icon: createNativeImage('right'),
      click: () => win.webContents.send('next')
    },
    {
      label: t('repeatMenu'),
      icon: createNativeImage('repeat'),
      submenu: [
        {
          label: t('repeatOff'),
          click: () => win.webContents.send('repeat', 'off'),
          id: 'off',
          checked: repeatMode === 'off',
          type: 'radio'
        },
        {
          label: t('repeatOn'),
          click: () => win.webContents.send('repeat', 'on'),
          id: 'on',
          checked: repeatMode === 'on',
          type: 'radio'
        },
        {
          label: t('repeatOne'),
          click: () => win.webContents.send('repeat', 'one'),
          id: 'one',
          checked: repeatMode === 'one',
          type: 'radio'
        },
        {
          label: t('shuffle'),
          click: (item) => win.webContents.send('repeat-shuffle', item.checked),
          id: 'shuffle',
          checked: shuffleMode,
          type: 'checkbox'
        }
      ]
    },
    {
      label: t('like'),
      icon: createNativeImage('like'),
      click: () => win.webContents.send('like'),
      id: 'like'
    },
    {
      label: t('unlike'),
      icon: createNativeImage('unlike'),
      click: () => win.webContents.send('like'),
      id: 'unlike',
      visible: false
    },
    { type: 'separator' },
    {
      label: t('openOSD'),
      icon: createNativeImage('lrc'),
      click: () => win.webContents.send('updateOSDSetting', { show: true }),
      id: 'openOSD',
      visible: store.get('osdWin.show') === false
    },
    {
      label: t('closeOSD'),
      icon: createNativeImage('lrc'),
      click: () => win.webContents.send('updateOSDSetting', { show: false }),
      id: 'closeOSD',
      visible: store.get('osdWin.show')
    },
    {
      label: t('lockOSD'),
      icon: createNativeImage('lock'),
      click: () => win.webContents.send('updateOSDSetting', { lock: true }),
      id: 'lockOSD',
      visible: !isOSDLock
    },
    {
      label: t('unlockOSD'),
      icon: createNativeImage('unlock'),
      click: () => win.webContents.send('updateOSDSetting', { lock: false }),
      id: 'unlockOSD',
      visible: isOSDLock
    },
    { type: 'separator' },
    {
      label: t('quit'),
      icon: createNativeImage('quit'),
      click: () => app.quit()
    }
  ])
}

export interface LyricData {
  text: string
  words: Array<{ word: string; start: number; end: number }>
  lineStart: number
  lineEnd: number
  hasWordTiming: boolean
  lyricWidth?: number
  offset?: number
  /** 翻译/注音歌词 — 预留字段，原生层暂不渲染 */
  translationText?: string
  translationWords?: Array<{ word: string; start: number; end: number }>
}

export interface YPMTray {
  setVisibility: (opts: {
    lyric?: boolean
    buttons?: boolean
    icon?: boolean
    width?: number
  }) => void

  destroyTray: () => void
  updateSetting: (data: Partial<settingMap>) => void
  updateInfo: (data: Partial<statusMap>) => void
  initTrayState: (data: initMap) => void
  updateOsdStatus: (data: Partial<osdMap>) => void
}

// ================ 原生插件加载 ================
let nativeAddon: NativeTrayAddon | null = null

function loadNativeAddon(): NativeTrayAddon | null {
  if (!Constants.IS_MAC) return null
  if (nativeAddon) return nativeAddon

  const paths = [
    path.join(__dirname, '../../src/native/tray/build/Release/tray_addon.node'),
    path.join(process.cwd(), 'src/native/tray/build/Release/tray_addon.node'),
    path.join(__dirname, `../../dist-native/vutron_tray_addon_darwin_${process.arch}.node`),
    path.join(process.cwd(), `dist-native/vutron_tray_addon_darwin_${process.arch}.node`)
  ]

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        nativeAddon = require(p)
        return nativeAddon
      }
    } catch {
      // continue
    }
  }
  console.warn('[Tray] 原生插件加载失败，回退到 Electron Tray')
  return null
}

class TrayImpl implements YPMTray {
  private _win: BrowserWindow
  private _tray: Tray | null = null
  private _contextMenu: Menu | null = null
  private _nativeItem: NativeTrayItem | null = null

  constructor(win: BrowserWindow) {
    this._win = win
    this._tray = null
    this._contextMenu = null
    this._nativeItem = null

    this.createTray()
    this.setContextMenu()

    this.updateTooltip(app.name)

    nativeTheme.on('updated', () => {
      this.updateTrayColor()
      this.setContextMenu()
    })
  }

  createTray() {
    // macOS → 尝试原生插件
    if (Constants.IS_MAC) {
      const addon = loadNativeAddon()
      if (addon) {
        this._nativeItem = addon.createTrayItem({})
        this._nativeItem.onButtonClick((index: number) => {
          const channels = _isFmMode
            ? ['fm-trash', 'play', 'next', 'like']
            : ['previous', 'play', 'next', 'like']
          const channel = channels[index]
          if (channel) {
            this._win.webContents.send(channel)
          }
        })
        this._nativeItem.onRightClick(() => {
          const enableMenu = (store.get('settings.enableTrayMenu') as boolean) ?? true
          if (!enableMenu) return
          const template = createMenuTemplate(this._win)
          // 将模板序列化为原生 NSMenu 可用的格式（全局 ID 避免层级冲突）
          let nextId = 0
          const clickHandlers = new Map<number, () => void>()
          const serialize = (items: MenuItemConstructorOptions[]): any[] => {
            const result: any[] = []
            for (const item of items) {
              if (item.visible === false) continue
              const id = nextId++
              if ('click' in item && typeof item.click === 'function') {
                clickHandlers.set(id, () => (item.click as Function)(item as any, this._win))
              }
              const entry: any = {
                id,
                label: item.label || '',
                type: item.type || 'normal',
                enabled: item.enabled !== false
              }
              if (item.checked !== undefined) entry.checked = item.checked
              if (item.submenu) {
                entry.submenu = serialize(item.submenu as any)
              }
              result.push(entry)
            }
            return result
          }
          const nativeItems = serialize(template)
          this._nativeItem?.popupNativeMenu(nativeItems, (clickedId: number) => {
            const handler = clickHandlers.get(clickedId)
            if (handler) handler()
          })
        })
        this._nativeItem.onTrayClick(() => {
          this._win.show()
        })
        // 图标由渲染进程 onMounted 后通过 initTrayState 设置

        // 从 electron-store 读取持久化的可见性设置
        const showLyric = (store.get('settings.showLyric') as boolean) ?? true
        const showControl = (store.get('settings.showControl') as boolean) ?? true
        const showIcon = (store.get('settings.showIcon') as boolean) ?? true
        if (!showLyric || !showControl || !showIcon) {
          this._nativeItem.setVisibility({ lyric: showLyric, buttons: showControl, icon: showIcon })
        }
        return
      }
      // 回退：空 Tray
      const tray = new Tray(nativeImage.createEmpty())
      this._tray = tray
    } else {
      const image = getIconPath().resize({ height: 20, width: 20 })
      this._tray = new Tray(image)
    }
    this._tray?.on('click', (event, bounds, position) => {
      if (Constants.IS_MAC) {
        this._win.webContents.send('handleTrayClick', { event, bounds, position })
      } else {
        this._win.show()
      }
    })
  }

  destroyTray() {
    if (this._nativeItem) {
      this._nativeItem.destroy()
      this._nativeItem = null
    }
    if (this._tray) {
      this._tray?.destroy()
      this._tray = null
    }
  }

  updateInfo(data: Partial<statusMap>) {
    if (data.lyric !== undefined) {
      this.updateLyric(data.lyric)
    }

    if (data.like !== undefined) {
      this.setLikeState(data.like)
    }

    if (data.playing !== undefined) {
      this.setPlayState(data.playing)
      playState = data.playing
    }

    if (data.seek !== undefined) {
      this.setProgress(data.seek)
    }

    if (data.line !== undefined) {
      // line 格式: [lineIndex, seekTime] — OSD 通过此字段持续更新进度
      this.setProgress(data.line[1])
    }

    if (data.setSeek !== undefined) {
      this.setProgress(data.setSeek)
    }

    if (data.isFM !== undefined) {
      _isFmMode = data.isFM
      this.setFMMode(data.isFM)
    }

    if (data.tWByW !== undefined) {
      this.setWordByWord(data.tWByW)
    }

    if (data.tooltip !== undefined) {
      this.updateTooltip(data.tooltip)
    }

    if (data.repeatMode !== undefined) {
      this.setRepeatMode(data.repeatMode)
    }

    if (data.shuffle !== undefined) {
      this.setShuffleMode(data.shuffle)
    }
  }

  initTrayState(data: initMap) {
    this.updateLyric(data.lyric)
    this.setPlayState(!!data.playing)
    if (data.seek) this.setProgress(data.seek)
    this.setPlaybackRate(data.rate)
    this.setLikeState(!!data.like)
    this.setFMMode(!!data.isFM)
    this.updateTrayColor()
  }

  updateLyric(_data: lyricLine) {
    if (!this._nativeItem) return
    const data = {
      text: _data.lyric?.text || '',
      words: _data.lyric?.info || [],
      lineStart: _data.start * 1000,
      lineEnd: _data.end * 1000,
      hasWordTiming: !!_data.lyric?.info?.length,
      lyricWidth: 0,
      offset: 0
    }

    this._nativeItem.setLyric(
      data.text,
      data.words,
      data.lineStart,
      data.lineEnd,
      data.hasWordTiming,
      data.lyricWidth || 0,
      data.offset || 0
    )
  }

  updateOsdStatus(data: Partial<osdMap>) {
    if (data.show !== undefined) {
      this.setShowOSD(data.show)
    }
    if (data.isLock !== undefined) {
      this.setOSDLock(data.isLock)
    }
  }

  private updateTrayColor() {
    const icon = getIconPath()
    if (this._nativeItem) {
      this._nativeItem.setIconImage(icon.toPNG())
      return
    }
    if (!this._tray || Constants.IS_MAC) return
    this._tray?.setImage(icon.resize({ height: 20, width: 20 }))
  }

  private setContextMenu() {
    if (this._nativeItem) return // 原生模式右键由插件触发
    const setMenu = Constants.IS_MAC ? (store.get('settings.enableTrayMenu') as boolean) : true
    if (setMenu) {
      const template = createMenuTemplate(this._win)
      this._contextMenu = Menu.buildFromTemplate(template)
      this._tray?.setContextMenu(this._contextMenu)
    } else {
      this._contextMenu = null
      this._tray?.setContextMenu(null)
    }
  }

  private setShowOSD(show: boolean) {
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('openOSD')!.visible = !show
    this._contextMenu.getMenuItemById('closeOSD')!.visible = show
    this._tray?.setContextMenu(this._contextMenu)
  }

  private setOSDLock(lock: boolean) {
    isOSDLock = lock
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('lockOSD')!.visible = !lock
    this._contextMenu.getMenuItemById('unlockOSD')!.visible = lock
    this._tray?.setContextMenu(this._contextMenu)
  }

  private setPlayState(isPlaying: boolean) {
    playState = isPlaying || false
    if (this._nativeItem) this._nativeItem.setPlaying(isPlaying)
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('play')!.visible = !isPlaying
    this._contextMenu.getMenuItemById('pause')!.visible = isPlaying
    this._tray?.setContextMenu(this._contextMenu)
  }

  private setProgress(seek: number) {
    if (this._nativeItem) this._nativeItem.setProgress(seek)
  }

  private setPlaybackRate(rate: number) {
    if (this._nativeItem) this._nativeItem.setPlaybackRate(rate)
  }

  private setLikeState(isLiked: boolean) {
    if (this._nativeItem) this._nativeItem.setLikeState(isLiked)
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('like')!.visible = !isLiked
    this._contextMenu.getMenuItemById('unlike')!.visible = isLiked
    this._tray?.setContextMenu(this._contextMenu)
  }

  setVisibility(opts: { lyric?: boolean; buttons?: boolean; icon?: boolean; width?: number }) {
    if (!this._nativeItem) return
    if (opts.width !== undefined) this._nativeItem.setWidth(opts.width)

    const nativeOpts: { lyric?: boolean; buttons?: boolean; icon?: boolean } = {}
    if (opts.lyric !== undefined) nativeOpts.lyric = opts.lyric
    if (opts.buttons !== undefined) nativeOpts.buttons = opts.buttons
    if (opts.icon !== undefined) nativeOpts.icon = opts.icon

    this._nativeItem.setVisibility(nativeOpts)
    setTimeout(this.setContextMenu)
  }

  private setFMMode(isFM: boolean) {
    _isFmMode = isFM
    if (this._nativeItem) this._nativeItem.setButtonType(0, isFM ? 4 : 0)
  }

  private setRepeatMode(mode: 'on' | 'one' | 'off') {
    repeatMode = mode
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById(repeatMode)!.checked = true
    this._tray?.setContextMenu(this._contextMenu)
  }

  private setShuffleMode(isShuffle: boolean) {
    shuffleMode = isShuffle
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('shuffle')!.checked = isShuffle
    this._tray?.setContextMenu(this._contextMenu)
  }

  private updateTooltip(title: string) {
    if (!Constants.IS_MAC) this._tray?.setToolTip(title)
  }

  private setWordByWord(wBYw: boolean) {
    if (this._nativeItem) this._nativeItem.setWordByWord(wBYw)
  }

  private setPlayedColor(hex: string) {
    if (this._nativeItem) this._nativeItem.setPlayedColor(hex)
  }

  private setPlayedColorLight(hex: string) {
    if (this._nativeItem) this._nativeItem.setPlayedColorLight(hex)
  }

  updateSetting(data: Partial<settingMap>) {
    if (data.enableTrayMenu !== undefined) {
      this.setContextMenu()
    }

    if (data.lang !== undefined) {
      this.setContextMenu()
    }

    if (data.trayColor !== undefined) {
      this.updateTrayColor()
    }

    if (data.showIcon !== undefined) {
      this.setVisibility({ icon: data.showIcon })
    }

    if (data.isWordByWord) {
      this.setWordByWord(data.isWordByWord)
    }

    if (data.playedColor !== undefined) {
      this.setPlayedColor(data.playedColor)
    }

    if (data.playedColorLight !== undefined) {
      this.setPlayedColorLight(data.playedColorLight)
    }
  }
}

export const createTray = (win: BrowserWindow): YPMTray => {
  return new TrayImpl(win)
}
