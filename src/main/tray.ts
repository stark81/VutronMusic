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
import store from './store'
import path from 'path'

let playState = false
let repeatMode = 'off'
let shuffleMode = false
let isOSDLock = (store.get('osdWin.isLock') as boolean) || false

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
      click: () => app.exit()
    }
  ])
}

export interface YPMTray {
  createTray: () => void
  updateTray: (img: string, width: number, height: number) => void
  updateTrayColor: () => void
  destroyTray: () => void
  show: () => void
  setContextMenu: (setMenu: boolean) => void
  setPlayState: (isPlaying: boolean) => void
  setLikeState: (isLiked: boolean) => void
  setRepeatMode: (repeat: string) => void
  setShuffleMode: (isShuffle: boolean) => void
  setShowOSD: (show: boolean) => void
  setOSDLock: (lock: boolean) => void
  updateTooltip: (title: string) => void
}

class TrayImpl implements YPMTray {
  private _win: BrowserWindow
  private _tray: Tray | null = null
  private _contextMenu: Menu | null = null

  constructor(win: BrowserWindow) {
    this._win = win
    this._tray = null
    this._contextMenu = null

    this.createTray()
    this.setContextMenu()

    this.updateTooltip(app.name)

    nativeTheme.on('updated', () => {
      this.updateTrayColor()
      this.setContextMenu(true)
    })
  }

  createTray() {
    if (Constants.IS_MAC) {
      const tray = new Tray(nativeImage.createEmpty())
      this._tray = tray
    } else {
      const image = getIconPath().resize({ height: 20, width: 20 })
      this._tray = new Tray(image)
    }
    this._tray.on('click', (event, bounds, position) => {
      if (Constants.IS_MAC) {
        this._win.webContents.send('handleTrayClick', { event, bounds, position })
      } else {
        this._win.show()
      }
    })
  }

  destroyTray() {
    if (this._tray) {
      this._tray.destroy()
      this._tray = null
    }
  }

  updateTray(img: string, width: number, height: number) {
    if (store.get('settings.showTray') === false) return
    if (!this._tray) this.createTray()
    const image = nativeImage.createFromDataURL(img).resize({ height, width })
    image.setTemplateImage(true)
    this._tray.setImage(image)
  }

  updateTrayColor() {
    if (!this._tray || Constants.IS_MAC) return
    const icon = getIconPath()
    this._tray.setImage(icon.resize({ height: 20, width: 20 }))
  }

  show() {
    this._win.show()
  }

  setContextMenu(setMenu: boolean = true) {
    if (setMenu) {
      const template = createMenuTemplate(this._win)
      this._contextMenu = Menu.buildFromTemplate(template)
      this._tray.setContextMenu(this._contextMenu)
    } else {
      this._contextMenu = null
      this._tray.setContextMenu(null)
    }
  }

  setShowOSD(show: boolean) {
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('openOSD').visible = !show
    this._contextMenu.getMenuItemById('closeOSD').visible = show
    this._tray.setContextMenu(this._contextMenu)
  }

  setOSDLock(lock: boolean) {
    isOSDLock = lock
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('lockOSD').visible = !lock
    this._contextMenu.getMenuItemById('unlockOSD').visible = lock
    this._tray.setContextMenu(this._contextMenu)
  }

  setPlayState(isPlaying: boolean) {
    playState = isPlaying || false
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('play').visible = !isPlaying
    this._contextMenu.getMenuItemById('pause').visible = isPlaying
    this._tray.setContextMenu(this._contextMenu)
  }

  setLikeState(isLiked: boolean) {
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('like').visible = !isLiked
    this._contextMenu.getMenuItemById('unlike').visible = isLiked
    this._tray.setContextMenu(this._contextMenu)
  }

  setRepeatMode(mode: 'on' | 'one' | 'off') {
    repeatMode = mode
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById(repeatMode).checked = true
    this._tray.setContextMenu(this._contextMenu)
  }

  setShuffleMode(isShuffle: boolean) {
    shuffleMode = isShuffle
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('shuffle').checked = isShuffle
    this._tray.setContextMenu(this._contextMenu)
  }

  updateTooltip(title: string) {
    if (!Constants.IS_MAC) this._tray.setToolTip(title)
  }
}

export const createTray = (win: BrowserWindow): YPMTray => {
  return new TrayImpl(win)
}
