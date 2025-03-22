<template>
  <div
    v-show="!noLyric"
    class="lyric-container"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div v-show="hover" class="offset">
      <button-icon title="提前0.5s" @click="setOffset(0.5)">
        <svg-icon icon-class="back5s" />
      </button-icon>
      <button-icon class="recovery" :title="offset" @click="setOffset(0)">
        <svg-icon icon-class="recovery" />
      </button-icon>
      <button-icon title="后退0.5s" @click="setOffset(-0.5)">
        <svg-icon icon-class="forward5s" />
      </button-icon>
    </div>
    <div ref="lyricContainer">
      <!-- <div id="line-1" class="line"></div>
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
        @click="seek = Number(line.start) / 1000 + (currentTrack?.offset || 0)"
      >
        <div v-if="line.lyric?.length" class="lyric-line">
          <span
            v-for="(lyric, idx) in line.lyric"
            :key="idx"
            ref="lyricLineSpan"
            :data-start="lyric.start"
            :data-end="lyric.end"
          >
            {{ lyric.word }}</span
          >
        </div>
        <div v-if="nTranslationMode === 'tlyric' && line.tlyric" class="traslation">
          <span
            v-for="(lyric, idx) in line.tlyric"
            :key="idx"
            >{{ lyric.word }}</span
          >
        </div>
        <div v-if="nTranslationMode === 'rlyric' && line.rlyric" class="traslation">
          <span
            v-for="(lyric, idx) in line.rlyric"
            :key="idx"
            >{{ lyric.word }}</span
          >
        </div>
      </div> -->
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, toRefs, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import { initLyric, setLyrics } from '../utils/lyricController'

const playerStore = usePlayerStore()
const { noLyric, currentTrack, lyrics, seek, playing, lyricOffset, startStamp } = storeToRefs(playerStore)

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

watch(() => lyrics.value.lyric.length, (value) => {
  if (!value) return
  setTimeout(() => {
    setLyrics(lyrics.value)
  }, 100)
}, { immediate: true })

onMounted(() => {
  if (!currentTrack.value) return

  const _startStamp = playing.value ? startStamp.value : (performance.now() - seek.value * 1000)
  if (lyricContainer.value) {
    initLyric({
      container: lyricContainer.value, playing: playing.value,
      startStamp: _startStamp, offset: lyricOffset.value,
      mode: nTranslationMode.value, wByw: isNWordByWord.value
    })
  }
})

onBeforeUnmount(() => {})
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
    will-change: background-size;
    transition: font-size 0.4s ease;
    background-repeat: no-repeat;
    background-color: rgba(255,255,255, 0.28);
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-size: 0 100%;
    overflow-wrap: break-word;
  }
  .traslation span {
    font-size: v-bind('`${nFontSize - 2}px`');
    opacity: 0.28;
  }
}

.line-mode.active {
  .lyric-line span {
    background-color: rgba(255,255,255, 0.95);
  }
  .traslation span {
    background-color: rgba(255,255,255, 0.75);
  }
}

.word-mode.active {
  .lyric-line {
    span {
      background-image: -webkit-linear-gradient(top, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95));
    }
    .wordPlayed {
      background-size: 100% 100%;
    }

    // .wordPlaying {
    //   background-size: v-bind('`${width}%`') 100%;
    // }
  }
}
</style>
