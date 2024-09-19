import { BrowserWindow, nativeImage, TouchBar, ipcMain } from 'electron'
import Constants from './utils/Constants'
import path from 'path'

const { TouchBarButton, TouchBarSpacer } = TouchBar

const createNativeImage = (name: string) => {
  return nativeImage.createFromPath(
    Constants.IS_DEV_ENV
      ? path.join(process.cwd(), `./src/public/images/touchBar/${name}`)
      : path.join(__dirname, `../images/touchbar/${name}`) // 此处在于打包后，原来路径里的大写字母被转成了小写字母
  )
}

export const createTouchBar = (win: BrowserWindow) => {
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

  const updateLyric = (img: string, width: any, height: any) => {
    const image = nativeImage.createFromDataURL(img).resize({ width, height })
    image.setTemplateImage(true)
    showLyric.icon = image
  }

  ipcMain.on('updateTouchBarLyric', (event, { img, width, height }) => {
    updateLyric(img, width, height)
  })
  ipcMain.on('updatePlayerState', (event, data) => {
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
