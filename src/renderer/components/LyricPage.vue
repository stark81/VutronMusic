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
    <div ref="lyricsRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import { initPlayer, updateLyric, updateLyricIndex, lyricPlay } from '../utils/lyricLine'

const playerStore = usePlayerStore()
const {
  noLyric,
  currentTrack,
  currentLyricIndex,
  lyrics,
  hasTranslation,
  hasRoman,
  seek,
  playing
} = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { isNWordByWord, nTranslationMode, nFontSize } = toRefs(normalLyric.value)

const hover = ref(false)
const lyricsRef = ref<HTMLDivElement>()

const haswByw = computed(() => {
  let result = false
  lyrics.value.forEach((line) => {
    if (line.words.length > 1) {
      result = true
    }
  })
  return isNWordByWord.value && result
})

const showTlyric = computed(() => hasTranslation.value && nTranslationMode.value === 'tlyric')
const showRlyric = computed(() => hasRoman.value && nTranslationMode.value === 'rlyric')

const lyricWithTranslation = computed(() => {
  const ret: any[] = []
  lyrics.value.forEach((line, index) => {
    const { translatedLyric, romanLyric, ...lineInfo } = line

    const lineItem = { index, ...lineInfo }
    if (showTlyric.value) {
      const tWordText = haswByw.value ? translatedLyric.split('') : [translatedLyric]
      const startTime = line.words[0].startTime
      const endTime = line.words[line.words.length - 1].endTime
      const tWords = tWordText.map((t: string, i: number) => {
        const interval = (endTime - startTime) / tWordText.length
        return {
          startTime: Math.round(startTime + interval * i),
          endTime: Math.round(startTime + interval * (i + 1)),
          word: t
        }
      })
      lineItem.translation = tWords
    } else if (showRlyric.value) {
      const rWordText = haswByw.value ? romanLyric.split('') : [romanLyric]
      const startTime = line.words[0].startTime
      const endTime = line.words[line.words.length - 1].endTime
      const tWords = rWordText.map((t: string, i: number) => {
        const interval = (endTime - startTime) / rWordText.length
        return {
          startTime: Math.round(startTime + interval * i),
          endTime: Math.round(startTime + interval * (i + 1)),
          word: t
        }
      })
      lineItem.translation = tWords
    }
    ret.push(lineItem)
  })
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

watch(lyricWithTranslation, (value) => {
  updateLyric(value)
})

watch(playing, (value) => {
  if (value) {
    lyricPlay(seek.value)
  }
})

watch(currentLyricIndex, (value) => {
  updateLyricIndex(value)
  const el = document.getElementById(`line${value}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

onMounted(() => {
  if (!currentTrack.value) return
  lyricsRef.value?.appendChild(
    initPlayer({
      lyrics: lyricWithTranslation.value,
      currentTime: seek.value,
      currentLyricIndex: currentLyricIndex.value,
      mode: haswByw.value ? 'word-mode' : 'line-mode',
      type: 'lyric'
    })
  )
  nextTick(() => {
    const el = document.getElementById(`line${currentLyricIndex.value}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
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

.line-content {
  border-radius: 12px;
  margin: 2px 0;
  user-select: none;
  padding: 12px;
  font-weight: 550;

  &:hover {
    background-color: var(--color-secondary-bg-for-transparent);
  }

  &:first-child {
    margin-top: 40vh;
  }
  &:last-child {
    margin-bottom: 40vh;
  }
}

.line {
  font-size: v-bind('`${nFontSize}px`');
  opacity: 0.28;
}

.translation {
  font-size: v-bind('`${nFontSize - 4}px`');
  opacity: 0.28;
}

.line-mode.active > .line {
  opacity: 0.8;
}

.word-mode.active > .line {
  // opacity: 0.8;
}
</style>
