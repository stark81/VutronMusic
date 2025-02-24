<template>
  <div class="container" :style="containerStyle">
    <div
      v-if="type === 'normal'"
      id="line-1"
      class="line"
      :style="{ paddingTop: type === 'normal' ? '45vh' : '0px' }"
    ></div>
    <div
      v-for="lyricArray in lyricForShow"
      :id="`line${lyricArray.index}`"
      :key="lyricArray.index"
      class="line"
      :class="{
        played: lyricArray.index < currentLyricIndex,
        isPlaying: lyricArray.index === currentLyricIndex,
        unplay: lyricArray.index > currentLyricIndex,
        haswByw,
        notWordByWord: !haswByw
      }"
      :style="lineStyle(lyricArray.index)"
    >
      <div v-if="lyricArray.lyric?.length" class="lyric">
        <span
          v-for="(lyric, idx) in lyricArray.lyric"
          :key="idx"
          :class="{
            wordPlayed: progress >= lyric.end,
            wordPlaying: progress >= lyric.start && progress < lyric.end,
            wordUnplay: progress < lyric.start
          }"
          >{{ lyric.word }}</span
        ></div
      >
      <div v-if="translationMode === 'tlyric' && lyricArray?.tlyric" class="translation">
        <span
          v-for="(tlyric, idx) in lyricArray.tlyric"
          :key="idx"
          :class="{
            wordPlayed: progress > tlyric.end,
            wordPlaying:
              lyricArray.index === currentLyricIndex &&
              progress > tlyric.start &&
              progress < tlyric.end,
            wordUnplay: progress < tlyric.start
          }"
        >
          {{ tlyric.word }}</span
        >
      </div>
      <div v-if="translationMode === 'romalrc' && lyricArray?.rlyric" class="translation">
        <span
          v-for="(rlyric, idx) in lyricArray.rlyric"
          :key="idx"
          :class="{
            wordPlayed: progress > rlyric.end,
            wordPlaying:
              lyricArray.index === currentLyricIndex &&
              progress > rlyric.start &&
              progress < rlyric.end,
            wordUnplay: progress < rlyric.start
          }"
        >
          {{ rlyric.word }}</span
        >
      </div>
    </div>
    <div
      v-if="type === 'normal'"
      class="line"
      :style="{ paddingBottom: type === 'normal' ? '45vh' : '6px' }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'

const osdLyricStore = useOsdLyricStore()
const { isWordByWord, type, playedLrcColor, unplayLrcColor, fontSize, translationMode, mode } =
  storeToRefs(osdLyricStore)

const startTime = ref(0)
const progress = ref(0)
const lyricOffset = ref(0)
const isPlaying = ref(false)
const width = ref(0)
const tWidth = ref(0)
const currentLyricIndex = ref(-1)
const lyrics = ref<{ lyric: any[]; tlyric: any[]; rlyric: any[] }>({
  lyric: [{ content: '暂无歌词', time: 0, contentInfo: null }],
  rlyric: [],
  tlyric: []
})
let animationFrameId: number | null = null

const containerStyle = computed(() => {
  const result: Record<string, any> = {}
  result.overflowY = type.value === 'normal' ? 'scroll' : 'hidden'
  result.justifyContent = type.value === 'normal' ? '' : 'center'
  return result
})

const haswByw = computed(() => {
  let result = false
  for (const item of lyrics.value.lyric) {
    if (item.contentInfo) {
      result = true
      break
    }
  }
  return isWordByWord.value && result
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

        const sameTimeTLyric = lyrics.value?.tlyric.find((t) => t.time === l.time)
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

        const sameTimeRLyric = lyrics.value?.rlyric.find((t) => t.time === l.time)
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
        const sameTimeTLyric = lyrics.value?.tlyric.find((t) => t.time === l.time)
        if (sameTimeTLyric) {
          lineItem.tlyric = [
            { start: l.time * 1000, end: l.time * 1000, word: sameTimeTLyric.content }
          ]
        }
        const sameTimeRLyric = lyrics.value?.rlyric.find((t) => t.time === l.time)
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

const miniModeLyric = computed(() => {
  const idx = Math.max(currentLyricIndex.value, 0)
  if (mode.value === 'oneLine') {
    return lyricWithTranslation.value?.slice(idx, idx + 1)
  } else {
    const hasTranslation =
      (translationMode.value === 'tlyric' && lyricWithTranslation.value[idx]?.tlyric) ||
      (translationMode.value === 'romalrc' && lyricWithTranslation.value[idx]?.rlyric)
    const index = hasTranslation ? idx : idx + (idx % 2 === 0 ? 0 : -1) || 0
    return lyricWithTranslation.value.slice(index, index + (hasTranslation ? 1 : 2))
  }
})

const lyricForShow = computed(() => {
  if (type.value === 'normal') return lyricWithTranslation.value
  return miniModeLyric.value
})

const lineStyle = (index: number) => {
  const result: Record<string, string> = {}
  let align = 'center'
  let margin = '10px 0'
  if (type.value === 'small') {
    // result.display = 'inline-block'
    // result.whiteSpace = 'nowrap'
    if (lyricForShow.value?.length === 2) {
      align = index % 2 === 0 ? 'start' : 'end'
      margin = '6px 0'
    }
  }
  result.textAlign = align
  result.margin = margin
  return result
}

const animate = () => {
  if (!lyrics.value.lyric.length || !haswByw.value || !isPlaying.value) return
  progress.value = performance.now() - startTime.value + lyricOffset.value
  animationFrameId = requestAnimationFrame(animate)
}

window.mainApi.on('updateLyricInfo', (event: Event, data: Record<string, any>[]) => {
  const [key, value] = Object.entries(data)[0] as [string, any]
  if (key === 'lyrics') {
    lyrics.value = value.lyric.length ? value : { lyric: [], rlyric: [], tlyric: [] }
    progress.value = 0
    startTime.value = performance.now() - progress.value
  } else if (key === 'lrcIdx') {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    currentLyricIndex.value = value[0]
    progress.value = value[1] * 1000
    startTime.value = performance.now() - progress.value
    animate()

    setTimeout(() => {
      const el = document.getElementById(`line${value[0]}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  } else if (key === 'lyricOffset') {
    lyricOffset.value = value * 1000
  }
})

window.mainApi?.on('update-osd-playing-status', (event: any, res: boolean) => {
  isPlaying.value = res
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
  if (line?.tlyric) {
    for (const word of line.tlyric) {
      if (value >= word.start && value < word.end) {
        tWidth.value = Math.round(((value - word.start) / (word.end - word.start)) * 100)
      }
    }
  } else if (line?.rlyric) {
    for (const word of line.rlyric) {
      if (value >= word.start && value < word.end) {
        tWidth.value = Math.round(((value - word.start) / (word.end - word.start)) * 100)
      }
    }
  }
})

watch(isPlaying, (value) => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (value) {
    startTime.value = performance.now() - progress.value
    animate()
  }
})

onMounted(() => {
  const player = JSON.parse(localStorage.getItem('player') || '{}')
  isPlaying.value = player?.playing || false
  if (!player.lyrics) return
  lyrics.value = player.lyrics
  currentLyricIndex.value = player.currentLyricIndex
  lyricOffset.value = player.currentTrack?.offset || 0
  progress.value = (player.progress ?? 0) * 1000
  startTime.value = performance.now() - progress.value

  setTimeout(() => {
    const el = document.getElementById(`line${currentLyricIndex.value}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 50)
})

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
})
</script>

<style scoped lang="scss">
.container {
  user-select: none;
  padding: 0 20px;
  height: calc(100vh - 44px);
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
}

.line {
  font-size: v-bind('`${fontSize}px`');
  user-select: none;
  font-weight: 650;
  transition:
    font-size 0.3s ease-in,
    color 0.3s ease-in;

  .lyric {
    line-height: 100%;
  }
  .translation {
    line-height: 100%;
    margin-top: 2px;
    span {
      font-size: v-bind('`${fontSize - 4}px`');
    }
  }
}

.line.notWordByWord {
  color: v-bind('unplayLrcColor');
  transition:
    font-size 0.3s ease-in,
    color 0.3s ease-in;
}

.line.notWordByWord.isPlaying {
  color: v-bind('playedLrcColor');
}

.line.haswByw {
  color: transparent;
  opacity: 0.85;
  background: v-bind(
    '`linear-gradient(to right, ${playedLrcColor} 0%, ${unplayLrcColor} 0%) text`'
  );
}

.line.haswByw.played {
  .lyric .wordPlayed {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} 100%, ${unplayLrcColor} 100%) text`'
    );
  }
  .translation .wordPlayed {
    background-color: var(--translation-color-played);
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} 100%, ${unplayLrcColor} 100%) text`'
    );
  }
}

.line.haswByw.isPlaying {
  .lyric .wordPlayed {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} 100%, ${unplayLrcColor} 100%) text`'
    );
  }

  .translation .wordPlayed {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} 100%, ${unplayLrcColor} 100%) text`'
    );
  }
  .lyric .wordPlaying {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} ${width}%, ${unplayLrcColor}  ${width}%) text`'
    );
  }
  .translation .wordPlaying {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} ${tWidth}%, ${unplayLrcColor}  ${tWidth}%) text`'
    );
  }
  .lyric .wordUnplay {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} 0%, ${unplayLrcColor} 0%) text`'
    );
  }
  .translation .wordUnplay {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} 0%, ${unplayLrcColor} 0%) text`'
    );
  }
}

.line.haswByw.unplay {
  .lyric span {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} 0%, ${unplayLrcColor} 0%) text`'
    );
  }
  .translation span {
    background: v-bind(
      '`linear-gradient(to right, ${playedLrcColor} 0%, ${unplayLrcColor} 0%) text`'
    );
  }
}
</style>
