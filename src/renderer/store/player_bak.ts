import { defineStore } from 'pinia'
import { Track, useLocalMusicStore } from './localMusic'
import { useSettingsStore } from './settings'
import shuffleFn from 'lodash/shuffle'
import { lyricParse } from '../utils/lyric'
import { getLyric } from '../api/track'
import { ref, computed, reactive, watch, watchEffect, onMounted, onBeforeUnmount } from 'vue'

export interface biquadType {
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

export interface userBiquadType {
  [key: string]: biquadType
}

export const usePlayerStore = defineStore(
  'player',
  () => {
    const playing = ref(false)
    const enabled = ref(false)
    const progress = ref(0)
    const repeatMode = ref('off')
    const _shuffle = ref(false)
    const _volume = ref(1)
    const volumeBeforeMuted = ref(1)
    const isPersonalFM = ref(false)
    const currentTrack = ref<Track | null>(null)
    const outputDevice = ref('default')
    let setIntervalTimer: any
    let setLyricIntervalTimer: any
    const currentLyricIndex = ref(-1)
    const localMusics = ref<Track[]>([])
    const isLiked = ref(false)
    const pic = ref<string>()
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

    const localMusicStore = useLocalMusicStore()

    const settingsStore = useSettingsStore()
    const useReplayGain = computed(() => settingsStore.localMusic.replayGain)
    const useInnerInfoFirst = computed(() => settingsStore.localMusic.useInnerInfoFirst)

    let audioContext = new AudioContext()
    let currentFetchController: AbortController | null = null

    const _shuffleList = ref<number[]>([])
    const _list = ref<number[]>([])
    const currentTrackIndex = ref(0)
    const currentNode = reactive<{
      offset: number
      start: number | null
      source: AudioBufferSourceNode | null
      buffer: AudioBuffer | null
    }>({
      offset: 0,
      start: null,
      source: null,
      buffer: null
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

    const howler = {
      biquads: new Map<string, BiquadFilterNode>(),
      convolverSourceGain: audioContext.createGain(),
      convolverOutputGain: audioContext.createGain(),
      convolver: audioContext.createConvolver(),
      masterGain: audioContext.createGain()
    }

    const currentTrackDuration = computed(() => {
      return ~~((currentTrack.value?.dt || 1000) / 1000)
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
        // if (!currentNode.source) return
        if (playing.value) {
          stop().then(async () => {
            currentNode.offset = value
            currentNode.start = null
            await play()
          })
        } else {
          currentNode.offset = value
          currentNode.start = null
        }
      }
    })

    const volume = computed({
      get() {
        return _volume.value
      },
      set(value) {
        _volume.value = value
        let replayGain = 1
        if (useReplayGain.value && currentTrack.value?.trackGain) {
          replayGain = Math.pow(10, currentTrack.value.trackGain / 20)
        }
        howler.masterGain.gain.setValueAtTime(value * replayGain, audioContext.currentTime)
      }
    })

    const noLyric = computed(() => lyrics.lyric.length === 0)

    watch(currentTrack, async (value) => {
      if (!value) return
      if (pic.value) URL.revokeObjectURL(pic.value)
      await getCurrentTrackInfo(value)
      currentLyricIndex.value = -1
      updateMediaSessionMetaData(value)
    })

    watch(useReplayGain, (value) => {
      if (value && currentTrack.value?.trackGain) {
        const replayGain = Math.pow(10, currentTrack.value.trackGain / 20)
        howler.masterGain.gain.setValueAtTime(volume.value * replayGain, audioContext.currentTime)
      }
    })

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
      fetch(path)
        .then((res) => res.arrayBuffer())
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((buffer) => {
          if (buffer) convolverParams.buffer = buffer
        })
    }

    const getCurrentTrackInfo = async (track: Track) => {
      if (!track) return
      let data: {
        color: string
        color2: string
        pic: { type: string; data: Buffer }
        format: string
        isInnerPic: boolean
        gain: number
        lyrics: any[] | string
      }
      let lyricData: {
        lrc: { lyric: any[] }
        tlyric: { lyric: any[] }
        romalrc: { lyric: any[] }
      } = {
        lrc: { lyric: [] },
        tlyric: { lyric: [] },
        romalrc: { lyric: [] }
      }
      // 《惊鸿雪》属于线上没有歌词，但本地有。需要调整歌词获取逻辑。
      if (!track.isLocal || (!useInnerInfoFirst.value && track.matched)) {
        fetch(`atom://get-pic-and-color/${track.album.picUrl}?param=128y128`)
          .then((res) => res.json())
          .then((colorData) => {
            const buffer = new Uint8Array(colorData.pic.data)
            const blob = new Blob([buffer], { type: colorData.format })
            pic.value = URL.createObjectURL(blob)
            color.value = colorData.color
            color2.value = colorData.color2
          })
        lyricData = await getLyric(track.id)
      } else {
        data = await fetch(`atom://get-localtrack-info${track.filePath}`).then((res) => res.json())
        if (!data.isInnerPic && track.matched) {
          const colorData = await fetch(
            `atom://get-pic-and-color/${track.album.picUrl}?param=512y512`
          ).then((res) => res.json())
          const buffer = new Uint8Array(colorData.pic.data)
          const blob = new Blob([buffer], { type: colorData.format })
          pic.value = URL.createObjectURL(blob)
          color.value = colorData.color
          color2.value = colorData.color2
        } else {
          const buffer = new Uint8Array(data.pic.data)
          const blob = new Blob([buffer], { type: data.format })
          pic.value = URL.createObjectURL(blob)
          color.value = data.color
          color2.value = data.color2
        }
        const localLyric = typeof data.lyrics === 'string' ? data.lyrics : data.lyrics[0]
        if (localLyric) {
          const splitLines = (str: string) => {
            if (str.includes('\r\n')) {
              return str.split('\r\n')
            } else if (str.includes('\r')) {
              return str.split('\r')
            } else {
              return str.split('\n')
            }
          }
          const result = splitLines(localLyric)
          const groupedResult: Array<string>[] = result.reduce(
            (acc: string[][], curr) => {
              if (curr === '') {
                acc.push([])
                acc[acc.length - 1].push(curr)
              } else {
                acc[acc.length - 1].push(curr)
              }
              return acc
            },
            [[]]
          )
          const lyricArray = groupedResult.filter((item) => item.length > 1)
          if (lyricArray.length) {
            lyricData = {
              lrc: { lyric: lyricArray[0] || [] },
              tlyric: { lyric: lyricArray[1] || [] },
              romalrc: { lyric: lyricArray[2] || [] }
            }
          }
        } else if (track.matched) {
          lyricData = await getLyric(track.id)
        }
      }

      let { lyric, tlyric, rlyric } = lyricParse(lyricData)
      lyric = lyric.filter((l) => !/^作(词|曲)\s*(:|：)\s*无$/.exec(l.content))
      const includeAM = lyric.length <= 10 && lyric.map((l) => l.content).includes('纯音乐，请欣赏')
      if (includeAM) {
        const reg = /^作(词|曲)\s*(:|：)\s*/
        const author = currentTrack.value!.artists[0]?.name
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

    const replacePlaylist = (trackIDS: number[], autoPlayTrackID = 0) => {
      isPersonalFM.value = false
      _list.value = trackIDS
      currentTrackIndex.value = autoPlayTrackID
      if (_shuffle.value) shuffleTheList()
      stop().then(() => {
        replaceCurrentTrack(trackIDS[autoPlayTrackID], true)
        enabled.value = true
      })
    }

    const replaceCurrentTrack = async (trackID: number, autoPlay = true) => {
      progress.value = 0
      try {
        const track = await getLocalMusic(trackID)
        currentTrack.value = track
        if (!track) {
          playNext()
          return
        }
        const source = await getTrackSource(track)
        await loadSource(source)
        if (autoPlay) {
          playing.value = true
          await play()
        }
      } catch (error) {
        playNext()
      }
    }

    const getLocalMusic = (id: number) => {
      return new Promise<Track | null>((resolve) => {
        localMusics.value = localMusicStore.localTracks
        const matchTrack = localMusics.value?.find((track: Track) => track.id === id)
        resolve(matchTrack || null)
      })
    }

    const getTrackSource = (track: Track) => {
      return new Promise<string>((resolve) => {
        if (track.isLocal) {
          resolve(`atom://get-music${track.filePath}`)
        } else {
          resolve('')
        }
      })
    }

    const loadSource = (source: string) => {
      return new Promise<boolean>((resolve, reject) => {
        if (currentFetchController) {
          currentFetchController.abort()
        }
        currentFetchController = new AbortController()
        const { signal } = currentFetchController
        fetch(source, { signal })
          .then((res) => {
            if (!res.ok) {
              reject(new Error('Failed to load audio source'))
            }
            return res.arrayBuffer()
          })
          .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
          .then((audioBuffer) => {
            if (audioBuffer) {
              currentNode.buffer = audioBuffer
              resolve(true)
            } else {
              reject(new Error('Failed to decode audio data'))
            }
          })
          .catch(reject)
          .finally(() => {
            currentFetchController = null
          })
      })
    }

    const playPrev = async () => {
      await stop()
      if (currentTrackIndex.value > 0) {
        currentTrackIndex.value--
        await replaceCurrentTrack(list.value[currentTrackIndex.value], true)
      } else {
        playing.value = false
      }
    }

    const playNext = async () => {
      await stop()
      if (currentTrackIndex.value < list.value.length - 1) {
        currentTrackIndex.value++
        await replaceCurrentTrack(list.value[currentTrackIndex.value], true)
      } else {
        playing.value = false
      }
    }

    const play = async () => {
      if (currentNode.source) return
      await audioContext.resume()
      const source = audioContext.createBufferSource()
      source.buffer = currentNode.buffer
      source.onended = playNext
      source.connect(howler.biquads.get(`hz${biquadParamsKeys[0]}`)!)
      source.start(0, currentNode.offset)
      // howler.masterGain.gain.setValueAtTime(volume.value, audioContext.currentTime)
      volume.value = _volume.value
      currentNode.source = source
      currentNode.start = audioContext.currentTime
      // playing.value = true

      // // 更新播放进度
      // updateProgress()
    }

    const pause = async () => {
      if (!currentNode.source) return
      howler.masterGain.gain.setValueAtTime(0, audioContext.currentTime)
      currentNode.offset = seek.value
      await audioContext.suspend()
      currentNode.source.stop()
      currentNode.source.disconnect()
      currentNode.source.onended = null
      currentNode.source = null
      currentNode.start = null
    }

    const stop = async () => {
      await pause()
      currentNode.offset = 0
      currentNode.start = null
      if (currentNode.source) currentNode.source.buffer = null
      currentNode.source = null
    }

    const playOrPause = async () => {
      if (playing.value) {
        playing.value = false
        await pause()
      } else {
        playing.value = true
        await play()
      }
    }

    const setDevice = (device: string) => {
      if ('setSinkId' in AudioContext.prototype) {
        // @ts-ignore
        audioContext.setSinkId(device)
      }
    }

    const shuffleTheList = () => {
      _shuffleList.value = shuffleFn(_list.value.slice())
    }

    const setupAudioNode = async () => {
      if (audioContext.state === 'closed') audioContext = new AudioContext()
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
    }

    const updateMediaSessionMetaData = async (track: Track) => {
      if ('mediaSession' in navigator === false) {
        return
      }
      const artists = track.artists.map((a) => a.name)
      const metadata = {
        title: track.name,
        artist: artists.join(','),
        album: track.album.name,
        artwork: [
          {
            src: pic.value!,
            type: 'image/jpg',
            sizes: '224x224'
          },
          {
            src: pic.value!,
            type: 'image/jpg',
            sizes: '512x512'
          }
        ],
        length: currentTrackDuration.value,
        trackId: track.id,
        url: '/trackid/' + track.id
      }
      navigator.mediaSession.metadata = new MediaMetadata(metadata)
    }

    const resetPlayer = () => {
      if (currentNode.source) stop()
      list.value = []
      enabled.value = false
      playing.value = false
      currentTrackIndex.value = 0
      currentTrack.value = null
      progress.value = 0
      volume.value = 1
      _shuffle.value = false
      _shuffleList.value = []
      _list.value = []
      isPersonalFM.value = false
      repeatMode.value = 'off'
      pic.value = undefined
      progress.value = 0
      lyrics.lyric = []
      lyrics.tlyric = []
      lyrics.rlyric = []
      currentLyricIndex.value = -1
      if (pic.value) URL.revokeObjectURL(pic.value)

      for (const key in biquadParams) {
        biquadParams[key] = 0
      }
    }

    onMounted(() => {
      setupAudioNode().then(async () => {
        await replaceCurrentTrack(list.value[currentTrackIndex.value], false)
        setDevice(outputDevice.value)
        watch(outputDevice, (value) => {
          setDevice(value)
        })
        volume.value = _volume.value
        setIntervalTimer = setInterval(() => {
          progress.value =
            currentNode.offset +
            (currentNode.start !== null ? audioContext.currentTime - currentNode.start : 0)
        }, 1000)
        setLyricIntervalTimer = setInterval(() => {
          const progress = seek.value + lyricOffset.value
          currentLyricIndex.value = lyrics.lyric.findIndex((l, index) => {
            const nextLyric = lyrics.lyric[index + 1]
            const nextLyricTime = nextLyric ? nextLyric.time : currentTrackDuration.value
            return progress >= l.time && progress < nextLyricTime
          })
        }, 50)
      })
    })

    onBeforeUnmount(() => {
      clearInterval(setIntervalTimer)
      clearInterval(setLyricIntervalTimer)
      playing.value = false
      pic.value = undefined
    })

    return {
      playing,
      enabled,
      progress,
      seek,
      repeatMode,
      shuffle,
      volume,
      _volume,
      volumeBeforeMuted,
      _list,
      _shuffleList,
      _shuffle,
      list,
      currentTrack,
      isPersonalFM,
      currentTrackIndex,
      currentTrackDuration,
      outputDevice,
      biquadParams,
      biquadUser,
      convolverParams,
      pic,
      isLiked,
      lyrics,
      noLyric,
      currentLyricIndex,
      color,
      color2,
      setConvolver,
      replacePlaylist,
      playPrev,
      playNext,
      playOrPause,
      resetPlayer
    }
  },
  {
    persist: true
  }
)
