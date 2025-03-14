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
  currentLyricIndex: number
  playing: boolean
  dom: HTMLDivElement = document.createElement('div')
  mode: 'line-mode' | 'word-mode'
  type: 'lyric' | 'desktopLyric'
  fonts: { word: Record<string, any>[]; tWord: Record<string, any>[] } = { word: [], tWord: [] }

  constructor(data: Record<string, any>) {
    this.lyrics = data.lyrics
    this.currentTime = data.currentTime * 1000
    this.currentLyricIndex = data.currentLyricIndex
    this.playing = data.playing
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

  play(curTime: number) {
    this.currentTime = curTime * 1000
    if (!this.fonts.word.length) return
    this.pause()
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

export const updateLyric = (lyrics: any[]) => {
  lrc?.setLyric(lyrics)
}

export const updateLyricIndex = (index: number) => {
  lrc!.updateCurrentLyricIndex(index)
}

export const lyricPlay = (curTime: number) => {
  lrc?.play(curTime)
}
