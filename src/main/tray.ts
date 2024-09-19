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

// const getIcon = () => {}

const createNativeImage = (filename: string) => {
  const isDarkMode = nativeTheme.shouldUseDarkColors
  const name = isDarkMode ? `${filename}_white.png` : `${filename}_black.png`
  return nativeImage.createFromPath(
    Constants.IS_DEV_ENV
      ? path.join(process.cwd(), `./src/public/images/tray/${name}`)
      : path.join(__dirname, `../images/tray/${name}`)
  )
}

const createMenuTemplate = (win: BrowserWindow) => {
  const lang = store.get('settings.lang') as string
  const template: MenuItemConstructorOptions[] = Constants.IS_LINUX
    ? [
        {
          label: lang === 'zh' ? '显示主面板' : 'Show Main Panel',
          click: () => win.show()
        },
        {
          type: 'separator'
        }
      ]
    : []
  return template.concat([
    {
      label: lang === 'zh' ? '播放' : 'Play',
      icon: createNativeImage('play'),
      click: () => {
        win.webContents.send('play')
      },
      id: 'play',
      visible: !playState
    },
    {
      label: lang === 'zh' ? '暂停' : 'Pause',
      icon: createNativeImage('pause'),
      click: () => {
        win.webContents.send('play')
      },
      id: 'pause',
      visible: playState
    },
    {
      label: lang === 'zh' ? '上一首' : 'Prev',
      icon: createNativeImage('left'),
      click: () => {
        win.webContents.send('previous')
      }
    },
    {
      label: lang === 'zh' ? '下一首' : 'Next',
      icon: createNativeImage('right'),
      click: () => {
        win.webContents.send('next')
      }
    },
    {
      label: lang === 'zh' ? '循环播放' : 'Repeat Mode',
      icon: createNativeImage('repeat'),
      submenu: [
        {
          label: lang === 'zh' ? '关闭循环' : 'Repeat Off',
          click: () => win.webContents.send('repeat', 'off'),
          id: 'off',
          checked: repeatMode === 'off',
          type: 'radio'
        },
        {
          label: lang === 'zh' ? '列表循环' : 'Repeat On',
          click: () => win.webContents.send('repeat', 'on'),
          id: 'on',
          checked: repeatMode === 'on',
          type: 'radio'
        },
        {
          label: lang === 'zh' ? '单曲循环' : ' Repeat One',
          click: () => win.webContents.send('repeat', 'one'),
          id: 'one',
          checked: repeatMode === 'one',
          type: 'radio'
        },
        {
          label: lang === 'zh' ? '随机播放' : 'Shuffle',
          click: (item) => win.webContents.send('repeat-shuffle', item.checked),
          id: 'shuffle',
          checked: shuffleMode,
          type: 'checkbox'
        }
      ]
    },
    {
      label: lang === 'zh' ? '加入喜欢' : 'Like',
      icon: createNativeImage('like'),
      click: () => {
        win.webContents.send('like')
      },
      id: 'like'
    },
    {
      label: lang === 'zh' ? '取消喜欢' : 'Dislike',
      icon: createNativeImage('unlike'),
      click: () => {
        win.webContents.send('like')
      },
      id: 'unlike',
      visible: false
    },
    {
      label: lang === 'zh' ? '退出' : 'Quit',
      icon: createNativeImage('quit'),
      click: () => {
        app.exit()
      }
    }
  ])
}

export interface YPMTray {
  createTray: () => void
  updateTray: (img: string, width: number, height: number) => void
  show: () => void
  setContextMenu: (setMenu: boolean) => void
  setPlayState: (isPlaying: boolean) => void
  setLikeState: (isLiked: boolean) => void
  setRepeatMode: (repeat: string) => void
  setShuffleMode: (isShuffle: boolean) => void
}

class TrayImpl implements YPMTray {
  private _win: BrowserWindow
  private _tray: Tray | null = null
  private _contextMenu: Menu | null = null

  constructor(win: BrowserWindow) {
    this._win = win
    this._tray = null
    this._contextMenu = null
  }

  createTray() {
    const tray = new Tray(nativeImage.createEmpty())
    this._tray = tray
    this._tray.on('click', (event, bounds, position) => {
      this._win.webContents.send('handleTrayClick', { event, bounds, position })
    })
  }

  updateTray(img: string, width: number, height: number) {
    if (!this._tray) this.createTray()
    const image = nativeImage.createFromDataURL(img).resize({ height, width })
    image.setTemplateImage(true)
    this._tray.setImage(image)
  }

  show() {
    this._win.show()
  }

  setContextMenu(setMenu: boolean) {
    if (!this._tray) this.createTray()
    if (setMenu) {
      const template = createMenuTemplate(this._win)
      this._contextMenu = Menu.buildFromTemplate(template)
      this._tray.setContextMenu(this._contextMenu)
    } else {
      this._tray.setContextMenu(null)
    }
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
  }

  setShuffleMode(isShuffle: boolean) {
    shuffleMode = isShuffle
    if (!this._contextMenu) return
    this._contextMenu.getMenuItemById('shuffle').checked = isShuffle
  }
}

export const createTray = (win: BrowserWindow): YPMTray => {
  return new TrayImpl(win)
}
