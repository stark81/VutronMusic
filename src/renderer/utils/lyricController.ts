import { nextTick } from 'vue'
import eventBus from './eventBus'

type TranslationMode = 'none' | 'tlyric' | 'rlyric'

interface word {
  start: number
  end: number
  word: string
}

interface lyrics {
  lyric: { start: number; end: number; content: string; contentInfo?: word[] }[]
  tlyric: { start: number; content: string }[]
  rlyric: { start: number; content: string }[]
}

interface params {
  container: HTMLElement
  playing: boolean
  mode: TranslationMode
  wByw: boolean
  line: number
  fontIdx: number
  tFontIdx: number
  currentTime: number
  isMini?: boolean
  isOneLine?: boolean
  rate?: number
}

interface animation {
  dom: HTMLElement
  start: number
  end: number
  animation: Animation
  lineIdx: number
}
interface line {
  dom: HTMLElement
  start: number
  end: number
}

const createAnimation = (dom: HTMLElement, duration: number) => {
  const effect = new KeyframeEffect(
    dom,
    [{ backgroundSize: '0 100%' }, { backgroundSize: '100% 100%' }],
    {
      duration: Math.max(duration, 0),
      easing: 'linear',
      fill: 'forwards'
    }
  )
  return new Animation(effect, document.timeline)
}

export class LyricManager {
  container: HTMLElement
  lyricElements: line[] = []
  animations: { lyric: animation[]; translation: animation[] } = { lyric: [], translation: [] }
  lineAnimation: {
    lyric: { index: number; animation: Animation }[]
    translation: { index: number; animation: Animation }[]
  } = { lyric: [], translation: [] }

  playing: boolean
  mode: TranslationMode
  _wByW: boolean
  _hasWordByWord: boolean = false
  fontIdx: number
  tFontIdx: number
  lineIdx: number
  lastFontIdx: number = -1
  lastTFontIdx: number = -1
  currentTime: number // 毫秒
  lyrics: lyrics | null = null
  rate: number
  _behavior: 'smooth' | 'instant' = 'smooth'
  isMini: boolean = false
  isOneLine: boolean = false
  groupLyric: number[][] = []
  groupIndex: number = -1
  isWheeling: boolean = false
  scrollingTimer: any = null

  constructor(data: params) {
    this.container = data.container
    this.playing = data.playing
    this.mode = data.mode
    this._wByW = data.wByw
    this.lineIdx = data.line
    this.fontIdx = data.fontIdx
    this.tFontIdx = data.tFontIdx
    this.currentTime = data.currentTime
    this.isMini = data.isMini || false
    this.isOneLine = data.isOneLine || false
    this.rate = data.rate || 1
    this.container.addEventListener('click', this.handleLyricClick.bind(this))
    if (this.isMini) {
      window.addEventListener('resize', this.createLineAnimation.bind(this))
    }
  }

  _mergeLine(index: number) {
    if (!this.lyrics?.lyric[index]?.contentInfo) return
    const line = this.lyricElements[index]
    if (!line) return
    const map = ['.lyric-line', '.translation']
    map.forEach((selector) => {
      const lyricContainer = line.dom?.querySelector(selector) as HTMLElement
      if (lyricContainer) {
        const spans = lyricContainer.querySelectorAll('span')
        const text: string[] = []
        spans.forEach((span) => {
          text.push(span.textContent!)
        })
        lyricContainer.innerHTML = ''
        const span = document.createElement('span')
        span.textContent = text.join('')
        lyricContainer.appendChild(span)
      }
    })
  }

  _separateLine(index: number) {
    if (!this.lyrics?.lyric[index]?.contentInfo) return
    const line = this.lyricElements[index]
    if (!line) return
    const map = [
      ['.lyric-line', 'lyric'],
      ['.translation', 'translation']
    ] as [string, 'lyric' | 'translation'][]
    map.forEach(([selector, type]) => {
      const lyricContainer = line.dom?.querySelector(selector) as HTMLElement
      if (!lyricContainer) return
      const ans = this.animations[type]
        .filter((a) => a.lineIdx === index)
        .sort((a, b) => a.start - b.start)
      lyricContainer.innerHTML = ''
      ans.forEach((an) => lyricContainer.appendChild(an.dom))
    })
  }

  updateLineIndex(index: number) {
    index = Math.min(index, this.lyricElements.length - 1)
    if (this.lineIdx !== index) {
      this.lineIdx = index
    }

    this.lyricElements.forEach((line) => {
      line?.dom.classList.remove('active')
      if (index === -1 && !this.isWheeling) {
        this.lyricElements[0]?.dom.scrollIntoView({ block: 'center', behavior: this._behavior })
      } else if (Number(line?.dom.dataset.index!) < index) {
        line?.dom.classList.add('played')
      } else if (Number(line?.dom.dataset.index!) === index) {
        line?.dom.classList.remove('played')
        line?.dom.classList.add('active')
        if (this.isWheeling) return
        line?.dom.scrollIntoView({ block: 'center', behavior: this._behavior })
      } else {
        line?.dom.classList.remove('played')
      }
    })
  }

  updateFontIndex(type: 'lyric' | 'translation' = 'lyric', index: number, restart = false) {
    const prevIndex =
      type === 'lyric' ? (restart ? -1 : this.lastFontIdx) : restart ? -1 : this.lastTFontIdx

    if (type === 'lyric') {
      this.lastFontIdx = this.fontIdx
      this.fontIdx = index
    } else {
      this.lastTFontIdx = this.tFontIdx
      this.tFontIdx = index
    }

    if (!this.animations || !this.animations[type].length) return

    requestAnimationFrame(() => {
      const animations = this.animations[type]
      const start = Math.min(prevIndex, index) - 1
      const end = restart ? animations.length : Math.max(prevIndex, index) + 1

      for (let i = start; i < end + 1; i++) {
        const font = animations[i]
        if (font && i < index) {
          this.handleFontPlay(font, 0, true)
          if (font.dom.style.backgroundSize !== '100% 100%') {
            font.dom.style.backgroundSize = '100% 100%'
          }
        }

        if (font && i >= index) {
          if (font.dom.style.backgroundSize !== '0 100%') {
            font.dom.style.backgroundSize = '0 100%'
          }
          font.animation.cancel()
        }

        if (font && i === index) {
          const driftTime = Math.max(this.currentTime - font.start, 0)
          font.animation.currentTime = index < prevIndex ? 0 : driftTime
          if (this.playing) {
            font.animation.play()
          }
        }
      }
    })
  }

  updateAniPlaybackRate(rate: number) {
    this.animations.lyric.forEach((an) => {
      an.animation.playbackRate = rate
    })
    this.animations.translation.forEach((an) => {
      an.animation.playbackRate = rate
    })
  }

  updateMode(data: {
    mode: TranslationMode
    line: number
    fontIndex: number
    tFontIndex: number
    currentTime: number
  }) {
    this.mode = data.mode
    this.currentTime = data.currentTime
    this.lastFontIdx = -1
    this.lastTFontIdx = -1
    this.lineIdx = data.line
    this.fontIdx = data.fontIndex
    this.tFontIdx = data.tFontIndex

    this._behavior = 'instant'
    this.clearLyrics()
    this.groupLyric = []
    this.buildLyricElements(this.lyrics!)
    if (this.isMini) {
      let idx = manager.groupLyric.findIndex((g) => g.includes(this.lineIdx))
      idx = Math.max(0, idx)
      this.createLyricsDom(idx)
    } else {
      this.createLyricsDom()
    }
    nextTick(() => {
      this._behavior = 'smooth'
    })
  }

  handleFontPlay(font: animation, curTime: number, toFinish: boolean) {
    if (!font) return
    if (font.animation.playState === 'finished') {
      return
    }

    if (toFinish) {
      if (font.dom.style.backgroundSize !== '100% 100%') {
        font.dom.style.backgroundSize = '100% 100%'
      }
      font.animation.finish()
    } else {
      if (font.dom.style.backgroundSize !== '100% 100%') {
        font.dom.style.backgroundSize = '100% 100%'
      }
      font.animation.currentTime = curTime
      if (font.animation.playState !== 'running') {
        font.animation.play()
      }
    }
  }

  buildLyricElements(lyrics: lyrics) {
    this.lyrics = lyrics

    const lyricFiltered = lyrics.lyric.filter(({ content }) => Boolean(content))
    if (!lyricFiltered.length) return
    let fontIndex = 0
    this.lineIdx = Math.min(this.lineIdx, lyricFiltered.length - 1)

    this.lyricElements = lyricFiltered.map((l, index) => {
      const element = document.createElement('div')
      element.classList.add('line')
      element.classList.add(l.contentInfo && this._wByW ? 'word-mode' : 'line-mode')
      element.classList.add(this.isMini ? 'mini' : 'normal')
      element.dataset.index = index.toString()
      const start = l.start * 1000
      const end = l.end * 1000

      const lyricLine = document.createElement('div')
      lyricLine.classList.add('lyric-line')

      if (l.contentInfo && this._wByW) {
        if (!this._hasWordByWord) this._hasWordByWord = true
        l.contentInfo.forEach((w) => {
          const span = document.createElement('span')
          span.dataset.index = fontIndex.toString()
          span.textContent = w.word
          span.style.backgroundSize = '0 100%'

          lyricLine.appendChild(span)
          fontIndex++

          const animation = createAnimation(span, w.end - w.start)
          animation.playbackRate = this.rate
          this.animations.lyric.push({
            dom: span,
            animation,
            lineIdx: index,
            start: w.start,
            end: w.end
          })
        })
        element.appendChild(lyricLine)

        if (this.mode === 'none') {
          return { dom: element, index, start, end }
        }

        const sameLyric = lyrics[this.mode].find((t) => t.start === l.start)
        if (sameLyric) {
          const translation = document.createElement('div')
          translation.classList.add('translation')
          const words = sameLyric.content.split(this.mode === 'tlyric' ? '' : ' ')
          const interval = (end - start) / words.length
          words.forEach((w, idx) => {
            const span = document.createElement('span')
            span.textContent = this.mode === 'tlyric' ? w : `${w || ' '} `
            span.style.backgroundSize = '0 100%'
            translation.appendChild(span)

            const animation = createAnimation(span, interval)
            animation.playbackRate = this.rate
            this.animations.translation.push({
              dom: span,
              animation,
              lineIdx: index,
              start: start + interval * idx,
              end: start + interval * idx + interval
            })
          })
          element.append(translation)
        }
        return { dom: element, index, start, end }
      } else {
        const span = document.createElement('span')
        span.textContent = l.content
        lyricLine.appendChild(span)
        element.appendChild(lyricLine)

        if (this.mode === 'none') {
          return { dom: element, index, start, end }
        }

        const sameLyric = lyrics[this.mode].find((t) => t.start === l.start)
        if (sameLyric) {
          const translation = document.createElement('div')
          translation.classList.add('translation')

          const span = document.createElement('span')
          span.textContent = sameLyric.content
          translation.appendChild(span)
          element.appendChild(translation)
        }
        return { dom: element, index, start, end }
      }
    })

    if (this.isMini) {
      this.buildMiniMode()
    } else {
      this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: true })
    }
  }

  buildMiniMode() {
    if (!this.isMini) return
    let idx = 0
    while (idx < this.lyricElements.length) {
      const line = this.lyricElements[idx]
      const hasTranslation = line.dom.querySelector('.translation') !== null
      if (hasTranslation) {
        this.groupLyric.push([idx])
        idx++
      } else if (this.isOneLine) {
        this.groupLyric.push([idx])
        idx++
      } else {
        if (
          idx + 1 < this.lyricElements.length &&
          this.lyricElements[idx + 1].dom.querySelector('.translation') === null
        ) {
          this.groupLyric.push([idx, idx + 1])
          idx += 2
        } else {
          this.groupLyric.push([Number(line.dom.dataset.index!)])
          idx++
        }
      }
    }
  }

  createLineAnimation() {
    if (!this.isMini) return
    let index = this.groupLyric.findIndex((items) => items.includes(this.lineIdx))
    index = index === -1 ? 0 : index
    const ids = this.groupLyric[index]

    ids.forEach((idx) => {
      const line = this.lyricElements[idx]
      const container = line.dom

      const lyricContainer = container?.querySelector('.lyric-line') as HTMLElement
      if (lyricContainer) {
        const containerWidth = container.offsetWidth
        const scrollWidth = Math.max(0, lyricContainer.scrollWidth - containerWidth)
        // 说明需要进行滚动，此时需要考虑逐字歌词和非逐字歌词的情况
        if (scrollWidth > 0) {
          if (this._hasWordByWord) {
            const spans = lyricContainer?.querySelectorAll('span')!
            const keyframes = [{ transform: `translateX(0)`, offset: 0 }]

            for (let i = 0; i < spans.length; i++) {
              const span = spans[i]
              const offsetLeft = span.offsetLeft

              const id = span.getAttribute('data-index')
              const an = this.animations.lyric.find(
                (item) => item.dom.getAttribute('data-index') === id
              )!

              if (offsetLeft - containerWidth / 2 >= scrollWidth) {
                const offset = (an.start - line.start) / (line.end - line.start)
                keyframes.push({
                  transform: `translateX(${-scrollWidth}px)`,
                  offset
                })
                break
              } else if (offsetLeft >= containerWidth / 2) {
                const sWidth = Math.min(offsetLeft - containerWidth / 2, scrollWidth)
                const offset = (an.start - line.start) / (line.end - line.start)
                keyframes.push({
                  transform: `translateX(${-sWidth}px)`,
                  offset
                })
              }
            }
            keyframes.push({
              transform: `translateX(${-scrollWidth}px)`,
              offset: 1
            })
            const effect = new KeyframeEffect(lyricContainer, keyframes, {
              duration: line.end - line.start,
              easing: 'linear',
              fill: 'forwards'
            })
            const animation = new Animation(effect, document.timeline)
            const item = this.lineAnimation.lyric.find((i) => i.index === idx)
            if (item) {
              item.animation.cancel()
              item.animation = animation
            } else {
              this.lineAnimation.lyric.push({ index: idx, animation })
            }
          } else {
            const duration = line.end - line.start
            const percent1 = containerWidth / 2 / lyricContainer.scrollWidth
            const percent2 = scrollWidth / lyricContainer.scrollWidth
            const keyframes = [
              { transform: `translateX(0)`, offset: 0 },
              { transform: `translateX(0)`, offset: percent1 },
              { transform: `translateX(${-scrollWidth}px)`, offset: percent1 + percent2 },
              { transform: `translateX(${-scrollWidth}px)`, offset: 1 }
            ]
            const effect = new KeyframeEffect(lyricContainer, keyframes, {
              duration,
              easing: 'linear',
              fill: 'forwards'
            })
            const animation = new Animation(effect, document.timeline)
            const item = this.lineAnimation.lyric.find((i) => i.index === idx)
            if (item) {
              item.animation.cancel()
              item.animation = animation
            } else {
              this.lineAnimation.lyric.push({ index: idx, animation })
            }
          }
        }
      }
    })

    const an = this.lineAnimation.lyric.find((i) => i.index === this.lineIdx)
    if (!an) return
    const line = this.lyricElements[this.lineIdx]
    const currentTime = this.currentTime - line.start
    an.animation.currentTime = currentTime
    if (this.playing) {
      an.animation.play()
    }
  }

  playLineAnimation(index: number) {
    if (!this.playing) return
    this.lineAnimation.lyric.forEach((item) => {
      if (item.index === index) {
        item.animation.play()
      } else {
        item.animation.pause()
      }
    })
  }

  createLyricsDom(index: number = -1) {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild)
    }
    const fragment = document.createDocumentFragment()

    if (index === -1) {
      this.lyricElements.map((l) => fragment.append(l?.dom))
    } else {
      const ids = this.groupLyric[index]
      ids?.forEach((id) => {
        const line = this.lyricElements[id]
        const dom = line?.dom
        dom.classList.add(ids.length === 1 ? 'one-line' : 'two-line')
        fragment.append(dom)
      })
    }

    this.container.appendChild(fragment)
    nextTick(() => {
      this.updateLineIndex(this.lineIdx)
      this.updateFontIndex('lyric', this.fontIdx, true)
      this.updateFontIndex('translation', this.tFontIdx, true)
      if (this.isMini) {
        this.createLineAnimation()
      }
    })
  }

  play() {
    if (!this.isMini) {
      this.lyricElements[this.lineIdx]?.dom.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    this.animations.lyric[this.fontIdx]?.animation.play()
    this.animations.translation[this.tFontIdx]?.animation.play()
    this.playLineAnimation(this.lineIdx)
  }

  pause() {
    this.animations.lyric[this.fontIdx]?.animation.pause()
    this.animations.translation[this.tFontIdx]?.animation.pause()
    this.lineAnimation.lyric.forEach((an) => an.animation.pause())
    this.lineAnimation.translation.forEach((an) => an.animation.pause())
  }

  clearLyrics(clearDom = true) {
    clearTimeout(this.scrollingTimer)
    this.container.removeEventListener('wheel', this.handleWheel)

    if (clearDom) {
      this.animations.lyric.forEach((an) => an.animation.finish())
      this.animations.translation.forEach((an) => an.animation.finish())
      this.lineAnimation.lyric.forEach(({ animation }) => {
        animation.finish()
      })
      this.lineAnimation.translation.forEach(({ animation }) => {
        animation.finish()
      })
    }

    this.animations = { lyric: [], translation: [] }
    this.lyricElements = []
    this.lineAnimation.lyric = []
    this.lineAnimation.translation = []

    if (!clearDom) return
    while (this.container.firstChild) {
      ;(this.container.firstChild as HTMLElement).innerHTML = ''
      this.container.removeChild(this.container.firstChild)
    }
    this.container.innerHTML = ''
  }

  handleWheel() {
    clearTimeout(this.scrollingTimer)
    const line = this.lyricElements[this.lineIdx]
    if (!line || !this.playing) return

    if (!this.isWheeling) this.isWheeling = true
    this.scrollingTimer = setTimeout(
      () => {
        this.isWheeling = false
        clearTimeout(this.scrollingTimer)
        const line = this.lyricElements[this.lineIdx]
        if (!line || !this.playing) return
        line.dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
      },
      Math.min(1000, (line.end - line.start) * 0.4)
    )
  }

  handleLyricClick(event: any) {
    const target = event.target.closest('.line')
    if (!target) return

    const index = parseInt(target.dataset.index, 10)
    this.onLineClick(index)
  }

  onLineClick(index: number) {
    const line = this.lyricElements[index]
    eventBus.emit('updateSeek', line.start / 1000)
  }
}

let manager: LyricManager

export const initLyric = (data: params) => {
  manager = new LyricManager(data)
}

export const setLyrics = (lyrics: lyrics) => {
  manager.groupLyric = []
  manager.groupIndex = -1
  manager?.clearLyrics()
  manager?.buildLyricElements(lyrics)
  if (manager?.isMini) {
    manager?.createLyricsDom(0)
    manager.groupIndex = 0
  } else {
    manager?.createLyricsDom()
  }
}

export const updatePlayStatus = (playing: boolean) => {
  manager.playing = playing
  if (playing) {
    manager.play()
  } else {
    manager.pause()
  }
}

export const updateLineIndex = (index: number) => {
  manager?.updateLineIndex(index)
  if (manager?.isMini) {
    let idx = manager.groupLyric.findIndex((g) => g.includes(index))
    idx = Math.max(0, idx)
    if (manager.groupIndex !== idx) {
      manager.groupIndex = idx
      manager?.createLyricsDom(idx)
    }
    manager?.playLineAnimation(index)
  }
}

export const updateFontIndex = (index: number, restart = false) => {
  if (!manager) return
  manager.updateFontIndex('lyric', index, restart)
}

export const updateTFontIndex = (index: number, restart = false) => {
  manager?.updateFontIndex('translation', index, restart)
}

export const updateMode = (data: {
  mode: TranslationMode
  currentTime: number
  line: number
  fontIndex: number
  tFontIndex: number
}) => {
  manager?.updateMode(data)
}

export const destroyController = () => {
  manager?.clearLyrics(false)
}

export const updateLineMode = (isOneLine: boolean) => {
  if (!manager) return
  manager.isOneLine = isOneLine
  manager.lastFontIdx = -1
  manager.lastTFontIdx = -1
  setLyrics(manager.lyrics!)
  updateLineIndex(manager.lineIdx)
  updateFontIndex(manager.fontIdx, true)
  updateTFontIndex(manager.tFontIdx)
}

export const updateWordByWord = (wByw: boolean) => {
  if (!manager) return
  manager._wByW = wByw
  manager?.clearLyrics()
  manager?.buildLyricElements(manager.lyrics || { lyric: [], tlyric: [], rlyric: [] })
  if (manager?.isMini) {
    manager?.createLyricsDom(manager.groupIndex)
  } else {
    manager?.createLyricsDom()
  }
}

export const updateRate = (rate: number) => {
  if (!manager) return
  manager.rate = rate
  manager.updateAniPlaybackRate(rate)
}
