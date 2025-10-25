<template>
  <transition name="slide-fade">
    <div v-show="!noLyric" class="lyric-wrapper" :class="{ 'use-mask': useMask }">
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
        ref="lyricContainer"
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
import { computed, nextTick, onMounted, ref, toRefs, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import LyricLine from './LyricLine.vue'

const props = defineProps({
  hover: { type: Boolean, default: false },
  textAlign: { type: String, default: 'left' },
  unplayColor: { type: String, default: 'var(--color-wbw-text-unplay)' },
  containerWidth: { type: String, default: 'calc(min(50vh, 33.33vw))' },
  offsetPadding: { type: String, default: '3vw' }
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

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nFontSize, useMask, nTranslationMode, isNWordByWord, isZoom } = toRefs(normalLyric.value)

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

const map = {
  start: 'left',
  center: 'center',
  end: 'right'
}

const transformOrigin = computed(() => `center ${map[props.textAlign]}`)
const lyricRefs = ref<InstanceType<typeof LyricLine>[]>([])
const isWheeling = ref(false)
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

  const BATCH_SIZE = 3
  const BATCH_DELAY_MS = 50

  for (let index = 0; index < lyrics.value.length; index++) {
    const instance = lyricRefs.value[index]
    if (!instance) continue
    const idx =
      index +
      (index < Math.min(currentIndex.value, lyrics.value.length - 1) ? lyrics.value.length : 0)
    const diff = idx - currentIndex.value
    const delayMs = Math.floor(diff / BATCH_SIZE) * BATCH_DELAY_MS

    if (delayMs > 0) {
      setTimeout(() => {
        instance?.createAnimations(type)
      }, delayMs)
    } else {
      await instance.createAnimations(type)
    }

    if (index === highlight.value) {
      const currentTime = (seek.value + lyricOffset.value) * 1000
      instance.updateCurrentTime(currentTime)
      let op: 'play' | 'pause' | 'finish' | 'reset' = playing.value ? 'play' : 'pause'
      if (currentTime >= lyrics.value[index].end * 1000) op = 'finish'
      instance.updatePlayStatus(op)
    }
  }
}

const clearAnimations = (clearAll = true) => {
  lyricRefs.value.forEach((instance) => {
    instance.clearAnimation(clearAll)
  })
}

const handleWheel = () => {
  clearTimeout(scrollingTimer)

  if (!isWheeling.value) isWheeling.value = true
  const idx = Math.max(0, highlight.value)

  scrollingTimer = setTimeout(
    () => {
      isWheeling.value = false
      const idx = Math.max(0, highlight.value)
      const line = document.getElementById(`lyric${idx}`)
      line?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    playing.value
      ? Math.min(300, (lyrics.value[idx]?.end - lyrics.value[idx]?.start) * 1000 * 0.4)
      : 1500
  )
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
    await nextTick()
    if (!lyricRefs.value.length) return
    if ((oldValue && value[2] !== oldValue[2]) || !oldValue) {
      if (!isWheeling.value) {
        const idx = Math.max(0, value[2])
        const el = document.getElementById(`lyric${idx}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

onMounted(async () => {
  scheduleAnimation()
  const idx = Math.max(0, highlight.value)
  const el = document.getElementById(`lyric${idx}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})
</script>

<style scoped lang="scss">
.lyric-wrapper {
  position: relative;
  height: 100vh;
  overflow: hidden;
  contain: strict;
}

.use-mask {
  mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
}

.offset {
  position: fixed;
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
  height: 100vh;
  width: v-bind(containerWidth);
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  scrollbar-width: none;
  position: relative;
  margin: 0 auto;
  contain: strict;

  &::-webkit-scrollbar {
    width: 0px;
  }

  :deep(.lyric) {
    border-radius: 12px;
    margin: 2px 0;
    user-select: none;
    padding: 12px;
    font-weight: 600;

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
      }
    }
  }

  :deep(.lyric:first-of-type) {
    margin-top: 40vh !important;
  }

  :deep(.lyric:last-child) {
    margin-bottom: 40vh;
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
      background-position: 0% 0% !important;
    }
  }
}

@media (max-aspect-ratio: 10/9) {
  .main-lyric-container {
    width: 100%;
    :deep(.lyric) {
      .lyric-line,
      .translation {
        text-align: center;
        transform-origin: center center;
      }
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
