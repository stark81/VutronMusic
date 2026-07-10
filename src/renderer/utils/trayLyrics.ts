import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useSettingsStore } from '../store/settings'
import { useDataStore } from '../store/data'
import { useLyricStore } from '../store/lyric'
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
const { playPrev, playNext, moveToFMTrash, playOrPause } = playerStore
const { isPersonalFM, playing, currentTrack, isLiked, currentLyric, playbackRate, seek } = storeToRefs(playerStore)

const settingsStore = useSettingsStore()
const { tray } = storeToRefs(settingsStore)

const { likeATrack } = useDataStore()
const lyricStore = useLyricStore()

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

  /** 给原生插件发送结构化歌词数据 */
  sendNativeLyricData() {
    if (!window.env?.isMac) return
    const idx = lyricStore.currentIndex
    const line = lyricStore.lyrics[idx]
    const track = currentTrack.value

    // ── 空歌词 fallback / 歌曲结束归零：显示 "艺术家 - 歌曲名" 或默认文本 ──
    if (!line || (track && (seek.value || 0) >= track.duration)) {
      const fallbackText = track
        ? `${track.artists?.[0]?.name || ''} - ${track.name || ''}`
        : '听你想听的音乐'
      window.mainApi?.send('updateTrayLyric', {
        text: fallbackText,
        words: [],
        lineStart: 0,
        lineEnd: 0,
        hasWordTiming: false,
        lyricWidth: tray.value.lyricWidth || undefined,
        offset: 0
      })
      return
    }

    const words = line.lyric.info
      ? line.lyric.info.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end
        }))
      : []

    // 计算当前 seek 在该行内的偏移（毫秒），对齐 OSD 的 currentTimeMs 逻辑：
    // OSD: currentTimeMs = (seek + lyricOffset) * 1000 + 50（50ms 缓冲跨窗口延迟）
    const seekTime = seek.value || 0
    const offsetMs = (seekTime + lyricStore.offset - line.start) * 1000 + 50

    window.mainApi?.send('updateTrayLyric', {
      text: line.lyric.text,
      words,
      lineStart: line.start * 1000,
      lineEnd: line.end * 1000,
      hasWordTiming: !!line.lyric.info && line.lyric.info.length > 0,
      lyricWidth: tray.value.lyricWidth || undefined,
      offset: Math.max(0, offsetMs)
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
          playNext(isPersonalFM.value)
          break
        case 3:
          if (currentTrack.value) {
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
    // ── FM 模式 ──
    watch(isPersonalFM, async (value) => {
      this._control?.updateImage(0, value ? thumbsDown : previous)
      await this._control?.draw()
      this.buildTray()
      window.mainApi?.send('setTrayFMMode', value)
    })

    // ── 歌词行切换（仅内容变化时全量发送，避免 seek 抖动重复发） ──
    let prevLyricIndex = lyricStore.currentIndex
    watch(currentLyric, (value) => {
      if (!tray.value.showLyric) return
      if (window.env?.isMac) {
        const idx = lyricStore.currentIndex
        if (idx !== prevLyricIndex) {
          prevLyricIndex = idx
          this.sendNativeLyricData()
        }
        return
      }
      this._lyric!.lyric = {
        text: value.content,
        width: 0,
        time: value.time * 1000
      }
      this._lyric?.updateLyric(!playing.value)
    })

    // ── 歌曲切换 → 推送当前歌词到原生 tray ──
    watch(currentTrack, () => {
      if (window.env?.isMac) {
        // 延迟一帧等待 lyricStore 更新
        setTimeout(() => this.sendNativeLyricData(), 0)
      }
    })

    // ── 歌词加载/切换 → 推送原生 tray ──
    watch(() => lyricStore.lyrics.length, () => {
      if (window.env?.isMac) {
        this.sendNativeLyricData()
      }
    })

    // ── 播放/暂停 + 倍率（原子同步，消除时序竞争） ──
    watch(playing, async (value) => {
      if (value) {
        this._lyric?.resume()
      } else {
        this._lyric?.pause()
      }
      this._control?.updateImage(1, value ? pause : play)
      await this._control?.draw()
      this.buildTray()
      if (window.env?.isMac) {
        window.mainApi?.send('updatePlayerState', {
          playing: value,
          rate: playbackRate.value
        })
      }
    })

    // ── 喜欢状态 ──
    watch(isLiked, async (value) => {
      this._control?.updateImage(3, value ? likeSolid : liked)
      await this._control?.draw()
      this.buildTray()
    })

    // ── 歌词显隐 ──
    watch(
      () => tray.value.showLyric,
      async () => {
        this.getCombineIcon()
        await this.drawTray()
        this.buildTray()
        window.mainApi?.send('updateTrayVisibility', {
          lyric: tray.value.showLyric,
          buttons: tray.value.showControl
        })
      }
    )

    // ── 控制按钮显隐 ──
    watch(
      () => tray.value.showControl,
      async () => {
        this.getCombineIcon()
        await this.drawTray()
        this.buildTray()
        window.mainApi?.send('updateTrayVisibility', {
          lyric: tray.value.showLyric,
          buttons: tray.value.showControl
        })
      }
    )

    // ── 歌词宽度变化 ──
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
        window.mainApi?.send('updateTrayVisibility', {
          lyric: tray.value.showLyric,
          buttons: tray.value.showControl,
          width: tray.value.lyricWidth
        })
      }
    )

    // ── 滚动速率 ──
    watch(
      () => tray.value.scrollRate,
      () => {
        this._lyric!.frame = tray.value.scrollRate
      }
    )

    // ── 歌词偏移调整 → 即时全量重建（对齐 OSD：每次 offset 变化瞬间同步绝对位置） ──
    watch(
      () => lyricStore.offset,
      () => {
        if (window.env?.isMac) this.sendNativeLyricData()
      }
    )

    // ── seek 变化 → 防抖重建动画（任何 seek 都同步，对齐 OSD 的 progress 变化触发） ──
    let seekDebounceTimer: ReturnType<typeof setTimeout> | null = null
    watch(seek, () => {
      if (!window.env?.isMac) return
      if (seekDebounceTimer) clearTimeout(seekDebounceTimer)
      seekDebounceTimer = setTimeout(() => {
        this.sendNativeLyricData()
        seekDebounceTimer = null
      }, 16)
    })

    // ── 倍率变化 → 通知原生 tray（播放时已随 playing 一起发送，此处只负责纯倍率变化场景） ──
    watch(playbackRate, (rate) => {
      if (window.env?.isMac) {
        window.mainApi?.send('updatePlayerState', { rate })
      }
    })

    // ── 其他事件 ──
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
    // like 事件由 player.ts 统一处理

    // ── 初始化：一次性推送所有状态到原生 tray，消除多消息时序竞争 ──
    if (window.env?.isMac) {
      const idx = lyricStore.currentIndex
      const line = lyricStore.lyrics[idx]
      let lyricData: any

      if (!line) {
        const fallbackText = currentTrack.value
          ? `${currentTrack.value.artists?.[0]?.name || ''} - ${currentTrack.value.name || ''}`
          : '听你想听的音乐'
        lyricData = { text: fallbackText, words: [], lineStart: 0, lineEnd: 0, hasWordTiming: false, lyricWidth: tray.value.lyricWidth || undefined, offset: 0 }
      } else {
        const words = line.lyric.info
          ? line.lyric.info.map((w: any) => ({ word: w.word, start: w.start, end: w.end }))
          : []
        const seekTime = seek.value || 0
        const offsetMs = (seekTime + lyricStore.offset - line.start) * 1000 + 50
        lyricData = {
          text: line.lyric.text,
          words,
          lineStart: line.start * 1000,
          lineEnd: line.end * 1000,
          hasWordTiming: !!line.lyric.info && line.lyric.info.length > 0,
          lyricWidth: tray.value.lyricWidth || undefined,
          offset: Math.max(0, offsetMs)
        }
      }

      window.mainApi?.send('initTrayState', {
        lyric: lyricData,
        playing: playing.value,
        rate: playbackRate.value,
        like: isLiked.value,
        isFM: isPersonalFM.value
      })
    }
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
