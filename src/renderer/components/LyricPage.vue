<template>
  <transition name="slide-fade">
    <div
      v-show="!noLyric"
      class="lyric-container"
      @mouseenter="hover = true"
      @mouseleave="hover = false"
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
      <div ref="lyricContainer"></div>
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
  updateMode
} from '../utils/lyricController'

const playerStore = usePlayerStore()
const {
  noLyric,
  currentTrack,
  lyrics,
  seek,
  playing,
  currentLyricIndex,
  currentIndex,
  lyricOffset
} = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showToast } = stateStore

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nFontSize, nTranslationMode, isNWordByWord } = toRefs(normalLyric.value)

const hover = ref(false)
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

watch(currentLyricIndex, (value) => {
  updateLineIndex(value)
})

watch(
  () => currentIndex.value.list,
  (value) => {
    updateFontIndex(value)
  }
)

watch(
  () => currentIndex.value.tList,
  (value) => {
    updateTFontIndex(value)
  }
)

watch(nTranslationMode, (value) => {
  updateMode({
    mode: value,
    currentTime: seek.value * 1000,
    line: currentLyricIndex.value,
    fontIndex: currentIndex.value.list,
    tFontIndex: currentIndex.value.tList
  })
})

watch(seek, (value) => {
  eventBus.emit('update-process', value)
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
      line: currentLyricIndex.value,
      fontIdx: currentIndex.value.list,
      tFontIdx: currentIndex.value.tList,
      currentTime: seek.value * 1000
    })
  }
})

onBeforeUnmount(() => {
  eventBus.off('update-process')
  // eventBus.off('get-line-font-index')
  eventBus.off('updateSeek')
  destroyController()
})
</script>

<style lang="scss">
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
  font-weight: 600;

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
    transition:
      font-size 0.4s ease,
      background-color 0.4s ease;
    background-repeat: no-repeat;
    background-color: rgba(255, 255, 255, 0.28);
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-size: 0 100%;
    overflow-wrap: break-word;
  }
  .translation span {
    font-size: v-bind('`${nFontSize - 2}px`');
    transition:
      font-size 0.4s ease,
      background-color 0.4s ease;
    background-repeat: no-repeat;
    background-color: rgba(255, 255, 255, 0.28);
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-size: 0 100%;
    overflow-wrap: break-word;
  }
}

.line-mode.active {
  .lyric-line span {
    background-color: rgba(255, 255, 255, 0.95);
  }
  .translation span {
    background-color: rgba(255, 255, 255, 0.75);
  }
}

.word-mode.active {
  .lyric-line span {
    background-image: -webkit-linear-gradient(
      top,
      rgba(255, 255, 255, 0.95),
      rgba(255, 255, 255, 0.95)
    );
  }
  .translation span {
    background-image: -webkit-linear-gradient(
      top,
      rgba(255, 255, 255, 0.75),
      rgba(255, 255, 255, 0.75)
    );
  }
}

.slide-fade-enter-active {
  transition: all 0.5s;
}

.slide-fade-leave-active {
  transition: all 0.5s;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(27vh);
  opacity: 0;
}
</style>
