<template>
  <div
    v-show="!noLyric"
    class="lyric-container"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div v-show="hover" class="offset">
      <button-icon title="提前0.5s" @click="setOffset(0.5)">
        <svg-icon icon-class="back5s" />
      </button-icon>
      <button-icon class="recovery" :title="offset" @click="setOffset(0)">
        <svg-icon icon-class="recovery" />
      </button-icon>
      <button-icon title="后退0.5s" @click="setOffset(-0.5)">
        <svg-icon icon-class="forward5s" />
      </button-icon>
    </div>
    <div>
      <div id="line-1" class="line"></div>
      <div
        v-for="line in lyricWithTranslation"
        :id="`line${line.index}`"
        :key="line.index"
        class="line"
        :class="{
          'word-mode': haswByw,
          'line-mode': !haswByw,
          active: line.index === currentLyricIndex
        }"
        @click="seek = Number(line.start) / 1000 + (currentTrack?.offset || 0)"
      >
        <div v-if="line.lyric?.length" class="lyric-line">
          <span
            v-for="(lyric, idx) in line.lyric"
            :key="idx"
            ref="lyricLineSpan"
            :data-start="lyric.start"
            :data-end="lyric.end"
          >
            {{ lyric.word }}</span
          >
        </div>
        <div v-if="nTranslationMode === 'tlyric' && line.tlyric" class="traslation">
          <span
            v-for="(lyric, idx) in line.tlyric"
            :key="idx"
            >{{ lyric.word }}</span
          >
        </div>
        <div v-if="nTranslationMode === 'rlyric' && line.rlyric" class="traslation">
          <span
            v-for="(lyric, idx) in line.rlyric"
            :key="idx"
            >{{ lyric.word }}</span
          >
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, toRefs, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import eventBus from '../utils/eventBus'

const playerStore = usePlayerStore()
const { noLyric, currentTrack, lyrics, seek, playing, currentTrackDuration, lyricOffset } = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nFontSize, nTranslationMode, isNWordByWord } = toRefs(normalLyric.value)

interface word { start: number, end: number, word: string }
interface animation { index: number, start: number, end: number, dom: HTMLElement, animation: Animation }

const hover = ref(false)
const currentLyricIndex = ref(-1)
const _performance = ref(0)
const animations = ref<animation[]>([])
const curFontNum = ref(-1)
// const curTfontNum = ref(-1)
const lyricLineSpan = ref<HTMLElement[]>()
let timeoutId = null as any
let fontTimeoutId = null as any

const haswByw = computed(() => {
  let result = false
  for (const item of lyrics.value.lyric) {
    if (item.contentInfo) {
      result = true
      break
    }
  }
  return isNWordByWord.value && result
})

const lyricWithTranslation = computed(() => {
  const ret = [] as { index: number, start: number, end: number, lyric: word[], tlyric: word[], rlyric: word[] }[]
  const lyricFiltered = lyrics.value.lyric.filter(({ content }) => Boolean(content))
  if (lyricFiltered.length) {
    lyricFiltered.forEach((l, index) => {
      const lineItem = {
        index,
        start: l.time * 1000,
        end: (l.end ?? l.time) * 1000,
        lyric: null as any,
        tlyric: null as any,
        rlyric: null as any
      }
      let content: any[]
      if (haswByw.value) {
        content = l.contentInfo
        lineItem.lyric = content
        lineItem.start = Math.min(...(content.map((w) => w.start) as number[]))
        lineItem.end = Math.max(...(content.map((w) => w.end) as number[]))

        const sameTimeTLyric = lyrics.value.tlyric.find((t) => t.time === l.time)
        if (sameTimeTLyric) {
          const words = sameTimeTLyric.content.split('')
          const tContent = words.map((item: string, index: number) => {
            const interval = (l.end - l.time) / words.length
            return {
              word: item,
              start: Math.floor((l.time + interval * index) * 1000),
              end: Math.floor((l.time + interval * index + interval) * 1000)
            }
          })
          lineItem.tlyric = tContent
        }

        const sameTimeRLyric = lyrics.value.rlyric.find((t) => t.time === l.time)
        if (sameTimeRLyric) {
          const words = sameTimeRLyric.content.split('')
          const rContent = words.map((item: string, index: number) => {
            const interval = (l.end - l.time) / words.length
            return {
              word: item,
              start: Math.floor((l.time + interval * index) * 1000),
              end: Math.floor((l.time + interval * index + interval) * 1000)
            }
          })
          lineItem.rlyric = rContent
        }
        ret.push(lineItem)
      } else {
        lineItem.lyric = [{ start: l.time * 1000, end: l.time * 1000, word: l.content }]
        const sameTimeTLyric = lyrics.value.tlyric.find((t) => t.time === l.time)
        if (sameTimeTLyric) {
          lineItem.tlyric = [
            { start: l.time * 1000, end: l.time * 1000, word: sameTimeTLyric.content }
          ]
        }
        const sameTimeRLyric = lyrics.value.rlyric.find((t) => t.time === l.time)
        if (sameTimeRLyric) {
          lineItem.rlyric = [
            { start: l.time * 1000, end: l.time * 1000, word: sameTimeRLyric.content }
          ]
        }
        ret.push(lineItem)
      }
    })
    ret[ret.length - 1].end = haswByw.value ? ret[ret.length - 1].end : currentTrackDuration.value * 1000
  }
  return ret
})

const fontList = computed(() => {
  return haswByw.value && lyricWithTranslation.value.map((line) => line.lyric.flat()).flat()
})

const getCurrentLineIndex = () => {
  if (!lyricWithTranslation.value.length) return
  const line = _findCurIndex(lyricWithTranslation.value)
  currentLyricIndex.value = line
  if (currentLyricIndex.value < 0) {
    const driftTime = performance.now() - _performance.value - lyricWithTranslation.value[0].start
    if (playing.value) {
      timeoutId = setTimeout(() => {
        clearTimeout(timeoutId)
        if (!playing.value) return
        getCurrentLineIndex()
      }, -driftTime)
    }
    return
  }

  if (line < lyricWithTranslation.value.length) {
    const curLine = lyricWithTranslation.value[line]
    if (!curLine) return
    const driftTime = performance.now() - _performance.value - curLine.start

    const nextLine = lyricWithTranslation.value[line + 1]
    const delay = nextLine ? (nextLine.start - curLine.start - driftTime) : (currentTrackDuration.value * 1000 - curLine.start - driftTime)
    if (playing.value) {
      timeoutId = setTimeout(() => {
        clearTimeout(timeoutId)
        if (!playing.value) return
        getCurrentLineIndex()
      }, delay)
    }

  }
}

const _handlePlayFont = (font: animation[], index: number, curTime: number) => {
  const cur = font[index]
  cur.animation.cancel()
  cur.animation.currentTime = curTime - cur.start
  cur.dom.style.backgroundSize = '100% 100%'

  for (let i = index - 1; i > -1; i--) {
    font[i].animation.currentTime = font[i].end - font[i].start
    font[i].dom.style.backgroundSize = '100% 100%'
  }

  for (let i = index + 1; i < font.length; i++) {
    font[i].animation.cancel()
    font[i].animation.currentTime = 0
    font[i].dom.style.backgroundSize = '0 100%'
  }
}

const _refresh = () => {
  if (!playing.value || !animations.value) {
    clearTimeout(fontTimeoutId)
    return
  }
  curFontNum.value = _findCurIndex(fontList.value as word[])
  if (curFontNum.value === -1) {
    const driftTime = animations.value[0].start - - (performance.now() - _performance.value)
    fontTimeoutId = setTimeout(() => {
      clearTimeout(fontTimeoutId)
      if (!playing.value) return
      _refresh()
    }, driftTime)
    return
  }
  const animation = animations.value[curFontNum.value]
  const nextFont = animations.value[curFontNum.value + 1]

  if (nextFont) {
    const driftTime = (nextFont ? nextFont.start : animation.end) - (performance.now() - _performance.value)
    fontTimeoutId = setTimeout(() => {
      clearTimeout(fontTimeoutId)
      if (!playing.value) return
      _refresh()
    }, driftTime)
  }
  animation.dom.style.backgroundSize = '0 100%'
  animation.animation.play()
}

const playFontAnimate = () => {
  if (!fontList.value || !animations.value.length) return
  clearTimeout(fontTimeoutId)
  const currentTime = performance.now() - _performance.value
  curFontNum.value = _findCurIndex(fontList.value)

  if (curFontNum.value === -1) {
    const driftTime = performance.now() - _performance.value - fontList.value[0].start
    if (playing.value) {
      fontTimeoutId = setTimeout(() => {
        clearTimeout(fontTimeoutId)
        if (!playing.value) return
        playFontAnimate()
      }, -driftTime)
    }
    return
  }

  _handlePlayFont(animations.value, curFontNum.value, currentTime)
  _refresh()
}

const offset = computed(() => {
  const lrcOffset = currentTrack.value!.offset || 0
  if (lrcOffset === 0) {
    return '未调整'
  } else if (lrcOffset > 0) {
    return `提前${lrcOffset}s`
  } else {
    return `延后${Math.abs(lrcOffset)}s`
  }
})

const setOffset = (offset: number) => {
  if (!currentTrack.value!.offset) {
    currentTrack.value!.offset = 0
  }
  if (currentTrack.value!.type === 'local') {
    window.mainApi
      .invoke('updateLocalTrackInfo', currentTrack.value!.id, {
        offset: currentTrack.value!.offset + offset
      })
      .then((isSussess: boolean) => {
        if (!isSussess) showToast('歌词延迟信息未保存至数据库，下次启动程序后需要重置歌词延迟')
      })
  }
  if (offset === 0) {
    currentTrack.value!.offset = 0
  } else {
    currentTrack.value!.offset += offset
  }
  showToast(
    `当前歌曲的歌词延迟为: ${currentTrack.value!.offset > 0 ? '延迟' : '提前'}${Math.abs(currentTrack.value!.offset)}s`
  )
}

const createAnimation = () => {
  // 这里的lyricLineSpan.value在切歌时会出现乱序，所以需要进行排序
  const spans = lyricLineSpan.value?.slice().sort((a, b) => Number(a.dataset.start) - Number(b.dataset.start))!

  spans.forEach((span, index) => {
    const start = Number(span.dataset.start)
    const end = Number(span.dataset.end)
    const duration = end - start
    const effect = new KeyframeEffect(
      span,
      [{ backgroundSize: '0 100%'}, { backgroundSize: '100% 100%' }],
      { duration, easing: 'linear', fill: 'forwards' }
    )
    const animation = new Animation(effect, document.timeline)
    animation.pause()
    if (index < curFontNum.value) {
      span.style.backgroundSize = '100% 100%'
      animation.currentTime = duration
    } else if (index > curFontNum.value) {
      span.style.backgroundSize = '0 100%'
      animation.currentTime = 0
    } else {
      span.style.backgroundSize = '100% 100%'
      const currentTime = performance.now() - _performance.value - start
      animation.currentTime = currentTime
    }

    animations.value.push({ index, start, end, dom: span, animation })
  })
  if (playing.value) {
    _performance.value = performance.now() - seek.value * 1000 + lyricOffset.value * 1000
    playFontAnimate()
  }
}

const _findCurIndex = (fontList: { start: number, end: number }[], startIndex = 0) => {
  if (!fontList.length) return -1
  if (performance.now() - _performance.value < fontList[0].start) return -1
  for (let index = startIndex; index < fontList.length; index++) {
    if (performance.now() - _performance.value < fontList[index].start) return index - 1
  }
  return fontList.length - 1
}

watch(() => lyricLineSpan.value?.length, (value) => {
  clearTimeout(fontTimeoutId)
  animations.value.forEach((item) => (item.animation.pause()))
  animations.value = []
  if (value && haswByw.value) {
    createAnimation()
  }
})

watch(currentLyricIndex, (value) => {
  nextTick(() => {
    const el = document.getElementById(`line${value}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
})

watch(lyricWithTranslation, () => {
  _performance.value = performance.now() - seek.value * 1000 + lyricOffset.value * 1000
})

watch(playing, (value) => {
  if (value) {
    clearTimeout(timeoutId)
    clearTimeout(fontTimeoutId)
    _performance.value = performance.now() - seek.value * 1000 + lyricOffset.value * 1000
    getCurrentLineIndex()
    playFontAnimate()
  } else {
    clearTimeout(timeoutId)
    timeoutId = null
    if (animations.value.length && curFontNum.value !== -1) {
      const font = animations.value[curFontNum.value]
      font.animation.pause()
    }
  }
})

watch(lyricOffset, (value) => {
  clearTimeout(fontTimeoutId)
  clearTimeout(timeoutId)
  _performance.value = performance.now() - seek.value * 1000 + value * 1000
  currentLyricIndex.value = _findCurIndex(lyricWithTranslation.value)
  getCurrentLineIndex()
  playFontAnimate()
})

// @ts-ignore
eventBus.on('update-process', (data: { progress: number, manual: boolean }) => {
  clearTimeout(timeoutId)
  _performance.value = performance.now() - data.progress * 1000 + lyricOffset.value * 1000
  currentLyricIndex.value = _findCurIndex(lyricWithTranslation.value)
  getCurrentLineIndex()

  if (!data.manual || !animations.value.length) return
  if (curFontNum.value !== -1) {
    const font = animations.value[curFontNum.value]
    font.animation.pause()
  }
  clearTimeout(fontTimeoutId)
  playFontAnimate()
})

watch(showLyrics, (value) => {
  if (value)
    clearTimeout(timeoutId)
    clearTimeout(fontTimeoutId)
    _performance.value = performance.now() - seek.value * 1000 + lyricOffset.value * 1000
    currentLyricIndex.value = _findCurIndex(lyricWithTranslation.value)
    getCurrentLineIndex()
    playFontAnimate()
    nextTick(() => {
      const el = document.getElementById(`line${currentLyricIndex.value}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
})

onMounted(() => {
  if (!currentTrack.value) return
  _performance.value = performance.now() - seek.value * 1000 + lyricOffset.value * 1000
  currentLyricIndex.value = _findCurIndex(lyricWithTranslation.value)
  if (fontList.value) curFontNum.value = _findCurIndex(fontList.value)
  if (playing.value) getCurrentLineIndex()
  setTimeout(() => {
    const el = document.getElementById(`line${currentLyricIndex.value}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, 50)
})

onBeforeUnmount(() => {
  if (animations.value) {
    animations.value[curFontNum.value]?.animation?.pause()
  }
  clearTimeout(timeoutId)
  clearTimeout(fontTimeoutId)
  timeoutId = null
  fontTimeoutId = null
  animations.value = []
})
</script>

<style scoped lang="scss">
.lyric-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  scrollbar-width: none;
  padding: 0 6vw 0 3vw;
  transition: all 0.5s;

  .offset {
    display: flex;
    position: fixed;
    flex-direction: column;
    background-color: rgba(0, 0, 0, 0.05);
    padding: 10px 6px;
    top: 50%;
    right: 30px;
    border-radius: 8px;
    transform: translate(0, -50%);
    z-index: 1;

    .button-icon {
      margin: unset;
    }

    .recovery {
      margin: 10px 0;
    }
  }
}

.line {
  border-radius: 12px;
  margin: 2px 0;
  user-select: none;
  padding: 12px;
  font-weight: 550;
  will-change: background-size;

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
  }

  &:first-child {
    margin-top: 40vh;
  }

  &:last-child {
    margin-bottom: 40vh;
  }
}

.line {
  .lyric-line span {
    font-size: v-bind('`${nFontSize}px`');
    will-change: background-size;
    transition: font-size 0.4s ease;
    background-repeat: no-repeat;
    background-color: rgba(255,255,255, 0.28);
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-size: 0 100%;
    overflow-wrap: break-word;
  }
  .traslation span {
    font-size: v-bind('`${nFontSize - 4}px`');
    opacity: 0.28;
  }
}

.line-mode.active {
  .lyric-line span {
    background-color: rgba(255,255,255, 0.95);
  }
  .traslation span {
    background-color: rgba(255,255,255, 0.75);
  }
}

.word-mode.active {
  .lyric-line {
    span {
      background-image: -webkit-linear-gradient(top, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95));
    }
    .wordPlayed {
      background-size: 100% 100%;
    }

    // .wordPlaying {
    //   background-size: v-bind('`${width}%`') 100%;
    // }
  }
}
</style>
