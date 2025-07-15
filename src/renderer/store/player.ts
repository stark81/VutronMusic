import { defineStore } from 'pinia'
import shuffleFn from 'lodash/shuffle'
import { lyricParse } from '../utils/lyric'
import { ref, computed, reactive, watch, watchEffect, onMounted, onBeforeUnmount, toRaw } from 'vue'
import { Track, useLocalMusicStore } from './localMusic'
import { useStreamMusicStore } from './streamingMusic'
import { useSettingsStore } from './settings'
import { useNormalStateStore } from './state'
import { useOsdLyricStore } from './osdLyric'
import { useDataStore } from './data'
import { searchMatch, fmTrash, personalFM, songChorus } from '../api/other'
import { getLyric as getApiLyric, getTrackDetail } from '../api/track'
import { useI18n } from 'vue-i18n'
import { cloneDeep } from 'lodash'

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
    const _volume = ref(1)
    const volumeBeforeMuted = ref(1)
    const isPersonalFM = ref(false)
    const currentTrack = ref<Track | null>(null)
    const title = ref<string | null>('VutronMusic')
    const outputDevice = ref('default')
    const backRate = ref(1.0)
    const _pitch = ref(1.0)
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

    const lyrics = reactive<{
      lyric: any[]
      tlyric: any[]
      rlyric: any[]
    }>({
      lyric: [],
      tlyric: [],
      rlyric: []
    })
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
    let intervalTimer

    const localMusicStore = useLocalMusicStore()
    const streamMusicStore = useStreamMusicStore()
    const { updateTrack, fetchLocalMusic, getALocalTrack, getLocalLyric, getLocalPic } =
      localMusicStore
    const {
      scrobble: scrobbleStream,
      fetchStreamMusic,
      getStreamLyric,
      getStreamPic,
      getAStreamTrack
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

    const currentIndex = reactive({
      line: -1,
      word: -1,
      tWord: -1
    })

    const timer = reactive<{ line: any; list: any; tList: any }>({
      line: null,
      list: null,
      tList: null
    })

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
        currentTrack.value?.starred
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

    const pitch = computed({
      get() {
        return _pitch.value
      },
      set(value) {
        _pitch.value = value
        if (!audioNodes.soundtouch) return
        // @ts-ignore
        audioNodes.soundtouch.parameters.get('pitch').value = value
      }
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
        currentIndex.line = getLyricIndex(lyrics.lyric, 0, 1)
        currentIndex.word = getLyricIndex(fontList.value.word, 0, 1000)
        currentIndex.tWord = getLyricIndex(fontList.value.tWord, 0, 1000)
        if (window.env?.isLinux) {
          window.mainApi?.send('playerCurrentTrackTime', { seeked: true, progress: value })
        }
        navigator.mediaSession.setPositionState({
          duration: currentTrackDuration.value,
          playbackRate: playbackRate.value,
          position: value
        })
        clearTimeout(timer.line)
        clearTimeout(timer.list)
        clearTimeout(timer.tList)
        updateIndex()
      }
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

    const volume = computed({
      get() {
        return _volume.value
      },
      set(value) {
        _volume.value = value
        audioNodes.masterGain?.gain.linearRampToValueAtTime(
          value,
          audioNodes.audioContext?.currentTime || 0 + 0.2
        )
      }
    })

    const playbackRate = computed({
      get: () => backRate.value,
      set: (value) => {
        backRate.value = value
        audioNodes.audio!.playbackRate = value
        window.mainApi?.send('updateRate', value)
        currentIndex.line = getLyricIndex(lyrics.lyric, 0, 1)
        currentIndex.word = getLyricIndex(fontList.value.word, 0, 1000)
        currentIndex.tWord = getLyricIndex(fontList.value.tWord, 0, 1000)
        clearTimeout(timer.line)
        clearTimeout(timer.list)
        clearTimeout(timer.tList)
        updateIndex()
        navigator.mediaSession.setPositionState({
          duration: currentTrackDuration.value,
          playbackRate: value,
          position: seek.value
        })
      }
    })

    const isWordByWord = computed(() => {
      let flag = false
      for (const l of lyrics.lyric) {
        if (l.contentInfo) {
          flag = true
          break
        }
      }
      return settingsStore.normalLyric.isNWordByWord && flag
    })

    const fontList = computed(() => {
      const word = [] as { start: number; end: number; word: string }[]
      const tWord = [] as { start: number; end: number; word: string }[]
      const rWord = [] as { start: number; end: number; word: string }[]
      if (isWordByWord.value) {
        lyrics.lyric.forEach((l) => {
          if (l.contentInfo) {
            l.contentInfo.forEach((c) => {
              word.push(c)
            })
            const sameTlyric = lyrics.tlyric.find((t) => t.start === l.start)
            if (
              sameTlyric &&
              (settingsStore.normalLyric.nTranslationMode === 'tlyric' ||
                osdLyricStore.translationMode === 'tlyric')
            ) {
              const words = sameTlyric.content.split('') as string[]
              words.forEach((w, i) => {
                const interval = (l.end - l.start) / words.length
                tWord.push({
                  start: Math.floor((l.start + i * interval) * 1000),
                  end: Math.floor((l.start + (i + 1) * interval) * 1000),
                  word: w
                })
              })
            }

            const sameRlyric = lyrics.rlyric.find((r) => r.start === l.start)
            if (
              (sameRlyric && settingsStore.normalLyric.nTranslationMode === 'rlyric') ||
              osdLyricStore.translationMode === 'rlyric'
            ) {
              const words = sameRlyric.content.split(' ') as string[]
              l.contentInfo.forEach((c, i) => {
                rWord.push({
                  start: c.start,
                  end: c.end,
                  word: words[i] ?? ''
                })
              })
            }
          }
        })
      }
      return { word, tWord, rWord }
    })

    const noLyric = computed(() => lyrics.lyric.length === 0)

    const shouldGetLrcIndex = computed(() => {
      return (
        stateStore.showLyrics ||
        osdLyricStore.show ||
        (window.env?.isMac && settingsStore.tray.showLyric) ||
        (window.env?.isLinux && settingsStore.tray.enableExtension)
      )
    })

    const shouldGetFontIndex = computed(() => {
      return osdLyricStore.show || stateStore.showLyrics
    })

    const getLyricIndex = (
      lst: { start: number; end: number }[],
      start = 0,
      rate: 1 | 1000 = 1
    ) => {
      if (!lst.length || !audioNodes.audio) return -1
      start = Math.max(start, 0)
      for (let i = start; i < lst.length; i++) {
        if (
          (lst[i].start || lst[i].start) / rate >
          audioNodes.audio.currentTime + lyricOffset.value
        ) {
          return i - 1
        }
      }

      if (audioNodes.audio.currentTime + lyricOffset.value > lst[lst.length - 1].end / rate) {
        return lst.length
      } else {
        return lst.length - 1
      }
    }

    watch(shouldGetLrcIndex, (value) => {
      if (value) {
        updateIndex()
      } else {
        clearTimeout(timer.line)
        clearTimeout(timer.list)
        clearTimeout(timer.tList)
      }
    })

    watch(shouldGetFontIndex, (value) => {
      if (value) {
        updateIndex()
      } else {
        clearTimeout(timer.list)
        clearTimeout(timer.tList)
      }
    })

    // watch(currentTrack, async (value) => {
    //   if (!value) return
    //   searchMatchForLocal(value)
    // })

    watch(lyrics, () => {
      clearTimeout(timer.line)
      clearTimeout(timer.list)
      clearTimeout(timer.tList)
      updateIndex()
    })

    watch(
      () => convolverParams.buffer,
      (value) => {
        if (!audioNodes.audioContext) return
        if (value instanceof AudioBuffer) {
          audioNodes.convolver!.buffer = value
          audioNodes.convolverSourceGain!.gain.setValueAtTime(
            convolverParams.mainGain,
            audioNodes.audioContext.currentTime
          )
          audioNodes.convolverOutputGain!.gain.setValueAtTime(
            convolverParams.sendGain,
            audioNodes.audioContext.currentTime
          )
        } else {
          audioNodes.convolver!.buffer = null
          audioNodes.convolverSourceGain!.gain.setValueAtTime(
            convolverParams.mainGain,
            audioNodes.audioContext.currentTime
          )
          audioNodes.convolverOutputGain!.gain.setValueAtTime(
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
      if (!lyrics.lyric.length || !shouldGetLrcIndex.value) return
      currentIndex.line = getLyricIndex(lyrics.lyric, 0, 1)
      const nextLine = lyrics.lyric[currentIndex.line + 1]

      if (nextLine) {
        const driftTime =
          nextLine.start -
          ((audioNodes.audio?.currentTime || 0) / playbackRate.value + lyricOffset.value) * 1000
        if (playing.value) {
          timer.line = setTimeout(() => {
            clearTimeout(timer.line)
            if (!playing.value) return
            _refreshLineIdx()
          }, driftTime)
        }
      }
    }

    const _refreshFontIdx = (type: 'word' | 'tWord' = 'word') => {
      if (!fontList.value[type].length || !shouldGetFontIndex.value) return
      const index = getLyricIndex(fontList.value[type], currentIndex[type], 1000)

      currentIndex[type] = index
      const nextFont = fontList.value[type][index + 1]
      if (nextFont) {
        const driftTime =
          nextFont.start -
          ((audioNodes.audio?.currentTime || 0) / playbackRate.value + lyricOffset.value) * 1000
        if (playing.value) {
          timer[type] = setTimeout(() => {
            clearTimeout(timer[type])
            if (!playing.value) return
            _refreshFontIdx(type)
          }, driftTime)
        }
      }
    }

    const updateIndex = () => {
      if (!lyrics.lyric.length || !shouldGetLrcIndex.value) return
      currentIndex.line = getLyricIndex(lyrics.lyric, 0, 1)
      if (!shouldGetLrcIndex.value) return
      if (fontList.value.word.length) {
        currentIndex.word = getLyricIndex(fontList.value.word, 0, 1000)
      }
      if (fontList.value.tWord.length) {
        currentIndex.tWord = getLyricIndex(fontList.value.tWord, 0, 1000)
      }
      if (!playing.value) return
      _refreshLineIdx()
      _refreshFontIdx('word')
      _refreshFontIdx('tWord')
    }

    const currentLyric = computed(() => {
      const line = lyrics.lyric[currentIndex.line]
      if (!line) return { content: currentTrack.value?.name || '听你想听的音乐', time: 0 }
      const nextLine = lyrics.lyric[currentIndex.line + 1]
      const diff = nextLine ? nextLine.start - line?.start : 10
      return { content: line?.content, time: diff, start: line?.start || 0 }
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

    watch(shouldGetFontIndex, (value) => {
      if (value) {
        _refreshLineIdx()
        _refreshFontIdx('word')
        _refreshFontIdx('tWord')
      } else {
        clearTimeout(timer.list)
        clearTimeout(timer.tList)
      }
    })

    watch(playing, (value) => {
      window.mainApi?.send('updatePlayerState', { playing: value })
      navigator.mediaSession.setPositionState({
        duration: currentTrackDuration.value,
        playbackRate: playbackRate.value,
        position: seek.value
      })
      progress.value = audioNodes.audio?.currentTime || 0
      _progress.value = audioNodes.audio?.currentTime || 0
      if (value) {
        updateIndex()
        updateMprisProgress()
        if (settingsStore.general.preventSuspension) {
          window.mainApi?.send('update-powersave', true)
        }
      } else {
        clearTimeout(timer.line)
        clearTimeout(timer.list)
        clearTimeout(timer.tList)
        timer.line = null
        timer.list = null
        timer.tList = null
        if (settingsStore.general.preventSuspension) {
          window.mainApi?.send('update-powersave', false)
        }
        if (intervalTimer) {
          clearInterval(intervalTimer)
          intervalTimer = null
        }
      }
    })

    watch(
      () => fontList.value.tWord,
      (value) => {
        if (value.length) _refreshFontIdx('tWord')
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

    watch(lyricOffset, () => {
      clearTimeout(timer.line)
      clearTimeout(timer.list)
      clearTimeout(timer.tList)
      updateIndex()
    })

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
              updateTrack(track.filePath, newTrack)
              _list.value[currentTrackIndex.value] = newTrack.id
              return getALocalTrack({ filePath: track.filePath })
            }
          })
          .catch((err) => {
            showToast(err)
            return null
          })
        if (result) track = result
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

    const updateMprisProgress = () => {
      if (!window.env?.isLinux) return
      window.mainApi?.send('playerCurrentTrackTime', {
        seeked: true,
        progress: audioNodes.audio!.currentTime
      })
      intervalTimer = setInterval(() => {
        window.mainApi?.send('playerCurrentTrackTime', {
          seeked: true,
          progress: audioNodes.audio!.currentTime
        })
      }, 5 * 1000)
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
      }

      const path = new URL(`../assets/medias/${data.source}`, import.meta.url).href
      fetch(path)
        .then((res) => res.arrayBuffer())
        .then((arrayBuffer) => audioNodes.audioContext!.decodeAudioData(arrayBuffer))
        .then((buffer) => {
          if (buffer) convolverParams.buffer = buffer
        })
        .catch((error) => {
          console.log('setConvolver error:', error)
        })
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
      getLyric(track)
    }

    const getLyric = async (track: Track) => {
      let data = {
        lrc: { lyric: [] as any[] },
        tlyric: { lyric: [] as any[] },
        romalrc: { lyric: [] as any[] },
        yrc: { lyric: [] as any[] },
        ytlrc: { lyric: [] as any[] },
        yromalrc: { lyric: [] as any[] }
      }
      switch (track.type!) {
        case 'stream':
          data = (await getStreamLyric(track.id))!
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

      let { lyric, tlyric, rlyric } = lyricParse(data)
      lyric = lyric.filter((l) => !/^作(词|曲)\s*(:|：)\s*无$/.exec(l.content))
      const includeAM = lyric.length <= 10 && lyric.map((l) => l.content).includes('纯音乐，请欣赏')
      if (includeAM) {
        const reg = /^作(词|曲)\s*(:|：)\s*/
        const artists = currentTrack.value!.artists ?? currentTrack.value!.ar
        const author = artists[0]?.name
        lyric = lyric.filter((l) => {
          const regExpArr = l.content.match(reg)
          return !regExpArr || l.content.replace(regExpArr[0], '') !== author
        })
      }
      if (lyric.length === 1 && includeAM) {
        lyrics.lyric = []
        lyrics.tlyric = []
        lyrics.rlyric = []
      } else {
        lyric = lyric.filter(({ content }) => Boolean(content))
        lyrics.lyric = lyric.map((l, index) => {
          const end = lyric[index + 1]
            ? (l.end ?? lyric[index + 1]?.start)
            : currentTrackDuration.value
          return { ...l, end }
        })
        tlyric = tlyric.filter(({ content }) => Boolean(content))
        lyrics.tlyric = tlyric.map((l, index) => {
          const end = tlyric[index + 1]
            ? (l.end ?? tlyric[index + 1]?.start)
            : currentTrackDuration.value
          return { ...l, end }
        })
        lyrics.tlyric = tlyric
        rlyric = rlyric.filter(({ content }) => Boolean(content))
        lyrics.rlyric = rlyric.map((l, index) => {
          const end = rlyric[index + 1]
            ? (l.end ?? rlyric[index + 1]?.start)
            : currentTrackDuration.value
          return { ...l, end }
        })
        lyrics.rlyric = rlyric
      }
    }

    const _getLocalLyric = async (track: Track) => {
      let data = {
        lrc: { lyric: [] as any[] },
        tlyric: { lyric: [] as any[] },
        romalrc: { lyric: [] as any[] },
        yrc: { lyric: [] as any[] },
        ytlrc: { lyric: [] as any[] },
        yromalrc: { lyric: [] as any[] }
      }
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
        if (data.lrc.lyric.length) return data
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
      enabled.value = true
    }

    const replaceCurrentTrack = async (trackID: number | string, autoPlay = true) => {
      // 切歌时先淡出
      const fade = getFadeDuration()
      if (audioNodes.masterGain && audioNodes.audioContext) {
        await smoothGain(audioNodes.masterGain.gain.value, 0, fade, audioNodes.masterGain)
      }
      return getLocalMusic(trackID as number).then(async (track) => {
        if (!track) {
          nextTrackCallback()
          return
        }
        currentTrack.value = track
        await searchMatchForLocal(track!)
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
        if (autoPlay && currentTrack.value?.name && currentTrack.value?.matched !== false) {
          // _scrobble(currentTrack.value, seek.value)
        } else if (autoPlay && currentTrack.value?.type === 'stream') {
          scrobbleStream(trackID as string)
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

    const playAudioSource = async (source: string, autoPlay = true) => {
      // 切歌时先淡出
      const fade = getFadeDuration()
      if (audioNodes.masterGain && audioNodes.audioContext) {
        await smoothGain(audioNodes.masterGain.gain.value, 0, fade, audioNodes.masterGain)
      }
      await destroAudioNode()
      await setupAudioNode(autoPlay)
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
          fetch(`atom://get-track/${id}`).then((data) => {
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
          resolve(`atom://get-music/${track.cache ? track.url : track.filePath}`)
        } else if (track.type === 'stream') {
          resolve(track.url)
        } else {
          const url = track.url.replace('http:', 'https:')
          resolve(window.env?.isElectron ? `atom://get-online-music/${track.url}` : url)
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

    const _playNextTrack = (isPersonal: boolean) => {
      pause()
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
      pause()
      seek.value = 0
      if (!isPersonalFM.value && repeatMode.value === 'one') {
        replaceCurrentTrack(currentTrack.value!.id)
      } else {
        _playNextTrack(isPersonalFM.value)
      }
    }

    // const stop = async () => {
    //   if (playingNext.value) {
    //     if (_shuffle.value) {
    //       _shuffleList.value.splice(currentTrackIndex.value + 1, 0, currentTrack.value!.id)
    //       currentTrackIndex.value += 1
    //     } else {
    //       _list.value.splice(currentTrackIndex.value + 1, 0, currentTrack.value!.id)
    //       currentTrackIndex.value += 1
    //     }
    //   }
    //   pause()
    // }

    const play = async () => {
      if (!audioNodes.audio) return
      const arts = currentTrack.value?.artists ?? currentTrack.value?.ar
      audioNodes.audio.playbackRate = playbackRate.value
      await audioNodes.audio.play()
      title.value = `${currentTrack.value?.name} · ${arts[0].name} - VutronMusic`
      if (!window.env?.isMac) {
        window.mainApi?.send('updateTooltip', title.value)
      }
      document.title = title.value
      const fade = getFadeDuration()
      audioNodes.masterGain!.gain.value = 0
      await smoothGain(0, volume.value, fade, audioNodes.masterGain!)
      audioNodes.audio!.volume = volume.value
    }

    const pause = () => {
      if (!audioNodes.audio) return
      const fade = getFadeDuration()
      smoothGain(audioNodes.masterGain!.gain.value, 0, fade, audioNodes.masterGain!).then(() => {
        audioNodes.audio?.pause()
        title.value = 'VutronMusic'
        if (!window.env?.isMac) {
          window.mainApi?.send('updateTooltip', title.value)
        }
        document.title = title.value
      })
    }

    const playOrPause = async () => {
      if (playing.value) {
        playing.value = false
        pause()
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
      if (audioNodes.audio.currentTime >= audioNodes.audio.duration - 0.5) {
        nextTrackCallback()
      }
    }

    const destroAudioNode = async () => {
      if (audioNodes.audio) {
        audioNodes.audio.removeEventListener('timeupdate', _handleTimeUpdate)
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

    const setupAudioNode = async (autoPlay: boolean = false) => {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preservesPitch = true
      audio.volume = 0
      audio.onended = null
      audioNodes.audio = audio
      seek.value = autoPlay ? 0 : progress.value

      audioNodes.audio.addEventListener('timeupdate', _handleTimeUpdate)

      audioNodes.audioContext = new AudioContext()
      audioNodes.audioSource = audioNodes.audioContext.createMediaElementSource(audioNodes.audio)
      await audioNodes.audioContext.resume()

      await audioNodes.audioContext.audioWorklet.addModule(
        new URL('../utils/soundtouch-worklet.js', import.meta.url)
      )
      const soundtouch = new AudioWorkletNode(audioNodes.audioContext, 'soundtouch-processor')
      audioNodes.soundtouch = soundtouch
      audioNodes.audioSource.connect(audioNodes.soundtouch)

      playbackRate.value = backRate.value
      pitch.value = _pitch.value

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

      audioNodes.soundtouch.connect(audioNodes.biquads.get(`hz${biquadParamsKeys[0]}`)!)

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

      audioNodes.masterGain.gain.setValueAtTime(volume.value, audioNodes.audioContext.currentTime)
      const key = biquadParamsKeys[biquadParamsKeys.length - 1]
      const lastBiquadFilter = audioNodes.biquads.get(`hz${key}`)!
      lastBiquadFilter.connect(audioNodes.convolverSourceGain)
      lastBiquadFilter.connect(audioNodes.convolver)
      audioNodes.dynamics.connect(audioNodes.masterGain)
      audioNodes.masterGain.connect(audioNodes.audioContext.destination)
    }

    const getPic = async (track: Track, size: number = 128) => {
      if (track.type === 'local' && !track.matched) {
        return await getLocalPic(track.id)
      } else if (track.type === 'stream') {
        return (await getStreamPic(track, size))!
      } else {
        return (track.album || track.al).picUrl
      }
    }

    const updateMediaSessionMetaData = async (track: Track) => {
      if ('mediaSession' in navigator === false) return

      if (pic.value?.startsWith('blob:')) {
        URL.revokeObjectURL(pic.value)
      }
      pic.value = await getPic(track, 512)

      const arts = track.artists ?? track.ar
      const artists = arts.map((a) => a.name)
      const metadata = {
        title: track.name,
        artist: artists.join(','),
        album: track.album?.name ?? track.al?.name,
        artwork: [
          {
            src:
              track.type === 'online' || track.matched ? pic.value + '?param=224y224' : pic.value,
            type: 'image/jpg',
            sizes: '224x224'
          },
          {
            src:
              track.type === 'online' || track.matched ? pic.value + '?param=512y512' : pic.value,
            type: 'image/jpg',
            sizes: '512x512'
          }
        ],
        length: currentTrackDuration.value,
        trackId: track.id,
        url: '/trackid/' + track.id
      }
      navigator.mediaSession.metadata = null
      navigator.mediaSession.metadata = new MediaMetadata(metadata)
      if (pic.value.startsWith('http')) pic.value += '?param=512y512'
      if (window.env?.isLinux) {
        metadata.artwork.map((art) => {
          art.src = (currentTrack.value?.album?.picUrl || currentTrack.value?.al?.picUrl)!
        })
        let pic1: string = new URL(`../assets/images/default.jpg`, import.meta.url).href
        let pic2: string = new URL(`../assets/images/default.jpg`, import.meta.url).href
        if (track.type === 'stream') {
          if (track.source === 'navidrome') {
            pic1 = track.picUrl.replace('size=64', 'size=224')
            pic2 = track.picUrl.replace('size=64', 'size=512')
          } else if (track.source === 'emby') {
            pic1 = track.picUrl
              .replace('maxHeight=64', 'maxHeight=224')
              .replace('maxWidth=64', 'maxWidth=224')
            pic1 = track.picUrl
              .replace('maxHeight=64', 'maxHeight=512')
              .replace('maxWidth=64', 'maxWidth=512')
          }
          metadata.artwork[0].src = pic1
          metadata.artwork[1].src = pic2
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
      lyrics.lyric = []
      lyrics.tlyric = []
      lyrics.rlyric = []
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
              line: currentIndex.line,
              font: currentIndex.word,
              tfont: currentIndex.tWord,
              playing: playing.value,
              progress: audioNodes.audio?.currentTime || 0,
              title: `${(currentTrack.value?.artists || currentTrack.value?.ar)[0]?.name} - ${currentTrack.value?.name}`
            }
          })
        }
      })

      watch(
        () => currentIndex.line,
        (value) => {
          if (osdLyricStore.show)
            window.mainApi?.sendMessage({ type: 'update-osd-status', data: { line: value } })
        }
      )

      watch(
        () => currentIndex.word,
        (value) => {
          if (osdLyricStore.show)
            window.mainApi?.sendMessage({ type: 'update-osd-status', data: { font: value } })
        }
      )

      watch(
        () => currentIndex.tWord,
        (value) => {
          if (osdLyricStore.show)
            window.mainApi?.sendMessage({ type: 'update-osd-status', data: { tfont: value } })
        }
      )

      watch(lyrics, (value) => {
        if (osdLyricStore.show) {
          const newLyric = cloneDeep(value)
          if (!newLyric.lyric.length) {
            newLyric.lyric[0] = {
              start: 0,
              content: `${(currentTrack.value?.artists || currentTrack.value?.ar)[0].name} - ${currentTrack.value?.name}`
            }
          }
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: { lyrics: toRaw(newLyric) }
          })
        }
      })

      watch(playing, (value) => {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = value ? 'playing' : 'paused'
        }
        if (osdLyricStore.show)
          window.mainApi?.sendMessage({ type: 'update-osd-status', data: { playing: value } })
      })

      watch(
        () => osdLyricStore.show,
        (value) => {
          if (!value) window.mainApi?.closeMessagePort()
        }
      )

      window.mainApi?.on('resume', () => {
        if (!currentTrack.value) return
        const t = _progress.value
        replaceCurrentTrack(currentTrack.value.id, false).then((res) => {
          if (res) seek.value = t
        })
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
        if (currentTrack.value && currentTrack.value.matched !== false) {
          likeATrack(currentTrack.value.id)
        }
      })
      window.mainApi?.on('fm-trash', () => {
        moveToFMTrash()
      })
      window.mainApi?.on('setPosition', (_: any, value: number) => {
        seek.value = value
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
          position: seek.value
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

    // 获取淡入淡出时长，限制范围，防止极端值
    const getFadeDuration = () => {
      const d = settingsStore.general.fadeDuration
      return Math.max(0.1, Math.min(3, Number(d) || 0.5))
    }

    // S型淡入淡出曲线
    const smoothGain = async (from: number, to: number, duration: number, gainNode: GainNode) => {
      return new Promise<void>((resolve) => {
        const start = performance.now()
        const change = to - from
        const ease = (t: number) => from + change * 0.5 * (1 - Math.cos(Math.PI * t)) // S型
        function step(now: number) {
          const elapsed = (now - start) / (duration * 1000)
          if (elapsed >= 1) {
            gainNode.gain.value = to
            resolve()
            return
          }
          gainNode.gain.value = ease(elapsed)
          requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      })
    }

    onMounted(async () => {
      await Promise.all([fetchLocalMusic(), fetchStreamMusic()])
      playing.value = false
      title.value = 'VutronMusic'
      if (enabled.value) {
        if (currentTrack.value?.type === 'stream') {
          if (streamMusicStore.currentService.status !== 'login') {
            resetPlayer(false)
            return
          }
        }
        replaceCurrentTrack(currentTrack.value!.id, false).then(() => {
          window.mainApi?.send('updatePlayerState', {
            playing: playing.value,
            isPersonalFM: isPersonalFM.value,
            like: isLiked.value,
            repeatMode: repeatMode.value,
            shuffle: shuffle.value
          })
        })
        handleIpcRenderer()
        initMediaSession()
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
      _volume,
      _pitch,
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
      getPic,
      setConvolver,
      replacePlaylist,
      playPrev,
      _playNextTrack,
      clearPlayNextList,
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
      omit: [
        'currentIndex.tWord',
        'currentIndex.word',
        'pic',
        'title',
        'currentLyricIndex',
        'outputDevice'
      ]
    }
  }
)
