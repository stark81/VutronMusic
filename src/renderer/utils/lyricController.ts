import { TranslationMode } from "../store/settings"

interface word { start: number, end: number, word: string }

interface lyrics {
  lyric: { time: number, end: number, content: string, contentInfo?: word[] }[]
  tlyric: { time: number, content: string }[]
  rlyric: { time: number, content: string }[]
}

interface params { container: HTMLElement, playing: boolean, startStamp: number, mode: TranslationMode, wByw: boolean, offset?: number }

export class LyricManager {
  container: HTMLElement
  currentAnimations: Set<Animation>
  lyricElements: any
  _playing: boolean
  _startTime: number
  _offset: number
  _mode: TranslationMode
  _wByW: boolean

  constructor(data: params) {
    this.container = data.container
    this._playing = data.playing
    this._startTime = data.startStamp
    this._offset = data.offset ?? 0
    this._mode = data.mode
    this._wByW = data.wByw
    this.currentAnimations = new Set()
    this.container.addEventListener('click', this.handleLyricClick.bind(this))
  }

  // 创建歌词 DOM 结构（使用文档片段优化批量插入
  createLyricsDom(lyrics: lyrics) {
    this.clearLyrics()
    const lyricFiltered = lyrics.lyric.filter(({ content }) => Boolean(content))
    if (!lyricFiltered.length) return

    const fragment = document.createDocumentFragment()

    lyricFiltered.forEach((l, index) => {
      const element = document.createElement('div')
      element.classList.add('line')
      element.classList.add(l.contentInfo ? 'word-mode' : 'line-mode')
      element.dataset.index = index.toString()

      // 创建歌词行
      const lyricLine = document.createElement('div')
      lyricLine.classList.add('lyric-line')

      // 创建翻译行
      let translation: HTMLDivElement | null = null

      // console.log('==1==', l.contentInfo)
      if (l.contentInfo && this._wByW) {
        l.contentInfo.forEach((w) => {
          const span = document.createElement('span')
          span.textContent = w.word
          lyricLine.appendChild(span)
        })
      } else {
        const span = document.createElement('span')
        span.textContent = l.content
        lyricLine.appendChild(span)
      }

      element.appendChild(lyricLine)
      const sameTlyric = lyrics.tlyric.find((t) => t.time === l.time)
        if (this._mode === 'tlyric' && sameTlyric) {
          translation = document.createElement('div')
          translation.classList.add('traslation')

          const span = document.createElement('span')
          span.textContent = sameTlyric.content
          translation!.appendChild(span)
        }
      if (translation) element.appendChild(translation)
      return fragment.appendChild(element)
    })

    this.container.appendChild(fragment)
  }

  // 更新播放进度（示例逻辑）
  updatePlayback(time) {
    const activeIndex = this.findActiveLineIndex(time)
    this.highlightActiveLine(activeIndex)
  }

  // 清除所有歌词元素和动画
  clearLyrics() {
    // 取消所有进行中的动画
    this.currentAnimations.forEach(animation => animation.cancel())
    this.currentAnimations.clear()

    // 高效清空容器
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild)
    }

    // 解除可能的内存引用
    this.lyricElements = null
  }

  // 事件处理（委托模式）
  handleLyricClick(event) {
    const target = event.target.closest('.line')
    if (!target) return

    const index = parseInt(target.dataset.index, 10)
    this.onLineClick(index)
  }

  // 高亮当前播放行（使用 Web Animations API 实现高性能动画）
  highlightActiveLine(index) {
    if (!this.lyricElements) return

    // 移除旧的高亮
    this.currentAnimations.forEach(animation => animation.cancel())
    this.currentAnimations.clear()

    // 应用新动画
    const element = this.lyricElements[index]
    if (element) {
      const animation = element.animate([
        { opacity: 0.5, transform: 'scale(1)' },
        { opacity: 1, transform: 'scale(1.1)' }
      ], {
        duration: 500,
        fill: 'forwards'
      })
      this.currentAnimations.add(animation)
    }
  }

  // 示例回调
  onLineClick(index) {
    console.log('Line clicked:', index)
    // 实现跳转逻辑
  }

  // 辅助方法：根据时间查找对应歌词行
  findActiveLineIndex(time) {
    // 需要实现具体查找逻辑
    return Math.floor(time / 5)
  }
}

// 使用示例
let manager: LyricManager

export const initLyric = (data: params) => {
  manager = new LyricManager(data)
}

export const setLyrics = (lyrics: any) => {
  if (!manager) return
  manager.createLyricsDom(lyrics)
}
