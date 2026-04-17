import { TouchBar, nativeImage } from 'electron'
import { Canvas, CanvasRenderingContext2D } from 'skia-canvas'
import { LyricScroller } from './lyricScroll'

const { TouchBarButton } = TouchBar

const TB_HEIGHT = 30
const TB_DPR = 1
const TB_LYRIC_WIDTH = 330

export class TouchBarCanvasManager {
  public button: InstanceType<typeof TouchBarButton>

  private canvas: Canvas
  private ctx: CanvasRenderingContext2D
  private scroller: LyricScroller

  private isPlaying = false
  private timer: any = null

  constructor(tbarButton: InstanceType<typeof TouchBarButton>) {
    // Canvas
    this.canvas = new Canvas(TB_LYRIC_WIDTH * TB_DPR, TB_HEIGHT * TB_DPR)
    this.ctx = this.canvas.getContext('2d')
    this.setupCtx()

    // Scroller
    this.scroller = new LyricScroller(this.ctx, {
      width: TB_LYRIC_WIDTH * TB_DPR,
      duration: 0
    })

    // TouchBar Button
    this.button = tbarButton
  }

  private setupCtx() {
    this.ctx.font = `${16 * TB_DPR}px "PingFang SC", sans-serif`
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = '#FFFFFF'
  }

  public setLyric(text: string, duration: number) {
    this.scroller.setText(text, duration)

    if (!this.isPlaying) {
      this.scroller.pause()
    }

    this.render()
    this.start()
  }

  public setPlaying(v: boolean) {
    this.isPlaying = v

    if (v) {
      this.scroller.resume()
      this.start()
    } else {
      this.scroller.pause()
      this.render() // ✅ 必须刷新
    }
  }

  // ======================
  // 渲染循环
  // ======================

  private start() {
    if (this.timer) return
    this.frame()
  }

  private frame() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null

    const stillAnimating = this.scroller.tick()
    this.render()

    // 只要还在动画阶段，就以 24FPS 运行，直到 isDone 为 true
    if (stillAnimating && this.isPlaying) {
      this.timer = setTimeout(() => this.frame(), 1000 / 24)
    }
  }

  // ======================
  // 渲染
  // ======================

  private render() {
    const { text, x, viewWidth, centered } = this.scroller.getState()
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)

    if (text) {
      ctx.save()

      ctx.beginPath()
      ctx.rect(0, 0, viewWidth, h)
      ctx.clip()

      if (centered) {
        ctx.textAlign = 'center'
        ctx.fillText(text, viewWidth / 2, h / 2)
      } else {
        ctx.textAlign = 'left'
        ctx.fillText(text, x, h / 2)
      }

      ctx.restore()
    }

    // 输出到 TouchBar
    const buf = this.canvas.toBufferSync('png')
    const img = nativeImage.createFromBuffer(buf, { scaleFactor: TB_DPR })

    this.button.icon = img
  }
}
