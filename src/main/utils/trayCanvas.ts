import type { Point } from 'electron'
import { nativeImage, Tray } from 'electron'
import type { CanvasRenderingContext2D, Image } from 'skia-canvas'
import { Canvas, loadImage } from 'skia-canvas'
import store from '../store'
import path from 'path'
import Constants from './Constants'
import { LyricScroller } from './lyricScroll'

const DPR = 2
const HEIGHT = 22
const ICON_BOX = 22

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

function getImg(p: string): Image {
  return cache.get(p)!
}

export class CanvasManager {
  private tray: Tray
  private canvas: Canvas
  private ctx: CanvasRenderingContext2D

  private lyricScroller: LyricScroller

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

    // 占位宽度，init() 里 updateLayout() 之后会 resize
    this.lyricScroller = new LyricScroller(this.ctx, {
      width: this.layout.lyricWidth * DPR,
      duration: 0
    })
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

    // canvas 重建后要把新 ctx 传给 scroller，同时同步宽度
    this.lyricScroller = new LyricScroller(this.ctx, {
      width: this.layout.lyricWidth * DPR,
      duration: 0
    })
    this.lyricScroller.setText('听你想听的音乐', 0)

    store.onDidChange('settings', () => {
      this.onLayoutChange()
    })
  }

  public onLayoutChange() {
    const oldLyricWidth = this.layout.lyricWidth

    this.updateLayout()

    // canvas 重建后需要重新创建 scroller（ctx 引用已失效）
    // 用新 ctx 和新宽度重新构造，并把当前文字状态带过去
    const prevState = this.lyricScroller.getState()
    this.lyricScroller = new LyricScroller(this.ctx, {
      width: this.layout.lyricWidth * DPR,
      duration: 0
    })

    if (prevState.text) {
      if (oldLyricWidth !== this.layout.lyricWidth) {
        // 宽度变了，重新设置歌词让状态机重新计算
        this.lyricScroller.setText(prevState.text, 0)
      } else {
        this.lyricScroller.setText(prevState.text, 0)
      }
    }

    if (!this.isPlaying) {
      this.lyricScroller.pause()
    }

    this.render()
  }

  setLyric(text: string, duration: number) {
    this.lyricScroller.setText(text, duration)
    if (!this.isPlaying) {
      this.lyricScroller.pause()
    }
    this.start()
  }

  setPlaying(v: boolean) {
    this.isPlaying = v

    if (v) {
      this.lyricScroller.resume()
      this.start()
    } else {
      this.lyricScroller.pause()
      this.render()
    }
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

    const stillAnimating = this.lyricScroller.tick()
    this.render()

    if (this.isPlaying && stillAnimating) {
      this.timer = setTimeout(() => this.frame(), 1000 / scrollRate)
    }
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
    const { text, x, viewWidth, centered } = this.lyricScroller.getState()
    if (!text) return

    ctx.save()
    ctx.beginPath()
    ctx.rect(offsetX, 0, viewWidth, h)
    ctx.clip()
    ctx.translate(offsetX, 0)

    if (centered) {
      ctx.textAlign = 'center'
      ctx.fillText(text, viewWidth / 2, h / 2)
    } else {
      ctx.textAlign = 'left'
      ctx.fillText(text, x, h / 2)
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
