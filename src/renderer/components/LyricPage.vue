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
      <div ref="lyricContainer" class="main-lyric-container" :class="{ isZoom }" />
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, toRefs, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import eventBus from '../utils/eventBus'
import {
  initLyric,
  setLyrics,
  updatePlayStatus,
  destroyController,
  updateLineIndex,
  updateFontIndex,
  updateTFontIndex,
  updateMode,
  updateRate
} from '../utils/lyricController'

const props = defineProps({
  hover: { type: Boolean, default: false },
  textAlign: { type: String, default: 'left' },
  unplayColor: { type: String, default: 'var(--color-wbw-text-unplay)' },
  containerWidth: { type: String, default: 'calc(min(50vh, 33.33vw))' },
  offsetPadding: { type: String, default: '3vw' }
})

const playerStore = usePlayerStore()
const { noLyric, currentTrack, lyrics, seek, playing, currentIndex, lyricOffset, playbackRate } =
  storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showToast } = stateStore

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nFontSize, nTranslationMode, isNWordByWord, useMask, isZoom } = toRefs(normalLyric.value)

const lyricContainer = ref<HTMLElement>()

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

const transformOrigin = computed(() => {
  return `center ${map[props.textAlign]}`
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

watch(
  lyrics,
  (value) => {
    if (!value.lyric.length) return
    setTimeout(() => {
      setLyrics(value)
    }, 50)
  },
  { immediate: true, deep: true }
)

watch(playing, (value) => {
  updatePlayStatus(value)
})

watch(
  () => currentIndex.value.line,
  (value) => {
    updateLineIndex(value)
  }
)

watch(
  () => currentIndex.value.word,
  (value) => {
    updateFontIndex(value)
  }
)

watch(
  () => currentIndex.value.tWord,
  (value) => {
    updateTFontIndex(value)
  }
)

watch(
  () => currentIndex.value.rWord,
  (value) => {
    updateTFontIndex(value)
  }
)

watch(nTranslationMode, (value) => {
  updateMode({
    mode: value,
    currentTime: seek.value * 1000,
    line: currentIndex.value.line,
    fontIndex: currentIndex.value.word,
    tFontIndex: currentIndex.value.tWord
  })
})

watch(seek, (value) => {
  eventBus.emit('update-process', value)
})

watch(playbackRate, (value) => {
  updateRate(value)
})

// @ts-ignore
eventBus.on('updateSeek', (start: number) => {
  seek.value = start - lyricOffset.value
})

onMounted(() => {
  if (!currentTrack.value) return

  if (lyricContainer.value) {
    initLyric({
      container: lyricContainer.value,
      playing: playing.value,
      mode: nTranslationMode.value,
      wByw: isNWordByWord.value,
      line: currentIndex.value.line,
      fontIdx: currentIndex.value.word,
      tFontIdx: currentIndex.value.tWord,
      currentTime: seek.value * 1000,
      rate: playbackRate.value
    })
  }
})

onBeforeUnmount(() => {
  eventBus.off('update-process')
  eventBus.off('updateSeek')
  destroyController()
})
</script>

<style lang="scss">
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
}

.isZoom .line {
  .lyric-line,
  .translation {
    transform: scale(0.95);
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  &.active {
    .lyric-line {
      transform: scale(1);
    }
  }
}

.line {
  border-radius: 12px;
  margin: 2px 0;
  user-select: none;
  padding: 12px;
  font-weight: 600;
  text-align: v-bind(textAlign);
  .lyric-line,
  .translation {
    transform-origin: v-bind(transformOrigin);
  }

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
    background-repeat: no-repeat;
    background-color: v-bind('`${unplayColor}`');
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-image: -webkit-linear-gradient(
      top,
      var(--color-wbw-text-played),
      var(--color-wbw-text-played)
    );
    background-size: 0 100%;
    overflow-wrap: break-word;
  }
  .translation span {
    font-size: v-bind('`${nFontSize - 2}px`');
    background-repeat: no-repeat;
    background-color: v-bind('`${unplayColor}`');
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-image: -webkit-linear-gradient(top, var(--color-wbw-text), var(--color-wbw-text));
    background-size: 0 100%;
    overflow-wrap: break-word;
  }
}

.line-mode.active {
  .lyric-line span {
    background-color: var(--color-wbw-text-played);
  }
  .translation span {
    background-color: var(--color-wbw-text);
  }
}

.word-mode.played {
  .lyric-line span {
    background-size: 0 100% !important;
  }
  .translation span {
    background-size: 0 100% !important;
  }
}

@media (max-aspect-ratio: 10/9) {
  .main-lyric-container {
    width: 100%;
    .line {
      text-align: center;
      .lyric-line,
      .translation {
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
  // transform: translateX(25vw);
  opacity: 0;
}
</style>
