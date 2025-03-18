const createAnimation = (dom: HTMLElement, duration: number) => {
  const effect = new KeyframeEffect(dom, [{ backgroundSize: '0 100%'}, { backgroundSize: '100% 100%' }], { duration, easing: 'linear' })
  return new Animation(effect, document.timeline)
}

export class LyricController {
  isPlaying: boolean
  currentIndex: number
  animations: { dom: HTMLElement, animation: Animation, start: number, duration: number }[]
  start: number = 0 // 歌词的初始时间
  currentTime: number = 0 // 歌词的当前时间
  private _timeout: any | null

  constructor(data: { elements: HTMLElement[], currentTime: number, isPlaying: boolean, index:number}) {
    this.isPlaying = data.isPlaying
    this.currentIndex = data.index
    this.start = performance.now()
    this.currentTime = data.currentTime
    this.animations = []
    this._timeout = null

    this._initLines(data.elements)

    if (this.isPlaying) {
      setTimeout(() => {
        const currentTime = performance.now() - this.start + this.currentTime
      this.play(currentTime)
      }, 100)
    }
  }

  _initLines(elements:  HTMLElement[]) {
    elements.forEach((element) => {
      const start = Number(element.dataset.start)
      const end = Number(element.dataset.end)
      const duration = end - start
      const animation = createAnimation(element, duration)
      this.animations.push({ dom: element, animation, start, duration })
    })
  }

  _findCurFont(curTime: number, startIndex = 0) {
    if (curTime < this.animations[0].start) return -1
    const length = this.animations.length
    for (let index = startIndex; index < length; index++) {
      if (curTime < this.animations[index].start) return index - 1
    }
    return length - 1
  }

  _handlePlayedFont(font: { dom: HTMLElement, animation: Animation }, currentTime: number, toFinish: boolean) {
    switch (font.animation.playState) {
      case 'finished':
        break
      case 'idle':
        font.dom.style.backgroundSize = '100% 100%'
        if (!toFinish) font.animation.play()
        break
      default:
        if (toFinish) {
          font.animation.cancel()
        } else {
          font.animation.currentTime = currentTime
          font.animation.play()
        }
        break
    }
  }

  _refresh() {
    this.currentIndex++
    const font = this.animations[this.currentIndex]
    if (!font) return
    const currentTime = performance.now() - this.start
    const driftTime = currentTime - font.start

    // driftTime>=0，说明当前播放进度大于当前歌词的位置
    if (driftTime >= 0) {
      const nextFont = this.animations[this.currentIndex+1]
      const delay = nextFont ? (nextFont.start - font.start - driftTime) : (font.duration - driftTime)
      // delay > 0 说明当前播放进度正处于这个歌词之内，触发当前歌词的播放动画，并设置下一个歌词的播放延迟
      if (delay > 0 || this.currentIndex === 0) {
        if (this.isPlaying) {
          this._timeout = setTimeout(() => {
            clearTimeout(this._timeout)
            if (!this.isPlaying) return
            this._refresh()
          }, delay)
        }
        this._handlePlayedFont(font, driftTime, false)
      } else {  // delay <= 0, 说明当前播放进度大于此歌词，需要重新查找播放的歌词
        const newCurFont = this._findCurFont(currentTime, 0)
        this.currentIndex = newCurFont - 1
        for (let i = 0; i <= this.currentIndex; i++) {
          this._handlePlayedFont(this.animations[i], 0, true)
        }
        this._refresh()
      }
    } else { // driftTime < 0,说明当前播放进度小于当前歌词位置
      if (this.currentIndex === 0) { // 说明当前还没有播放任何一个歌词，找到当前时间与第一个歌词之间的差值，设置延迟播放第0个歌词
        this.currentIndex--
        if (this.isPlaying) {
          this._timeout = setTimeout(() => {
            clearTimeout(this._timeout)
            if (!this.isPlaying) return
            this._refresh()
          }, -driftTime)
        }
      } else {
        const newCurFont = this._findCurFont(currentTime, 0)
        this.currentIndex = newCurFont - 1
        for (let i = 0; i <= this.currentIndex; i++) {
          this._handlePlayedFont(this.animations[i], 0, true)
        }
        this._refresh()
      }
    }
  }

  play(curTime: number) {
    this.start = performance.now() - curTime
    this.currentTime = curTime
    this.pause()
    this.isPlaying = true
    const idx = Math.max(0, this._findCurFont(curTime))

    for (let i = idx; i> -1; i--) {
      this._handlePlayedFont(this.animations[i], 0, true)
    }

    for (let i = idx; i < this.animations.length; i++) {
      const font = this.animations[i]
      font.animation.cancel()
      font.dom.style.backgroundSize = '0 100%'
    }

    this.currentIndex = idx - 1
    this._refresh()
  }

  pause() {
    if (!this.isPlaying) return
    this.isPlaying = false
    this.animations[this.currentIndex]?.animation.pause()
    for (let i = 0; i < this.currentIndex; i++) {
      this._handlePlayedFont(this.animations[i], 0, true)
    }
  }

  updateIndex(idx: number) {
    this.currentIndex = idx
  }
}
