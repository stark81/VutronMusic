import eventBus from './eventBus'

export class Canvas {
  w: number
  h: number
  devicePixelRatio: number
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  constructor({ width = 195, height = 22, devicePixelRatio = 1 }) {
    this.w = width
    this.h = height
    this.devicePixelRatio = devicePixelRatio
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.w * this.devicePixelRatio
    this.canvas.height = this.h * this.devicePixelRatio
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
  }
}

export class Control extends Canvas {
  singleWidth: number
  imageList: any
  constructor(imageList: any[], singleWidth = 22) {
    super({ width: singleWidth * imageList.length, devicePixelRatio: 2 })
    this.ctx.textBaseline = 'middle'
    this.singleWidth = singleWidth
    this.imageList = imageList
  }

  async draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (let index = 0; index < this.imageList.length; index++) {
      const item = this.imageList[index]
      await this.drawImage(index, item)
    }
  }

  drawImage(index: number, item: any) {
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        this.ctx.drawImage(
          img,
          this.singleWidth * index * this.devicePixelRatio,
          this.canvas.height / 2 - img.height / 2
        )
        resolve()
      }
      img.src = item
    })
  }

  updateImage(index: number, item: any) {
    this.imageList[index] = item
  }
}

export class Lyric extends Canvas {
  fontSize: number
  lyric: { text: any; width: number; time: number }
  x: number
  timer: any
  moveTimer: any
  timeoutTimer: any
  frame: number

  private animationFrameId: number = 0
  private timeoutId: any = 0

  private offscreenCanvas: HTMLCanvasElement
  private offscreenCtx: CanvasRenderingContext2D
  private scrollPixelsPerMS: number = 0
  private lastDrawTime: number = 0
  private dynamicFrameInterval: number = 33
  private lastRenderX: number = Infinity

  constructor({ width = 195, height = 22, fontSize = 14 } = {}) {
    super({ width, height, devicePixelRatio: 2 })
    this.fontSize = fontSize
    this.lyric = {
      text: '听你想听的音乐',
      width: 0,
      time: 0 // 单句歌词的播放时间
    }
    this.x = 0
    this.timer = null
    this.frame = 34
    this.ctx.font = `${
      this.fontSize * this.devicePixelRatio
    }px "pingfang sc", "microsoft yahei", sans-serif`
    this.ctx.textBaseline = 'middle'

    this.offscreenCanvas = document.createElement('canvas')
    this.offscreenCanvas.width = this.canvas.width
    this.offscreenCanvas.height = this.canvas.height
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')!
    this.offscreenCtx.font = this.ctx.font
    this.offscreenCtx.textBaseline = 'middle'
  }

  updateLyric(arg = this.lyric) {
    this.clearAllTimes()
    this.x = 0
    this.lastDrawTime = 0
    const measureText = this.ctx.measureText(arg.text)
    this.lyric = {
      text: arg.text,
      width: measureText.width,
      time: arg.time
    }
    if (this.lyric.width > this.canvas.width) {
      const rate = this.canvas.width / this.lyric.width
      const staticTime = Math.min(rate * this.lyric.time, 2000)

      const more = this.lyric.width - this.canvas.width
      this.scrollPixelsPerMS = more / Math.max(this.lyric.time - 2000, rate * this.lyric.time)

      this.startAnimation(staticTime)
    } else {
      this.draw()
    }
  }

  private startAnimation(staticTime: number) {
    this.draw()

    this.moveTimer = setTimeout(() => {
      this.startTimeoutLoop()
    }, staticTime)

    this.timeoutTimer = setTimeout(() => {
      this.clearAllTimes()
    }, this.lyric.time)
  }

  private startTimeoutLoop() {
    let lastTime = performance.now()
    let accumulatedTime = 0

    const animate = () => {
      const currentTime = performance.now()
      const delta = currentTime - lastTime
      lastTime = currentTime
      accumulatedTime += delta

      const hasMovement = this.calculatePosition(accumulatedTime)
      if (hasMovement) {
        this.dynamicFrameInterval = Math.min(33, this.dynamicFrameInterval + 2)
        accumulatedTime = 0
        this.draw()
      } else {
        this.dynamicFrameInterval = Math.max(50, this.dynamicFrameInterval - 5)
      }
      const nextInterval = this.calculateOptimalInterval()
      this.timeoutId = setTimeout(animate, nextInterval)
    }
    this.timeoutId = setTimeout(animate, this.dynamicFrameInterval)
  }

  private calculatePosition(delta: number): boolean {
    const prevX = this.x
    if (-this.x < this.lyric.width - this.canvas.width) {
      this.x -= this.scrollPixelsPerMS * delta * this.devicePixelRatio
      return Math.abs(prevX - this.x) > 1
    }
    this.clearAllTimes()
    return false
  }

  private calculateOptimalInterval(): number {
    const speed = Math.abs(this.scrollPixelsPerMS)
    if (speed < 0.05) return 50
    if (speed < 0.1) return 33
    return 16
  }

  private clearAllTimes() {
    cancelAnimationFrame(this.animationFrameId)
    clearTimeout(this.timeoutTimer)
    clearTimeout(this.moveTimer)
    clearTimeout(this.timer)
    clearTimeout(this.timeoutId)
  }

  draw() {
    if (Math.abs(this.x - this.lastRenderX) < 1) return

    const now = performance.now()
    if (now - this.lastDrawTime < this.dynamicFrameInterval) return

    let x: number
    if (this.lyric.width <= this.canvas.width) {
      x = this.canvas.width / 2
      this.offscreenCtx.textAlign = 'center'
    } else {
      x = this.x
      this.offscreenCtx.textAlign = 'left'
    }

    this.offscreenCtx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.offscreenCtx.fillText(this.lyric.text, x, this.canvas.height / 2 + 1)

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(this.offscreenCanvas, 0, 0)
    eventBus.emit('lyric-draw')
    this.lastDrawTime = now
  }
}
