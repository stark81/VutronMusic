import { defineStore, storeToRefs } from 'pinia'
import shuffleFn from 'lodash/shuffle'
import { lyricParse } from '../utils/lyric'
import { ref, computed, reactive, watch, watchEffect, onMounted, onBeforeUnmount, toRaw } from 'vue'
import { Track, useLocalMusicStore } from './localMusic'
import { useStreamMusicStore } from './streamingMusic'
import { useSettingsStore } from './settings'
import { useNormalStateStore } from './state'
import { useDataStore } from './data'
import { searchMatch, fmTrash, personalFM, songChorus } from '../api/other'
import { useI18n } from 'vue-i18n'
import eventBus from '../utils/eventBus'
// import { scrobble } from '../api/track'

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
    const repeatMode = ref('off')
    const _shuffle = ref(false)
    const _volume = ref(1)
    const volumeBeforeMuted = ref(1)
    const isPersonalFM = ref(false)
    const currentTrack = ref<Track | null>(null)
    const title = ref<string | null>('VutronMusic')
    const outputDevice = ref('default')
    const backRate = ref(1.0)
    let setIntervalTimer: any
    let lastUpdate = 0
    const currentLyricIndex = ref(-1)
    const streamMusics = ref<Track[]>([])
    const isLiked = ref(false)
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

    const color = ref<string>()
    const color2 = ref<string>()
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

    let initAcx = false
    const localMusicStore = useLocalMusicStore()
    const streamMusicStore = useStreamMusicStore()
    const { updateTrack, fetchLocalMusic } = localMusicStore
    const { scrobble, fetchStreamMusic } = streamMusicStore
    const { likeATrack } = useDataStore()
    const { t } = useI18n()

    const settingsStore = useSettingsStore()
    const { showToast } = useNormalStateStore()

    const audio = new Audio()
    const audioContext = new AudioContext()
    const audioSource = audioContext.createMediaElementSource(audio)

    const _shuffleList = ref<number[]>([])
    const _list = ref<number[]>([])
    const _playNextList = ref<number[]>([])
    const currentTrackIndex = ref(0)

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

    const howler = {
      audioSource,
      biquads: new Map<string, BiquadFilterNode>(),
      convolverSourceGain: audioContext.createGain(),
      convolverOutputGain: audioContext.createGain(),
      convolver: audioContext.createConvolver(),
      masterGain: audioContext.createGain()
    }

    const currentTrackDuration = computed(() => {
      return ~~((currentTrack.value?.dt || currentTrack.value?.duration || 1000) / 1000)
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

    const seek = computed({
      get() {
        return progress.value
      },
      set(value) {
        audio.currentTime = value
        getLyricIndex()
        window.mainApi.send('updateLyricInfo', { progress: value })
        eventBus.emit('update-process', value)
      }
    })

    const source = computed(() => {
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
        migu: '咪咕音乐'
      }
      return currentTrack.value
        ? `${currentTrack.value.name}, 音源：${sourceMap[currentTrack.value.source!] ?? currentTrack.value.source}`
        : ''
    })

    const volume = computed({
      get() {
        return _volume.value
      },
      set(value) {
        _volume.value = value
        howler.masterGain.gain.linearRampToValueAtTime(value, audioContext.currentTime + 0.2)
      }
    })

    const playbackRate = computed({
      get: () => backRate.value,
      set: (value) => {
        backRate.value = value
        audio.playbackRate = value
      }
    })

    const noLyric = computed(() => lyrics.lyric.length === 0)

    watch(currentTrack, async (value) => {
      if (!value) return
      currentLyricIndex.value = -1
      const flag = await searchMatchForLocal(value)
      if (flag) return
      await getCurrentTrackInfo(value)
      updateMediaSessionMetaData(value)
    })

    const currentLyric = computed(() => {
      let result: { content: string; time: number }
      if (currentLyricIndex.value < lyrics.lyric.length) {
        const lyric = lyrics.lyric[currentLyricIndex.value]
        const nextLyric = lyrics.lyric[currentLyricIndex.value + 1]
        const diff = nextLyric?.time - lyric?.time || 10
        result = {
          content: lyric?.content || currentTrack.value?.name || '听你想听的音乐',
          time: diff
        }
      } else {
        result = {
          content: currentTrack.value?.name || '听你想听的音乐',
          time: 10
        }
      }
      return result
    })

    watch(lyrics, (value) => {
      window.mainApi.send('updateLyricInfo', { lyrics: toRaw(value) })
    })

    watch(currentLyric, (value) => {
      if (window.env?.isLinux && settingsStore.tray.enableExtension) {
        window.mainApi.send('updateLyricInfo', { currentLyric: value })
      }
    })

    watch(currentLyricIndex, (value) => {
      window.mainApi.send('updateLyricInfo', { lrcIdx: [value, audio.currentTime] })
      eventBus.emit('update-process', audio.currentTime || 0)
    })

    watch(
      () => settingsStore.tray.enableExtension,
      (value) => {
        if (!value) {
          const lrc = { content: '', time: 10 }
          window.mainApi.send('updateLyricInfo', { currentLyric: lrc })
        } else {
          window.mainApi.send('updateLyricInfo', { currentLyric: currentLyric.value })
        }
      }
    )

    watch(
      () => convolverParams.buffer,
      (value) => {
        if (value instanceof AudioBuffer) {
          howler.convolver.buffer = value
          howler.convolverSourceGain.gain.setValueAtTime(
            convolverParams.mainGain,
            audioContext.currentTime
          )
          howler.convolverOutputGain.gain.setValueAtTime(
            convolverParams.sendGain,
            audioContext.currentTime
          )
        } else {
          howler.convolver.buffer = null
          howler.convolverSourceGain.gain.setValueAtTime(
            convolverParams.mainGain,
            audioContext.currentTime
          )
          howler.convolverOutputGain.gain.setValueAtTime(
            convolverParams.sendGain,
            audioContext.currentTime
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
        if (convolverParams.buffer) {
          howler.convolverSourceGain.gain.setValueAtTime(value, audioContext.currentTime)
        }
      }
    )

    watch(
      () => convolverParams.sendGain,
      (value) => {
        if (convolverParams.buffer) {
          howler.convolverOutputGain.gain.setValueAtTime(value, audioContext.currentTime)
        }
      }
    )

    const getLyricIndex = () => {
      const progress = audio.currentTime + lyricOffset.value
      currentLyricIndex.value = lyrics.lyric.findIndex((l, index) => {
        const nextLyric = lyrics.lyric[index + 1]
        const nextLyricTime = nextLyric ? nextLyric.time : currentTrackDuration.value
        return progress >= l.time && progress < nextLyricTime
      })
    }

    const update = () => {
      getLyricIndex()
      const now = performance.now()
      if (now - lastUpdate >= 500) {
        if (!audio) return
        progress.value = audio.currentTime
        lastUpdate = now
      }
    }

    watch(playing, (value) => {
      window.mainApi.send('updatePlayerState', { playing: value })
      if (value) {
        setIntervalTimer = setInterval(update, 50)
      } else {
        clearInterval(setIntervalTimer)
      }
    })

    watch(isLiked, (value) => {
      window.mainApi.send('updatePlayerState', { like: value })
    })

    watch(repeatMode, (value) => {
      window.mainApi.send('updatePlayerState', { repeatMode: value })
    })

    watch(isPersonalFM, (value) => {
      window.mainApi.send('updatePlayerState', { isPersonalFM: value })
    })

    watch(shuffle, (value) => {
      window.mainApi.send('updatePlayerState', { shuffle: value })
    })

    watchEffect(() => {
      for (const biquad of biquadParamsKeys) {
        const value = biquadParams[biquad]
        const biquadNode = howler.biquads.get(`hz${biquad}`)
        if (biquadNode) biquadNode.gain.value = value
      }
    })

    const lyricOffset = computed(() => {
      return currentTrack.value?.offset ?? 0
    })

    watch(lyricOffset, (value) => {
      window.mainApi.send('updateLyricInfo', { lyricOffset: value })
    })

    const searchMatchForLocal = async (track: Track) => {
      let flag = false
      if (track.type === 'local' && !track.matched) {
        const params = {
          title: track.name,
          album: '',
          artist: track.artists[0].name,
          duration: (track.dt || track.duration) / 1000,
          md5: track.md5,
          localID: track.id
        }
        await searchMatch(params)
          .then(async (res: any) => {
            if (res.result.songs.length > 0) {
              const newTrack = res.result.songs[0]
              updateTrack(track.filePath, newTrack)
              _list.value[currentTrackIndex.value] = newTrack.id
              const newSong = localMusicStore.localTracks.find((t) => t.filePath === track.filePath)
              await getCurrentTrackInfo(newSong!)
              await updateMediaSessionMetaData(newSong!)
              flag = true
            }
          })
          .catch((err) => {
            showToast(err)
          })
      }
      return flag
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
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
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
      let data: any
      if (track.type === 'stream') {
        if (track.source === 'navidrome') {
          data = await fetch(`atom://get-stream-track-info/${track.id}`).then((res) => res.json())
        } else if (track.source === 'emby') {
          const match = track.picUrl.match(/get-stream-pic\/(.*)/)
          if (match) {
            const idString = match[1]
            const id = idString.replace('/64', '/512')
            data = await fetch(`atom://get-stream-track-info/${id}`).then((res) => res.json())
          } else {
            data = await fetch(`atom://get-color/${track.picUrl}/save-pic=1?param=512y512`).then(
              (res) => res.json()
            )
          }
        }
      } else {
        data = await fetch(`atom://get-track-info/${track.id}`).then((res) => res.json())
        if (track.matched) {
          songChorus(track.id).then((res) => {
            if (res.chorus.length) {
              chorus.value = res.chorus[0].startTime / 1000 - (currentTrack.value?.offset || 0)
            }
          })
        }
      }
      const buffer = new Uint8Array(data.pic.data)
      const blob = new Blob([buffer], { type: data.format })
      // if (pic.value) URL.revokeObjectURL(pic.value)
      pic.value = URL.createObjectURL(blob)
      if (data.color) {
        color.value = data.color
        color2.value = data.color2
      } else {
        showToast(t('toast.getColorFailed'))
      }
      const lyricData = data.lyrics

      let { lyric, tlyric, rlyric } = lyricParse(lyricData)
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
        lyrics.lyric = lyric
        lyrics.tlyric = tlyric
        lyrics.rlyric = rlyric
      }
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
      const { localMusic } = storeToRefs(settingsStore)
      if (playlistSourceType.includes('local') && localMusic.value.scanning) {
        showToast(t('toast.scanning'))
        return
      }
      if (!initAcx) {
        await setupAudioNode()
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
      return getLocalMusic(trackID as number)
        .then((data: Track | undefined) => {
          return data ?? null
        })
        .then((track) => {
          currentTrack.value = track
          eventBus.emit('update-process', 0)
          // updateMediaSessionMetaData(track!)
          getTrackSource(track!).then((source) => {
            if (source) {
              if (track!.id === currentTrack.value?.id) {
                playAudioSource(source, autoPlay)
              }
            } else {
              showToast(track?.reason)
              _playNextTrack(isPersonalFM.value)
            }
            if (autoPlay && currentTrack.value?.name && currentTrack.value?.matched !== false) {
              // _scrobble(currentTrack.value, seek.value)
            } else if (autoPlay && currentTrack.value?.type === 'stream') {
              scrobble(trackID as string)
            }
          })
        })
    }

    const playAudioSource = (source: string, autoPlay = true) => {
      // await stop()
      audio.src = source
      audio.load()
      if (autoPlay) {
        play()
        playing.value = true
      }
    }

    const getLocalMusic = (id: number) => {
      return new Promise<Track | undefined>((resolve) => {
        let matchTrack = localMusicStore.localTracks.find((track: Track) => track.id === id)
        if (matchTrack) {
          if (!isLocalList.value) {
            showToast(`使用本地文件播放`)
          }
          matchTrack.source = 'localTrack'
          resolve(matchTrack)
          return
        }
        streamMusics.value = streamMusicStore.streamTracks
        matchTrack = streamMusics.value?.find((track) => track.id === id)
        if (matchTrack) {
          resolve(matchTrack)
          return
        }
        fetch(`atom://get-track/${id}`).then((data) => {
          if (data.status === 200) {
            data.json().then((track: Track) => {
              resolve(track)
            })
          } else if (data.status === 440) {
            resolve(undefined)
          }
        })
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
          resolve(`atom://get-online-music/${track.url}`)
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
      stop()
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
      if (isPersonal) {
        playNextFMTrack()
      } else {
        playNext()
      }
    }

    const playNext = async () => {
      stop()
      const [trackID, index, isPlayingNext] = getNextTrack()
      playingNext.value = isPlayingNext
      if (!trackID) {
        playing.value = false
        return false
      }
      currentTrackIndex.value = index
      await replaceCurrentTrack(trackID, true)
      return true
    }

    const nextTrackCallback = () => {
      if (currentTrack.value?.matched !== false) {
        // _scrobble(currentTrack.value, 0, true)
      }
      if (!isPersonalFM.value && repeatMode.value === 'one') {
        replaceCurrentTrack(currentTrack.value!.id)
      } else {
        _playNextTrack(isPersonalFM.value)
      }
    }

    // const _scrobble = (track: any, time: number, completed = false) => {
    //   const trackDuration = ~~(track.dt / 1000)
    //   time = completed ? trackDuration : ~~time
    //   const sourceID =
    //     playlistSource.value.id === 0 ? track.al?.id || track.album?.id : playlistSource.value.id
    //   scrobble({ id: track.id, sourceid: sourceID, time })
    // }

    const stop = async () => {
      seek.value = 0
      if (playingNext.value) {
        if (_shuffle.value) {
          _shuffleList.value.splice(currentTrackIndex.value + 1, 0, currentTrack.value!.id)
          currentTrackIndex.value += 1
        } else {
          _list.value.splice(currentTrackIndex.value + 1, 0, currentTrack.value!.id)
          currentTrackIndex.value += 1
        }
      }
      howler.masterGain.gain.setValueAtTime(0, audioContext.currentTime)
      await pause()
      audio.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
      audio.load()
    }

    const play = () => {
      const arts = currentTrack.value?.artists ?? currentTrack.value?.ar
      audioContext.resume().then(() => {
        audio.play()
        title.value = `${currentTrack.value?.name} · ${arts[0].name} - VutronMusic`
        document.title = title.value
        howler.masterGain.gain.linearRampToValueAtTime(volume.value, audioContext.currentTime + 0.2)
      })
    }

    const pause = async () => {
      howler.masterGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2)
      audio.pause()
      title.value = 'VutronMusic'
      document.title = title.value
      await audioContext.suspend()
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
        audioContext.setSinkId(device)
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

    const setupAudioNode = async () => {
      audio.addEventListener('ended', nextTrackCallback)
      await audioContext.suspend()

      setConvolver({
        name: '',
        source: convolverParams.fileName,
        mainGain: convolverParams.mainGain,
        sendGain: convolverParams.sendGain
      })

      for (const [key, value] of Object.entries(biquadParams)) {
        const filter = audioContext.createBiquadFilter()
        howler.biquads.set(`hz${key}`, filter)
        filter.type = 'peaking'
        filter.frequency.value = Number(key)
        filter.Q.value = 1.4
        filter.gain.value = value
      }
      for (let i = 1; i < biquadParamsKeys.length; i++) {
        const prev = biquadParamsKeys[i - 1]
        const curr = biquadParamsKeys[i]
        howler.biquads.get(`hz${prev}`)!.connect(howler.biquads.get(`hz${curr}`)!)
      }

      howler.audioSource.connect(howler.biquads.get(`hz${biquadParamsKeys[0]}`)!)

      const dynamics = audioContext.createDynamicsCompressor()
      howler.convolver.connect(howler.convolverOutputGain)
      howler.convolverSourceGain.connect(dynamics)
      howler.convolverOutputGain.connect(dynamics)
      howler.convolver.buffer =
        convolverParams.buffer instanceof ArrayBuffer ? convolverParams.buffer : null
      howler.convolverSourceGain.gain.value = convolverParams.mainGain
      howler.convolverOutputGain.gain.value = convolverParams.sendGain

      howler.masterGain.gain.setValueAtTime(volume.value, audioContext.currentTime)
      const key = biquadParamsKeys[biquadParamsKeys.length - 1]
      const lastBiquadFilter = howler.biquads.get(`hz${key}`)!
      lastBiquadFilter.connect(howler.convolverSourceGain)
      lastBiquadFilter.connect(howler.convolver)
      dynamics.connect(howler.masterGain)
      howler.masterGain.connect(audioContext.destination)

      initAcx = true
    }

    const updateMediaSessionMetaData = async (track: Track) => {
      if ('mediaSession' in navigator === false) return
      const arts = track.artists ?? track.ar
      const artists = arts.map((a) => a.name)
      const metadata = {
        title: track.name,
        artist: artists.join(','),
        album: track.album?.name ?? track.al?.name,
        artwork: [
          {
            src: pic.value!,
            type: 'image/jpg',
            sizes: '112x112'
          },
          {
            src: pic.value!,
            type: 'image/jpg',
            sizes: '224x224'
          }
        ],
        length: currentTrackDuration.value,
        trackId: track.id,
        url: '/trackid/' + track.id
      }
      navigator.mediaSession.metadata = new MediaMetadata(metadata)
      if (window.env?.isLinux) {
        metadata.artwork.map((art) => {
          art.src = (currentTrack.value?.album?.picUrl || currentTrack.value?.al?.picUrl)!
        })
        window.mainApi.send('metadata', metadata)
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
      currentLyricIndex.value = -1
      if (pic.value) {
        URL.revokeObjectURL(pic.value)
        pic.value = 'https://p2.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg'
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
      window.mainApi.on('play', () => {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.classList?.contains('comment-input')
        ) {
          return
        }
        playOrPause()
      })
      window.mainApi.on('previous', () => {
        if (!isPersonalFM.value) playPrev()
        else moveToFMTrash()
      })
      window.mainApi.on('next', () => _playNextTrack(isPersonalFM.value))
      window.mainApi.on('repeat', (_: any, value: string) => {
        repeatMode.value = value
      })
      window.mainApi.on('repeat-shuffle', (_: any, value: boolean) => {
        shuffle.value = value
      })
      window.mainApi.on('like', () => {
        if (currentTrack.value && currentTrack.value.matched !== false) {
          likeATrack(currentTrack.value.id)
        }
      })
      window.mainApi.on('fm-trash', () => {
        moveToFMTrash()
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

    onMounted(async () => {
      await Promise.all([fetchLocalMusic(), fetchStreamMusic()])
      playing.value = false
      title.value = 'VutronMusic'
      if (enabled.value) {
        pic.value = `atom://get-pic/${currentTrack.value?.id}`
        if (currentTrack.value?.type === 'stream') {
          pic.value = currentTrack.value?.picUrl
          if (streamMusicStore.status[streamMusicStore.select] !== 'login') {
            resetPlayer(false)
            return
          }
        }
        await setupAudioNode()
        seek.value = progress.value
        replaceCurrentTrack(currentTrack.value!.id, false).then(() => {
          window.mainApi.send('updatePlayerState', {
            playing: playing.value,
            isPersonalFM: isPersonalFM.value,
            like: isLiked.value,
            repeatMode: repeatMode.value,
            shuffle: shuffle.value
          })
          getLyricIndex()
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
      if (pic.value) URL.revokeObjectURL(pic.value)
      clearInterval(setIntervalTimer)
    })

    return {
      playing,
      enabled,
      progress,
      seek,
      chorus,
      playbackRate,
      repeatMode,
      title,
      shuffle,
      volume,
      _volume,
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
      currentTrackDuration,
      outputDevice,
      biquadParams,
      biquadUser,
      convolverParams,
      pic,
      isLiked,
      isLocalList,
      lyrics,
      noLyric,
      personalFMTrack,
      personalFMNextTrack,
      currentLyricIndex,
      currentLyric,
      color,
      color2,
      playlistSource,
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
    persist: true
  }
)
