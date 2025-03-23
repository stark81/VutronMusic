import { TranslationMode } from "../store/settings"
import eventBus from "./eventBus"

interface word { start: number, end: number, word: string }

interface lyrics {
  lyric: { time: number, end: number, content: string, contentInfo?: word[] }[]
  tlyric: { time: number, content: string }[]
  rlyric: { time: number, content: string }[]
}

interface params { container: HTMLElement, playing: boolean, startStamp: number, mode: TranslationMode, wByw: boolean, offset?: number }

interface animation { dom: HTMLElement, start: number, end: number, animation: Animation }
interface line { dom: HTMLElement, start: number }

const createAnimation = (dom: HTMLElement, duration: number) => {
  const effect = new KeyframeEffect(
    dom,
    [ { backgroundSize: '0 100%' }, { backgroundSize: '100% 100%' } ],
    { duration, easing: 'linear', fill: 'forwards' }
  )
  return new Animation(effect, document.timeline)
}

export class LyricManager {
  container: HTMLElement
  lyricElements: line[] = []
  animations: { lyric: animation[], translation: animation[] } = { lyric:[], translation:[] }
  _playing: boolean
  _startTime: number
  _offset: number
  _mode: TranslationMode
  _wByW: boolean
  _hasWordByWord: boolean = false
  _lineIndex: number = -1
  _lineIdxTimeout: any = 0
  _fontIdxTimeout: any = 0
  _tFontIdxTimeout: any = 0
  _fontIdx: number = -1
  _tFontIdx: number = -1

  constructor(data: params) {
    this.container = data.container
    this._playing = data.playing
    this._startTime = data.startStamp
    this._offset = (data.offset ?? 0) * 1000
    this._mode = data.mode
    this._wByW = data.wByw
    this.container.addEventListener('click', this.handleLyricClick.bind(this))
  }

  // 创建歌词 DOM 结构（使用文档片段优化批量插入
  createLyricsDom(lyrics: lyrics) {
    this.clearLyrics()
    const lyricFiltered = lyrics.lyric.filter(({ content }) => Boolean(content))
    if (!lyricFiltered.length) return

    const fragment = document.createDocumentFragment()
    this.lyricElements = lyricFiltered.map((l, index) => {
      const element = document.createElement('div')
      element.classList.add('line')
      element.classList.add(l.contentInfo ? 'word-mode' : 'line-mode')
      element.dataset.index = index.toString()
      const start = l.time * 1000
      const end = l.end * 1000

      const lyricLine = document.createElement('div')
      lyricLine.classList.add('lyric-line')


      if (l.contentInfo && this._wByW) {
        if (!this._hasWordByWord) this._hasWordByWord = true
        l.contentInfo.forEach((w) => {
          const span = document.createElement('span')
          span.textContent = w.word
          span.style.backgroundSize = '0 100%'

          lyricLine.appendChild(span)

          const animation = createAnimation(span, w.end - w.start)
          this.animations.lyric.push({ dom: span, animation, start: w.start, end: w.end })
        })
        element.appendChild(lyricLine)

        if (this._mode === 'tlyric') {
          const sameTlyric = lyrics.tlyric.find((t) => t.time === l.time)
          if (sameTlyric) {
            const translation = document.createElement('div')
            translation.classList.add('translation')
            const words = sameTlyric.content.split('')
            const interval = (end - start) / words.length
            words.forEach((w, index) => {
              const span = document.createElement('span')
              span.textContent = w
              span.style.backgroundSize = '0 100%'
              translation.appendChild(span)

              const animation = createAnimation(span, interval)
              this.animations.translation.push({ dom: span, animation, start: start + interval * index, end: start + interval * index + interval })
            })
            element.append(translation)
          }
        } else if (this._mode === 'rlyric') {
          const sameRlyric = lyrics.rlyric.find((t) => t.time === l.time)
          if (sameRlyric) {
            const translation = document.createElement('div')
            translation.classList.add('translation')
            const words = sameRlyric.content.split('')
            const interval = (end - start) / words.length
            words.forEach((w, index) => {
              const span = document.createElement('span')
              span.textContent = w
              span.style.backgroundSize = '0 100%'
              translation.appendChild(span)

              const animation = createAnimation(span, interval)
              this.animations.translation.push({ dom: span, animation, start: start + interval * index, end: start + interval * index + interval })
            })
            element.append(translation)
          }
        }

      } else {
        const span = document.createElement('span')
        span.textContent = l.content
        lyricLine.appendChild(span)
        element.appendChild(lyricLine)

        if (this._mode === 'tlyric') {
          const sameTlyric = lyrics.tlyric.find((t) => t.time === l.time)
          if (sameTlyric) {
            const translation = document.createElement('div')
            translation.classList.add('translation')

            const span = document.createElement('span')
            span.textContent = sameTlyric.content
            translation.appendChild(span)
            element.appendChild(translation)
          }
        } else if (this._mode === 'rlyric') {
          const sameRlyric = lyrics.rlyric.find((t) => t.time === l.time)
          if (sameRlyric) {
            const translation = document.createElement('div')
            translation.classList.add('translation')

            const span = document.createElement('span')
            span.textContent = sameRlyric.content
            translation.appendChild(span)
            element.appendChild(translation)
          }
        }
      }
      return { dom: fragment.appendChild(element), start, end }
    })

    this.container.appendChild(fragment)
    this.refresh()
  }

  updateLineIndex() {
    if (!this.lyricElements.length) return
    const currentTime = performance.now() - this._startTime + this._offset
    this._lineIndex = this.findIndex(this.lyricElements, currentTime, this._lineIndex - 1)

    this.lyricElements[this._lineIndex]?.dom.classList.add('active')
    if (this._lineIndex === -1) {
      this.lyricElements[0].dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      this.lyricElements[this._lineIndex].dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const idx = this._lineIndex + 1
    const driftTime = this.lyricElements[idx]?.start - currentTime
    if (this._playing) {
      this._lineIdxTimeout = setTimeout(() => {
        clearTimeout(this._lineIdxTimeout)
        if (!this._playing) return
        this.lyricElements[this._lineIndex]?.dom.classList.remove('active')
        this.updateLineIndex()
      }, Math.abs(driftTime))
    }
  }

  updateFontIndex(type: 'lyric' | 'translation') {
    if (!this.animations[type].length) return

    const ans = this.animations[type]
    const idx = type === 'lyric' ? '_fontIdx' : '_tFontIdx'
    const fontTimeout = type === 'lyric' ? '_fontIdxTimeout' : '_tFontIdxTimeout'

    if (!ans) return

    const currentTime = performance.now() - this._startTime + this._offset
    this[idx] = this.findIndex(ans, currentTime, this[idx] - 1)

    if (this[idx] === -1) {
      const font = ans[0]
      const driftTime = font.start - currentTime
      if (this._playing) {
        this[fontTimeout] = setTimeout(() => {
          clearTimeout(this[fontTimeout])
          if (!this._playing) return
          this.updateFontIndex(type)
        }, driftTime)
      }
    } else {
      const font = ans[this[idx]]
      const nextFont = ans[this[idx] + 1]

      if (nextFont) {
        const driftTime = nextFont ? nextFont.start - currentTime : font.end - currentTime

        if (this._playing) {
          this[fontTimeout] = setTimeout(() => {
            clearTimeout(this[fontTimeout])
            if (!this._playing) return
            this.updateFontIndex(type)
          }, driftTime)
        }
      }

      const last = ans[this[idx] - 1]
      if (last && last.animation.playState !== 'finished') {
        last.animation.finish()
      }

      font.dom.style.backgroundSize = '100% 100%'
      font.animation.currentTime = currentTime - font.start
      if (this._playing) font.animation.play()
    }
  }

  _getCurrrentTime() {
    return performance.now() - this._startTime
  }

  refresh() {
    const currentTime = performance.now() - this._startTime + this._offset
    this._lineIndex = this.findIndex(this.lyricElements, currentTime)
    this.lyricElements.forEach((line, index) => {
      line.dom.classList.remove('active')
      if (index < this._lineIndex) {
        line.dom.classList.add('played')
      } else if (index === this._lineIndex) {
        line.dom.classList.add('active')
      }
    })

    this.updateLineIndex()
    if (!this._hasWordByWord) return

    this._fontIdx = this.findIndex(this.animations.lyric, currentTime)
    for (let i = this._fontIdx - 1; i > -1; i--) {
      const font = this.animations.lyric[i]
      font.dom.style.backgroundSize = '100% 100%'
      font.animation.cancel()
    }

    this._tFontIdx = this.findIndex(this.animations.translation, currentTime)
    for (let i = this._tFontIdx - 1; i > -1; i--) {
      const font = this.animations.translation[i]
      font.dom.style.backgroundSize = '100% 100%'
      font.animation.cancel()
    }

    this.updateFontIndex('lyric')
    this.updateFontIndex('translation')
  }

  pause() {
    this.animations.lyric.forEach((an) => (an.animation.pause()))
    this.animations.translation.forEach((an) => (an.animation.pause()))
    clearTimeout(this._lineIdxTimeout)
    clearTimeout(this._fontIdxTimeout)
    clearTimeout(this._tFontIdxTimeout)
  }

  clearLyrics() {
    clearTimeout(this._lineIdxTimeout)
    clearTimeout(this._fontIdxTimeout)
    clearTimeout(this._tFontIdxTimeout)
    this._lineIndex = -1
    this._fontIdx = -1
    this._tFontIdx = -1

    this.animations.lyric.forEach((an) => an.animation.cancel())
    this.animations.translation.forEach((an) => an.animation.cancel())

    this.animations = { lyric: [], translation: [] }
    this.lyricElements = []

    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild)
    }
  }

  handleLyricClick(event: any) {
    const target = event.target.closest('.line')
    if (!target) return

    const index = parseInt(target.dataset.index, 10)
    this.onLineClick(index)
  }

  onLineClick(index: number) {
    const line = this.lyricElements[index]
    eventBus.emit('updateSeek', line.start / 1000 - this._offset / 1000)
  }

  findIndex(lst: { start: number }[], time: number, index = 0) {
    for (let i = 0; i < lst.length; i++) {
      if (lst[i].start > time) return i - 1
    }
    return lst.length - 1
  }
}

let manager: LyricManager

export const initLyric = (data: params) => {
  manager = new LyricManager(data)
}

export const setLyrics = (lyrics: lyrics, startTime: number) => {
  if (!manager) return
  manager._startTime = startTime
  manager.createLyricsDom(lyrics)
}

export const updatePlayStatus = (playing: boolean) => {
  manager._playing = playing
  if (playing) {
    manager.lyricElements.forEach((line) => (line.dom.classList.remove('active')))
    manager.refresh()
  } else {
    manager.pause()
  }
}

export const updateStartTime = (startTime: number) => {
  clearTimeout(manager._lineIdxTimeout)
  clearTimeout(manager._fontIdxTimeout)
  clearTimeout(manager._tFontIdxTimeout)
  manager._startTime = startTime
  manager.animations.lyric.forEach((an) => {
    an.animation.cancel()
    an.animation.currentTime = 0
  })
  manager.animations.translation.forEach((an) => {
    an.animation.cancel()
    an.animation.currentTime = 0
  })
  manager.lyricElements.forEach((line) => (line.dom.classList.remove('active')))
  manager.refresh()
}

export const destroyController = () => {
  manager.clearLyrics()
}

export const updateOffset = (offset: number) => {
  clearTimeout(manager._lineIdxTimeout)
  clearTimeout(manager._fontIdxTimeout)
  clearTimeout(manager._tFontIdxTimeout)
  manager._offset = offset * 1000
  manager.animations.lyric.forEach((an) => {
    an.animation.cancel()
    an.animation.currentTime = 0
  })
  manager.animations.translation.forEach((an) => {
    an.animation.cancel()
    an.animation.currentTime = 0
  })
  manager.lyricElements.forEach((line) => (line.dom.classList.remove('active')))
  manager.refresh()
}
