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
    {{ lyrics }}
    <!-- <BackgroundRender :album="pic" />
    <LyricPlayer :lyric-lines="lyrics" :current-time="seek" /> -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
// import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
// import eventBus from '../utils/eventBus'
// import { LyricPlayer, BackgroundRender } from '@applemusic-like-lyrics/vue'

const playerStore = usePlayerStore()
const { noLyric, currentTrack, currentLyricIndex, lyrics, seek, playing } = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

// const settingsStore = useSettingsStore()
// const { normalLyric } = storeToRefs(settingsStore)
// const { isNWordByWord } = toRefs(normalLyric.value)

const hover = ref(false)
const startTime = ref(0)
const progress = ref(0)
// const width = ref(0)
// const tWidth = ref(0)
let animationFrameId: number | null = null

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

// const lyricOffset = computed(() => currentTrack.value?.offset || 0)

// const animate = () => {
//   if (!lyrics.value.lyric?.length) return
//   progress.value = performance.now() - startTime.value + lyricOffset.value * 1000
//   animationFrameId = requestAnimationFrame(animate)
// }

watch(currentLyricIndex, (value) => {
  const el = document.getElementById(`line${value}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})

// watch(playing, (value) => {
//   if (animationFrameId) {
//     cancelAnimationFrame(animationFrameId)
//     animationFrameId = null
//   }
//   if (value) {
//     startTime.value = performance.now() - progress.value
//     animate()
//   }
// })

watch(showLyrics, (value) => {
  if (value)
    nextTick(() => {
      const el = document.getElementById(`line${currentLyricIndex.value}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
})

// watch(progress, (value) => {
//   if (!lyricWithTranslation.value.length) {
//     if (animationFrameId) {
//       cancelAnimationFrame(animationFrameId)
//       animationFrameId = null
//     }
//     return
//   }
//   const line = lyricWithTranslation.value[currentLyricIndex.value]
//   if (!line?.lyric) {
//     if (animationFrameId) {
//       cancelAnimationFrame(animationFrameId)
//       animationFrameId = null
//     }
//     return
//   }

//   for (const word of line.lyric) {
//     if (value >= word.start && value < word.end) {
//       width.value = Math.round(((value - word.start) / (word.end - word.start)) * 100)
//     }
//   }
//   if (line.tlyric) {
//     for (const word of line.tlyric) {
//       if (value >= word.start && value < word.end) {
//         tWidth.value = Math.round(((value - word.start) / (word.end - word.start)) * 100)
//       }
//     }
//   } else if (line.rlyric) {
//     for (const word of line.rlyric) {
//       if (value >= word.start && value < word.end) {
//         tWidth.value = Math.round(((value - word.start) / (word.end - word.start)) * 100)
//       }
//     }
//   }
// })

// @ts-ignore
// eventBus.on('update-process', (value: number) => {
//   if (animationFrameId) {
//     cancelAnimationFrame(animationFrameId)
//     animationFrameId = null
//   }
//   progress.value = value * 1000
//   startTime.value = performance.now() - progress.value
//   if (playing.value) {
//     animate()
//   }
// })

onMounted(() => {
  if (!currentTrack.value) return
  // console.log('===1===', lyrics.value)
  nextTick(() => {
    const el = document.getElementById(`line${currentLyricIndex.value}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    progress.value = (seek.value ?? 0) * 1000
    startTime.value = performance.now() - progress.value
    if (playing.value) {
      // animate()
    }
  })
})

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
})
</script>

<style scoped lang="scss">
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
</style>
