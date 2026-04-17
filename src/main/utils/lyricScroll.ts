export interface LyricScrollerOptions {
  width: number // 可视宽度（已乘 DPR）
  duration: number // 歌词时长 ms
}

export class LyricScroller {
  private text = ''
  private measuredWidth = 0
  private viewWidth: number

  private x = 0
  private speed = 0
  private phase: 'static' | 'scroll' | 'done' = 'done'
  private staticTime = 0
  private elapsed = 0
  private lastTime = 0
  private pausedAt: number | null = null
  private duration = 0

  constructor(
    private ctx: { measureText(t: string): { width: number } },
    options: LyricScrollerOptions
  ) {
    this.viewWidth = options.width
    this.duration = options.duration
  }

  /** 切换可视宽度（如用户调整了 lyricWidth） */
  resize(newWidth: number) {
    this.viewWidth = newWidth
    this.recalibrate()
  }

  /** 设置新歌词，重置状态机 */
  setText(text: string, duration: number) {
    this.text = text
    this.duration = duration
    this.measuredWidth = this.ctx.measureText(text).width

    const now = Date.now()
    this.x = 0
    this.elapsed = 0
    this.lastTime = now
    this.pausedAt = null

    if (this.measuredWidth <= this.viewWidth) {
      this.speed = 0
      this.phase = 'done'
      this.staticTime = 0
    } else {
      this.staticTime = Math.max(
        500,
        Math.min((this.viewWidth / this.measuredWidth) * duration, 2000)
      )
      this.speed =
        ((this.measuredWidth - this.viewWidth) / Math.max(duration - this.staticTime, 1)) * 1.2
      this.phase = 'static'
    }
  }

  pause() {
    this.pausedAt = Date.now()
  }

  resume() {
    if (this.pausedAt !== null) {
      const gap = Date.now() - this.pausedAt
      this.lastTime += gap
      this.pausedAt = null
    }
  }

  /** 推进状态机，返回是否还需要继续 tick */
  tick(): boolean {
    if (this.phase === 'done' || this.pausedAt !== null) return false

    const now = Date.now()
    const delta = now - this.lastTime
    this.lastTime = now
    this.elapsed += delta

    if (this.phase === 'static') {
      if (this.elapsed >= this.staticTime) {
        this.phase = 'scroll'
        this.elapsed = 0
      }
      return true
    }

    const limit = -(this.measuredWidth - this.viewWidth)
    this.x -= this.speed * delta

    if (this.x <= limit) {
      this.x = limit
      this.phase = 'done'
      return false
    }

    return true
  }

  get isDone() {
    return this.phase === 'done'
  }

  /** 供渲染层读取 */
  getState() {
    return {
      text: this.text,
      x: this.x,
      viewWidth: this.viewWidth,
      centered: this.measuredWidth <= this.viewWidth
    }
  }

  private recalibrate() {
    const remaining = this.measuredWidth - Math.abs(this.x)
    if (remaining <= this.viewWidth) {
      this.phase = 'done'
      return
    }
    this.speed =
      ((this.measuredWidth - this.viewWidth) / Math.max(this.duration - this.staticTime, 1)) * 1.2
  }
}
