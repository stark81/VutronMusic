import { watch, ref, computed } from 'vue'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'

const playerStore = usePlayerStore()
const { playing, startStamp, seek, lyricOffset, lyrics, currentTrack } = storeToRefs(playerStore)
const currentIndex = ref(-1)

let enable = true

export const currentLyric = computed(() => {
  if (currentIndex.value < 0) {
    return { content: currentTrack.value?.name || '听你想听的音乐', time: 0 }
  }
  const nextLyric = lyrics.value.lyric[currentIndex.value + 1]
  const diff = nextLyric?.time - lyrics.value.lyric[currentIndex.value]?.time || 10
  return { content: lyrics.value.lyric[currentIndex.value].content, time: diff }
})

let lyricTimeout: any = null

const getStartTime = () => {
  const startTime = playing.value ? startStamp.value : performance.now() - seek.value * 1000
  const currentTime = performance.now() - startTime + lyricOffset.value * 1000
  return currentTime
}

const findIndex = (lst: { time: number }[], currentTime: number) => {
  for (let i = 0; i < lst.length; i++) {
    if (lst[i].time > currentTime) {
      return i - 1
    }
  }
  return lst.length - 1
}

const getLyric = () => {
  if (lyrics.value.lyric.length === 0) return
  const currentTime = getStartTime()
  currentIndex.value = findIndex(lyrics.value.lyric, currentTime / 1000)

  if (currentIndex.value < lyrics.value.lyric.length - 1) {
    const idx = currentIndex.value + 1
    const driftTime = lyrics.value.lyric[idx]?.time * 1000 - currentTime
    if (playing.value) {
      lyricTimeout = setTimeout(() => {
        clearTimeout(lyricTimeout)
        if (!playing.value || !enable) return
        getLyric()
      }, driftTime)
    }
  }
}

export const updateEnable = (val: boolean) => {
  enable = val
  if (val) {
    getLyric()
  } else {
    clearTimeout(lyricTimeout)
  }
}

watch(playing, (val) => {
  if (val && enable) {
    clearTimeout(lyricTimeout)
    const currentTime = getStartTime()
    currentIndex.value = findIndex(lyrics.value.lyric, currentTime / 1000)
    getLyric()
  } else {
    clearTimeout(lyricTimeout)
  }
})

watch(
  () => lyrics.value.lyric.length,
  () => {
    clearTimeout(lyricTimeout)
    const currentTime = getStartTime()
    currentIndex.value = findIndex(lyrics.value.lyric, currentTime / 1000)
    getLyric()
  },
  { immediate: true }
)

watch(lyricOffset, () => {
  clearTimeout(lyricTimeout)
  const currentTime = getStartTime()
  currentIndex.value = findIndex(lyrics.value.lyric, currentTime / 1000)
  getLyric()
})

watch(
  seek,
  () => {
    clearTimeout(lyricTimeout)
    const currentTime = getStartTime()
    currentIndex.value = findIndex(lyrics.value.lyric, currentTime / 1000)
    getLyric()
  },
  { immediate: true }
)
