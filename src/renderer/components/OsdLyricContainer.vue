<template>
  <div ref="lyricContainer" class="container" :style="containerStyle"> </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, reactive } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'
import {
  initLyric,
  setLyrics,
  updatePlayStatus,
  destroyController,
  updateLineIndex,
  updateFontIndex,
  updateTFontIndex,
  updateMode,
  updateLineMode,
  updateWordByWord
} from '../utils/lyricController'

const osdLyricStore = useOsdLyricStore()
const { isWordByWord, translationMode, type, fontSize, playedLrcColor, unplayLrcColor, mode, font } =
  storeToRefs(osdLyricStore)

const lyricContainer = ref<HTMLElement>()
const playing = ref(false)
const progress = ref(0)
const lyrics = ref({
  lyric: [] as any[],
  tlyric: [] as any[],
  rlyric: [] as any[]
})
const lyricOffset = ref(0)
const indexs = reactive({
  line: -1,
  font: -1,
  tfont: -1
})

const containerStyle = computed(() => {
  const result: Record<string, any> = {}
  result.overflowY = type.value === 'normal' ? 'scroll' : 'hidden'
  result.justifyContent = type.value === 'normal' ? '' : 'center'
  if (font.value) {
    result.fontFamily = font.value
  }
  return result
})

watch(lyrics, (value) => {
  if (value.lyric.length) {
    setLyrics(value)
  } else {
    destroyController()
  }
})

watch(
  () => indexs.font,
  (value) => {
    updateFontIndex(value)
  }
)

watch(
  () => indexs.tfont,
  (value) => {
    updateTFontIndex(value)
  }
)

watch(playing, (value) => {
  updatePlayStatus(value)
})

watch(isWordByWord, (value) => {
  updateWordByWord(value)
})

watch(translationMode, (value) => {
  updateMode({
    mode: value,
    line: indexs.line,
    fontIndex: indexs.font,
    tFontIndex: indexs.tfont,
    currentTime: progress.value
  })
})

watch(mode, (value) => {
  updateLineMode(value === 'oneLine')
})

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data.type === 'update-osd-status') {
    for (const [key, value] of Object.entries(event.data.data) as [string, any]) {
      if (key === 'lyrics') {
        lyrics.value = value
      } else if (key === 'playing') {
        playing.value = value
      } else if (key === 'progress') {
        progress.value = value * 1000
      } else if (key === 'line') {
        indexs.line = value
        updateLineIndex(value)
      } else if (key === 'font') {
        indexs.font = value
      } else if (key === 'tfont') {
        indexs.tfont = value
      }
    }
  }
})

onMounted(() => {
  const player = JSON.parse(localStorage.getItem('player') || '{}')
  playing.value = player?.playing || false
  if (!player.lyrics) return
  lyrics.value = player.lyrics
  if (!lyrics.value.lyric.length) {
    lyrics.value.lyric[0] = {
      start: 0,
      content: `${(player.currentTrack?.artists || player.currentTrack?.ar)[0]?.name} - ${player.currentTrack?.name}`
    }
  }
  lyricOffset.value = (player.currentTrack?.offset || 0) * 1000
  progress.value = (player.progress ?? 0) * 1000

  initLyric({
    container: lyricContainer.value!,
    playing: playing.value,
    mode: translationMode.value,
    wByw: isWordByWord.value,
    line: indexs.line,
    fontIdx: indexs.font,
    tFontIdx: indexs.tfont,
    currentTime: progress.value,
    isMini: type.value === 'small',
    isOneLine: mode.value === 'oneLine'
  })
})

onBeforeUnmount(() => {
  destroyController()
})
</script>

<style lang="scss">
.container {
  user-select: none;
  padding: 0 20px;
  height: calc(100vh - 44px);
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
}

.line {
  border-radius: 12px;
  margin: 2px 0;
  user-select: none;
  padding: 2px 0;
  font-weight: 600;
}

.normal {
  text-align: center;
  &:first-child {
    margin-top: 40vh;
  }

  &:last-child {
    margin-bottom: 40vh;
  }
}

.mini {
  white-space: nowrap;
  overflow: hidden;
}
.one-line {
  text-align: center;
}

.two-line {
  &:first-child {
    text-align: left;
  }
  &:last-child {
    text-align: right;
  }
}

.line {
  .lyric-line span {
    font-size: v-bind('`${fontSize}px`');
    transition:
      font-size 0.4s ease,
      background-color 0.2s ease;
    background-repeat: no-repeat;
    background-color: v-bind('`${unplayLrcColor}`');
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-size: 0 100%;
    overflow-wrap: break-word;
    -webkit-text-stroke: 0.05px rgba(46, 46, 46, 0.3); /* 描边宽度和颜色 */
  }
  .translation span {
    font-size: v-bind('`${fontSize - 4}px`');
    transition:
      font-size 0.4s ease,
      background-color 0.4s ease;
    background-repeat: no-repeat;
    background-color: v-bind('`${unplayLrcColor}`');
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-size: 0 100%;
    overflow-wrap: break-word;
    -webkit-text-stroke: 0.05px rgba(46, 46, 46, 0.3); /* 描边宽度和颜色 */
  }
}

.line-mode.active {
  .lyric-line span {
    background-color: v-bind('`${playedLrcColor}`');
  }
  .translation span {
    background-color: v-bind('`${playedLrcColor}`');
  }
}

.word-mode {
  .lyric-line span {
    background-size: 100% 100%;
    background-image: -webkit-linear-gradient(
      top,
      v-bind('`${playedLrcColor}`'),
      v-bind('`${playedLrcColor}`')
    );
  }
  .translation span {
    background-size: 100% 100%;
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
  }
  .translation span {
    background-size: 100% 100%;
  }
}
</style>
