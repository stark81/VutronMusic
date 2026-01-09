import { defineStore } from 'pinia'
import shuffleFn from 'lodash/shuffle'
import cloneDeep from 'lodash/cloneDeep'
import {
  ref,
  computed,
  reactive,
  watch,
  watchEffect,
  onMounted,
  onBeforeUnmount,
  toRaw,
  nextTick
} from 'vue'
import { useLocalMusicStore } from './localMusic'
import { useStreamMusicStore } from './streamingMusic'
import { useSettingsStore } from './settings'
import { useNormalStateStore } from './state'
import { useOsdLyricStore } from './osdLyric'
import { useDataStore } from './data'
import { searchMatch, fmTrash, personalFM, songChorus } from '../api/other'
import { getLyric as getApiLyric, getTrackDetail } from '../api/track'
import { useI18n } from 'vue-i18n'
import _ from 'lodash'
import { extractExpirationFromUrl } from '../utils'
import { Track, serviceName, lyricLine } from '@/types/music'

interface biquadType {
  31: number
  62: number
  125: number
  250: number
  500: number
  1000: number
  2000: number
  4000: number
  8000: number
  16000: number
}

interface userBiquadType {
  [key: string]: biquadType
}

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve('')
    }, ms)
  })

export const usePlayerStore = defineStore(
  'player',
  () => {
    const playing = ref(false)
    const playingNext = ref(false)
    const enabled = ref(false)
    const progress = ref(0)
    const _progress = ref(0)
    const repeatMode = ref('off')
    const _shuffle = ref(false)
    const volume = ref(1)
    const volumeBeforeMuted = ref(1)
    const isPersonalFM = ref(false)
    const currentTrack = ref<Track | null>(null)
    const title = ref<string | null>('VutronMusic')
    const outputDevice = ref('')
    const backRate = ref(1.0)
    const pitch = ref(1.0)
    const isLocalList = ref(false)
    const chorus = ref(0)
    const pic = ref<string>(
      currentTrack.value?.album?.picUrl ||
        'https://p2.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg'
    )
    const playlistSource = ref<{
      type: string
      id: number | string
    }>({ type: 'album', id: 0 })

    const lyrics = ref<lyricLine[]>([])
    const _personalFMLoading = ref(false)
    const _personalFMTrack = ref<{
      id: number
      [key: string]: any
    }>({ id: 0 })
    const _personalFMNextTrack = ref<{
      id: number
      [key: string]: any
    }>({ id: 0 })

    let lastUpdateTime = 0

    const localMusicStore = useLocalMusicStore()
    const streamMusicStore = useStreamMusicStore()
    const { updateTrack, fetchLocalMusic, getALocalTrack, getLocalLyric, getLocalPic } =
      localMusicStore
    const {
      scrobble: scrobbleStream,
      fetchStreamMusic,
      getStreamLyric,
      getStreamPic,
      getAStreamTrack,
      likeAStreamTrack
    } = streamMusicStore
    const dataStore = useDataStore()
    const { likeATrack } = dataStore
    const { t } = useI18n()

    const settingsStore = useSettingsStore()
    const stateStore = useNormalStateStore()
    const { showToast } = stateStore

    const osdLyricStore = useOsdLyricStore()

    const _shuffleList = ref<number[]>([])
    const _list = ref<number[]>([])
    const _playNextList = ref<number[]>([])
    const currentTrackIndex = ref(0)

    const currentIndex = ref(-1)

    let timer: any = null

    const biquadParams = reactive<biquadType>({
      31: 0,
      62: 0,
      125: 0,
      250: 0,
      500: 0,
      1000: 0,
      2000: 0,
      4000: 0,
      8000: 0,
      16000: 0
    })

    const biquadUser = ref<userBiquadType[]>([])
    const biquadParamsKeys = Object.keys(biquadParams)
    const convolverParams = reactive<{
      fileName: string
      buffer: AudioBuffer | null
      mainGain: number
      sendGain: number
    }>({
      fileName: '',
      buffer: null,
      mainGain: 1,
      sendGain: 0
    })

    const audioNodes = {
      audio: null as HTMLAudioElement | null,
      audioContext: null as AudioContext | null,
      audioSource: null as MediaElementAudioSourceNode | null,
      soundtouch: null as null | AudioWorkletNode,
      biquads: new Map<string, BiquadFilterNode>(),
      dynamics: null as DynamicsCompressorNode | null,
      convolverSourceGain: null as GainNode | null,
      convolverOutputGain: null as GainNode | null,
      convolver: null as ConvolverNode | null,
      masterGain: null as GainNode | null
    }

    const currentTrackDuration = computed(() => {
      return ~~((currentTrack.value?.dt || currentTrack.value?.duration || 1000) / 1000)
    })

    const isLiked = computed(() => {
      return (
        !!dataStore.liked.songs.find((id) => id === currentTrack.value?.id) ||
        !!_.flatten(Object.values(streamMusicStore.streamLikedTracks)).find(
          (t) => t.id === currentTrack.value?.id
        )
      )
    })

    const list = computed({
      get: () => (_shuffle.value ? _shuffleList.value : _list.value),
      set: (list) => {
        _list.value = list
      }
    })

    const shuffle = computed({
      get: () => _shuffle.value,
      set: (value) => {
        _shuffle.value = value
        if (value) {
          shuffleTheList()
        }
      }
    })

    watch(volume, (value) => {
      if (!audioNodes.masterGain) return
      const fade = fadeDuration.value
      smoothGain(value, fade)
    })

    watch(pitch, (value) => {
      nextTick(() => {
        // @ts-ignore
        if (audioNodes.soundtouch) audioNodes.soundtouch.parameters.get('pitch').value = value
      })
    })

    const seek = computed({
      get() {
        return _progress.value
      },
      set(value) {
        if (!audioNodes.audio) return
        audioNodes.audio.currentTime = value
        _progress.value = value
        progress.value = value
        lastUpdateTime = value
        currentIndex.value = getLyricIndex(lyrics.value, 0, 1)
        if (window.env?.isLinux) {
          window.mainApi?.send('updatePlayerState', { progress: value })
        }
        navigator.mediaSession.setPositionState({
          duration: currentTrackDuration.value,
          playbackRate: playbackRate.value,
          position: value
        })
        clearTimeout(timer)
        updateIndex()
      }
    })

    const useBiquad = computed(() => {
      return biquadParamsKeys.some((key) => biquadParams[Number(key) as keyof biquadType] !== 0)
    })

    const useConvolver = computed(() => {
      return convolverParams.fileName !== ''
    })

    const usePitch = computed(() => {
      return pitch.value !== 1.0
    })

    const enableDRP = computed(() => settingsStore.misc.enableDiscordRichPresence)

    watch(enableDRP, (value) => {
      if (value) {
        playing.value
          ? playDiscordPresence(currentTrack.value!, audioNodes.audio?.currentTime || 0)
          : pauseDiscordPresence(currentTrack.value!)
      } else {
        pauseDiscordPresence(currentTrack.value!)
      }
    })

    const enableFM = computed(() => settingsStore.misc.lastfm.enable)

    watch(
      () => [audioNodes.audioSource, useBiquad.value, useConvolver.value, usePitch.value],
      (value) => {
        if (!value[0]) return
        audioNodes.audioSource?.disconnect()
        audioNodes.soundtouch?.disconnect()
        audioNodes.biquads.get(`hz${biquadParamsKeys[biquadParamsKeys.length - 1]}`!)?.disconnect()
        audioNodes.masterGain?.disconnect()

        let start = audioNodes.audioSource!
        const lst: Function[] = []
        if (value[3]) lst.push(connectToSoundtouch)
        if (value[1]) lst.push(connectToBiquad)
        if (value[2]) lst.push(connectToConvolver)

        for (const func of lst) {
          start = func(start)
        }
        start.connect(audioNodes.masterGain!)
        audioNodes.masterGain!.connect(audioNodes.audioContext!.destination)
      },
      { immediate: true }
    )

    const fadeDuration = computed(() => {
      const d = settingsStore.general.fadeDuration
      return Math.max(0.1, Math.min(1, Number(d) || 0.2))
    })

    const source = computed(() => {
      if (!currentTrack.value) return ''
      const sourceMap = {
        localTrack: '本地音乐',
        navidrome: 'navidrome',
        emby: 'emby',
        netease: '网易云音乐',
        qq: 'QQ音乐',
        kugou: '酷狗音乐',
        kuwo: '酷我音乐',
        bodian: '波点音乐',
        bilibili: '哔哩哔哩',
        pyncmd: '第三方网易云音乐',
        migu: '咪咕音乐',
        cache: '缓存'
      }
      const sources = currentTrack.value.source?.split('-')
      if (!sources) return sourceMap.netease
      let source = ''
      if (sources.length === 1) {
        source = sourceMap[sources[0]]
      } else {
        source = `${sourceMap[sources[0]]}-${sourceMap[sources[1]]}`
      }
      return `${currentTrack.value.name}, 音源：${source ?? currentTrack.value.source}`
    })

    const playbackRate = computed({
      get: () => backRate.value,
      set: (value) => {
        backRate.value = value
        audioNodes.audio!.playbackRate = value
      }
    })

    watch(playbackRate, (value) => {
      window.mainApi?.send('updatePlayerState', {
        rate: value,
        progress: audioNodes.audio?.currentTime ?? 0
      })
      navigator.mediaSession.setPositionState({
        duration: currentTrackDuration.value,
        playbackRate: value,
        position: seek.value > currentTrackDuration.value ? 0 : seek.value
      })
      clearTimeout(timer)
      updateIndex()
    })

    const shouldGetLrcIndex = computed(() => {
      return (
        stateStore.showLyrics ||
        osdLyricStore.show ||
        (window.env?.isMac && settingsStore.tray.showLyric) ||
        (window.env?.isLinux && settingsStore.tray.enableExtension)
      )
    })

    const noLyric = computed(() => lyrics.value.length === 0)

    // 对于网易云官方的歌曲链接，其有效时间只有 25 分钟，过期后需要重新获取链接
    const isValidUrl = (url: string) => {
      if (!currentTrack.value || !audioNodes.audio) return false
      if (currentTrack.value.source === 'netease') {
        const expiration = extractExpirationFromUrl(url)
        if (!expiration) return true
        const now = new Date()
        const endTime = (now.getTime() +
          (currentTrack.value.dt || currentTrack.value.duration || 0)) as number
        const validTime = new Date(endTime)
        if (validTime >= expiration) return false
        return true
      }
      return true
    }

    const getLyricIndex = (
      lst: { start: number; end: number }[],
      start = 0,
      rate: 1 | 1000 = 1
    ) => {
      if (!lst.length || !audioNodes.audio) return -1
      start = Math.max(start, 0)
      for (let i = start; i < lst.length; i++) {
        if (
          lst[i]?.start &&
          lst[i]?.start / rate > audioNodes.audio.currentTime + lyricOffset.value
        ) {
          return i - 1
        }
      }

      const end = lst.at(-1)!.end
      if (audioNodes.audio.currentTime + lyricOffset.value > end / rate) {
        return lst.length
      } else {
        return lst.length - 1
      }
    }

    watch(shouldGetLrcIndex, (value) => {
      if (value) {
        updateIndex()
      } else {
        clearTimeout(timer)
      }
    })

    watch(
      () => convolverParams.buffer,
      async (value) => {
        if (!audioNodes.audioContext) return
        await nextTick()
        if (value instanceof AudioBuffer) {
          if (audioNodes.convolver) audioNodes.convolver.buffer = value
          audioNodes.convolverSourceGain?.gain.setValueAtTime(
            convolverParams.mainGain,
            audioNodes.audioContext.currentTime
          )
          audioNodes.convolverOutputGain?.gain.setValueAtTime(
            convolverParams.sendGain,
            audioNodes.audioContext.currentTime
          )
        } else {
          if (audioNodes.convolver) audioNodes.convolver.buffer = null
          audioNodes.convolverSourceGain?.gain.setValueAtTime(
            convolverParams.mainGain,
            audioNodes.audioContext.currentTime
          )
          audioNodes.convolverOutputGain?.gain.setValueAtTime(
            convolverParams.sendGain,
            audioNodes.audioContext.currentTime
          )
        }
      }
    )

    watch(outputDevice, (value) => {
      setDevice(value)
    })

    watch(
      () => convolverParams.mainGain,
      (value) => {
        if (convolverParams.buffer && audioNodes.convolverSourceGain) {
          audioNodes.convolverSourceGain.gain.setValueAtTime(
            value,
            audioNodes.audioContext?.currentTime || 0
          )
        }
      }
    )

    watch(
      () => !audioNodes.audio?.paused,
      (value) => {
        playing.value = value
      }
    )

    watch(
      () => convolverParams.sendGain,
      (value) => {
        if (convolverParams.buffer && audioNodes.convolverOutputGain) {
          audioNodes.convolverOutputGain.gain.setValueAtTime(
            value,
            audioNodes.audioContext?.currentTime || 0
          )
        }
      }
    )

    const _refreshLineIdx = () => {
      if (!lyrics.value.length || !shouldGetLrcIndex.value) return
      currentIndex.value = getLyricIndex(lyrics.value, 0, 1)
      const nextLine = lyrics.value[currentIndex.value + 1]

      if (nextLine) {
        const driftTime =
          nextLine.start - ((audioNodes.audio?.currentTime || 0) + lyricOffset.value)
        if (playing.value) {
          timer = setTimeout(
            () => {
              clearTimeout(timer)
              if (!playing.value) return
              _refreshLineIdx()
            },
            (driftTime * 1000) / playbackRate.value
          )
        }
      }
    }
    const updateIndex = () => {
      if (!lyrics.value.length || !shouldGetLrcIndex.value) return
      currentIndex.value = getLyricIndex(lyrics.value, 0, 1)
      if (!shouldGetLrcIndex.value) return
      if (!playing.value) return
      _refreshLineIdx()
    }

    const currentLyric = computed(() => {
      const line = lyrics.value[currentIndex.value]
      if (!line) return { content: currentTrack.value?.name || '听你想听的音乐', time: 0, start: 0 }
      const nextLine = lyrics.value[currentIndex.value + 1]
      const diff = (nextLine ? nextLine.start : currentTrackDuration.value) - line?.start
      return { content: line?.lyric?.text || '', time: diff, start: line?.start || 0 }
    })

    watch(currentLyric, (value) => {
      if (
        window.env?.isLinux &&
        settingsStore.tray.enableExtension &&
        stateStore.extensionCheckResult
      ) {
        window.mainApi?.send('updateLyricInfo', { currentLyric: toRaw(value) })
      }
    })

    watch(
      () => window.env?.isLinux && settingsStore.tray.enableExtension,
      (value) => {
        if (!stateStore.extensionCheckResult) return
        if (value) {
          window.mainApi?.send('updateLyricInfo', { currentLyric: toRaw(currentLyric.value) })
        } else {
          window.mainApi?.send('updateLyricInfo', { currentLyric: { content: '', time: 10 } })
        }
      }
    )

    watch(playing, (value) => {
      window.mainApi?.send('updatePlayerState', {
        playing: value,
        progress: audioNodes.audio?.currentTime || 0
      })
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = value ? 'playing' : 'paused'
        navigator.mediaSession.setPositionState({
          duration: currentTrackDuration.value,
          playbackRate: playbackRate.value,
          position: seek.value > currentTrackDuration.value ? 0 : seek.value
        })
      }
      if (osdLyricStore.show) {
        window.mainApi?.sendMessage({ type: 'update-osd-status', data: { playing: value } })
      }
      progress.value = audioNodes.audio?.currentTime || 0
      _progress.value = audioNodes.audio?.currentTime || 0
      if (value) {
        updateIndex()
      } else {
        clearTimeout(timer)
        timer = null
      }
    })

    watch(
      () => playing.value && settingsStore.general.preventSuspension,
      (value) => {
        window.mainApi?.send('update-powersave', value)
      }
    )

    watch(isLiked, (value) => {
      window.mainApi?.send('updatePlayerState', { like: value })
    })

    watch(repeatMode, (value) => {
      window.mainApi?.send('updatePlayerState', { repeatMode: value })
    })

    watch(isPersonalFM, (value) => {
      window.mainApi?.send('updatePlayerState', { isPersonalFM: value })
    })

    watch(shuffle, (value) => {
      window.mainApi?.send('updatePlayerState', { shuffle: value })
    })

    watchEffect(() => {
      for (const biquad of biquadParamsKeys) {
        const value = biquadParams[biquad]
        const biquadNode = audioNodes.biquads.get(`hz${biquad}`)
        if (biquadNode) biquadNode.gain.value = value
      }
    })

    const lyricOffset = computed(() => {
      return currentTrack.value?.offset ?? 0
    })

    watch(lyricOffset, (value) => {
      clearTimeout(timer)
      updateIndex()
      if (window.env?.isLinux) {
        updateMediaSessionMetaData(currentTrack.value!)
      }
      if (osdLyricStore.show) {
        window.mainApi?.sendMessage({
          type: 'update-osd-status',
          data: { lyricOffset: [value, audioNodes.audio?.currentTime || 0] }
        })
      }
    })

    watch(
      () => [osdLyricStore.mode, osdLyricStore.translationMode],
      () => {
        if (osdLyricStore.show) {
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: { seek: audioNodes.audio?.currentTime || 0 }
          })
        }
      }
    )

    const updateLocalID2OnlineID = (localID: number, onlineID: number) => {
      _list.value = _list.value.map((id) => (id === localID ? onlineID : id))
      if (_shuffle.value) {
        _shuffleList.value = _shuffleList.value.map((id) => (id === localID ? onlineID : id))
        _playNextList.value = _playNextList.value.map((id) => (id === localID ? onlineID : id))
      }
    }

    const searchMatchForLocal = async (track: Track) => {
      if (track.type === 'local' && !track.matched) {
        const params = {
          title: track.name,
          album: '',
          artist: track.artists[0].name,
          duration: (track.dt || track.duration) / 1000,
          md5: track.md5,
          localID: track.id
        }
        const result = await searchMatch(params)
          .then((res: any) => {
            if (res.result.songs.length > 0) {
              const newTrack = res.result.songs[0]
              updateLocalID2OnlineID(track.id, newTrack.id)
              updateTrack(track.filePath, newTrack)
              return getALocalTrack({ filePath: track.filePath })
            }
          })
          .catch((err) => {
            showToast(err)
            return null
          })
        if (result) track = result
      }
      window.mainApi?.send('write-cover', {
        filePath: track.filePath,
        picUrl: track.matched ? track.album?.picUrl || track.al?.picUrl : null,
        currentPlayingPath: track.filePath
      })
      if (track.type === 'online' && !track.cache && settingsStore.autoCacheTrack.enable) {
        window.mainApi?.send('cacheATrack', { id: track.id, url: track.url })
      }
      await getCurrentTrackInfo(track)
      await updateMediaSessionMetaData(track)
      if (osdLyricStore.show) {
        window.mainApi?.sendMessage({
          type: 'update-osd-status',
          data: { title: `${(track.artists || track.ar)[0]?.name} - ${track.name}` }
        })
      }
    }

    const setConvolver = (data: {
      name: string
      source: string
      mainGain: number
      sendGain: number
    }) => {
      convolverParams.fileName = data.source
      convolverParams.mainGain = data.mainGain
      convolverParams.sendGain = data.sendGain

      if (!data.source) {
        convolverParams.buffer = null
        return
      }

      const path = new URL(`../assets/medias/${data.source}`, import.meta.url).href
      try {
        fetch(path)
          .then((res) => res.arrayBuffer())
          .then((arrayBuffer) => audioNodes.audioContext?.decodeAudioData(arrayBuffer))
          .then((buffer) => {
            if (buffer) convolverParams.buffer = buffer
          })
          .catch((err) => {
            console.log(err)
          })
      } catch {
        console.log('set convolver failed!')
      }
    }

    const getCurrentTrackInfo = async (track: Track) => {
      if (!track) return
      chorus.value = 0
      // let data: any
      if (track.matched) {
        songChorus(track.id).then((res) => {
          if (res.chorus.length) {
            chorus.value = res.chorus[0].startTime / 1000 - (currentTrack.value?.offset || 0)
          }
        })
      }
      await getLyric(track)
      seek.value = playing.value ? 0 : progress.value
      currentIndex.value = getLyricIndex(lyrics.value, 0, 1)
    }

    const getLyric = async (track: Track) => {
      let data: lyricLine[] = []
      switch (track.type!) {
        case 'stream':
          data = await getStreamLyric(track)
          break
        case 'online':
          data = await getApiLyric(track.id)
          break
        case 'local':
          data = await _getLocalLyric(track)
          break
        default:
          break
      }

      data = data.filter((l) => !/^作(词|曲)\s*(:|：)\s*无$/.exec(l.lyric.text))
      if (data.length) {
        data.at(-1)!.end =
          data.at(-1)!.end || Math.min(currentTrackDuration.value, data.at(-1)!.start + 10)
      }
      const includeAM =
        data.length <= 10 && data.map((l) => l.lyric.text).includes('纯音乐，请欣赏')
      if (includeAM) {
        const reg = /^作(词|曲)\s*(:|：)\s*/
        const artists = currentTrack.value!.artists ?? currentTrack.value!.ar
        const author = artists[0]?.name
        data = data.filter((l) => {
          const regExpArr = l.lyric.text.match(reg)
          return !regExpArr || l.lyric.text.replace(regExpArr[0], '') !== author
        })
      }
      lyrics.value = data.length === 1 && includeAM ? [] : data
    }

    const _getLocalLyric = async (track: Track) => {
      let data: lyricLine[] = []
      const trackInfoOrder = settingsStore.localMusic.trackInfoOrder
      for (const order of trackInfoOrder) {
        switch (order) {
          case 'online':
            if (track.matched) data = await getApiLyric(track.id)
            break
          default:
            data = await getLocalLyric(track.id)
            break
        }
        if (data.length) return data
      }
      return data
    }

    /**
     * 替换播放列表，前两个参数的目的是为了实现网易云听歌记录的功能，同时为了实现优先本地歌曲时的提示功能
     * @param playlistSourceType 播放列表类型
     * @param playlistSourceID 播放列表ID
     * @param trackIDS 播放列表歌曲ID
     * @param autoPlayTrackID 自动播放歌曲的index
     */
    const replacePlaylist = async (
      playlistSourceType: string,
      playlistSourceID: number | string,
      trackIDS: number[],
      autoPlayTrackID = 0
    ) => {
      if (playlistSourceType.includes('local') && settingsStore.localMusic.scanning) {
        showToast(t('toast.scanning'))
        return
      }
      isPersonalFM.value = false
      _list.value = trackIDS
      isLocalList.value = playlistSourceType.includes('local')

      playlistSource.value = {
        type: playlistSourceType,
        id: playlistSourceID
      }

      if (_shuffle.value) {
        shuffleTheList(autoPlayTrackID)
        currentTrackIndex.value = 0
        replaceCurrentTrack(list.value[currentTrackIndex.value], true)
      } else {
        currentTrackIndex.value = autoPlayTrackID
        replaceCurrentTrack(list.value[autoPlayTrackID], true)
      }
      if (!enabled.value) enabled.value = true
    }

    const replaceCurrentTrack = async (trackID: number | string, autoPlay = true) => {
      if (autoPlay && currentTrack.value?.name) {
        scrobbleFM(currentTrack.value, seek.value)
      }

      const fade = fadeDuration.value
      await smoothGain(0, fade)
      return getLocalMusic(trackID as number).then(async (track) => {
        if (!track) {
          nextTrackCallback()
          return false
        }
        currentTrack.value = track
        searchMatchForLocal(track!)
        const source = await getTrackSource(track!)
        let replaced = false
        if (source) {
          if (track!.id === currentTrack.value?.id) {
            playAudioSource(source, autoPlay)
            replaced = true
          }
        } else {
          showToast(track?.reason)
          _playNextTrack(isPersonalFM.value)
        }
        if (autoPlay && currentTrack.value?.type === 'stream') {
          scrobbleStream(track)
        }
        return replaced
      })
    }

    // const _scrobble = (track: any, time: number, completed = false) => {
    //   const trackDuration = ~~(track.dt / 1000)
    //   time = completed ? trackDuration : ~~time
    //   const sourceID =
    //     playlistSource.value.id === 0 ? track.al?.id || track.album?.id : playlistSource.value.id
    //   scrobble({ id: track.id, sourceid: sourceID, time })
    // }

    const scrobbleFM = (track: Track, time: number, completed = false) => {
      if (!enableFM.value) return
      const trackDuration = ~~(track.dt / 1000)
      time = completed ? trackDuration : ~~time
      if (time >= trackDuration / 2 || time >= 240) {
        const timestamp = ~~(new Date().getTime() / 1000) - time
        const info = {
          artist: (track.artists || track.ar)[0]?.name || '未知歌手',
          track: track.name,
          timestamp,
          album: track.album?.name || (track.al?.name as string) || '未知专辑',
          tracnNumber: track.no || 1,
          duration: trackDuration
        }
        window.mainApi?.send('track-scrobble', info)
      }
    }

    const updateNowPlaying = () => {
      if (!enableFM.value) return
      const track = currentTrack.value!
      const info = {
        artist: (track.artists || track.ar)[0]?.name || '未知歌手',
        track: track!.name,
        album: track.album?.name || (track.al?.name as string) || '未知专辑',
        duration: ~~((track.dt || track.duration) / 1000)
      }
      window.mainApi?.send('update-now-playing', info)
    }

    const playAudioSource = async (source: string, autoPlay = true) => {
      // 切歌时先淡出
      const fade = fadeDuration.value
      await smoothGain(0, fade)
      audioNodes.audio!.src = source
      audioNodes.audio!.load()
      if (autoPlay) {
        play()
        playing.value = true
      }
    }

    const getLocalMusic = (id: number) => {
      return new Promise<Track | undefined>((resolve) => {
        let matchTrack = getALocalTrack({ id })
        if (matchTrack) {
          if (!isLocalList.value) {
            showToast(`使用本地文件播放`)
          }
          matchTrack.source = 'localTrack'
          resolve(matchTrack)
          return
        }
        matchTrack = getAStreamTrack(id)
        if (matchTrack) {
          resolve(matchTrack)
          return
        }
        if (window.env?.isElectron) {
          fetch(`atom://local-asset?type=track&id=${id}`).then((data) => {
            if (data.status === 200) {
              data.json().then((track: Track) => {
                resolve(track)
              })
            } else if (data.status === 404) {
              resolve(undefined)
            }
          })
        } else {
          getTrackDetail(id.toString()).then((data) => {
            if (data.code === 200) {
              resolve(data.songs[0])
            } else {
              resolve(undefined)
            }
          })
        }
      })
    }

    const getTrackSource = (track: Track) => {
      return new Promise<string>((resolve) => {
        if (track.type === 'online' && !track.url) {
          resolve('')
        }
        if (track.type === 'local' || track.cache) {
          resolve(
            `atom://local-asset?type=stream&path=${encodeURIComponent(track.cache ? track.url : track.filePath)}`
          )
        } else {
          // 设置了代理的歌曲链接好像是 https，直通
          resolve(
            track.url.startsWith('https') ? track.url : `atom://get-online-music/${track.url}`
          )
        }
      })
    }

    const getPrevTrack = () => {
      const next = currentTrackIndex.value - 1

      if (repeatMode.value === 'on') {
        if (currentTrackIndex.value === 0) {
          return [list.value[list.value.length - 1], list.value.length - 1]
        }
        if (list.value.length === currentTrackIndex.value + 1) {
          return [list.value[0], 0]
        }
      }
      return [list.value[next], next]
    }

    const playPrev = async () => {
      const [trackID, index] = getPrevTrack()
      if (!trackID) {
        playing.value = false
        return false
      }
      currentTrackIndex.value = index!
      await replaceCurrentTrack(trackID, true)
      return true
    }

    const getNextTrack = (): [number | undefined, number, boolean] => {
      const next = currentTrackIndex.value + 1

      if (_playNextList.value.length > 0) {
        const trackID = _playNextList.value.shift()
        return [trackID!, currentTrackIndex.value, true]
      }

      if (repeatMode.value === 'on') {
        if (list.value.length === currentTrackIndex.value + 1) {
          return [list.value[0], 0, false]
        }
      }
      return [list.value[next], next, false]
    }

    const _playNextTrack = async (isPersonal: boolean) => {
      await pause()
      if (isPersonal) {
        playNextFMTrack()
      } else {
        playNext()
      }
    }

    const playNext = async () => {
      const [trackID, index, isPlayingNext] = getNextTrack()
      playingNext.value = isPlayingNext
      if (!trackID) {
        playing.value = false
        return false
      }
      currentTrackIndex.value = index
      await replaceCurrentTrack(trackID, true)
    }

    const nextTrackCallback = () => {
      seek.value = 0
      clearTimeout(timer)
      scrobbleFM(currentTrack.value!, 0, true)

      if (!isPersonalFM.value && repeatMode.value === 'one') {
        replaceCurrentTrack(currentTrack.value!.id)
      } else {
        _playNextTrack(isPersonalFM.value)
      }
    }

    const playDiscordPresence = (track: Track, seekTime = 0) => {
      if (!enableDRP.value) return
      const copyTrack = { ...track }
      copyTrack.dt -= seekTime * 1000
      window.mainApi?.send('playDiscordPresence', cloneDeep(copyTrack))
    }

    const pauseDiscordPresence = (track: Track) => {
      if (!enableDRP.value) return
      window.mainApi?.send('pauseDiscordPresence', cloneDeep(track))
    }

    const play = async () => {
      if (!audioNodes.audio) return

      try {
        if (!isValidUrl(currentTrack.value?.url || '')) {
          const savedProgress = _progress.value
          await replaceCurrentTrack(currentTrack.value!.id, false)
          audioNodes.audio!.src = currentTrack.value!.url!
          audioNodes.audio!.load()
          seek.value = savedProgress

          setTimeout(() => {
            if (!isValidUrl(currentTrack.value?.url || '')) {
              throw new Error('刷新后 URL 仍然无效')
            }
          }, 20)
        }

        const arts = currentTrack.value?.artists ?? currentTrack.value?.ar
        audioNodes.audio.playbackRate = playbackRate.value

        if (audioNodes.audioContext?.state === 'suspended') {
          await audioNodes.audioContext?.resume()
        }

        // 淡入淡出功能需要调整到 masterGain 上，而不是 audio 元素上，以避免出现爆破音
        const fade = fadeDuration.value
        await smoothGain(volume.value, fade)
        await audioNodes.audio.play()

        title.value = `${currentTrack.value?.name} · ${arts[0].name} - VutronMusic`
        if (!window.env?.isMac) {
          window.mainApi?.send('updateTooltip', title.value)
        }
        document.title = title.value

        playDiscordPresence(currentTrack.value!, audioNodes.audio.currentTime)
        updateNowPlaying()
      } catch (error) {
        if (currentTrack.value?.cache) {
          const isOk = (await window.mainApi?.invoke(
            'deleteACacheTrack',
            currentTrack.value.id
          )) as boolean
          if (isOk) {
            replaceCurrentTrack(currentTrack.value!.id, true)
          } else {
            showToast(`歌曲 ${currentTrack.value?.name} 播放错误，正在切换下一首...`)
            _playNextTrack(isPersonalFM.value)
          }
        } else {
          console.log('==2=2=11=1=1====', error)
          showToast(`歌曲 ${currentTrack.value?.name} 的音乐链接已过期，正在重新获取...`)
          replaceCurrentTrack(currentTrack.value!.id, true)
        }
      }
    }

    const pause = async () => {
      if (!audioNodes.audio) return
      const fade = fadeDuration.value
      await smoothGain(0, fade)
      audioNodes.audio?.pause()
      title.value = 'VutronMusic'
      if (!window.env?.isMac) {
        window.mainApi?.send('updateTooltip', title.value)
      }
      document.title = title.value
      pauseDiscordPresence(currentTrack.value!)
    }

    const playOrPause = async () => {
      if (playing.value) {
        playing.value = false
        await pause()
        audioNodes.audioContext?.suspend()
      } else {
        play()
        playing.value = true
      }
    }

    const setDevice = (device: string) => {
      if ('setSinkId' in AudioContext.prototype) {
        // @ts-ignore
        audioNodes.audioContext?.setSinkId(device)
      }
    }

    const switchRepeatMode = () => {
      if (repeatMode.value === 'on') {
        repeatMode.value = 'one'
      } else if (repeatMode.value === 'one') {
        repeatMode.value = 'off'
      } else {
        repeatMode.value = 'on'
      }
    }

    const shuffleTheList = (firstTrackID = 0) => {
      const id = _list.value[firstTrackID]
      const list = _list.value.filter((trackID) => trackID !== id)
      // if (firstTrackID === 0) list = _list.value
      _shuffleList.value = shuffleFn(list)
      _shuffleList.value.unshift(id)
    }

    const addTrackToPlayNext = (trackID: number | number[], playNow = false, addToHead = false) => {
      if (typeof trackID === 'object') {
        _playNextList.value = [..._playNextList.value, ...trackID]
      } else {
        addToHead ? _playNextList.value.unshift(trackID) : _playNextList.value.push(trackID)
      }
      if (playNow) playNext()
    }

    const _handleTimeUpdate = () => {
      if (!audioNodes.audio) return
      if (Math.abs(audioNodes.audio.currentTime - lastUpdateTime) >= 1) {
        _progress.value = audioNodes.audio.currentTime
        lastUpdateTime = audioNodes.audio.currentTime
      }
      if (window.env?.isLinux) {
        window.mainApi?.send('updatePlayerState', { progress: audioNodes.audio.currentTime })
      }
    }

    const destroAudioNode = async () => {
      if (audioNodes.audio) {
        audioNodes.audio.removeEventListener('timeupdate', _handleTimeUpdate)
        audioNodes.audio.removeEventListener('ended', nextTrackCallback)
        audioNodes.audio.pause()

        audioNodes.audioSource?.disconnect()
        audioNodes.biquads.forEach((filter) => {
          filter.disconnect()
        })
        audioNodes.soundtouch?.disconnect()
        audioNodes.dynamics?.disconnect()
        audioNodes.convolver?.disconnect()
        audioNodes.convolverOutputGain?.disconnect()
        audioNodes.convolverSourceGain?.disconnect()
        audioNodes.masterGain?.disconnect()

        audioNodes.audio = null
        audioNodes.audioSource = null
        audioNodes.soundtouch = null
        audioNodes.biquads.clear()
        audioNodes.dynamics = null
        if (audioNodes.convolver) audioNodes.convolver.buffer = null
        audioNodes.convolver = null
        audioNodes.convolverOutputGain = null
        audioNodes.convolverSourceGain = null
        audioNodes.masterGain = null
        await audioNodes.audioContext?.close()
        audioNodes.audioContext = null
      }
    }

    const connectToBiquad = (sourceNode: AudioNode) => {
      const first = biquadParamsKeys[0]
      sourceNode.connect(audioNodes.biquads.get(`hz${first}`)!)
      const last = biquadParamsKeys[biquadParamsKeys.length - 1]
      return audioNodes.biquads.get(`hz${last}`)!
    }

    const connectToConvolver = (sourceNode: AudioNode) => {
      sourceNode.connect(audioNodes.convolverSourceGain!)
      sourceNode.connect(audioNodes.convolver!)
      // audioNodes.dynamics!.connect(audioNodes.masterGain!)
      return audioNodes.dynamics!
    }

    const connectToSoundtouch = (sourceNode: AudioNode) => {
      sourceNode.connect(audioNodes.soundtouch!)
      return audioNodes.soundtouch!
    }

    const setupAudioNode = async () => {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preservesPitch = true
      audio.volume = 1
      audio.onended = null
      audioNodes.audio = audio
      seek.value = progress.value
      playbackRate.value = backRate.value

      audioNodes.audio.addEventListener('timeupdate', _handleTimeUpdate)
      audioNodes.audio.addEventListener('ended', nextTrackCallback)

      audioNodes.audioContext = new AudioContext()
      audioNodes.audioSource = audioNodes.audioContext.createMediaElementSource(audioNodes.audio)
      await audioNodes.audioContext.suspend()

      setConvolver({
        name: '',
        source: convolverParams.fileName,
        mainGain: convolverParams.mainGain,
        sendGain: convolverParams.sendGain
      })

      for (const [key, value] of Object.entries(biquadParams)) {
        const filter = audioNodes.audioContext.createBiquadFilter()
        audioNodes.biquads.set(`hz${key}`, filter)
        filter.type = 'peaking'
        filter.frequency.value = Number(key)
        filter.Q.value = 1.4
        filter.gain.value = value
      }
      for (let i = 1; i < biquadParamsKeys.length; i++) {
        const prev = biquadParamsKeys[i - 1]
        const curr = biquadParamsKeys[i]
        audioNodes.biquads.get(`hz${prev}`)!.connect(audioNodes.biquads.get(`hz${curr}`)!)
      }

      audioNodes.dynamics = audioNodes.audioContext.createDynamicsCompressor()
      audioNodes.convolver = audioNodes.audioContext.createConvolver()
      audioNodes.convolverOutputGain = audioNodes.audioContext.createGain()
      audioNodes.convolverSourceGain = audioNodes.audioContext.createGain()
      audioNodes.masterGain = audioNodes.audioContext.createGain()

      audioNodes.convolver.connect(audioNodes.convolverOutputGain)
      audioNodes.convolverSourceGain.connect(audioNodes.dynamics)
      audioNodes.convolverOutputGain.connect(audioNodes.dynamics)
      audioNodes.convolver.buffer =
        convolverParams.buffer instanceof ArrayBuffer ? convolverParams.buffer : null
      audioNodes.convolverSourceGain.gain.value = convolverParams.mainGain
      audioNodes.convolverOutputGain.gain.value = convolverParams.sendGain

      audioNodes.masterGain.gain.setValueAtTime(0, audioNodes.audioContext.currentTime)

      await audioNodes.audioContext.audioWorklet.addModule(
        new URL('../utils/soundtouch-worklet.js', import.meta.url)
      )
      const soundtouch = new AudioWorkletNode(audioNodes.audioContext, 'soundtouch-processor')
      audioNodes.soundtouch = soundtouch
      // @ts-ignore
      audioNodes.soundtouch.parameters.get('pitch').value = pitch.value

      let start = audioNodes.audioSource
      const lst: Function[] = []
      if (usePitch.value) lst.push(connectToSoundtouch)
      if (useBiquad.value) lst.push(connectToBiquad)
      if (useConvolver.value) lst.push(connectToConvolver)

      for (const func of lst) {
        start = func(start)
      }
      start.connect(audioNodes.masterGain)
      audioNodes.masterGain.connect(audioNodes.audioContext!.destination)

      setDevice(outputDevice.value)
    }

    const getPic = async (track: Track, size: number = 128) => {
      if (track.type === 'local') {
        return await getLocalPic(track.id, size)
      } else if (track.type === 'stream') {
        return getStreamPic(track, size)!
      } else {
        let url = (track.album || track.al).picUrl
        url = url.replace('http://', 'https://')
        return url + `?param=${size}y${size}`
      }
    }

    const updateMediaSessionMetaData = async (track: Track) => {
      if ('mediaSession' in navigator === false) return

      if (pic.value?.startsWith('blob:')) {
        URL.revokeObjectURL(pic.value)
      }
      pic.value = await getPic(track, 1024)

      const arts = track.artists ?? track.ar
      const artists = arts.map((a) => a.name)
      const metadata = {
        title: track.name,
        artist: artists.join(','),
        album: track.album?.name ?? track.al?.name,
        artwork: [
          {
            src: await getPic(track, 512),
            type: 'image/jpg',
            sizes: '512x512'
          },
          {
            src: await getPic(track, 1024),
            type: 'image/jpg',
            sizes: '1024x1024'
          }
        ],
        length: currentTrackDuration.value,
        trackId: track.id,
        url: '/trackid/' + track.id,
        progress: audioNodes.audio?.currentTime ?? 0,
        rate: playbackRate.value,
        asText: lyrics.value.map((lrc) => `${formatTime(lrc.start)}${lrc.lyric.text}`).join('\n'),
        lyricOffset: lyricOffset.value
      }
      if (window.env?.isWindows) {
        metadata.artwork = [
          {
            src: await getPic(track, 2048),
            type: 'image/jpg',
            sizes: '2048x2048'
          }
        ]
      }
      navigator.mediaSession.metadata = null
      navigator.mediaSession.metadata = new MediaMetadata(metadata)
      if (window.env?.isLinux) {
        if (track.type === 'stream') {
          metadata.artwork.map((art) => {
            const url = `http://localhost:${window.env?.isDev ? 40001 : 41830}` + art.src
            art.src = url
          })
        } else if (track.type === 'local') {
          metadata.artwork.map((art) => {
            const url = `http://localhost:${window.env?.isDev ? 40001 : 41830}/local-asset?id=${track.id}&size=${art.sizes.split('x')[0]}`
            art.src = url
          })
        }
        window.mainApi?.send('metadata', metadata)
      }
    }

    const resetPlayer = (resetBiq = true) => {
      list.value = []
      enabled.value = false
      currentTrackIndex.value = 0
      currentTrack.value = null
      progress.value = 0
      _shuffleList.value = []
      _list.value = []
      isPersonalFM.value = false
      lyrics.value = []
      if (pic.value.startsWith('blob:')) {
        URL.revokeObjectURL(pic.value)
        pic.value = new URL(`../assets/images/default.jpg`, import.meta.url).href
      }

      if (resetBiq) {
        volume.value = 1
        _shuffle.value = false
        repeatMode.value = 'off'
        for (const key in biquadParams) {
          biquadParams[key] = 0
        }
      }
    }

    const handleIpcRenderer = () => {
      window.addEventListener('message', (event) => {
        if (event.data.type === 'init-from-osd') {
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: {
              line: [currentIndex.value, audioNodes.audio?.currentTime || 0],
              playing: playing.value,
              seek: audioNodes.audio?.currentTime || 0,
              title: `${(currentTrack.value?.artists || currentTrack.value?.ar)[0]?.name} - ${currentTrack.value?.name}`
            }
          })
        } else if (event.data.type === 'get-seek') {
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: { seek: audioNodes.audio?.currentTime || 0 }
          })
        }
      })

      watch(
        () => [currentIndex.value, progress.value],
        (value) => {
          if (osdLyricStore.show)
            window.mainApi?.sendMessage({
              type: 'update-osd-status',
              data: { line: [value[0], audioNodes.audio?.currentTime || 0] }
            })
        }
      )

      watch(backRate, (value) => {
        if (osdLyricStore.show)
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: { rate: value }
          })
      })

      watch(lyrics, (value) => {
        if (osdLyricStore.show) {
          const newLyric = _.cloneDeep(value)
          if (!newLyric.length) {
            newLyric[0] = {
              start: 0,
              end: 0,
              lyric: {
                text: `${(currentTrack.value?.artists || currentTrack.value?.ar)[0].name} - ${currentTrack.value?.name}`
              }
            }
          }
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: { lyrics: toRaw(newLyric) }
          })
        }
      })

      watch(
        () => osdLyricStore.show,
        (value) => {
          if (!value) window.mainApi?.closeMessagePort()
        }
      )

      window.mainApi?.on('resume', async () => {
        if (!currentTrack.value) return
        const t = _progress.value
        await replaceCurrentTrack(currentTrack.value.id, false)
        audioNodes.audio!.src = currentTrack.value!.url!
        audioNodes.audio!.load()
        seek.value = t
      })

      window.mainApi?.on('play', () => {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.classList?.contains('comment-input')
        ) {
          return
        }
        playOrPause()
      })
      window.mainApi?.on('previous', () => {
        if (!isPersonalFM.value) playPrev()
        else moveToFMTrash()
      })
      window.mainApi?.on('next', () => _playNextTrack(isPersonalFM.value))
      window.mainApi?.on('repeat', (_: any, value: string) => {
        repeatMode.value = value
      })
      window.mainApi?.on('repeat-shuffle', (_: any, value: boolean) => {
        shuffle.value = value
      })
      window.mainApi?.on('like', () => {
        if (!currentTrack.value) return
        if (currentTrack.value?.type === 'stream') {
          const op = currentTrack.value.starred ? 'unstar' : 'star'
          likeAStreamTrack(op, currentTrack.value)
        } else if (currentTrack.value?.matched) {
          likeATrack(currentTrack.value.id)
        }
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

    const initMediaSession = () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
          play()
          playing.value = true
        })
        navigator.mediaSession.setActionHandler('pause', () => {
          pause()
          playing.value = false
        })
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (!isPersonalFM.value) playPrev()
          else moveToFMTrash()
        })
        navigator.mediaSession.setActionHandler('nexttrack', () =>
          _playNextTrack(isPersonalFM.value)
        )
        navigator.mediaSession.setActionHandler('stop', () => {
          pause()
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
          duration: currentTrackDuration.value,
          playbackRate: playbackRate.value,
          position: seek.value > currentTrackDuration.value ? 0 : seek.value
        })
      }
    }

    const loadPersonalFMNextTrack = () => {
      if (_personalFMLoading.value) {
        return [false, { id: 0 }]
      }
      _personalFMLoading.value = true
      return personalFM()
        .then((result: any) => {
          if (!result || !result.data) {
            _personalFMNextTrack.value = { id: 0 }
          } else {
            _personalFMNextTrack.value = result.data[0]
            // 缓存下一首歌，待处理
          }
          _personalFMLoading.value = false
          return [true, _personalFMNextTrack.value]
        })
        .catch(() => {
          _personalFMNextTrack.value = { id: 0 }
          _personalFMLoading.value = false
          return [false, _personalFMNextTrack.value]
        })
    }

    const playNextFMTrack = async () => {
      if (_personalFMLoading.value) return false

      isPersonalFM.value = true
      if (_personalFMNextTrack.value.id === 0) {
        _personalFMLoading.value = true
        let result: any = null
        let retryCount = 5
        for (; retryCount >= 0; retryCount--) {
          result = await personalFM().catch(() => null)
          if (!result) {
            _personalFMLoading.value = false
            showToast(t('player.getFMTimeout'))
            return false
          }
          if (result.data?.length > 0) {
            break
          } else if (retryCount > 0) {
            await delay(1000)
          }
        }
        _personalFMLoading.value = false
        if (retryCount < 0) {
          showToast(t('player.getFMOverCount'))
          return false
        }
        _personalFMTrack.value = result.data[0]
      } else {
        if (_personalFMNextTrack.value.id === _personalFMTrack.value.id) {
          return false
        }
        _personalFMTrack.value = _personalFMNextTrack.value
      }
      if (isPersonalFM.value) {
        replaceCurrentTrack(_personalFMTrack.value.id)
      }
      loadPersonalFMNextTrack()
      return true
    }

    const personalFMTrack = computed(() => _personalFMTrack.value)
    const personalFMNextTrack = computed(() => _personalFMNextTrack.value)

    const playPersonalFM = () => {
      isPersonalFM.value = true
      if (!enabled.value) enabled.value = true
      if (currentTrack.value?.id !== _personalFMTrack.value.id) {
        playlistSource.value.type = 'personalFM'
        playlistSource.value.id = _personalFMTrack.value.id
        replaceCurrentTrack(_personalFMTrack.value.id, true)
      } else {
        playOrPause()
      }
    }

    const moveToFMTrash = async () => {
      isPersonalFM.value = true
      const id = _personalFMTrack.value.id
      if (await playNextFMTrack()) {
        fmTrash(id)
      }
    }

    const clearPlayNextList = () => {
      _playNextList.value = []
    }

    const smoothGain = async (to: number, duration: number) => {
      if (!audioNodes.audioContext || !audioNodes.masterGain) return
      const now = audioNodes.audioContext.currentTime
      audioNodes.masterGain?.gain.cancelAndHoldAtTime(now)

      if (audioNodes.audioContext.state === 'running') {
        audioNodes.masterGain?.gain.linearRampToValueAtTime(to, now + duration)
        await delay(duration * 1000)
      } else {
        audioNodes.masterGain?.gain.setValueAtTime(to, now)
      }
    }

    const formatTime = (seconds: number) => {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      const formattedMinutes = minutes.toString().padStart(2, '0')
      const formattedSeconds = remainingSeconds.toFixed(3).padStart(6, '0')
      return `[${formattedMinutes}:${formattedSeconds}]`
    }

    if (typeof window !== 'undefined') {
      window.vutronmusic = {
        get progress() {
          return audioNodes.audio?.currentTime || 0
        },
        get playing() {
          return playing.value
        },
        get volume() {
          return currentTrack.value?.volume || 0
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
          const hasTLyric = lyrics.value.some((lrc) => lrc.tlyric && lrc.tlyric.text.trim() !== '')
          const hasRLyric = lyrics.value.some((lrc) => lrc.rlyric && lrc.rlyric.text.trim() !== '')

          const result = {
            lrc: lyrics.value.map((lrc) => `${formatTime(lrc.start)}${lrc.lyric.text}`).join('\n'),
            tlyric: hasTLyric
              ? lyrics.value
                  .filter((lrc) => lrc.tlyric)
                  .map((lrc) => `${formatTime(lrc.start)}${lrc.tlyric?.text}`)
                  .join('\n')
              : '',
            romalrc: hasRLyric
              ? lyrics.value
                  .filter((lrc) => lrc.rlyric)
                  .map((lrc) => `${formatTime(lrc.start)}${lrc.rlyric?.text}`)
                  .join('\n')
              : ''
          }
          return result
        }
      }
    }

    onMounted(async () => {
      await Promise.all([fetchLocalMusic(), fetchStreamMusic()])
      await nextTick()
      await setupAudioNode()
      playing.value = false
      title.value = 'VutronMusic'
      handleIpcRenderer()
      initMediaSession()
      if (enabled.value) {
        if (currentTrack.value?.type === 'stream') {
          if (
            !streamMusicStore.loginedServices.length ||
            !streamMusicStore.loginedServices
              .map((s) => s.name)
              .includes(currentTrack.value.source as serviceName)
          ) {
            resetPlayer(false)
            return
          }
        }
        replaceCurrentTrack(currentTrack.value!.id, false).then(() => {
          playDiscordPresence(currentTrack.value!, audioNodes.audio!.currentTime)
          setTimeout(() => {
            window.mainApi?.send('updatePlayerState', {
              playing: playing.value,
              progress: audioNodes.audio?.currentTime || 0,
              isPersonalFM: isPersonalFM.value,
              like: isLiked.value,
              repeatMode: repeatMode.value,
              shuffle: shuffle.value
            })
          })
        })
      }
      if (
        _personalFMTrack.value.id === 0 ||
        _personalFMNextTrack.value.id === 0 ||
        _personalFMTrack.value.id === _personalFMNextTrack.value.id
      ) {
        personalFM().then((result: any) => {
          _personalFMTrack.value = result.data[0]
          _personalFMNextTrack.value = result.data[1]
        })
      }
    })

    onBeforeUnmount(() => {
      progress.value = audioNodes.audio?.currentTime || 0
      if (pic.value.startsWith('blob:')) URL.revokeObjectURL(pic.value)
      destroAudioNode()
    })

    return {
      playing,
      enabled,
      progress,
      seek,
      pic,
      chorus,
      backRate,
      playbackRate,
      pitch,
      repeatMode,
      title,
      shuffle,
      lyricOffset,
      volume,
      volumeBeforeMuted,
      _list,
      _shuffleList,
      _shuffle,
      _playNextList,
      list,
      currentTrack,
      isPersonalFM,
      source,
      currentTrackIndex,
      currentIndex,
      currentLyric,
      currentTrackDuration,
      outputDevice,
      biquadParams,
      biquadUser,
      convolverParams,
      isLiked,
      isLocalList,
      lyrics,
      noLyric,
      personalFMTrack,
      personalFMNextTrack,
      playlistSource,
      fadeDuration,
      setConvolver,
      replacePlaylist,
      playPrev,
      _playNextTrack,
      clearPlayNextList,
      updateLocalID2OnlineID,
      playOrPause,
      resetPlayer,
      setDevice,
      switchRepeatMode,
      addTrackToPlayNext,
      playPersonalFM,
      playNextFMTrack,
      moveToFMTrash
    }
  },
  {
    persist: {
      omit: ['pic', 'title', 'outputDevice']
    }
  }
)
