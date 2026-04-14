import type { Point } from 'electron'
import { nativeImage, Tray } from 'electron'
import type { CanvasRenderingContext2D, Image } from 'skia-canvas'
import { Canvas, loadImage } from 'skia-canvas'
import store from '../store'
import path from 'path'
import Constants from './Constants'

const DPR = 2
const HEIGHT = 22
const ICON_BOX = 22

interface LyricState {
  text: string
  width: number
  duration: number

  x: number
  speed: number

  phase: 'static' | 'scroll' | 'done'

  staticTime: number
  elapsed: number
  lastTime: number

  pausedAt: number | null
}

const createImagePath = (filename: string) => {
  return Constants.IS_DEV_ENV
    ? path.join(process.cwd(), `./src/public/images/tray/${filename}.png`)
    : path.join(__dirname, `../images/tray/${filename}.png`)
}

const ICONS = {
  prev: createImagePath('skip_previous'),
  thumbsDown: createImagePath('thumbs_down'),
  play: createImagePath('play_arrow'),
  pause: createImagePath('pause'),
  next: createImagePath('skip_next'),
  like: createImagePath('like'),
  liked: createImagePath('like_fill'),
  icon: createImagePath('menu_white')
}

const cache = new Map<string, Image>()

async function preloadImages() {
  await Promise.all(
    Object.values(ICONS).map(async (file) => {
      cache.set(file, await loadImage(file))
    })
  )
}

function getImg(path: string): Image {
  return cache.get(path)!
}

export class CanvasManager {
  private tray: Tray
  private canvas: Canvas
  private ctx: CanvasRenderingContext2D

  private lyric: LyricState | null = null

  private isPlaying = false
  private isLiked = false
  private isFM = false

  private timer: any = null

  private layout = {
    width: 0,
    showLyric: true,
    showControl: true,
    lyricWidth: 192
  }

  constructor(tray: Tray) {
    this.tray = tray

    this.canvas = new Canvas(1, HEIGHT * DPR)
    this.ctx = this.canvas.getContext('2d')

    this.setupCtx()
  }

  private setupCtx() {
    this.ctx.font = `${14 * DPR}px "pingfang sc", "microsoft yahei", sans-serif`
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = 'white'
  }

  private updateLayout() {
    this.layout.showLyric = store.get('settings.tray.showLyric') ?? true
    this.layout.showControl = store.get('settings.tray.showControl') ?? true
    this.layout.lyricWidth = (store.get('settings.tray.lyricWidth') ?? 192) as number

    const lyricW = this.layout.showLyric ? this.layout.lyricWidth * DPR : 0
    const controlW = this.layout.showControl ? ICON_BOX * DPR * 4 : 0
    const iconW = ICON_BOX * DPR

    this.layout.width = lyricW + controlW + iconW

    this.canvas = new Canvas(this.layout.width, HEIGHT * DPR)
    this.ctx = this.canvas.getContext('2d')
    this.setupCtx()
  }

  async init() {
    await preloadImages()
    this.updateLayout()

    this.setLyric('听你想听的音乐', 0)

    store.onDidChange('settings', () => {
      this.onLayoutChange()
    })
  }

  public onLayoutChange() {
    const oldWidth = this.layout.lyricWidth

    this.updateLayout()

    if (!this.lyric) {
      this.render()
      return
    }

    if (oldWidth !== this.layout.lyricWidth) {
      this.recalibrateLyric()
    }

    this.render()
  }

  setLyric(text: string, duration: number) {
    const limit = this.layout.lyricWidth * DPR
    const measuredWidth = this.ctx.measureText(text).width

    const now = Date.now()

    if (measuredWidth <= limit) {
      this.lyric = {
        text,
        width: measuredWidth,
        duration,
        x: 0,
        speed: 0,
        phase: 'done',
        staticTime: 0,
        elapsed: 0,
        lastTime: now,
        pausedAt: null
      }
    } else {
      const staticTime = Math.max(500, Math.min((limit / measuredWidth) * duration, 2000))

      const speed = (measuredWidth - limit) / Math.max(duration - staticTime, 1)

      this.lyric = {
        text,
        width: measuredWidth,
        duration,
        x: 0,
        speed,
        phase: 'static',
        staticTime,
        elapsed: 0,
        lastTime: now,
        pausedAt: null
      }
    }

    this.start()
  }

  setPlaying(v: boolean) {
    if (!this.lyric) return

    if (!v) {
      this.isPlaying = false
      this.lyric.pausedAt = Date.now()
      this.render()
      return
    }

    if (this.lyric.pausedAt) {
      const gap = Date.now() - this.lyric.pausedAt
      this.lyric.lastTime += gap
      this.lyric.pausedAt = null
    }

    this.isPlaying = true
    this.start()
  }

  setLiked(v: boolean) {
    this.isLiked = v
    this.start()
  }

  setFM(v: boolean) {
    this.isFM = v
    this.start()
  }

  private start() {
    if (this.timer) return
    this.timer = setTimeout(() => this.frame(), 0)
  }

  private frame() {
    this.timer = null
    const scrollRate = (store.get('settings.tray.scrollRate') as number) || 30

    const now = Date.now()
    this.tick(now)
    this.render()

    const done = this.lyric?.phase === 'done'

    if (this.isPlaying && !done) {
      this.timer = setTimeout(() => this.frame(), 1000 / scrollRate)
    }
  }

  private tick(now: number) {
    const s = this.lyric
    if (!s || s.phase === 'done') return
    if (!this.isPlaying) return

    const delta = now - s.lastTime
    s.lastTime = now
    s.elapsed += delta

    if (s.phase === 'static') {
      if (s.elapsed >= s.staticTime) {
        s.phase = 'scroll'
        s.elapsed = 0
      }
      return
    }

    const limit = -(s.width - this.layout.lyricWidth * DPR)

    s.x -= s.speed * delta

    if (s.x <= limit) {
      s.x = limit
      s.phase = 'done'
    }
  }

  private recalibrateLyric() {
    const s = this.lyric!
    const limit = this.layout.lyricWidth * DPR

    const remaining = s.width - Math.abs(s.x)

    if (remaining <= limit) {
      s.phase = 'done'
      return
    }

    s.speed = (s.width - limit) / Math.max(s.duration - s.staticTime, 1)
  }

  private render() {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)

    let x = 0

    if (this.layout.showLyric) {
      this.drawLyric(ctx, x, h)
      x += this.layout.lyricWidth * DPR
    }

    if (this.layout.showControl) {
      this.drawControls(ctx, x, h)
      x += ICON_BOX * DPR * 4
    }

    this.drawIcon(ctx, x, h)

    const buf = this.canvas.toBufferSync('png')
    const img = nativeImage.createFromBuffer(buf, { scaleFactor: DPR })
    img.setTemplateImage(true)
    this.tray.setImage(img)
  }

  private drawLyric(ctx: CanvasRenderingContext2D, offsetX: number, h: number) {
    if (!this.lyric) return
    const limit = this.layout.lyricWidth * DPR

    ctx.save()
    ctx.beginPath()
    ctx.rect(offsetX, 0, limit, h)
    ctx.clip()

    ctx.translate(offsetX, 0)

    if (this.lyric.width <= limit) {
      ctx.textAlign = 'center'
      ctx.fillText(this.lyric.text, limit / 2, h / 2)
    } else {
      ctx.textAlign = 'left'
      ctx.fillText(this.lyric.text, this.lyric.x, h / 2)
    }

    ctx.restore()
  }

  private drawControls(ctx: CanvasRenderingContext2D, offsetX: number, h: number) {
    const icons = [
      this.isFM ? ICONS.thumbsDown : ICONS.prev,
      this.isPlaying ? ICONS.pause : ICONS.play,
      ICONS.next,
      this.isLiked ? ICONS.liked : ICONS.like
    ]

    for (let i = 0; i < icons.length; i++) {
      const img = getImg(icons[i])
      const dx = offsetX + i * ICON_BOX * DPR
      const dy = h / 2 - img.height / 2
      ctx.drawImage(img, dx, dy)
    }
  }

  private drawIcon(ctx: CanvasRenderingContext2D, offsetX: number, h: number) {
    const img = getImg(ICONS.icon)
    const dy = h / 2 - img.height / 2
    ctx.drawImage(img, offsetX, dy)
  }

  public click(position: Point) {
    const { showLyric, showControl, lyricWidth } = this.layout
    const map = {
      0: 'previous',
      1: 'play',
      2: 'next',
      3: 'like',
      4: 'icon'
    } as const

    if (showControl) {
      const x = showLyric ? position.x - 8 - lyricWidth : position.x - 8
      const pos = Math.floor(x / ICON_BOX) as [0, 1, 2, 3, 4][number]
      if (x > 0) {
        return map[pos]
      }
      return 'icon'
    } else if (showLyric) {
      return 'icon'
    } else {
      return null
    }
  }
}
