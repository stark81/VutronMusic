import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useAudioEngineStore } from '../store/audioEngine'
import { useSettingsStore } from '../store/settings'
import { useLyricStore } from '../store/lyric'
import { useOsdLyricStore } from '../store/osdLyric'
import { usePluginMusic } from '../store/pluginMusic'
import { computed, toRaw, watch } from 'vue'
import { Track } from '@/types/plugin'
import { RepeatMode } from '@/types/music'

const playerStore = usePlayerStore()
const settingsStore = useSettingsStore()
const lyricStore = useLyricStore()
const osdLyricStore = useOsdLyricStore()
const engineStore = useAudioEngineStore()
const pluginStore = usePluginMusic()

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
  title,
  duration,
  volume,
  seek
} = storeToRefs(playerStore)
const { tray } = storeToRefs(settingsStore)
const { currentIndex } = storeToRefs(lyricStore)
const { show, isLock, type, mode, translationMode } = storeToRefs(osdLyricStore)

const { playOrPause, playPrev, playNext, replaceCurrentTrack, moveToFMTrash } = playerStore
const { getCurrentTime } = engineStore
const { likeATrack, resizeImage } = pluginStore

const shouldSend = computed(() => {
  return (
    (window.env?.isLinux && tray.value.enableExtension) ||
    (window.env?.isMac && tray.value.showLyric)
  )
})

// macOS 和 Windows 使用 Media Session API（Windows 上映射到 SMTC）
const supportsMediaSession = 'mediaSession' in navigator
const useMediaSession = supportsMediaSession && (window.env?.isMac || window.env?.isWindows)

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
  if (shouldSend.value || show.value) {
    window.mainApi?.send('synchronize-player-info', {
      rate: value,
      seek: getCurrentTime() ?? 0
    })
  }

  if (useMediaSession) {
    navigator.mediaSession.setPositionState({
      duration: duration.value,
      playbackRate: value,
      position: getCurrentTime()
    })
  }
})

watch(
  playing,
  (value) => {
    window.mainApi?.send('synchronize-player-info', {
      playing: value,
      seek: getCurrentTime()
    })

    if (useMediaSession) {
      navigator.mediaSession.setPositionState({
        duration: duration.value,
        playbackRate: playbackRate.value,
        position: getCurrentTime()
      })
    }
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
  if (show.value && value) {
    window.mainApi?.send('synchronize-player-info', {
      title: `${value.artists?.[0]?.name || ''} - ${value.name || ''}`
    })
  }

  if (useMediaSession && value) {
    navigator.mediaSession.setPositionState({
      duration: duration.value,
      playbackRate: playbackRate.value,
      position: getCurrentTime()
    })

    updateMediaSessionMetaData(value)
  }
})

watch(setSeek, (value) => {
  if (!value || !show.value || !useMediaSession) return
  window.mainApi?.send('synchronize-player-info', {
    setSeek: getCurrentTime()
  })

  if (useMediaSession) {
    navigator.mediaSession.setPositionState({
      duration: duration.value,
      playbackRate: playbackRate.value,
      position: getCurrentTime()
    })
  }

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

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = remainingSeconds.toFixed(3).padStart(6, '0')
  return `[${formattedMinutes}:${formattedSeconds}]`
}

const updateMediaSessionMetaData = async (track: Track) => {
  // macOS/Windows 没有 mediaSession 支持时跳过（Linux 仍需走 IPC 发给 MPRIS）
  if ((window.env?.isMac || window.env?.isWindows) && !supportsMediaSession) return

  const plugin = track.pluginId

  const artist = track.artists.map((ar) => ar.name).join(',')
  const metadata = {
    title: track.name,
    artist,
    album: track.album?.name,
    artwork: [
      {
        src: await resizeImage(plugin, track.picUrl, 512),
        type: 'image/jpg',
        sizes: '512x512'
      },
      {
        src: await resizeImage(plugin, track.picUrl, 1024),
        type: 'image/jpg',
        sizes: '1024x1024'
      }
    ],
    length: duration.value,
    trackId: track.id,
    url: '/trackid/' + track.id,
    progress: engineStore.getCurrentTime() ?? 0,
    rate: playbackRate.value,
    asText: lyrics.value.map((lrc) => `${formatTime(lrc.start)}${lrc.lyric.text}`).join('\n'),
    lyricOffset: lyricOffset.value
  }
  if (window.env?.isWindows) {
    metadata.artwork = [
      {
        src: await resizeImage(plugin, track.picUrl, 2048),
        type: 'image/jpg',
        sizes: '2048x2048'
      }
    ]
  }
  if (useMediaSession) {
    navigator.mediaSession.metadata = new MediaMetadata(metadata)
  } else {
    window.mainApi?.send('metadata', metadata)
  }
}

const initMediaSession = () => {
  if (useMediaSession) {
    navigator.mediaSession.setActionHandler('play', () => {
      engineStore.play()
      playing.value = true
    })
    navigator.mediaSession.setActionHandler('pause', async () => {
      await engineStore.pause()
      playing.value = false
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (!isPersonalFM.value) playPrev()
      else moveToFMTrash()
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext(isPersonalFM.value))
    navigator.mediaSession.setActionHandler('stop', async () => {
      await engineStore.pause()
      playing.value = false
    })
    navigator.mediaSession.setActionHandler('seekto', (event) => {
      seek.value = event.seekTime!
    })
    navigator.mediaSession.setActionHandler('seekbackward', (event) => {
      seek.value -= event.seekOffset || 10
    })
    navigator.mediaSession.setActionHandler('seekforward', (event) => {
      seek.value += event.seekOffset || 10
    })
    navigator.mediaSession.setPositionState({
      duration: duration.value,
      playbackRate: playbackRate.value,
      position: seek.value > duration.value ? 0 : seek.value
    })
  }
}

const setupVutronMusic = () => {
  if (typeof window === 'undefined') return
  window.vutronmusic = {
    get progress() {
      return engineStore.getCurrentTime()
    },
    get playing() {
      return playing.value
    },
    get volume() {
      return volume.value
    },
    get currentTrack() {
      return toRaw(currentTrack.value || {})
    },
    get isLiked() {
      return isLiked.value
    },
    get repeatMode() {
      return repeatMode.value
    },
    get lyric() {
      const lrcLyrics = lyrics.value
      const hasTLyric = lrcLyrics.some((lrc) => lrc.tlyric && lrc.tlyric.text.trim() !== '')
      const hasRLyric = lrcLyrics.some((lrc) => lrc.rlyric && lrc.rlyric.text.trim() !== '')

      const result = {
        lrc: lrcLyrics.map((lrc) => `${formatTime(lrc.start)}${lrc.lyric.text}`).join('\n'),
        tlyric: hasTLyric
          ? lrcLyrics
              .filter((lrc) => lrc.tlyric)
              .map((lrc) => `${formatTime(lrc.start)}${lrc.tlyric?.text}`)
              .join('\n')
          : '',
        romalrc: hasRLyric
          ? lrcLyrics
              .filter((lrc) => lrc.rlyric)
              .map((lrc) => `${formatTime(lrc.start)}${lrc.rlyric?.text}`)
              .join('\n')
          : ''
      }
      return result
    }
  }
}

const handleIpcRenderer = () => {
  window.mainApi?.on('resume', async () => {
    if (!currentTrack.value) return
    const t = progress.value
    const { pluginId, sourceContext } = currentTrack.value
    await replaceCurrentTrack(pluginId, sourceContext, false)
    seek.value = t
  })

  window.mainApi?.on('play', playOrPause)
  window.mainApi?.on('pause', playOrPause)

  window.mainApi?.on('previous', () => {
    if (!isPersonalFM.value) playPrev()
    else moveToFMTrash()
  })
  window.mainApi?.on('next', () => playNext(isPersonalFM.value))
  window.mainApi?.on('repeat', (_: any, value: RepeatMode) => {
    repeatMode.value = value
  })
  window.mainApi?.on('repeat-shuffle', (_: any, value: boolean) => {
    isShuffle.value = value
  })
  window.mainApi?.on('like', () => {
    if (!currentTrack.value) return
    likeATrack(currentTrack.value)
  })
  window.mainApi?.on('fm-trash', () => {
    moveToFMTrash()
  })
  window.mainApi?.on('setPosition', (_: any, value: number) => {
    seek.value = value
  })
  window.mainApi?.on('increaseVolume', () => {
    if (volume.value + 0.1 >= 1) return (volume.value = 1)
    volume.value += 0.1
  })
  window.mainApi?.on('decreaseVolume', () => {
    if (volume.value - 0.1 <= 0) return (volume.value = 0)
    volume.value -= 0.1
  })
}

setupVutronMusic()

initMediaSession()

handleIpcRenderer()
