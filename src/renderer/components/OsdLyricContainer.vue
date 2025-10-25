<template>
  <div
    ref="lyricContainer"
    class="container"
    :class="{
      lineMode,
      mini: type === 'small',
      'one-line': type === 'small' && mode === 'oneLine',
      'two-line': type === 'small' && mode === 'twoLines'
    }"
    :style="containerStyle"
  >
    <div
      v-for="(lyric, index) in lyricToShow"
      :id="`lyric${index}`"
      :key="index"
      class="lyric"
      :class="{
        active: index === highlightIdx,
        played: index < highlightIdx,
        center: lyricToShow.length === 1
      }"
    >
      <LyricLine
        ref="lyricRefs"
        :item="lyric"
        :idx="index"
        :current-index="highlightIdx"
        :translation-mode="translationMode"
        :playing="playing"
        :is-word-by-word="!lineMode"
        :playback-rate="playbackRate"
        :is-mini="isMini"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import LyricLine from './LyricLine.vue'
import { storeToRefs } from 'pinia'
import { lyricLine, TranslationMode, word } from '@/types/music.d'

const osdLyricStore = useOsdLyricStore()
const {
  isWordByWord,
  translationMode,
  type,
  fontSize,
  playedLrcColor,
  unplayLrcColor,
  mode,
  font
} = storeToRefs(osdLyricStore)

const lyricRefs = ref<InstanceType<typeof LyricLine>[]>([])
const lyricContainer = ref<HTMLElement>()
const playing = ref(false)
const lyrics = ref<lyricLine[]>([])
const currentIndex = ref(-1)
const seek = ref(0)
const lyricOffset = ref(0)
const isMini = computed(() => type.value === 'small')
const playbackRate = ref(1.0)

const containerStyle = computed(() => {
  const result: Record<string, any> = {}
  result.overflowY = isMini.value ? 'hidden' : 'scroll'
  result.justifyContent = isMini.value ? 'center' : ''
  result.fontFamily = font.value ?? 'system-ui'
  return result
})

const lyricMap: Record<TranslationMode, TranslationMode> = {
  tlyric: 'tlyric',
  rlyric: 'rlyric',
  none: 'none'
}

const currentGroupIndex = computed(() => {
  if (!isMini.value) return -1
  const idx = groupLyric.value.findIndex((g) => g.includes(highlight.value))
  return Math.max(0, idx)
})

const lyricToShow = computed(() => {
  if (!isMini.value) return lyrics.value

  const idx = currentGroupIndex.value
  const result = groupLyric.value[idx]
    ? groupLyric.value[idx].map((index) => lyrics.value[index])
    : []
  return result
})

const modeKey = computed(() => lyricMap[translationMode.value])

const groupLyric = computed(() => {
  const result: number[][] = []
  if (!isMini.value) return result
  let idx = 0
  while (idx < lyrics.value.length) {
    const line = lyrics.value[idx]
    const trans = line[modeKey.value] as { text: string; info?: word[] } | null
    if (trans) {
      result.push([idx])
      idx++
    } else if (mode.value === 'oneLine') {
      result.push([idx])
      idx++
    } else {
      const nextTrans =
        lyrics.value[idx + 1] &&
        (lyrics.value[idx + 1][modeKey.value] as {
          text: string
          info?: word[]
        } | null)
      if (idx + 1 < lyrics.value.length && !nextTrans) {
        result.push([idx, idx + 1])
        idx += 2
      } else {
        result.push([idx])
        idx++
      }
    }
  }
  return result
})

const lineMode = computed(() => {
  return !isWordByWord.value || lyrics.value.every((line) => !line.lyric?.info)
})

const highlight = computed(() => Math.min(currentIndex.value, lyrics.value.length - 1))

const highlightIdx = computed(() => {
  if (!isMini.value) return highlight.value
  return groupLyric.value[currentGroupIndex.value].findIndex((id) => id === highlight.value)
})

const clearAnimations = (clearAll = true) => {
  lyricRefs.value.forEach((instance) => {
    instance.clearAnimation(clearAll)
  })
}

const scheduleAnimation = async (type: 'all' | 'translation' = 'all') => {
  if (!lyricRefs.value?.length) return

  const BATCH_SIZE = 3
  const BATCH_DELAY_MS = 50

  for (let index = 0; index < lyricToShow.value.length; index++) {
    const instance = lyricRefs.value[index]
    if (!instance) continue
    const idx =
      index +
      (index < Math.min(highlightIdx.value, lyricToShow.value.length - 1)
        ? lyricToShow.value.length
        : 0)
    const diff = idx - highlightIdx.value
    const delayMs = isMini.value ? 0 : Math.floor(diff / BATCH_SIZE) * BATCH_DELAY_MS

    if (delayMs > 0) {
      setTimeout(() => {
        instance?.createAnimations(type)
      }, delayMs)
    } else {
      await instance?.createAnimations(type)
    }

    if (index === highlightIdx.value) {
      const currentTime = (seek.value + lyricOffset.value) * 1000
      instance.updateCurrentTime(currentTime)
      let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
      if (currentTime >= lyricToShow.value[index].end * 1000) op = 'finish'
      instance.updatePlayStatus(op)
    }
  }
}

watch(lyricToShow, async () => {
  clearAnimations()
  await nextTick()
  scheduleAnimation()
})

watch(playing, (value) => {
  const instance = lyricRefs.value[highlightIdx.value]
  if (!instance) return
  const currentTime = (seek.value + lyricOffset.value) * 1000
  let op: 'play' | 'pause' | 'finish' | 'reset' = value ? 'play' : 'pause'
  if (currentTime >= lyricToShow.value[highlightIdx.value].end * 1000) op = 'finish'
  instance.updatePlayStatus(op)
})

watch(isWordByWord, async () => {
  const idx = currentIndex.value
  currentIndex.value = -1
  clearAnimations()
  scheduleAnimation()
  await nextTick()
  currentIndex.value = idx
})

watch(translationMode, () => {
  clearAnimations(false)
  scheduleAnimation('translation')
  if (isMini.value) return
  const idx = Math.max(0, highlightIdx.value)
  const el = document.getElementById(`lyric${idx}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

watch(playbackRate, (value) => {
  lyricRefs.value?.forEach((instance) => {
    instance.updatePlaybackRate(value)
  })
})

watch(
  () => [seek.value, lyricOffset.value, highlight.value],
  async (value, oldValue) => {
    await nextTick()
    if (!lyricRefs.value.length) return
    if ((oldValue && value[2] !== oldValue[2]) || !oldValue) {
      if (!isMini.value) {
        const idx = Math.max(0, value[2])
        const el = document.getElementById(`lyric${idx}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }

      const old = !oldValue ? -1 : oldValue[2]
      const start = isMini.value ? 0 : Math.min(old, value[2])
      const end = isMini.value ? lyricRefs.value.length : Math.max(old, value[2]) + 1

      for (let i = start; i < end; i++) {
        const instance = lyricRefs.value[i]
        if (i < highlightIdx.value) {
          instance?.updatePlayStatus('finish')
        } else if (i === highlightIdx.value) {
          const currentTime = (seek.value + value[1]) * 1000
          instance?.updateCurrentTime(currentTime)
          let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
          if (currentTime >= (lyricToShow.value[i]?.end || 0) * 1000) op = 'finish'
          instance?.updatePlayStatus(op)
        } else {
          instance?.updatePlayStatus('reset')
        }
      }
    } else if (oldValue && value[0] !== oldValue[0]) {
      const instance = lyricRefs.value[highlightIdx.value]
      const currentTime = (seek.value + lyricOffset.value) * 1000
      instance?.updateCurrentTime(currentTime)
      let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
      if (currentTime >= (lyricToShow.value[highlightIdx.value]?.end || 0) * 1000) op = 'finish'
      instance?.updatePlayStatus(op)
    } else if (oldValue && value[1] !== oldValue[1]) {
      const instance = lyricRefs.value[highlightIdx.value]
      const deltaTime = (value[1] - oldValue[1]) * 1000
      instance?.adjustCurrentTimeByDelta(deltaTime)
      let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
      const currentTime = (value[1] + seek.value) * 1000
      if (currentTime >= (lyricToShow.value[highlightIdx.value]?.end || 0) * 1000) op = 'finish'
      instance?.updatePlayStatus(op)
    }
  },
  { immediate: true }
)

type statusMap = {
  lyrics: lyricLine[]
  playing: boolean
  lyricOffset: [number, number] // 当前的歌词 offset，当前播放进度
  line: [number, number] // 当前行，当前播放进度
  rate: number
  seek: number // 目前这一项的触发是在当单双行切换、翻译切换时更新播放进度
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data.type !== 'update-osd-status') return

  const data = event.data.data as Partial<statusMap>

  if (data.lyrics !== undefined) {
    lyrics.value = data.lyrics
  }

  if (data.playing !== undefined) {
    playing.value = data.playing
  }

  if (data.lyricOffset !== undefined) {
    const [offset, seekValue] = data.lyricOffset
    lyricOffset.value = offset
    seek.value = seekValue
  }

  if (data.line !== undefined) {
    const [lineIndex, seekValue] = data.line
    currentIndex.value = lineIndex
    seek.value = seekValue
  }

  if (data.rate !== undefined) {
    playbackRate.value = data.rate
  }

  if (data.seek !== undefined) {
    seek.value = data.seek
  }
})

const handleVisebilitiyChange = () => {
  if (!document.hidden) {
    window.mainApi?.sendMessage({ type: 'get-seek' })
  }
}

onMounted(async () => {
  const player = JSON.parse(localStorage.getItem('player') || '{}')
  playing.value = player?.playing || false
  if (!player.lyrics) return
  lyrics.value = player.lyrics
  currentIndex.value = player.currentIndex || -1
  if (!lyrics.value.length) {
    lyrics.value[0] = {
      start: 0,
      end: 0,
      lyric: {
        text: `${(player.currentTrack?.artists || player.currentTrack?.ar)[0]?.name} - ${player.currentTrack?.name}`
      }
    }
  }
  lyricOffset.value = player.currentTrack.offset || 0

  scheduleAnimation()

  document.addEventListener('visibilitychange', handleVisebilitiyChange)

  if (isMini.value) return
  await nextTick()
  const idx = Math.max(0, highlight.value)
  const el = document.getElementById(`lyric${idx}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

onBeforeUnmount(() => {
  // destroyController(true)
  document.removeEventListener('visibilitychange', handleVisebilitiyChange)
})
</script>

<style scoped lang="scss">
.container {
  user-select: none;
  height: calc(100vh - 54px);
  scrollbar-width: none;
  display: flex;
  flex-direction: column;

  :deep(.lyric) {
    border-radius: 12px;
    margin: 2px 0;
    user-select: none;
    padding: 2px 0;
    font-weight: 600;

    .lyric-line span {
      font-size: v-bind('`${fontSize}px`');
      transition:
        font-size 0.4s ease,
        background-color 0.2s ease;

      background: linear-gradient(
        to right,
        v-bind('`${playedLrcColor}`') 50%,
        v-bind('`${unplayLrcColor}`') 50%
      );
      background-clip: text;
      color: transparent;
      background-size: 200% 100%;
      background-position: 100% 0%;

      overflow-wrap: break-word;
      -webkit-text-stroke: 0.05px rgba(46, 46, 46, 0.3);
    }
    .translation span {
      font-size: v-bind('`${fontSize - 4}px`');
      transition:
        font-size 0.4s ease,
        background-color 0.4s ease;
      background: linear-gradient(
        to right,
        v-bind('`${playedLrcColor}`') 50%,
        v-bind('`${unplayLrcColor}`') 50%
      );
      background-clip: text;
      color: transparent;
      background-size: 200% 100%;
      background-position: 100% 0%;
      overflow-wrap: break-word;
      -webkit-text-stroke: 0.05px rgba(46, 46, 46, 0.3);
    }

    &.played {
      .lyric-line span,
      .translation span {
        background-position: 0% 0% !important;
      }
    }

    &:not(.played):not(.active) {
      .lyric-line span,
      .translation span {
        background-position: 100% 0% !important;
      }
    }
  }
}

.container:not(.mini) {
  text-align: center;
  :deep(.lyric:first-of-type) {
    margin-top: 40vh !important;
  }

  :deep(.lyric:last-child) {
    margin-bottom: 40vh;
  }
}

.container.mini {
  white-space: nowrap;
  overflow: hidden;

  :deep(.hidden-measure) {
    padding: 0;
  }

  &.one-line {
    text-align: center;
  }

  &.two-line :deep(.lyric:not(.hidden-measure)) {
    &:first-child {
      text-align: left;
    }
    &:last-child {
      text-align: right;
    }
  }

  &.two-line :deep(.lyric.center) {
    text-align: center !important;
  }
}

.container.lineMode {
  :deep(.lyric.played) {
    .lyric-line span {
      background-position: 100% 0% !important;
    }
    .translation span {
      background-position: 100% 0% !important;
    }
  }
  :deep(.lyric.active) {
    .lyric-line span {
      background-position: 0% 0% !important;
    }
    .translation span {
      background-position: 0% 0% !important;
    }
  }
}

.word-mode {
  .lyric-line span {
    background-size: 0% 100%;
    background-image: -webkit-linear-gradient(
      top,
      v-bind('`${playedLrcColor}`'),
      v-bind('`${playedLrcColor}`')
    );
  }
  .translation span {
    background-size: 0% 100%;
    background-image: -webkit-linear-gradient(
      top,
      v-bind('`${playedLrcColor}`'),
      v-bind('`${playedLrcColor}`')
    );
  }
}

.played,
.active {
  .lyric-line span {
    background-size: 100% 100%;
    will-change: background-size;
  }
  .translation span {
    background-size: 100% 100%;
    will-change: background-size;
  }
}
</style>
