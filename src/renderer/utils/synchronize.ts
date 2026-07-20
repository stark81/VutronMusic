import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useAudioEngineStore } from '../store/audioEngine'
import { useSettingsStore } from '../store/settings'
import { useLyricStore } from '../store/lyric'
import { useOsdLyricStore } from '../store/osdLyric'
import { computed, toRaw, watch } from 'vue'

const playerStore = usePlayerStore()
const settingsStore = useSettingsStore()
const lyricStore = useLyricStore()
const osdLyricStore = useOsdLyricStore()
const engineStore = useAudioEngineStore()

const {
  isPersonalFM,
  isShuffle,
  playing,
  currentTrack,
  isLiked,
  playbackRate,
  progress,
  lyrics,
  lyricOffset,
  setSeek,
  repeatMode,
  title
  // isEnd
} = storeToRefs(playerStore)
const { tray } = storeToRefs(settingsStore)
const { currentIndex } = storeToRefs(lyricStore)
const { show, isLock, type, mode, translationMode } = storeToRefs(osdLyricStore)

const { getCurrentTime } = engineStore

const shouldSend = computed(() => {
  return (
    (window.env?.isLinux && tray.value.enableExtension) ||
    (window.env?.isMac && tray.value.showLyric)
  )
})

const currentLyric = computed(() => {
  const track = currentTrack.value
  const text = track ? `${track.artists[0]?.name} - ${track.name}` : '听你想听的音乐'
  return lyrics.value[currentIndex.value] || { start: 0, end: 0.01, lyric: { text } }
})

window.mainApi?.on('init-from-osd', () => {
  window.mainApi?.send('synchronize-player-info', {
    line: [currentIndex.value, getCurrentTime(), toRaw(currentLyric.value)],
    playing: playing.value,
    seek: getCurrentTime(),
    title: `${currentTrack.value?.artists[0]?.name} - ${currentTrack.value?.name}`
  })
})

window.mainApi?.on('get-seek', () => {
  window.mainApi?.send('synchronize-player-info', { seek: getCurrentTime() })
})

window.mainApi?.send('initTrayState', {
  lyric: toRaw(currentLyric.value),
  seek: getCurrentTime(),
  playing: playing.value,
  rate: playbackRate.value,
  like: isLiked.value,
  isFM: isPersonalFM.value
})

// ============================================================================= //
//  下面开始监控 store 的变化，同步到主进程，主进程再转发给：tray、touchbar、osd、dbus 等  //
// ============================================================================= //
watch(isLiked, (value) => {
  window.mainApi?.send('synchronize-player-info', {
    like: value
  })
})

watch(currentLyric, (value) => {
  window.mainApi?.send('synchronize-player-info', {
    lyric: toRaw(value),
    seek: getCurrentTime()
  })
})

watch(
  () => [currentIndex.value, progress.value],
  (value) => {
    if (!show.value) return
    window.mainApi?.send('synchronize-player-info', {
      line: [value[0], getCurrentTime()]
    })
  }
)

watch(
  () => [mode.value, translationMode.value],
  () => {
    if (!show.value) return
    window.mainApi?.send('synchronize-player-info', {
      seek: getCurrentTime()
    })
  }
)

watch(lyricOffset, (value) => {
  if (!shouldSend.value || !show.value) return
  window.mainApi?.send('synchronize-player-info', {
    lyricOffset: [value, getCurrentTime()]
  })
})

watch(playbackRate, (value) => {
  if (!shouldSend.value || !show.value) return
  window.mainApi?.send('synchronize-player-info', {
    rate: value,
    seek: getCurrentTime() ?? 0
  })
})

watch(
  playing,
  (value) => {
    window.mainApi?.send('synchronize-player-info', {
      playing: value,
      seek: getCurrentTime()
    })
  },
  { immediate: true }
)

watch(
  isPersonalFM,
  (value) => {
    if (!shouldSend.value) return
    window.mainApi?.send('synchronize-player-info', { isFM: value })
  },
  { immediate: true }
)

watch(lyrics, (value) => {
  if (!shouldSend.value) return
  window.mainApi?.send('synchronize-player-info', {
    lyrics: toRaw(value)
  })
})

watch(currentTrack, (value) => {
  if (!show.value || !value) return
  window.mainApi?.send('synchronize-player-info', {
    title: `${value.artists?.[0]?.name || ''} - ${value.name || ''}`
  })
})

watch(setSeek, (value) => {
  if (!value || !show.value || !shouldSend.value) return
  window.mainApi?.send('synchronize-player-info', {
    setSeek: getCurrentTime()
  })
  setTimeout(() => {
    setSeek.value = false
  })
})

watch(repeatMode, (value) => {
  window.mainApi?.send('synchronize-player-info', { repeatMode: value })
})

watch(isShuffle, (value) => {
  window.mainApi?.send('synchronize-player-info', { shuffle: value })
})

watch(shouldSend, (value, oldValue) => {
  if (oldValue && !value && currentTrack.value) {
    const text = `${currentTrack.value.artists?.[0]?.name || ''} - ${currentTrack.value.name || ''}`
    window.mainApi?.send('synchronize-player-info', {
      lyric: { start: 0, end: 0, lyric: { text } }
    })
  }
})

watch(
  () => tray.value.isWordByWord,
  (value) => {
    window.mainApi?.send('synchronize-player-info', {
      tWByW: value
    })
  }
)

watch(
  () => [tray.value.showLyric, tray.value.showControl, tray.value.lyricWidth],
  (value) => {
    window.mainApi?.send('updateTrayVisibility', {
      lyric: value[0],
      buttons: value[1],
      width: value[2]
    })
    if (value[0]) {
      window.mainApi?.send('synchronize-player-info', {
        seek: getCurrentTime()
      })
    }
  },
  {
    immediate: true
  }
)

watch(title, (value) => {
  if (!window.env?.isMac) {
    window.mainApi?.send('synchronize-player-info', {
      tooltip: value
    })
  }
})

watch(
  show,
  (value) => {
    window.mainApi?.send('updateOsdState', { show: value })
  },
  { immediate: true }
)
watch(type, (value) => {
  window.mainApi?.send('updateOsdState', { type: value })
})
watch(isLock, (value) => {
  window.mainApi?.send('updateOsdState', { isLock: value })
})
