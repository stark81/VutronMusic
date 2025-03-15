export const createAnimation = (dom: HTMLElement, duration: number) => {
  const effect = new KeyframeEffect(
    dom,
    [{ backgroundSize: '0 100%' }, { backgroundSize: '100% 100%' }],
    { duration, easing: 'linear' }
  )
  return new Animation(effect, document.timeline)
}

export class LyricPlayer {
  lyrics: any[]
  currentTime: number
  _performanceTime: number = 0
  currentLyricIndex: number
  playing: boolean
  dom: HTMLDivElement = document.createElement('div')
  mode: 'line-mode' | 'word-mode'
  type: 'lyric' | 'desktopLyric'
  fonts: { word: Record<string, any>[]; tWord: Record<string, any>[] } = { word: [], tWord: [] }
  curFontNum: number

  constructor(data: Record<string, any>) {
    this.lyrics = data.lyrics
    this.currentTime = data.currentTime * 1000
    this.currentLyricIndex = data.currentLyricIndex
    this.playing = data.playing
    this.curFontNum = 0
    this.mode = data.mode as 'line-mode' | 'word-mode'
    this.type = data.type as 'lyric' | 'desktopLyric'
    this.buildHTML()
    this.updateCurrentLyricIndex(this.currentLyricIndex)
  }

  setLyric(lyrics: any[]) {
    this.lyrics = lyrics
    this.buildHTML()
  }

  buildHTML() {
    this.dom.textContent = ''
    this.lyrics.forEach((lyric) => {
      const lineContent = document.createElement('div')
      // @ts-ignore
      lineContent.time = lyric.startTime
      lineContent.id = `line${lyric.index}`
      lineContent.className = 'line-content'
      lineContent.classList.add(this.mode)

      const line = document.createElement('div')
      line.style = 'position: relative; display: inline-block;'
      line.className = 'line'
      lineContent.appendChild(line)

      const lrcContent = document.createElement('div')
      lrcContent.className = 'font-content'
      lyric.words.forEach((w: any) => {
        const wordElement = document.createElement('span')
        wordElement.className = 'word'
        wordElement.textContent = w.word
        const animation = createAnimation(wordElement, w.endTime - w.startTime)
        this.fonts.word.push({
          dom: wordElement,
          animation,
          startTime: w.startTime,
          endTime: w.endTime
        })
        lrcContent.appendChild(wordElement)
      })
      line.appendChild(lrcContent)

      if (lyric.translation) {
        const translation = document.createElement('div')
        translation.style = 'position: relative; display: inline-block;'
        translation.className = 'translation'
        lyric.translation.forEach((t: any) => {
          const wordElement = document.createElement('span')
          wordElement.className = 'word'
          wordElement.textContent = t.word
          translation.appendChild(wordElement)
        })
        lineContent.appendChild(document.createElement('br'))
        lineContent.appendChild(translation)
      }
      this.dom.appendChild(lineContent)
    })
  }

  updateCurrentLyricIndex(index: number) {
    this.currentLyricIndex = index
    this.dom.querySelectorAll('.line-content').forEach((lineContent, i) => {
      if (i === index) {
        lineContent.classList.add('active')
      } else {
        lineContent.classList.remove('active')
      }
    })
  }

  findcurFontNum(type: 'word' | 'tWord', curTime: number, startIndex = 0) {
    const length = this.fonts[type].length
    for (let index = startIndex; index < length; index++) {
      if (curTime < this.fonts[type][index].startTime) return Math.max(0, index - 1)
    }
    return length - 1
  }

  _handlePlayFont(font: any, curTime: number, toFinish: boolean) {
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
          font.animation.currentTime = curTime
          font.animation.play()
        }
        break
    }
  }

  _refresh() {
    this.curFontNum++
    const curFont = this.fonts.word[this.curFontNum]
    const currentTime = performance.now() - this._performanceTime + this.currentTime

    const driftTime = currentTime - curFont.startTime

    if (driftTime > 0 || this.curFontNum === 0) {
      const nextFont = this.fonts.word[this.curFontNum + 1]
      const delay = nextFont.startTime - curFont.startTime - driftTime
      if (delay > 0) {
        if (this.playing) {
          setTimeout(() => {
            if (!this.playing) return
            this._refresh()
          }, delay)
        }
        this._handlePlayFont(curFont, this.currentTime - curFont.startTime, false)
        return
      } else {
        const newCurLineNum = this.findcurFontNum('word', currentTime, this.curFontNum + 1)
        // console.log(newCurLineNum)
        if (newCurLineNum > this.curFontNum) this.curFontNum = newCurLineNum - 1
        for (let i = 0; i <= this.curFontNum; i++) this._handlePlayFont(this.fonts.word[i], 0, true)
        this._refresh()
        return
      }
    } else if (this.curFontNum === 0) {
      this.curFontNum--
      if (this.playing) {
        setTimeout(() => {
          if (!this.playing) return
          this._refresh()
        }, -driftTime)
        return
      }
    }

    this.curFontNum = this.findcurFontNum('word', currentTime, this.curFontNum) - 1
    for (let i = 0; i <= this.curFontNum; i++) this._handlePlayFont(this.fonts.word[i], 0, true)
    this._refresh()
  }

  play(curTime: number) {
    this._performanceTime = performance.now()
    this.currentTime = curTime * 1000
    if (!this.fonts.word.length) return
    this.playing = true
    this.curFontNum = this.findcurFontNum('word', this.currentTime)

    for (let i = this.curFontNum; i > -1; i--) {
      this._handlePlayFont(this.fonts.word[i], 0, true)
    }

    for (let i = this.curFontNum + 1; i < this.fonts.word.length; i++) {
      const font = this.fonts.word[i]
      font.animation.cancel()
      font.dom.style.backgroundSize = '0 100%'
    }
    this.curFontNum--
    this._refresh()
  }

  pause() {
    if (!this.playing) return
    this.playing = false
  }

  getHTMLElement() {
    return this.dom
  }
}

let lrc: LyricPlayer | null = null

export const initPlayer = (data: Record<string, any>) => {
  lrc = new LyricPlayer(data)
  return lrc.getHTMLElement()
}

export const updateLyric = (lyrics: any[], mode: 'word-mode' | 'line-mode') => {
  if (lrc) lrc.mode = mode
  lrc?.setLyric(lyrics)
}

export const updateLyricIndex = (index: number) => {
  lrc!.updateCurrentLyricIndex(index)
}

export const lyricPlay = (curTime: number) => {
  lrc?.play(curTime)
}
