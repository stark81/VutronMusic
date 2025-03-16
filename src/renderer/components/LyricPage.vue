<template>
  <div
    v-show="!noLyric"
    class="lyric-container"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div v-show="hover" class="offset">
      <button-icon title="后退0.5s" @click="setOffset(-0.5)">
        <svg-icon icon-class="back5s" />
      </button-icon>
      <button-icon class="recovery" :title="offset" @click="setOffset(0)">
        <svg-icon icon-class="recovery" />
      </button-icon>
      <button-icon title="提前0.5s" @click="setOffset(0.5)">
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
      @click="seek = Number(line.start) / 1000 - (currentTrack?.offset || 0)"
    >
      <div v-if="line.lyric?.length" class="lyric-line">
        <span
          v-for="(lyric, idx) in line.lyric"
          :key="idx"
          :class="{
            wordPlayed: progress >= lyric.end,
            wordPlaying: progress >= lyric.start && progress < lyric.end,
            wordUnplay: progress < lyric.start
          }"
        >
          {{ lyric.word }}</span
        >
      </div>
      <div v-if="nTranslationMode === 'tlyric' && line.tlyric" class="traslation">
        <span
          v-for="(lyric, idx) in line.tlyric"
          :key="idx"
          :class="{
            wordPlayed: progress > lyric.end,
            wordPlaying: progress > lyric.start && progress < lyric.end,
            wordUnplay: progress < lyric.start
          }"
          >{{ lyric.word }}</span
        >
      </div>
      <div v-if="nTranslationMode === 'rlyric' && line.rlyric" class="traslation">
        <span
          v-for="(lyric, idx) in line.rlyric"
          :key="idx"
          :class="{
            wordPlayed: progress > lyric.end,
            wordPlaying: progress > lyric.start && progress < lyric.end,
            wordUnplay: progress < lyric.start
          }"
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
const { noLyric, currentTrack, currentLyricIndex, lyrics, seek, playing } = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nFontSize, nTranslationMode, isNWordByWord } = toRefs(normalLyric.value)

const hover = ref(false)
const startTime = ref(0)
const progress = ref(0)
const width = ref(0)
const tWidth = ref(0)
let animationFrameId: number | null = null

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
  const ret = [] as any[]
  const lyricFiltered = lyrics.value.lyric.filter(({ content }) => Boolean(content))
  if (lyricFiltered.length) {
    lyricFiltered.forEach((l, index) => {
      const lineItem = {
        index,
        start: l.time * 1000,
        end: l.end * 1000,
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
  }
  return ret
})

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

const lyricOffset = computed(() => currentTrack.value?.offset || 0)

const animate = () => {
  if (!lyrics.value.lyric?.length) return
  progress.value = performance.now() - startTime.value + lyricOffset.value * 1000
  animationFrameId = requestAnimationFrame(animate)
}

watch(currentLyricIndex, (value) => {
  const el = document.getElementById(`line${value}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})

watch(playing, (value) => {
  if (value) {
    startTime.value = performance.now() - progress.value
    animate()
  } else {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }
})

watch(showLyrics, (value) => {
  if (value)
    nextTick(() => {
      const el = document.getElementById(`line${currentLyricIndex.value}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
})

watch(progress, (value) => {
  if (!lyricWithTranslation.value.length) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    return
  }
  const line = lyricWithTranslation.value[currentLyricIndex.value]
  if (!line?.lyric) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    return
  }

  for (const word of line.lyric) {
    if (value >= word.start && value < word.end) {
      width.value = Math.round(((value - word.start) / (word.end - word.start)) * 100)
    }
  }
  if (line.tlyric) {
    for (const word of line.tlyric) {
      if (value >= word.start && value < word.end) {
        tWidth.value = Math.round(((value - word.start) / (word.end - word.start)) * 100)
      }
    }
  } else if (line.rlyric) {
    for (const word of line.rlyric) {
      if (value >= word.start && value < word.end) {
        tWidth.value = Math.round(((value - word.start) / (word.end - word.start)) * 100)
      }
    }
  }
})

// @ts-ignore
eventBus.on('update-process', (value: number) => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  progress.value = value * 1000
  startTime.value = performance.now() - progress.value
  if (playing.value) {
    animate()
  }
})

onMounted(() => {
  if (!currentTrack.value) return
  nextTick(() => {
    const el = document.getElementById(`line${currentLyricIndex.value}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    progress.value = (seek.value ?? 0) * 1000
    startTime.value = performance.now() - progress.value
    if (playing.value) {
      animate()
    }
  })
})

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
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
    opacity: 0.28;
  }
  .traslation span {
    font-size: v-bind('`${nFontSize - 4}px`');
    opacity: 0.28;
  }
}

.line-mode.active {
  .lyric-line span {
    opacity: 0.95;
  }
  .traslation span {
    opacity: 0.75;
  }
}

.word-mode.active {
  .lyric-line {
    span {
      opacity: unset;
      transition: font-size 0.4s ease;
      background-repeat: no-repeat;
      background-color: rgba(255,255,255, 0.28);
      background-image: -webkit-linear-gradient(top, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95));
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-size: 0 100%;
      will-change: background-size;
    }
    .wordPlayed {
      background-size: 100% 100%;
    }

    .wordPlaying {
      background-size: v-bind('`${width}%`') 100%;
    }
  }
}
</style>
