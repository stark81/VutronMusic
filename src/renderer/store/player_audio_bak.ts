import { defineStore } from 'pinia'
import shuffleFn from 'lodash/shuffle'
import { Track, useLocalMusicStore } from './localMusic'
// import { Howler, Howl } from 'howler'
import { computed, ref, onMounted, onBeforeUnmount, reactive, watch } from 'vue'

export const usePlayerStore = defineStore(
  'player',
  () => {
    const enabled = ref(false)
    const playing = ref(false)
    const isPersonalFM = ref(false)
    const _shuffle = ref(false)
    const _list = ref<any[]>([])
    const _volume = ref(1)
    const _shuffleList = ref<any[]>([])
    const progress = ref(0)
    const repeatMode = ref('off')
    const lyrics = reactive<{
      lyric: any[]
      tlyric: any[]
      rlyric: any[]
    }>({
      lyric: [],
      tlyric: [],
      rlyric: []
    })
    const currentTrack = ref<any>()
    const currentTrackIndex = ref(0)
    const manualSeek = ref(false)
    const outputDevice = ref<string>('default')
    const biquadParms = reactive({
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
    const convolverParams = reactive({
      buffer: null,
      mainGain: 1,
      sendGain: 0
    })
    const localMusicStore = useLocalMusicStore()
    const localMusics = ref<Track[]>(localMusicStore.localTracks)

    const playerNode: { [key: string]: any } = {}
    const biquadKeys = Object.keys(biquadParms)
    const _pic = ''

    const currentLyricIndex = computed({
      get: () => {
        return playerNode.currentLyricIndex
      },
      set: (value) => {
        playerNode.currentLyricIndex = value
      }
    })

    const shuffle = computed({
      get: () => {
        return _shuffle.value
      },
      set: (value) => {
        _shuffle.value = value
        if (value) shuffleTheList()
      }
    })

    const currentTrackDuration = computed(() => ~~((currentTrack.value?.dt || 1000) / 1000))

    const list = computed({
      get: () => {
        return _shuffle.value ? _shuffleList.value : _list.value
      },
      set: (value) => {
        _list.value = value
        if (_shuffle.value) shuffleTheList()
      }
    })

    const seek = computed({
      get: () => {
        return progress.value
      },
      set: (value) => {
        if (value >= 0 && value <= currentTrackDuration.value) {
          manualSeek.value = true
          progress.value = value
        }
      }
    })

    const volume = computed({
      get: () => _volume.value,
      set: (value) => {
        _volume.value = value
        if (playerNode.audioNode) {
          playerNode.audioNode.volume = value
        }
      }
    })

    const imageUrl = computed(() => {
      return _pic
    })

    const noLyric = computed(() => {
      return lyrics.lyric.length === 0
    })

    const timeupdateFn = () => {
      progress.value = playerNode.audioNode.currentTime
      if (progress.value >= currentTrackDuration.value) {
        playNext()
      }
    }

    const setupAudioNode = () => {
      playerNode.audioContext = new AudioContext()
      playerNode.audioContext.suspend()
      playerNode.audioNode = new Audio()
      playerNode.sourceNode = playerNode.audioContext.createMediaElementSource(playerNode.audioNode)

      playerNode.biquads = new Map()
      for (const [key, value] of Object.entries(biquadParms)) {
        const filter = playerNode.audioContext.createBiquadFilter()
        playerNode.biquads.set(`hz${key}`, filter)
        filter.type = 'peaking'
        filter.frequency.value = Number(key)
        filter.Q.value = 1.4
        filter.gain.value = value
      }
      for (let i = 1; i < biquadKeys.length; i++) {
        const prev = biquadKeys[i - 1]
        const curr = biquadKeys[i]
        playerNode.biquads.get(`hz${prev}`)!.connect(playerNode.biquads.get(`hz${curr}`)!)
      }

      const dynamics = playerNode.audioContext.createDynamicsCompressor()
      playerNode.convolver = playerNode.audioContext.createConvolver()
      playerNode.convolverSourceGain = playerNode.audioContext.createGain()
      playerNode.convolverOutputGain = playerNode.audioContext.createGain()
      playerNode.convolver.connect(playerNode.convolverOutputGain)
      playerNode.convolverSourceGain.connect(dynamics)
      playerNode.convolverOutputGain.connect(dynamics)
      playerNode.convolver.buffer = convolverParams.buffer
      playerNode.convolverSourceGain.gain.value = convolverParams.mainGain
      playerNode.convolverOutputGain.gain.value = convolverParams.sendGain

      playerNode.masterGain = playerNode.audioContext.createGain()
      playerNode.masterGain.gain.setValueAtTime(1, playerNode.audioContext.currentTime)

      const key = biquadKeys[biquadKeys.length - 1]
      const lastBiquadFilter = playerNode.biquads.get(`hz${key}`)!
      lastBiquadFilter.connect(playerNode.convolverSourceGain)
      lastBiquadFilter.connect(playerNode.convolver)
      dynamics.connect(playerNode.masterGain)
      playerNode.masterGain.connect(playerNode.audioContext.destination)
    }

    const connectAudioNode = async () => {
      await playerNode.audioContext.resume()
      playerNode.sourceNode.connect(playerNode.biquads.get(`hz${biquadKeys[0]}`)!)
    }

    const unload = async () => {
      await playerNode.audioContext.suspend()
      playerNode.sourceNode.disconnect()
      playerNode.audioNode.removeEventListener('timeupdate', timeupdateFn, false)
      playerNode.audioNode.src = ''
      await playerNode.audioNode.load()
      // playerNode.audioNode = null
      // delete playerNode.audioNode
      // playerNode.sourceNode.buffer = null
      // playerNode.sourceNode = null
      // delete playerNode.sourceNode
      // playerNode.audioNode = new Audio()
      // playerNode.sourceNode = playerNode.audioContext.createMediaElementSource(playerNode.audioNode)
    }

    const shuffleTheList = () => {
      _shuffleList.value = shuffleFn(_list.value.slice())
    }

    const replacePlaylist = async (trackIDS: number[], autoPlayTrackID = 0) => {
      if (!playerNode.audioNode) {
        setupAudioNode()
        await connectAudioNode()
      }
      isPersonalFM.value = false
      enabled.value = true
      _list.value = trackIDS
      currentTrackIndex.value = autoPlayTrackID
      if (_shuffle.value) shuffleTheList()
      replaceCurrentTrack(trackIDS[autoPlayTrackID], true)
    }

    const replaceCurrentTrack = (trackID: number, autoPlay = true) => {
      // 优先从本地歌曲中获取
      return (
        getLocalMusic(trackID)
          // 如果本地没有，则从线上获取
          .then((track) => track ?? getTrack(trackID))
          .then((track) => {
            currentTrack.value = track
            getTrackSource(track).then(async (source) => {
              await unload()
              await connectAudioNode()
              playerNode.audioNode.src = source
              await playerNode.audioNode.load()
              playerNode.audioNode.addEventListener('timeupdate', timeupdateFn, false)
              if (autoPlay) {
                playerNode.audioNode.play().then(() => {
                  playing.value = true
                })
              }
            })
          })
      )
    }

    // 占位，模拟请求线上歌曲资源
    const getTrack = async (trackID: number) => {
      return new Promise<Track>((resolve) => {})
    }

    const getTrackSource = (track: Track) => {
      return new Promise((resolve) => {
        resolve(track.isLocal ? `atom://get-music${track.filePath}` : '')
      })
    }

    const getLocalMusic = async (id: number) => {
      return new Promise<Track | null>((resolve) => {
        const matchTrack = localMusics.value.find((track: Track) => track.id === id)
        resolve(matchTrack || null)
      })
    }

    const playOrPause = async () => {
      if (playing.value) {
        playerNode.audioNode.pause()
        playing.value = false
      } else {
        playerNode.audioNode.play()
        playing.value = true
      }
    }

    const playNext = () => {
      playerNode.audioNode.removeEventListener('timeupdate', timeupdateFn, false)
      if (currentTrackIndex.value < list.value.length - 1) {
        currentTrackIndex.value++
        replaceCurrentTrack(list.value[currentTrackIndex.value], true)
      } else {
        playing.value = false
      }
    }

    const playPrev = () => {
      playerNode.audioNode.removeEventListener('timeupdate', timeupdateFn, false)
      if (currentTrackIndex.value > 0) {
        currentTrackIndex.value--
        replaceCurrentTrack(list.value[currentTrackIndex.value], true)
      } else {
        playing.value = false
      }
    }

    const resetPlayer = () => {}

    const setDevice = (device: string) => {
      if ('setSinkId' in AudioContext.prototype) {
        // @ts-ignore
        playerNode.audioContext.setSinkId(device)
      }
    }

    onMounted(() => {
      if (enabled.value) {
        setupAudioNode()
        connectAudioNode().then(() => {
          replaceCurrentTrack(list.value[currentTrackIndex.value], false).then(() => {
            setDevice(outputDevice.value)
            watch(outputDevice, (val) => {
              setDevice(val)
            })
            watch(progress, async (newValue) => {
              if (playerNode.audioNode && manualSeek.value) {
                playerNode.audioNode.removeEventListener('timeupdate', timeupdateFn, false)
                if (playing.value) await playerNode.audioNode.pause()
                playerNode.audioNode.currentTime = newValue
                manualSeek.value = false
                if (playing.value) await playerNode.audioNode.play()
                playerNode.audioNode.addEventListener('timeupdate', timeupdateFn, false)
              }
            })
          })
        })
      }
    })

    onBeforeUnmount(() => {
      manualSeek.value = false
      if (enabled.value) {
        unload()
        playerNode.audioNode.removeEventListener('timeupdate', timeupdateFn, false)
      }
    })

    return {
      enabled,
      currentTrack,
      currentTrackDuration,
      playing,
      lyrics,
      repeatMode,
      isPersonalFM,
      outputDevice,
      currentLyricIndex,
      shuffle,
      progress,
      seek,
      _shuffle,
      _list,
      _shuffleList,
      currentTrackIndex,
      list,
      volume,
      imageUrl,
      noLyric,
      setupAudioNode,
      replacePlaylist,
      playOrPause,
      playNext,
      playPrev,
      resetPlayer
    }
  },
  {
    persist: true // 开启数据持久化
  }
)
