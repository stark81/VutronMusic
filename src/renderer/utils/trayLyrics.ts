import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useSettingsStore } from '../store/settings'
import { useDataStore } from '../store/data'
import { Lyric, Control, Canvas } from './canvas'
import { watch } from 'vue'
import eventBus from './eventBus'
// import { currentLyric, updateEnable } from './lyricUtils'

const previous = new URL('../assets/tray/skip_previous.png', import.meta.url).href
const play = new URL('../assets/tray/play_arrow.png', import.meta.url).href
const next = new URL('../assets/tray/skip_next.png', import.meta.url).href
const pause = new URL('../assets/tray/pause.png', import.meta.url).href
const liked = new URL('../assets/tray/like.png', import.meta.url).href
const likeSolid = new URL('../assets/tray/like_fill.png', import.meta.url).href
const thumbsDown = new URL('../assets/tray/thumbs_down.png', import.meta.url).href
const trayIcon = new URL('../assets/tray/menu_white.png', import.meta.url).href

const playerStore = usePlayerStore()
const { playPrev, _playNextTrack, moveToFMTrash, playOrPause } = playerStore
const { isPersonalFM, playing, currentTrack, isLiked, currentLyric } = storeToRefs(playerStore)

const settingsStore = useSettingsStore()
const { tray } = storeToRefs(settingsStore)

const { likeATrack } = useDataStore()

class TrayLyric {
  _icon: Control | null
  _control: Control | null
  _lyric: Lyric | null
  _tray: Canvas | null
  constructor() {
    this._icon = null
    this._control = null
    this._lyric = null
    this._tray = null
  }

  getIcons() {
    this._lyric = new Lyric({ width: tray.value.lyricWidth })
    if (currentTrack.value)
      this._lyric.lyric.text = currentLyric.value.content || currentTrack.value.name
    this._control = new Control([
      isPersonalFM.value ? thumbsDown : previous,
      playing.value ? pause : play,
      next,
      liked
    ])
    this._icon = new Control([trayIcon])
  }

  getCombineIcon() {
    let width = this._icon!.canvas.width
    const height = this._icon!.canvas.height
    let devicePixelRatio = 1
    width += tray.value.showLyric ? this._lyric!.canvas.width : 0
    width += tray.value.showControl ? this._control!.canvas.width : 0
    devicePixelRatio = this._icon!.devicePixelRatio
    this._tray = new Canvas({ width, height })
    this._tray.devicePixelRatio = devicePixelRatio
  }

  async drawTray() {
    if (tray.value.showLyric) this._lyric!.draw()
    if (tray.value.showControl) await this._control!.draw()
    await this._icon!.draw()
  }

  buildTray() {
    const width = this._tray!.canvas.width
    const height = this._tray!.canvas.height
    this._tray?.ctx.clearRect(0, 0, width, height)

    let x = 0
    if (tray.value.showLyric) {
      this._tray?.ctx.drawImage(this._lyric?.canvas!, x, 0)
      x += this._lyric!.canvas.width
    }

    if (tray.value.showControl) {
      this._tray?.ctx.drawImage(this._control?.canvas!, x, 0)
      x += this._control!.canvas.width
    }

    this._tray?.ctx.drawImage(this._icon?.canvas!, x, 0)

    window.mainApi?.send('updateTray', {
      img: this._tray?.canvas.toDataURL(),
      width: this._tray!.canvas.width / this._tray!.devicePixelRatio,
      height: this._tray!.canvas.height / this._tray!.devicePixelRatio
    })
  }

  handleClick(position: { x: number; y: number }) {
    const x = tray.value.showLyric
      ? position.x - 8 - this._lyric!.canvas.width / this._lyric!.devicePixelRatio
      : position.x - 8

    if (x > 0) {
      switch (Math.floor(x / this._control!.singleWidth)) {
        case 0:
          if (!isPersonalFM.value) {
            playPrev()
          } else {
            moveToFMTrash()
          }
          break
        case 1:
          playOrPause()
          break
        case 2:
          _playNextTrack(isPersonalFM.value)
          break
        case 3:
          if (currentTrack.value && currentTrack.value.matched) {
            likeATrack(currentTrack.value.id)
          }
          break
        case 4:
          window.mainApi?.send('showWindow')
          break
      }
    }
  }

  handleEvent() {
    watch(isPersonalFM, async (value) => {
      this._control?.updateImage(0, value ? thumbsDown : previous)
      await this._control?.draw()
      this.buildTray()
    })
    watch(currentLyric, (value) => {
      if (!tray.value.showLyric) return
      this._lyric!.lyric = {
        text: value.content,
        width: 0,
        time: value.time * 1000
      }
      this._lyric?.updateLyric(!playing.value)
    })
    watch(playing, async (value) => {
      if (value) {
        this._lyric?.resume()
      } else {
        this._lyric?.pause()
      }
      this._control?.updateImage(1, value ? pause : play)
      await this._control?.draw()
      this.buildTray()
    })
    watch(isLiked, async (value) => {
      this._control?.updateImage(3, value ? likeSolid : liked)
      await this._control?.draw()
      this.buildTray()
    })
    watch(
      () => tray.value.showLyric,
      async () => {
        this.getCombineIcon()
        await this.drawTray()
        this.buildTray()
      }
    )
    watch(
      () => tray.value.showControl,
      async () => {
        this.getCombineIcon()
        await this.drawTray()
        this.buildTray()
      }
    )
    watch(
      () => tray.value.lyricWidth,
      async () => {
        const currentLyric = this._lyric!.lyric
        this.getIcons()
        this.getCombineIcon()
        this._lyric!.lyric = currentLyric
        this._lyric!.updateLyric(!playing.value)
        await this.drawTray()
        this.buildTray()
      }
    )
    watch(
      () => tray.value.scrollRate,
      () => {
        this._lyric!.frame = tray.value.scrollRate
      }
    )
    eventBus.on('lyric-draw', () => {
      this.buildTray()
    })
    window.mainApi?.on('handleTrayClick', (event: any, { position }) => {
      if (tray.value.showControl) {
        this.handleClick(position)
      } else if (tray.value.showLyric) {
        const x = position.x - 8 - this._lyric!.canvas.width / this._lyric!.devicePixelRatio
        if (x > 0) window.mainApi?.send('showWindow')
      } else {
        window.mainApi?.send('showWindow')
      }
    })
  }
}

class TouchBarLyric {
  private _lyric: Lyric
  private _touchBar: Canvas
  constructor() {
    this._lyric = new Lyric({ width: 252, fontSize: 12 })
    if (currentTrack.value)
      this._lyric.lyric.text = currentLyric.value.content || currentTrack.value.name
    this._touchBar = new Canvas({
      width: this._lyric.canvas.width,
      height: this._lyric.canvas.height,
      devicePixelRatio: 1
    })
    this._lyric.draw()
  }

  buildTouchBar() {
    const width = this._touchBar.canvas.width
    const height = this._touchBar.canvas.height
    this._touchBar.ctx.clearRect(0, 0, width, height)
    this._touchBar.ctx.drawImage(this._lyric.canvas, 0, 0)
    window.mainApi?.send('updateTouchBarLyric', {
      img: this._touchBar.canvas.toDataURL(),
      width: this._touchBar.canvas.width / this._touchBar.devicePixelRatio,
      height: this._touchBar.canvas.height / this._touchBar.devicePixelRatio
    })
  }

  handleEvent() {
    watch(currentLyric, (value) => {
      this._lyric!.lyric = {
        text: value.content,
        width: 0,
        time: value.time * 1000
      }
      this._lyric.updateLyric(!playing.value)
    })
    eventBus.on('lyric-draw', () => {
      this.buildTouchBar()
    })
  }
}

export const buildTrays = async () => {
  const tray = new TrayLyric()
  tray.getIcons()
  tray.getCombineIcon()
  await tray.drawTray()
  tray.buildTray()
  tray.handleEvent()
}

export const buildTouchBars = () => {
  const touchBar = new TouchBarLyric()
  touchBar.buildTouchBar()
  touchBar.handleEvent()
}
