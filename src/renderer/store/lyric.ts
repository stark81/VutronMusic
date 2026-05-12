import { lyricLine } from '@/types/music'
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useLyricStore = defineStore('lyric', () => {
  let timer: ReturnType<typeof setTimeout>
  const lyrics = ref<lyricLine[]>([])
  const currentIndex = ref(-1)
  const offset = ref(0)

  const noLyric = computed(() => !lyrics.value.length)
  const shouldGetLrcIndex = computed(() => true)
  const currentLyric = computed(() => '')

  watch(shouldGetLrcIndex, (value) => {
    if (value) {
      updateIndex()
    } else {
      clearTimeout(timer)
    }
  })
  watch(offset, () => {})
  watch(currentLyric, () => {})

  function getLyricIndex() {}
  function refreshLineIdx() {}
  function updateIndex() {
    timer = setTimeout(() => {})
  }

  return {
    lyrics,
    offset,
    noLyric,
    currentLyric,
    currentIndex,
    getLyricIndex,
    refreshLineIdx,
    updateIndex
  }
})
