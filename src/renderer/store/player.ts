import { defineStore } from 'pinia'
import { computed, toRaw, onMounted, ref, watch } from 'vue'
import { useAudioEngineStore } from './audioEngine'
import { useLyricStore } from './lyric'
import { usePluginMusic } from './pluginMusic'
import { useOsdLyricStore } from './osdLyric'
import { useNormalStateStore } from './state'
import { useSettingsStore } from './settings'
import eventBus from '../utils/eventBus'

import shuffleFn from 'lodash/shuffle'
import cloneDeep from 'lodash/cloneDeep'

import { PluginId, Track } from '@/types/plugin'
import { RepeatMode, SourceType, PlaylistSourceInfo } from '@/types/music'

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = remainingSeconds.toFixed(3).padStart(6, '0')
  return `[${formattedMinutes}:${formattedSeconds}]`
}

export const usePlayerStore = defineStore(
  'player',
  () => {
    const engineStore = useAudioEngineStore()
    const lyricStore = useLyricStore()
    const pluginStore = usePluginMusic()
    const osdLyricStore = useOsdLyricStore()
    const stateStore = useNormalStateStore()
    const settingsStore = useSettingsStore()

    // ─────────────────────────────────────────────
    // 来自 pluginStore的状态与方法
    // ─────────────────────────────────────────────
    const likedTracks = computed(() => pluginStore.likedTracks)
    const { pluginMethodCall, resizeImage, likeATrack } = pluginStore

    const source = computed(
      () =>
        pluginStore.services.find((item) => item.code === currentTrack.value?.pluginId)?.name ||
        currentTrack.value?.pluginId ||
        '未知音源'
    )

    // ─────────────────────────────────────────────
    // 来自 usePlaybackStore 的状态
    // 直接返回 store 里的 ref/computed，响应性完整保留，
    // 可写 computed（seek、shuffle、playbackRate）的 set 也正常工作。
    // ─────────────────────────────────────────────

    // 播放器状态
    const playing = ref(false)
    const enabled = ref(false)
    const progress = ref(0)
    const playbackRate = ref(1)
    const title = ref('VutronMusic')

    // 歌曲信息
    const isPersonalFM = ref(false)
    const playingNext = ref(false)
    const currentTrackIndex = ref(0)
    const currentTrack = ref<Track>()
    const chorus = ref(0)
    const pic = ref('vutron://get-default-pic')

    const personalFMTrack = ref<Track>()

    // 播放列表相关
    const isShuffle = ref(false)
    const repeatMode = ref<RepeatMode>('off')
    const playList = ref<[PluginId, Record<string, any>][]>([])
    const shuffleList = ref<[PluginId, Record<string, any>][]>([])
    const playNextList = ref<[PluginId, Record<string, any>][]>([])

    const _volume = ref(0.5)
    const _volumeBeforeMuted = ref(0)
    const playlistSource = ref<PlaylistSourceInfo>({
      type: 'Playlist',
      plugin: '' as PluginId,
      sourceContext: {}
    })

    const enableDRP = computed(() => settingsStore.misc.enableDiscordRichPresence)

    const hasListSource = computed(
      () => !isPersonalFM.value && playlistSource.value.type !== 'SearchTrack'
    )

    const getListSourcePath = computed(() => {
      const { type, plugin, sourceContext } = playlistSource.value

      switch (type) {
        case 'Album':
          return `/album/${plugin}/${JSON.stringify(sourceContext)}`
        case 'Artist':
          return `/artist/${plugin}/${JSON.stringify(sourceContext)}`
        case 'Playlist':
          if (plugin === 'all' || sourceContext.id === 0 || sourceContext.id === '0') {
            const codes = pluginStore.loggedInServices
              .filter((item) => item.type === sourceContext.pluginType)
              .map((item) => item.code)
              .join('/')
            return `/liked-songs/${plugin === 'all' ? codes : plugin}`
          }
          return `/playlist/${plugin}/${JSON.stringify(sourceContext)}`
        case 'DailySongs':
          return `/daily/songs/${plugin}`
        case 'Track':
          return sourceContext.pluginType === 'stream' ? `/stream` : '/localMusic'
        default:
          return ''
      }
    })

    const list = computed({
      get: () => (isShuffle.value ? shuffleList.value : playList.value),
      set: (value) => (playList.value = value)
    })

    /**
     * seek 是可写 computed，set 会同步到 audio.currentTime 并触发歌词索引更新。
     * 这里转发整个 computed，保留 getter + setter 语义。
     */
    const seek = computed({
      get: () => engineStore.progress,
      set: (value) => {
        engineStore.setPosition(value)
        lyricStore.updateIndex()
        progress.value = value
        if (window.env?.isLinux) {
          window.mainApi?.send('updatePlayerState', { progress: value })
        }
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setPositionState({
            duration: duration.value,
            playbackRate: playbackRate.value,
            position: value
          })
        }
      }
    })

    const volume = computed({
      get: () => _volume.value,
      set: (v) => {
        _volume.value = v
        engineStore.applyVolume(v)
      }
    })
    const volumeBeforeMuted = computed({
      get: () => _volumeBeforeMuted.value,
      set: (v) => {
        _volumeBeforeMuted.value = v
      }
    })

    const duration = computed(() => {
      return ~~((currentTrack.value?.duration || 1000) / 1000)
    })

    const isLiked = computed(() => {
      if (!currentTrack.value) return false
      const plugin = currentTrack.value.pluginId
      const likedIDs = likedTracks.value[plugin]?.data.map((item) => item.id)
      return likedIDs?.includes(currentTrack.value.id)
    })

    // ─────────────────────────────────────────────
    // 来自 useLyricStore 的状态
    // ─────────────────────────────────────────────

    // const  = ref<lyricLine[]>([])

    /**
     * currentIndex 在原 store 里是直接暴露的 ref，
     * 部分组件可能直接读取；这里只读转发即可。
     */
    const lyrics = computed({
      get: () => lyricStore.lyrics,
      set: (value) => {
        lyricStore.lyrics = value.filter((item) => !!item.lyric.text)
      }
    })
    const currentIndex = computed(() => lyricStore.currentIndex)
    const currentLyric = computed(() => lyricStore.currentLyric)
    const lyricOffset = computed({
      get: () => lyricStore.offset,
      set: (value) => {
        lyricStore.offset = value
      }
    })
    const noLyric = computed(() => !lyrics.value.length)

    // ─────────────────────────────────────────────
    // 来自 useAudioEngineStore 的状态
    // ─────────────────────────────────────────────

    // const biquadParams = computed(() => engineStore.biquadParams)
    // const biquadUser = computed({
    //   get: () => engineStore.biquadUser,
    //   set: (v) => {
    //     engineStore.biquadUser = v
    //   }
    // })
    // const convolverParams = computed(() => engineStore.convolverParams)
    const pitch = computed({
      get: () => engineStore.pitch,
      set: (v) => (engineStore.pitch = v)
    })
    const outputDevice = computed({
      get: () => engineStore.outputDevice,
      set: (v) => {
        engineStore.outputDevice = v
      }
    })
    /**
     * balance 是新增字段，原 store 没有。
     * 对外暴露以便 UI 层（均衡器/音效设置页）可以直接通过 playerStore 访问。
     */
    // const balance = computed({
    //   get: () => engineStore.balance,
    //   set: (v) => {
    //     engineStore.balance = v
    //   }
    // })
    const fadeDuration = computed(() => engineStore.fadeDuration)

    // ─────────────────────────────────────────────
    // watch
    // ─────────────────────────────────────────────
    watch(
      playbackRate,
      (value) => {
        engineStore.setPlaybackRate(value)
        lyricStore.updateRate(value)
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setPositionState({
            duration: duration.value,
            playbackRate: value,
            position: seek.value > duration.value ? 0 : seek.value
          })
        }
        window.mainApi?.send('updatePlayerState', {
          rate: value,
          progress: engineStore.getCurrentTime() ?? 0
        })
        if (osdLyricStore.show)
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: { rate: value }
          })
      },
      { immediate: true }
    )

    watch(isLiked, (value) => {
      window.mainApi?.send('updatePlayerState', { like: value })
    })

    watch(repeatMode, (value) => {
      window.mainApi?.send('updatePlayerState', { repeatMode: value })
    })

    watch(isShuffle, (value) => {
      window.mainApi?.send('updatePlayerState', { shuffle: value })
    })

    watch(
      () => playing.value && settingsStore.general.preventSuspension,
      (value) => {
        window.mainApi?.send('update-powersave', value)
      }
    )

    watch(enableDRP, (value) => {
      if (value && playing.value) {
        playDiscordPresence(currentTrack.value!, engineStore.getCurrentTime())
      } else {
        pauseDiscordPresence(currentTrack.value!)
      }
    })

    watch(lyricOffset, (value) => {
      if (window.env?.isLinux) {
        updateMediaSessionMetaData(currentTrack.value!)
      }
      if (osdLyricStore.show) {
        window.mainApi?.sendMessage({
          type: 'update-osd-status',
          data: { lyricOffset: [value, engineStore.getCurrentTime()] }
        })
      }
    })

    watch(
      () => [osdLyricStore.mode, osdLyricStore.translationMode],
      () => {
        if (osdLyricStore.show) {
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: { seek: engineStore.getCurrentTime() }
          })
        }
      }
    )

    // ─────────────────────────────────────────────
    // 方法转发
    // 方法不需要包 computed，直接引用子 store 的函数即可。
    // ─────────────────────────────────────────────

    function replacePlaylist(
      source: { type: SourceType; plugin: PluginId | 'all'; sourceContext: Record<string, any> },
      sourceContext: [PluginId, Record<string, any>][],
      index: number
    ) {
      playlistSource.value = source
      isPersonalFM.value = false
      playList.value = sourceContext

      if (isShuffle.value) {
        shuffleTheList(index)
        currentTrackIndex.value = 0
        const [plugin, sourceContext] = list.value[currentTrackIndex.value]
        replaceCurrentTrack(plugin, sourceContext)
      } else {
        currentTrackIndex.value = index
        const [plugin, sourceContext] = list.value[currentTrackIndex.value]
        replaceCurrentTrack(plugin, sourceContext)
      }
      playing.value = true
      if (!enabled.value) enabled.value = true
    }

    function shuffleTheList(firstID = 0) {
      const id = playList.value[firstID]
      const list = playList.value.filter((item) => item !== id)
      shuffleList.value = shuffleFn(list)
      shuffleList.value.unshift(id)
    }

    async function replaceCurrentTrack(
      plugin: PluginId,
      sourceContext: Record<string, any>,
      autoPlay = true
    ) {
      if (autoPlay && currentTrack.value?.name) {
        scrobbleFM(currentTrack.value as Track, seek.value)
        if (seek.value >= currentTrack.value.duration / 2 || seek.value >= 240000) {
          pluginMethodCall(currentTrack.value.pluginId, 'scrobble', {
            ...currentTrack.value.sourceContext,
            time: seek.value
          })
        }
      }

      const res = await pluginMethodCall(plugin, 'getTrackDetail', { tracks: [sourceContext] })

      currentTrack.value = {
        ...res.data[0],
        album: { ...res.data[0].album, pluginId: plugin },
        artists: res.data[0].artists.map((it) => ({ ...it, pluginId: plugin })),
        albumArtists: res.data[0].albumArtists.map((it) => ({ ...it, pluginId: plugin })),
        pluginId: plugin
      }

      const result = await pluginMethodCall(plugin, 'songUrl', sourceContext)
      const { url, replayGain, peak } = result.data
      engineStore.playAudioSource(url, replayGain, peak, autoPlay)

      updateNowPlaying(currentTrack.value)
    }

    // function getTrackInfo() {}

    const playOrPause = async () => {
      if (playing.value) {
        await engineStore.pause()
        playing.value = false
      } else {
        playing.value = true
        await engineStore.play()
      }
    }

    function _getNextTrack(): [[PluginId, Record<string, any>] | undefined, number, boolean] {
      const next = currentTrackIndex.value + 1
      if (playNextList.value.length > 0) {
        const track = playNextList.value.shift()
        return [track, next, true]
      }
      if (repeatMode.value === 'on') {
        if (list.value.length === currentTrackIndex.value + 1) {
          return [list.value[0], 0, false]
        }
      }
      return [list.value[next], next, false]
    }

    function playPrev() {
      const [trackInfo, prev, isPlayingNext] = _getPrevTrack()
      playingNext.value = isPlayingNext

      if (!trackInfo) {
        playing.value = false
        engineStore.pause()
      } else {
        currentTrackIndex.value = prev
        replaceCurrentTrack(...trackInfo, true)
      }
    }

    function _getPrevTrack(): [[PluginId, Record<string, any>] | undefined, number, boolean] {
      const prev = currentTrackIndex.value - 1

      if (repeatMode.value === 'on') {
        if (currentTrackIndex.value === 0) {
          return [list.value.at(-1), list.value.length - 1, false]
        }
      }
      return [list.value[prev], prev, false]
    }

    function _playNext() {
      if (playingNext.value) {
        const track = currentTrack.value!
        list.value.splice(currentTrackIndex.value, 0, [track.pluginId, track.sourceContext])
      }

      const [trackInfo, index, isPlayingNext] = _getNextTrack()
      playingNext.value = isPlayingNext

      if (!trackInfo) {
        playing.value = false
      } else {
        currentTrackIndex.value = index
        replaceCurrentTrack(...trackInfo, true)
        playing.value = true
      }
    }

    function _playNextPersonal() {}

    async function playNext(isPersonal: boolean) {
      await engineStore.pause()
      if (isPersonal) {
        _playNextPersonal()
      } else {
        _playNext()
      }
    }

    function _nextTrackCallback() {
      seek.value = 0
      scrobbleFM(currentTrack.value as Track, 0, true)
      pluginMethodCall(currentTrack.value!.pluginId, 'scrobble', {
        ...currentTrack.value!.sourceContext,
        time: currentTrack.value!.duration
      })
      if (!isPersonalFM.value && repeatMode.value === 'one') {
        const { pluginId, sourceContext } = currentTrack.value!
        replaceCurrentTrack(pluginId, sourceContext)
      } else {
        playNext(isPersonalFM.value)
      }
    }

    function _handleTimeUpdate() {
      if (window.env?.isLinux) {
        window.mainApi?.send('updatePlayerState', { progress: engineStore.getCurrentTime() })
      }
    }

    function playDiscordPresence(track: Track | undefined, seekTime = 0) {
      if (!enableDRP.value || !track) return
      const copyTrack = { ...track }
      copyTrack.duration -= seekTime * 1000
      window.mainApi?.send('playDiscordPresence', cloneDeep(copyTrack))
    }

    function pauseDiscordPresence(track: Track | undefined) {
      if (!enableDRP.value || !track) return
      window.mainApi?.send('pauseDiscordPresence', cloneDeep(track))
    }

    // ── Last.fm 记录 ──────────────────────────
    const enableFM = computed(() => settingsStore.misc.lastfm.enable)

    function scrobbleFM(track: Track, time: number, completed = false) {
      if (!enableFM.value) return
      const trackDuration = ~~(track.duration / 1000)
      time = completed ? trackDuration : ~~time
      if (time >= trackDuration / 2 || time >= 240) {
        const timestamp = ~~(Date.now() / 1000) - time
        const info = {
          artist: track.artists[0]?.name || '未知歌手',
          track: track.name,
          timestamp,
          album: track.album?.name || '未知专辑',
          tracnNumber: track.no || 1,
          duration: trackDuration
        }
        window.mainApi?.send('track-scrobble', info)
      }
    }

    function updateNowPlaying(track: Track | undefined) {
      if (!enableFM.value || !track) return
      const info = {
        artist: track.artists[0]?.name || '未知歌手',
        track: track.name,
        album: track.album?.name || '未知专辑',
        duration: ~~(track.duration / 1000)
      }
      window.mainApi?.send('update-now-playing', info)
    }

    // const _playNextTrack = playbackStore.playNextTrack
    function switchRepeatMode() {
      if (repeatMode.value === 'on') {
        repeatMode.value = 'one'
      } else if (repeatMode.value === 'one') {
        repeatMode.value = 'off'
      } else {
        repeatMode.value = 'on'
      }
    }

    function addTrackToPlayNext(
      trackInfos: [PluginId, Record<string, any>][],
      playNow = false,
      addToHead = false
    ) {
      if (addToHead) {
        trackInfos.forEach((item) => {
          playNextList.value.unshift(item)
        })
      } else {
        playNextList.value.push(...trackInfos)
      }
      if (playNow) playNext(false)
    }

    function clearPlayNextList() {
      playNextList.value = []
    }

    // const updateLocalID2OnlineID = playbackStore.updateLocalID2OnlineID
    // const playPersonalFM = playbackStore.playPersonalFM
    const moveToFMTrash = () => {}

    const resetPlayer = (resetAll = true) => {
      playList.value = []
      shuffleList.value = []
      playNextList.value = []
      enabled.value = false
      currentTrackIndex.value = 0
      currentTrack.value = undefined
      progress.value = 0
      isPersonalFM.value = false
      lyrics.value = []

      if (resetAll) {
        _volume.value = 0.5
        _volumeBeforeMuted.value = 0
        isShuffle.value = false
        repeatMode.value = 'off'
      }
    }

    // —— useAudioEngineStore 的方法 ——
    const setConvolver = engineStore.setConvolver
    const setDevice = engineStore.setDevice
    const setBalance = engineStore.setBalance
    const { showToast } = stateStore

    // ─────────────────────────────────────────────
    // 原 store 中 shouldGetLrcIndex 的等价暴露
    // 原来部分组件可能通过 playerStore.noLyric 等判断展示逻辑，
    // shouldGetLrcIndex 是内部计算属性，外部一般不直接用；
    // 如有需要可取 lyricStore 直接访问。
    // ─────────────────────────────────────────────

    const updateMediaSessionMetaData = async (track: Track) => {
      if ('mediaSession' in navigator === false) return

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
      navigator.mediaSession.metadata = new MediaMetadata(metadata)
      if (window.env?.isLinux) {
        window.mainApi?.send('metadata', metadata)
      }
    }

    watch(currentTrack, async (value) => {
      if (!value) return

      chorus.value = 0
      seek.value = playing.value ? 0 : progress.value
      // 获取当前歌曲的封面、歌词信息
      const plugin = value.pluginId
      await Promise.all([
        pluginMethodCall(plugin, 'resizePicUrl', { url: value.picUrl, size: 512 }).then(
          (result) => {
            pic.value = result.data
          }
        ),
        pluginMethodCall(plugin, 'getLyric', { ...value.sourceContext })
          .then((res) => {
            let data = res.data.filter((l) => !/^作(词|曲)\s*(:|：)\s*无$/.exec(l.lyric.text))
            const includeAM =
              data.length <= 10 &&
              data.some((l) => ['纯音乐，请欣赏', '暂无歌词'].includes(l.lyric.text))
            const reg = /^作(词|曲)\s*(:|：)\s*/
            const artists = currentTrack.value!.artists
            const author = artists[0]?.name
            data = data.filter((l) => {
              const regExpArr = l.lyric.text.match(reg)
              return !regExpArr || l.lyric.text.replace(regExpArr[0], '') !== author
            })
            lyrics.value = data.length === 1 && includeAM ? [] : data
          })
          .catch()
      ])

      // if (settingsStore.general.showChorus) {
      //   pluginMethodCall(plugin, 'songChorus', { ...value.sourceContext })
      //     .then((res: any) => {
      //       if (res.data?.length) {
      //         chorus.value = res.data[0].startTime / 1000 - (lyricOffset.value || 0)
      //       }
      //     })
      //     .catch(() => {})
      // }

      updateMediaSessionMetaData(value)
      lyricStore.updateIndex()

      // 缓存下一首歌的信息
    })

    watch(playing, (value) => {
      progress.value = engineStore.getCurrentTime()
      if (value) {
        lyricStore.updateIndex()
        playDiscordPresence(currentTrack.value!, engineStore.getCurrentTime())
      } else {
        lyricStore.clearTimer()
        pauseDiscordPresence(currentTrack.value!)
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = value ? 'playing' : 'paused'
        navigator.mediaSession.setPositionState({
          duration: duration.value,
          playbackRate: playbackRate.value,
          position: seek.value > duration.value ? 0 : seek.value
        })
      }
      window.mainApi?.send('updatePlayerState', {
        playing: value,
        progress: engineStore.getCurrentTime() || 0
      })
      if (osdLyricStore.show) {
        window.mainApi?.sendMessage({ type: 'update-osd-status', data: { playing: value } })
      }
    })

    watch(
      () => [currentIndex.value, progress.value],
      (value) => {
        if (!osdLyricStore.show) return
        window.mainApi?.sendMessage({
          type: 'update-osd-status',
          data: { line: [value[0], engineStore.getCurrentTime()] }
        })
      }
    )

    function initMediaSession() {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
          engineStore.play()
          playing.value = true
        })
        navigator.mediaSession.setActionHandler('pause', () => {
          engineStore.pause()
          playing.value = false
        })
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (!isPersonalFM.value) playPrev()
          else moveToFMTrash()
        })
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext(isPersonalFM.value))
        navigator.mediaSession.setActionHandler('stop', () => {
          engineStore.pause()
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

    function handleEventBus() {
      eventBus.on('loadCurrentTrack', (params) => {
        if (!currentTrack.value) return
        showToast('正在重新获取播放链接')

        const [autoPlay, currentTime] = params as [boolean, number]
        const { pluginId, sourceContext } = currentTrack.value
        replaceCurrentTrack(pluginId, sourceContext, false).then(() => {
          seek.value = currentTime
          engineStore.setPosition(currentTime)
          if (autoPlay) engineStore.play()
        })
      })
      eventBus.on('playNext', () => {
        showToast(`播放错误，正在切歌: ${currentTrack.value?.reason}`)
        playNext(isPersonalFM.value)
      })
    }

    function handleIpcRenderer() {
      window.addEventListener('message', (event) => {
        if (event.data.type === 'init-from-osd') {
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: {
              line: [currentIndex.value, engineStore.getCurrentTime()],
              playing: playing.value,
              seek: engineStore.getCurrentTime(),
              title: `${currentTrack.value?.artists[0]?.name} - ${currentTrack.value?.name}`
            }
          })
        } else if (event.data.type === 'get-seek') {
          window.mainApi?.sendMessage({
            type: 'update-osd-status',
            data: { seek: engineStore.getCurrentTime() || 0 }
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
        const t = progress.value
        const { pluginId, sourceContext } = currentTrack.value
        await replaceCurrentTrack(pluginId, sourceContext, false)
        seek.value = t
      })

      window.mainApi?.on('play', playOrPause)

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

    function setupVutronMusic() {
      if (typeof window === 'undefined') return
      window.vutronmusic = {
        get progress() {
          return engineStore.getCurrentTime()
        },
        get playing() {
          return playing.value
        },
        get volume() {
          return _volume.value
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

    onMounted(() => {
      engineStore.setup({ onTimeUpdate: _handleTimeUpdate, onEnded: _nextTrackCallback })
      lyricStore.setTimeGetter(engineStore.getCurrentTime)
      lyricStore.setPlayingGetter(() => playing.value)
      lyricStore.setRateGetter(() => playbackRate.value)
      lyricStore.setTrackGetter(() => currentTrack.value)

      setupVutronMusic()
      handleEventBus()
      initMediaSession()
      handleIpcRenderer()

      if (enabled.value && currentTrack.value) {
        const { pluginId, sourceContext } = currentTrack.value
        replaceCurrentTrack(pluginId, sourceContext, false)
      }
    })

    return {
      // ── 来自 playback ──
      playing,
      enabled,
      progress,
      seek,
      pic,
      chorus,
      playbackRate,
      repeatMode,
      title,
      isShuffle,
      volume,
      volumeBeforeMuted,
      isPersonalFM,
      currentTrack,
      currentTrackIndex,
      duration,
      isLiked,
      source,
      playlistSource,
      shuffleList,
      playNextList,
      list,
      personalFMTrack,
      hasListSource,
      getListSourcePath,

      replacePlaylist,
      replaceCurrentTrack,
      playOrPause,
      playPrev,
      playNext,
      switchRepeatMode,
      addTrackToPlayNext,
      clearPlayNextList,
      // playPersonalFM,
      moveToFMTrash,
      resetPlayer,

      // ── 来自 lyric ──
      lyrics,
      currentIndex,
      currentLyric,
      noLyric,
      lyricOffset,

      // ── 来自 engine ──
      biquadParams: engineStore.biquadParams,
      biquadUser: engineStore.biquadUser,
      convolverParams: engineStore.convolverParams,
      pitch,
      outputDevice,
      // balance, // 新增，原 store 没有
      fadeDuration,
      setConvolver,
      setDevice,
      setBalance // 新增
    }
  },
  {
    persist: {
      omit: ['pic', 'title']
    }
  }
)
