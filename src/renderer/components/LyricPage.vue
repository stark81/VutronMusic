<template>
  <transition name="slide-fade">
    <div
      v-if="!noLyric"
      ref="lyricWrapperRef"
      class="lyric-wrapper"
      :class="{ 'use-mask': useMask }"
    >
      <div v-show="hover" class="offset">
        <button-icon title="提前0.5s" @click="setOffset(-0.5)">
          <svg-icon icon-class="back5s" />
        </button-icon>
        <button-icon class="recovery" :title="offset" @click="setOffset(0)">
          <svg-icon icon-class="recovery" />
        </button-icon>
        <button-icon title="后退0.5s" @click="setOffset(+0.5)">
          <svg-icon icon-class="forward5s" />
        </button-icon>
      </div>
      <div
        ref="lyricContainerRef"
        class="main-lyric-container"
        :class="{ 'is-zoom': isZoom, 'line-mode': lineMode }"
        @wheel="handleWheel"
      >
        <div
          v-for="(lyric, index) in lyrics"
          :id="`lyric${index}`"
          :key="index"
          class="lyric"
          :class="{ active: index === highlight }"
          @click="seek = lyric.start - lyricOffset"
        >
          <LyricLine
            ref="lyricRefs"
            :item="lyric"
            :idx="index"
            :current-index="currentIndex"
            :translation-mode="nTranslationMode"
            :playing="playing"
            :is-word-by-word="!lineMode"
            :playback-rate="playbackRate"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { usePlayerThemeStore } from '../store/playerTheme'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import LyricLine from './LyricLine.vue'

const props = defineProps({
  hover: { type: Boolean, default: false },
  textAlign: { type: String, default: 'left' },
  unplayColor: { type: String, default: 'var(--color-wbw-text-unplay)' },
  containerWidth: { type: String, default: 'calc(min(50vh, 33.33vw))' },
  offsetPadding: { type: String, default: '2vw' },
  margin: { type: String, default: '40vh' },
  containerMargin: { type: String, default: '0 auto' }
})

const playerStore = usePlayerStore()
const {
  noLyric,
  currentTrack,
  lyrics,
  playing,
  currentIndex,
  playbackRate,
  seek,
  lyricOffset,
  progress
} = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showToast } = stateStore

const playerThemeStore = usePlayerThemeStore()
const { themes } = storeToRefs(playerThemeStore)

const sense = computed(() => {
  const theme = themes.value.Classic[0].theme
  const result = theme.senses.Classic
  return result
})
const fontFamily = computed(() => sense.value.lyric.font)
const nFontSize = computed(() => sense.value.lyric.fontSize)
const isNWordByWord = computed(() => sense.value.lyric.wbw)
const nTranslationMode = computed(() => sense.value.lyric.translation)
const useMask = computed(() => sense.value.lyric.mask)
const isZoom = computed(() => sense.value.lyric.zoom)

const lineMode = computed(() => {
  return !isNWordByWord.value || lyrics.value.every((line) => !line.lyric?.info)
})

const highlight = computed(() => Math.min(currentIndex.value, lyrics.value.length - 1))

const offset = computed(() => {
  const lrcOffset = currentTrack.value!.offset || 0
  if (lrcOffset === 0) {
    return '未调整'
  } else if (lrcOffset > 0) {
    return `延后${lrcOffset}s`
  } else {
    return `提前${Math.abs(lrcOffset)}s`
  }
})

const transformOrigin = computed(() => `center ${props.textAlign}`)
const lyricRefs = ref<InstanceType<typeof LyricLine>[]>([])
const lyricContainerRef = ref<HTMLElement>()
const lyricWrapperRef = ref<HTMLElement>()
const isWheeling = ref(true)
const time = ref('1.5s')
let scrollingTimer: any = null

const setOffset = (offset: number) => {
  if (!currentTrack.value!.offset) {
    currentTrack.value!.offset = 0
  }
  if (currentTrack.value!.type === 'local') {
    window.mainApi
      ?.invoke('updateLocalTrackInfo', currentTrack.value!.id, {
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

const scheduleAnimation = async (type: 'all' | 'translation' = 'all') => {
  if (!lyricRefs.value?.length) return

  const indices = lyrics.value.map((_, i) => i)
  const highlightIdx = highlight.value

  const activeInstance = lyricRefs.value[highlightIdx]
  if (activeInstance) {
    activeInstance.createAnimations(type)

    const currentTime = (seek.value + lyricOffset.value) * 1000
    activeInstance.updateCurrentTime(currentTime)

    await nextTick()
    let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
    if (currentTime >= lyrics.value[highlightIdx].end * 1000) op = 'finish'
    activeInstance.updatePlayStatus(op)
  }

  const remaining = indices.filter((i) => i !== highlightIdx)

  const processQueue = () => {
    if (remaining.length === 0) return

    window.requestIdleCallback(
      (deadline) => {
        while (deadline.timeRemaining() > 1 && remaining.length > 0) {
          const idx = remaining.shift()!
          lyricRefs.value[idx]?.createAnimations(type)
        }

        if (remaining.length > 0) processQueue()
      },
      { timeout: 1000 }
    )
  }

  processQueue()
}

const clearAnimations = (clearAll = true) => {
  lyricRefs.value.forEach((instance) => {
    instance.clearAnimation(clearAll)
  })
}

const handleWheel = (e: WheelEvent) => {
  clearTimeout(scrollingTimer)

  const container = lyricContainerRef.value!
  const offset = lyricWrapperRef.value!.clientHeight

  const translateY = parseInt(container.style.transform?.split('(')[1]?.split(')')[0] || '0')
  const result = Math.min(Math.max(translateY - e.deltaY, offset - container.clientHeight), 0)
  container.style.transform = `translateY(${result}px)`

  if (!isWheeling.value) isWheeling.value = true
  const idx = Math.max(0, highlight.value)

  scrollingTimer = setTimeout(
    () => {
      isWheeling.value = false
      smoothScrollTo()
    },
    playing.value
      ? Math.min(300, (lyrics.value[idx]?.end - lyrics.value[idx]?.start) * 1000 * 0.4)
      : 1500
  )
}

const smoothScrollTo = () => {
  const container = lyricContainerRef.value!

  const idx = Math.max(0, highlight.value)
  const line = document.getElementById(`lyric${idx}`)!
  const offset = lyricWrapperRef.value!.clientHeight / 2
  const translateY = line.offsetTop - offset + line.clientHeight / 2
  const border = container.clientHeight - lyricWrapperRef.value!.clientHeight
  const result = Math.min(Math.max(translateY, 0), border)

  container.style.transform = `translateY(${-result}px)`
}

watch(playing, (value) => {
  const instance = lyricRefs.value[highlight.value]
  if (!instance) return
  const currentTime = (seek.value + lyricOffset.value) * 1000
  let op: 'play' | 'pause' | 'finish' | 'reset' = value ? 'play' : 'pause'
  if (currentTime >= lyrics.value[highlight.value].end * 1000) op = 'finish'
  instance.updatePlayStatus(op)
})

watch(playbackRate, (value) => {
  lyricRefs.value?.forEach((instance) => {
    instance.updatePlaybackRate(value)
  })
})

watch(lyrics, async () => {
  clearAnimations()
  await nextTick()
  scheduleAnimation()
})

watch(nTranslationMode, async () => {
  clearAnimations(false)
  await nextTick()
  scheduleAnimation('translation')
  const idx = Math.max(0, highlight.value)
  const el = document.getElementById(`lyric${idx}`)
  el?.scrollIntoView({ behavior: 'instant', block: 'center' })
})

watch(
  () => [progress.value, lyricOffset.value, highlight.value],
  async (value, oldValue) => {
    if (!lyricRefs.value.length) return
    if ((oldValue && value[2] !== oldValue[2]) || !oldValue) {
      if (!isWheeling.value) {
        smoothScrollTo()
      }

      const old = !oldValue ? -1 : oldValue[2]
      const start = Math.min(old, value[2])
      const end = Math.max(old, value[2]) + 1

      for (let i = start; i < end; i++) {
        if (i < value[2]) {
          const instance = lyricRefs.value[i]
          instance?.updatePlayStatus('finish')
        } else if (i === value[2]) {
          const instance = lyricRefs.value[i]
          const currentTime = (seek.value + value[1]) * 1000
          instance?.updateCurrentTime(currentTime)
          let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
          if (currentTime >= (lyrics.value[i]?.end || 0) * 1000) op = 'finish'
          instance?.updatePlayStatus(op)
        } else {
          const instance = lyricRefs.value[i]
          instance?.updatePlayStatus('reset')
        }
      }
    } else if (oldValue && value[0] !== oldValue[0]) {
      const instance = lyricRefs.value[highlight.value]
      const currentTime = (seek.value + lyricOffset.value) * 1000
      instance?.updateCurrentTime(currentTime)
      let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
      if (currentTime >= (lyrics.value[highlight.value]?.end || 0) * 1000) op = 'finish'
      instance?.updatePlayStatus(op)
    } else if (oldValue && value[1] !== oldValue[1]) {
      const instance = lyricRefs.value[highlight.value]
      const deltaTime = (value[1] - oldValue[1]) * 1000
      instance?.adjustCurrentTimeByDelta(deltaTime)
      let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
      const currentTime = (value[1] + seek.value) * 1000
      if (currentTime >= (lyrics.value[highlight.value]?.end || 0) * 1000) op = 'finish'
      instance?.updatePlayStatus(op)
    }
  },
  { immediate: true }
)

onMounted(() => {
  isWheeling.value = false

  requestAnimationFrame(() => {
    smoothScrollTo()

    requestAnimationFrame(() => {
      scheduleAnimation()
      time.value = '0.5s'
    })
  })
})

onBeforeUnmount(() => {
  clearAnimations()
  lyricRefs.value = []
})
</script>

<style scoped lang="scss">
.lyric-wrapper {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  contain: strict;
}

.use-mask {
  mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
}

.offset {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 10px 6px;
  top: 50%;
  right: v-bind(offsetPadding);
  border-radius: 8px;
  transform: translate(0, -50%);
  z-index: 1;
  contain: content;

  .button-icon {
    margin: unset;
  }

  .recovery {
    margin: 10px 0;
  }
}

.main-lyric-container {
  width: v-bind(containerWidth);
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  scrollbar-width: none;
  position: relative;
  margin: v-bind(containerMargin);
  transition: transform v-bind(time) cubic-bezier(0.15, 0.9, 0.08, 1);

  &::-webkit-scrollbar {
    width: 0px;
  }

  :deep(.lyric) {
    border-radius: 12px;
    margin: 2px 0;
    user-select: none;
    padding: 12px;
    font-weight: 600;
    font-family: v-bind('fontFamily || "inherit"');

    &:hover {
      background: var(--color-secondary-bg-for-transparent);
    }

    &.active {
      .lyric-line span,
      .translation span {
        will-change: background-position;
      }
    }

    &:not(.active) {
      .lyric-line span,
      .translation span {
        background-position: 100% 0% !important;
      }
    }

    .lyric-line {
      text-align: v-bind(textAlign);
      transform-origin: v-bind(transformOrigin);

      transform: scale(0.95);
      transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      span {
        font-size: v-bind('`${nFontSize}px`');
        background: linear-gradient(
          to right,
          var(--color-wbw-text-played) 50%,
          v-bind('`${unplayColor}`') 50%
        );
        background-clip: text;
        color: transparent;
        background-size: 200% 100%;
        background-position: 100% 0%;
        overflow-wrap: break-word;
        transition: font-size 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }
    }

    .translation {
      text-align: v-bind(textAlign);
      transform-origin: v-bind(transformOrigin);

      transform: scale(0.95);
      span {
        font-size: v-bind('`${nFontSize - 2}px`');
        background: linear-gradient(
          to right,
          var(--color-wbw-text) 50%,
          v-bind('`${unplayColor}`') 50%
        );
        background-clip: text;
        color: transparent;
        background-size: 200% 100%;
        background-position: 100% 0%;
        overflow-wrap: break-word;
        transition: font-size 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }
    }
  }

  :deep(.lyric:first-of-type) {
    margin-top: v-bind(margin) !important;
  }

  :deep(.lyric:last-child) {
    margin-bottom: v-bind(margin);
  }
}

.main-lyric-container.is-zoom {
  :deep(.lyric.active) {
    .lyric-line {
      transform: scale(1);
    }
  }
}

.main-lyric-container.line-mode {
  :deep(.lyric.active) {
    .lyric-line span,
    .translation span {
      color: var(--color-wbw-text-played);
    }
  }
  :deep(.lyric) {
    .lyric-line span,
    .translation span {
      transition: all 0.4s;
    }
  }
}

.slide-fade-enter-active {
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.slide-fade-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
}
</style>
