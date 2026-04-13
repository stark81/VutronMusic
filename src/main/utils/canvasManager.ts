import type { Rectangle, Point } from 'electron'
import { nativeImage, Tray } from 'electron'
import type { CanvasRenderingContext2D, Image } from 'skia-canvas'
import { Canvas, loadImage } from 'skia-canvas'
import path from 'path'
import Constants from './Constants'

const DPR = 2
const HEIGHT = 22

const LYRIC_W = 192
const ICON_BOX = 22

const FPS = 30
const FRAME_MS = 1000 / FPS

interface LyricState {
  text: string
  width: number
  duration: number

  x: number
  speed: number

  phase: 'static' | 'scroll' | 'done'
  start: number
  staticTime: number
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

  constructor(tray: Tray) {
    this.tray = tray
    const width = LYRIC_W * DPR + ICON_BOX * DPR * 5

    this.canvas = new Canvas(width, HEIGHT * DPR)
    this.ctx = this.canvas.getContext('2d')

    this.ctx.font = `${14 * DPR}px "pingfang sc", "microsoft yahei", sans-serif`
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = 'white'
  }

  async init() {
    await preloadImages()
    this.setLyric('听你想听的音乐', 0)
  }

  setLyric(text: string, duration: number, width: number = 192) {
    const limit = LYRIC_W * DPR

    if (width <= limit) {
      this.lyric = {
        text,
        width,
        duration,
        x: 0,
        speed: 0,
        phase: 'done',
        start: Date.now(),
        staticTime: 0
      }
    } else {
      const staticTime = Math.min((limit / width) * duration, 2000)
      const speed = (width - limit) / Math.max(duration - staticTime, 1)

      this.lyric = {
        text,
        width,
        duration,
        x: 0,
        speed,
        phase: 'static',
        start: Date.now(),
        staticTime
      }
    }

    this.kick()
  }

  setPlaying(v: boolean) {
    this.isPlaying = v
    if (v)
      this.kick() // 恢复播放时重启循环
    else this.render() // 暂停时只渲染一帧（更新控制按钮图标）
  }

  setLiked(v: boolean) {
    this.isLiked = v
    this.kick()
  }

  setFM(v: boolean) {
    this.isFM = v
    this.kick()
  }

  // ─────────────────────────────
  // 动画
  // ─────────────────────────────

  private kick() {
    if (this.timer) return
    this.timer = setTimeout(() => this.frame(), 0)
  }

  private frame() {
    this.timer = null
    const now = Date.now()
    this.tick(now)
    this.render()

    // 只有在播放且歌词还没滚完时才继续调度
    if (this.isPlaying && this.lyric?.phase !== 'done') {
      this.timer = setTimeout(() => this.frame(), FRAME_MS)
    }
  }

  private tick(now: number) {
    const s = this.lyric
    if (!s || !this.isPlaying || s.phase === 'done') return

    const el = now - s.start

    if (s.phase === 'static') {
      if (el >= s.staticTime) {
        s.phase = 'scroll'
        s.start = now
      }
      return
    }

    const limit = -(s.width - LYRIC_W * DPR)
    s.x = -(s.speed * el * DPR)

    if (s.x <= limit) {
      s.x = limit
      s.phase = 'done'
    }
  }

  private render() {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)

    let x = 0

    this.drawLyric(ctx, x, h)
    x += LYRIC_W * DPR

    this.drawIconRow(ctx, x, h)

    const buf = this.canvas.toBufferSync('png')
    const img = nativeImage.createFromBuffer(buf, { scaleFactor: DPR })
    img.setTemplateImage(true)
    this.tray.setImage(img)
  }

  private drawLyric(ctx: CanvasRenderingContext2D, offsetX: number, h: number) {
    if (!this.lyric) return

    ctx.save()
    // 关键：裁剪到歌词区域，防止溢出
    ctx.beginPath()
    ctx.rect(offsetX, 0, LYRIC_W * DPR, h)
    ctx.clip()

    ctx.translate(offsetX, 0)

    if (this.lyric.width <= LYRIC_W * DPR) {
      ctx.textAlign = 'center'
      ctx.fillText(this.lyric.text, (LYRIC_W * DPR) / 2, h / 2)
    } else {
      ctx.textAlign = 'left'
      ctx.fillText(this.lyric.text, this.lyric.x, h / 2)
    }

    ctx.restore()
  }

  private drawIconRow(ctx: CanvasRenderingContext2D, offsetX: number, h: number) {
    // console.log('=== drawIconRow ===', this.isFM, this.isPlaying, this.isLiked)
    const icons = [
      this.isFM ? ICONS.thumbsDown : ICONS.prev,
      this.isPlaying ? ICONS.pause : ICONS.play,
      ICONS.next,
      this.isLiked ? ICONS.liked : ICONS.like,
      ICONS.icon
    ]

    for (let i = 0; i < icons.length; i++) {
      const img = getImg(icons[i])
      if (!img) continue

      const dx = offsetX + i * ICON_BOX * DPR
      const dy = h / 2 - img.height / 2

      ctx.drawImage(img, dx, dy)
    }
  }

  public click(bounds: Rectangle, position: Point) {
    console.log('====2====1====1=====', bounds, position)
  }
}
