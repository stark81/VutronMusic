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
    <div id="line-1" class="line"></div>
    <div
      v-for="line in lyricWithTranslation"
      :id="`line${line.index}`"
      :key="line.index"
      class="line"
      :class="{
        haswByw,
        notWordByWord: !haswByw,
        highlight: line.index === currentLyricIndex,
        normal: line.index !== currentLyricIndex
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
  // console.log('=====11=====', lyrics.value)
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
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (value) {
    startTime.value = performance.now() - progress.value
    animate()
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
  transition: font-size 0.3s ease-in;
  user-select: none;
  padding: 12px;
  will-change: background;

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
  }

  &:first-child {
    margin-top: 40vh;
  }
}

.line#line-1 {
  margin-top: 40vh;
}

.line:last-child {
  margin-bottom: calc(50vh - 128px);
}

.lyric-line {
  font-size: v-bind('`${nFontSize}px`');
  font-weight: 650;
}

.traslation {
  font-size: v-bind('`${nFontSize - 4}px`');
  font-weight: 650;
}

.line.haswByw {
  .lyric-line,
  .traslation {
    color: transparent;
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.18) 0%) text`'
    );
  }
}

.line.haswByw.highlight {
  .lyric-line .wordPlayed {
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.92) 100%, rgba(255, 255, 255, 0.18) 100%) text`'
    );
  }
  .traslation .wordPlayed {
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.65) 100%, rgba(255, 255, 255, 0.18) 100%) text`'
    );
  }

  .lyric-line .wordPlaying {
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.92) ${width}%, rgba(255, 255, 255, 0.18) ${width}%) text`'
    );
  }
  .traslation .wordPlaying {
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.65) ${tWidth}%, rgba(255, 255, 255, 0.18) ${tWidth}%) text`'
    );
  }

  .lyric-line .wordUnplay {
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.18) 0%) text`'
    );
  }
  .traslation .wordUnplay {
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.18) 0%) text`'
    );
  }
}

.line.haswByw.normal {
  .lyric-line span {
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.18) 0%) text`'
    );
  }
  .traslation span {
    background: v-bind(
      '`linear-gradient(to right, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.18) 0%) text`'
    );
  }
}

.line.notWordByWord {
  opacity: 0.28;
  transition: opacity 0s;
}

.line.notWordByWord.highlight {
  opacity: unset;
  .lyric-line {
    opacity: 0.85;
  }
  .traslation {
    opacity: 0.65;
  }
}
</style>
