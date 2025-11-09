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
      <div ref="lyricContainer" class="main-lyric-container" @wheel="handleWheel">
        <div id="line-1" class="lyric"></div>
        <div
          v-for="(lyric, index) in lyrics"
          :id="`line${index}`"
          :key="lyric.start"
          class="lyric"
          @click="seek = lyric.start"
        >
          <WordLyric
            v-if="isNWordByWord && lyric.lyric?.info && index === currentIndex.line"
            :key="`${lyric.start}-${index}`"
            :item="lyric"
            :playing="playing"
            :background-color="unplayColor"
            :playback-rate="playbackRate"
            :font-size="nFontSize"
            :unplayed-color="unplayColor"
            :fade-duration="fadeDuration"
            :font-index="currentIndex.lyric"
            :t-font-index="tFontIndex"
            :is-active="isZoom"
            :playing-color="'var(--color-wbw-text-played)'"
            :translation-mode="nTranslationMode"
          ></WordLyric>
          <LineLyric
            v-else
            :item="lyric"
            :translation-mode="nTranslationMode"
            :background-color="index === highlight ? 'var(--color-wbw-text-played)' : unplayColor"
            :is-active="isZoom && index === highlight"
            :font-size="nFontSize"
          ></LineLyric>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import {
  computed,
  watch,
  onMounted,
  toRefs,
  // onBeforeUnmount,
  nextTick,
  // useTemplateRef,
  ref
} from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import LineLyric from './LyricLine.vue'
import WordLyric from './LyricLineWord.vue'

const props = defineProps({
  hover: { type: Boolean, default: false },
  textAlign: { type: String, default: 'left' },
  unplayColor: { type: String, default: 'var(--color-wbw-text-unplay)' },
  containerWidth: { type: String, default: 'calc(min(50vh, 33.33vw))' },
  offsetPadding: { type: String, default: '3vw' }
})

const playerStore = usePlayerStore()
const { noLyric, currentTrack, lyrics, seek, playing, currentIndex, playbackRate, fadeDuration } =
  storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showToast } = stateStore

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nFontSize, isNWordByWord, useMask, nTranslationMode, isZoom } = toRefs(normalLyric.value)

const isWheeling = ref(false)
let scrollingTimer: any = null

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
const highlight = computed(() => {
  const idx = currentIndex.value.line
  if (idx >= lyrics.value.length) return lyrics.value.length - 1
  return idx
})

const tFontIndex = computed(() => {
  let result = -1
  if (nTranslationMode.value === 'tlyric') {
    result = currentIndex.value.tlyric
  } else if (nTranslationMode.value === 'rlyric') {
    result = currentIndex.value.rlyric
  }
  return result
})

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

const handleWheel = () => {
  clearTimeout(scrollingTimer)
  const line = document.getElementById(`line${currentIndex.value.line}`)
  if (!line || !playing.value) return
  if (!isWheeling.value) isWheeling.value = true
  scrollingTimer = setTimeout(() => {
    clearTimeout(scrollingTimer)
    isWheeling.value = false
  }, 1500)
}

watch(
  () => !isWheeling.value && currentIndex.value.line,
  (value) => {
    const line = document.getElementById(`line${value}`)
    line?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
)

onMounted(async () => {
  if (!currentTrack.value) return

  await nextTick()
  const line = document.getElementById(`line${highlight.value}`)
  line?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
  contain: content;

  &::-webkit-scrollbar {
    width: 0px;
  }

  .lyric {
    :deep(.lyric-line),
    :deep(.translation) {
      text-align: v-bind(textAlign);
      transform-origin: v-bind(transformOrigin);
    }
  }

  .lyric:first-child {
    margin-top: 40vh;
  }

  .lyric:last-child {
    margin-bottom: 40vh;
  }
}

@media (max-aspect-ratio: 10/9) {
  .main-lyric-container {
    width: 100%;
    .lyric {
      :deep(.lyric-line),
      :deep(.translation) {
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
