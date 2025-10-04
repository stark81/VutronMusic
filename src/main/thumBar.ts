/* eslint-disable no-unused-vars */
import { BrowserWindow, nativeImage, nativeTheme, ThumbarButton, ipcMain } from 'electron'
import Constants from './utils/Constants'
import path from 'path'

const playStatus = {
  liked: false,
  play: false,
  next: true,
  prev: true
}

enum ItemKeys {
  Play = 'play',
  Pause = 'pause',
  Like = 'like',
  Unlike = 'unlike',
  Previous = 'previous',
  Next = 'next'
}

type ThumbarButtonMap = Map<ItemKeys, ThumbarButton>

const createNativeImage = (filename: string) => {
  const isDarkMode = nativeTheme.shouldUseDarkColors
  const name = isDarkMode ? `${filename}_white.png` : `${filename}_black.png`
  return nativeImage.createFromPath(
    Constants.IS_DEV_ENV
      ? path.join(process.cwd(), `./src/public/images/thumbar/${name}`)
      : path.join(__dirname, `../images/thumbar/${name}`)
  )
}

const createThumbarButtons = (win: BrowserWindow): ThumbarButtonMap => {
  return new Map<ItemKeys, ThumbarButton>()
    .set(ItemKeys.Play, {
      icon: createNativeImage('play'),
      click: () => win.webContents.send('play'),
      tooltip: '播放',
      flags: ['nobackground']
    })
    .set(ItemKeys.Pause, {
      icon: createNativeImage('pause'),
      click: () => win.webContents.send('play'),
      tooltip: '暂停',
      flags: ['nobackground']
    })
    .set(ItemKeys.Like, {
      icon: createNativeImage('like'),
      click: () => win.webContents.send('like'),
      tooltip: '取消收藏',
      flags: ['nobackground']
    })
    .set(ItemKeys.Unlike, {
      icon: createNativeImage('unlike'),
      click: () => win.webContents.send('like'),
      tooltip: '收藏',
      flags: ['nobackground']
    })
    .set(ItemKeys.Next, {
      icon: createNativeImage('forward'),
      click: () => win.webContents.send('next'),
      tooltip: '下一首',
      flags: ['nobackground']
    })
    .set(ItemKeys.Previous, {
      icon: createNativeImage('backward'),
      click: () => win.webContents.send('previous'),
      tooltip: '上一首',
      flags: ['nobackground']
    })
}

export interface Thumbar {
  updatePlayState<K extends keyof typeof playStatus>(key: K, value: (typeof playStatus)[K]): void
}

class ThumbarImpl implements Thumbar {
  private _win: BrowserWindow
  private _buttons: ThumbarButtonMap
  private _likedOrUnliked: ThumbarButton
  private _playOrPause: ThumbarButton
  private _previous: ThumbarButton
  private _next: ThumbarButton

  constructor(win: BrowserWindow) {
    this._win = win
    this._createButtons()

    nativeTheme.on('updated', () => {
      this._buttons.clear()
      this._createButtons()
    })

    ipcMain.on('updatePlayerState', (event, data) => {
      if ('playing' in data) {
        this.updatePlayState('play', data.playing)
      }
      if ('like' in data) {
        this.updatePlayState('liked', data.like)
      }
    })
  }

  private _createButtons() {
    this._buttons = createThumbarButtons(this._win)

    this._playOrPause = this._buttons.get(ItemKeys.Play)!
    this._likedOrUnliked = this._buttons.get(ItemKeys.Unlike)!
    this._previous = this._buttons.get(ItemKeys.Previous)!
    this._next = this._buttons.get(ItemKeys.Next)!

    this._updateThumbarButtons(false)
  }

  private _updateThumbarButtons(clear: boolean) {
    this._win.setThumbarButtons(
      clear ? [] : [this._likedOrUnliked, this._previous, this._playOrPause, this._next]
    )
  }

  updatePlayState<K extends keyof typeof playStatus>(key: K, value: (typeof playStatus)[K]): void {
    playStatus[key] = value
    if (key === 'liked') {
      this._likedOrUnliked = this._buttons.get(value ? ItemKeys.Like : ItemKeys.Unlike)!
    } else if (key === 'play') {
      this._playOrPause = this._buttons.get(value ? ItemKeys.Pause : ItemKeys.Play)!
    }
    this._updateThumbarButtons(false)
  }
}

export const createThumBar = (win: BrowserWindow) => {
  return new ThumbarImpl(win)
}
