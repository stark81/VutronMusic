import { BrowserWindow, nativeImage, TouchBar, ipcMain } from 'electron'
import Constants from './utils/Constants'
import { TouchBarCanvasManager } from './utils/touchbarCanvas'
import path from 'path'

const { TouchBarButton, TouchBarSpacer } = TouchBar

const createNativeImage = (name: string) => {
  return nativeImage.createFromPath(
    Constants.IS_DEV_ENV
      ? path.join(process.cwd(), `./src/public/images/touchBar/${name}`)
      : path.join(__dirname, `../images/touchbar/${name}`)
  )
}

export const createTouchBar = (win: BrowserWindow) => {
  const lrcBtn = new TouchBarButton({ icon: nativeImage.createEmpty() })
  const lyricScroller = new TouchBarCanvasManager(lrcBtn)

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

  ipcMain.on('updateLyricInfo', (event, data: any) => {
    const [key, value] = Object.entries(data)[0] as [string, { content: string; time: number }]
    if (key === 'currentLyric') {
      lyricScroller.setLyric(value.content, value.time * 1000)
    }
  })

  ipcMain.on('updatePlayerState', (event, data) => {
    if ('playing' in data) {
      lyricScroller.setPlaying(data.playing)
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
      lrcBtn
    ]
  }

  const touchBar = new TouchBar(options)
  if (touchBar) win.setTouchBar(touchBar)
}
