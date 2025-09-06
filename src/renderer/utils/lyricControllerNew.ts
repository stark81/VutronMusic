type TranslationMode = 'none' | 'tlyric' | 'rlyric'

interface word {
  start: number
  end: number
  word: string
}

interface lyrics {
  lyric: { start: number; end: number; content: string; contentInfo?: word[] }[]
  tlyric: { start: number; end: number; content: string }[]
  rlyric: { start: number; end: number; content: string }[]
}

interface params {
  container: HTMLElement
  playing: boolean
  mode: TranslationMode
  wByw: boolean
  line: number
  progress: number
  isMini?: boolean
  isOneLine?: boolean
  rate?: number
}

interface animation {
  dom: HTMLElement
  start: number
  end: number
  animation: Animation
}
interface line {
  dom: HTMLElement
  start: number
  end: number
}

export const createAnimation = (dom: HTMLElement, duration: number) => {
  const effect = new KeyframeEffect(dom, [{ width: '0%' }, { width: '100%' }], {
    duration: Math.max(duration, 0),
    easing: 'linear',
    fill: 'forwards'
  })
  return new Animation(effect, document.timeline)
}

class LyricManager {
  container: HTMLElement
  lyricElements: line[] = []
  animations: { lyric: animation[]; translation: animation[] } = { lyric: [], translation: [] }
  lineAnimation: {
    lyric: { index: number; animation: Animation }[]
    translation: { index: number; animation: Animation }[]
  } = { lyric: [], translation: [] }

  playing: boolean = false
  mode: TranslationMode = 'tlyric'
  _wByW: boolean = true
  fontIdx: number = 0
  tFontIdx: number = 0
  lineIdx: number = -1
  progress: number = 0
  lyrics: lyrics | null = null
  rate: number = 1
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
    this.progress = data.progress
    this.isMini = data.isMini || false
    this.isOneLine = data.isOneLine || false
    this.rate = data.rate || 1
  }

  clearLyrics() {}

  /**
   * 此次的改动是：全部按照逐行歌词的模式来创建dom，且不创建animation，
   * 等真正播放到这一行时再决定是否拆分成逐字的dom，并创建对应的animation；
   */
  buildLyricElements(originLyric: lyrics) {
    this.lyrics = {
      lyric: originLyric.lyric.map((l) => {
        const contentInfo = l.contentInfo?.filter((c) => c.word)
        return { start: l.start, end: l.end, content: l.content, contentInfo }
      }),
      rlyric: originLyric.rlyric,
      tlyric: originLyric.tlyric
    }

    const lyricFiltered = originLyric.lyric.filter(({ content }) => Boolean(content))
    if (!lyricFiltered.length) return

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

      const divBase = document.createElement('div')
      divBase.classList.add('div-base')
      divBase.textContent = l.content

      lyricLine.appendChild(divBase)
      element.appendChild(lyricLine)

      if (this.mode === 'none') return { dom: element, start, end }

      const modeMap = { tlyric: 'tlyric', rlyric: 'rlyric' } as const
      const mode = modeMap[this.mode as 'tlyric' | 'rlyric']
      const sameLyric = originLyric[mode].find((t) => t.start === l.start)
      if (sameLyric) {
        const translation = document.createElement('div')
        translation.classList.add('translation')

        const divBase = document.createElement('div')
        divBase.classList.add('div-base')
        divBase.textContent = sameLyric.content
        translation.appendChild(divBase)
        element.appendChild(translation)
      }
      return { dom: element, start, end }
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

  handleWheel() {
    clearTimeout(this.scrollingTimer)
    if (!this.isWheeling) this.isWheeling = true
    const line = this.lyricElements[this.lineIdx]
    if (!line || !this.playing) return

    this.scrollingTimer = setTimeout(
      () => {
        this.isWheeling = false
        clearTimeout(this.scrollingTimer)
        const line = this.lyricElements[this.lineIdx]
        if (!line || !this.playing) return
        line.dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
      },
      Math.min(1500, (line.end - line.start) * 0.4)
    )
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
    this.updateLineIndex(this.lineIdx, this.progress)
  }

  /**
   * 将指定index的行进行rebuild：
   * - 对于普通模式以及逐字模式的歌词，则检验其是否进行了换行：
   *   - 如果没有创建一个覆盖一行的animation；
   *   - 如果换行了，则拆分成单个字的span，并为每个字创建animation；
   * - 对于mini模式歌词，都只创建一个覆盖一行的animation；
   */
  updateLineIndex(index: number, progress: number) {
    if (this.lineIdx !== index) this._converseLine(this.lineIdx)
    this.lineIdx = index
    this.progress = progress

    // 开启了逐字歌词，且存在逐字歌词
    const lyricType: ('lyric' | 'tlyric' | 'rlyric')[] = ['lyric']
    if (this.mode === 'tlyric') {
      lyricType.push('tlyric')
    } else if (this.mode === 'rlyric') {
      lyricType.push('rlyric')
    }
    if (this._wByW) {
      lyricType.forEach((type) => {
        this._buildActiveLine(this.lineIdx, type)
      })
    }
    // 在桌面歌词的mini模式下，由于不存在换行的情况，直接写成一行
    // 并添加歌词左右滚动动画
    else if (this.isMini) {
      //
    }

    if (this.playing) this.play()
  }

  _converseLine(index: number) {
    const line = this.lyricElements[index]
    if (!line) return

    const parents = ['.lyric-line', '.translation']

    parents.forEach((cls) => {
      const lyricContainer = line.dom.querySelector(cls) as HTMLElement
      if (!lyricContainer) return
      const spans = Array.from(lyricContainer.querySelectorAll('.span-progress')) as HTMLElement[]
      const text = spans.map((span) => span.textContent).join('')
      while (lyricContainer.firstChild) {
        lyricContainer.removeChild(lyricContainer.firstChild)
      }
      const divBase = document.createElement('div')
      divBase.classList.add('div-base')
      divBase.textContent = text
      lyricContainer.appendChild(divBase)
    })

    this.animations.lyric = []
    this.animations.translation = []
  }

  play() {
    const type = ['lyric', 'translation'] as const
    type.forEach((t) => {
      this._play(t)
    })
  }

  _play(type: 'lyric' | 'translation') {
    const map = { lyric: 'fontIdx', translation: 'tFontIdx' }
    const ans = this.animations[type]
    if (this[map[type]] >= ans.length) {
      this[map[type]] = 0
      return
    }

    const line = ans[this[map[type]]]
    if (!line) return

    line.dom.style.width = '100%'
    line.animation.play()
    line.animation.finished.then(() => {
      this[map[type]]++
      this._play(type)
    })
  }

  _buildActiveLine(index: number, type: 'lyric' | 'tlyric' | 'rlyric') {
    const map = { lyric: '.lyric-line', tlyric: '.translation', rlyric: '.translation' }
    const line = this.lyricElements[index]

    const currentLyric = this.lyrics?.lyric[index]
    if (!currentLyric) return

    const contentInfo = currentLyric.contentInfo
    const start = currentLyric.start * 1000
    const end = currentLyric.end * 1000

    line.dom.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const lyricContainer = line.dom.querySelector(map[type]) as HTMLElement
    if (!contentInfo || !lyricContainer) return
    const element = lyricContainer.querySelector('.div-base') as HTMLElement

    const ws = element.textContent?.split(type === 'tlyric' ? '' : ' ') || []
    const interval = Math.floor((Math.min(end, contentInfo.at(-1)?.end || 0) - start) / ws.length)
    let words = ws.map((w, index) => {
      const word = type === 'tlyric' ? w : `${w} `
      const s = start + index * interval
      const e = s + interval
      return { word, start: s, end: e }
    })

    if (type === 'lyric') words = contentInfo
    const idx = words.findIndex((w) => w.start <= this.progress && this.progress <= w.end)

    words.forEach((w, i) => {
      const spanContainer = document.createElement('div')
      spanContainer.classList.add('single-word')
      spanContainer.style.position = 'relative'

      const span = document.createElement('span')
      span.textContent = w.word
      spanContainer.appendChild(span)

      const spanAb = document.createElement('span')
      spanAb.textContent = w.word
      spanAb.classList.add('span-progress')
      spanContainer.appendChild(spanAb)
      element.parentNode?.appendChild(spanContainer)

      const duration = w.end - w.start
      const animation = createAnimation(spanAb, duration)
      if (i < idx) {
        spanAb.style.width = '100%'
        animation.currentTime = duration
        animation.finish()
      } else if (i > idx) {
        animation.currentTime = 0
      } else {
        // 这里添加fontIdx和tFontIdx设置
        const id = type === 'lyric' ? 'fontIdx' : 'tFontIdx'
        this[id] = idx
        spanAb.style.width = '100%'
        animation.currentTime = this.progress - w.start
      }

      this.animations[type === 'lyric' ? 'lyric' : 'translation'].push({
        dom: spanAb,
        animation,
        start: w.start,
        end: w.end
      })
    })

    element.parentNode?.removeChild(element)
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

export const updatePlayStatus = (playing: boolean) => {}

export const updateLineIndex = (index: number, progress: number) => {
  if (!manager) return
  manager.updateLineIndex(index, progress)
}

export const updateFontIndex = (index: number) => {}

export const updateTFontIndex = (index: number) => {}

export const updateMode = (data: {
  mode: TranslationMode
  progress: number
  line: number
  fontIndex: number
  tFontIndex: number
}) => {}

export const destroyController = () => {}

export const updateLineMode = (isOneLine: boolean) => {}

export const updateWordByWord = (wByw: boolean) => {}

export const updateRate = (rate: number) => {}
