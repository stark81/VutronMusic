import { defineStore } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useAudioEngineStore } from './audioEngine'
import { useLyricStore } from './lyric'
import { usePluginMusic } from './pluginMusic'
import { useOsdLyricStore } from './osdLyric'
import { useNormalStateStore } from './state'
import { useSettingsStore } from './settings'
import eventBus from '../utils/eventBus'

import shuffleFn from 'lodash/shuffle'
import cloneDeep from 'lodash/cloneDeep'

import { LyricLine, PluginId, Track } from '@/types/plugin'
import { RepeatMode, PlaylistSourceInfo } from '@/types/music'

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
    const { pluginMethodCall } = pluginStore

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
    const lastProgressReport = ref(0)
    let _pendingEndReport = false
    const title = ref('VutronMusic')
    const isEnd = ref(false)
    const setSeek = ref(false)

    // 歌曲信息
    const isPersonalFM = ref(false)
    const playingNext = ref(false)
    const currentTrackIndex = ref(0)
    const currentTrack = ref<Track>()
    const nextTrack = ref<Track>()
    const chorus = ref(0)
    const pic = ref('http://localhost:41830/local-asset/default-cover')

    // FM 私有电台
    const fmTracks = ref<Track[]>([])
    const personalFMTrack = computed(() => (isPersonalFM.value ? currentTrack.value : undefined))

    // 当前激活的 library 类型插件 code，用于监听切换后刷新 FM 队列
    const activeLibraryCode = computed(() => {
      const lib = pluginStore.services.find((s) => s.active && s.type === 'library')
      return lib?.code ?? null
    })

    watch(activeLibraryCode, (newCode, oldCode) => {
      if (newCode && newCode !== oldCode) {
        fmTracks.value = []
        refillFMTracks()
      }
    })

    // 播放列表相关
    const isShuffle = ref(false)
    const repeatMode = ref<RepeatMode>('off')
    const playList = ref<[PluginId, Record<string, any>][]>([])
    const shuffleList = ref<[PluginId, Record<string, any>][]>([])
    const playNextList = ref<[PluginId, Record<string, any>][]>([])

    const volume = ref(0.5)
    const volumeBeforeMuted = ref(0)
    watch(volume, (v) => {
      engineStore.applyVolume(v)
    })
    const playlistSource = ref<PlaylistSourceInfo>({
      type: 'Playlist',
      plugin: '' as PluginId,
      sourceContext: {},
      pluginSourceContexts: {}
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
          if (
            plugin === 'all' ||
            sourceContext.id === 0 ||
            sourceContext.id === '0' ||
            ['local', 'library', 'stream'].includes(sourceContext.id)
          ) {
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
      set: (value) => {
        if (isShuffle.value) {
          shuffleList.value = value
        } else {
          playList.value = value
        }
      }
    })

    /**
     * seek 是可写 computed，set 会同步到 audio.currentTime 并触发歌词索引更新。
     * 这里转发整个 computed，保留 getter + setter 语义。
     */
    const seek = computed({
      get: () => engineStore.progress,
      set: (value) => {
        engineStore.setPosition(value)
        setSeek.value = true
        lyricStore.updateIndex()
        progress.value = value
        reportPlayback('progress')
        lastProgressReport.value = Date.now()
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
        lyricStore.lyrics = value
          .filter((item) => !!item.lyric.text)
          .map((item) => ({
            ...item,
            lyric: { ...item.lyric, text: item.lyric.text.replace(/\s{2,}/g, ' ') }
          }))
      }
    })
    const currentIndex = computed(() => lyricStore.currentIndex)
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
    const fadeDuration = computed(() => engineStore.fadeDuration)

    // ─────────────────────────────────────────────
    // watch
    // ─────────────────────────────────────────────
    watch(
      playbackRate,
      (value) => {
        engineStore.setPlaybackRate(value)
        lyricStore.updateRate(value)
      },
      { immediate: true }
    )

    watch(isShuffle, (value) => {
      if (value && playList.value.length > 0) {
        shuffleTheList(currentTrackIndex.value)
        currentTrackIndex.value = 0
        nextTrack.value = undefined
        if (prefetchTimer) clearTimeout(prefetchTimer)
        scheduleNextTrackPrefetch()
      }
    })

    // 监听播放列表/播放队列变化，自动清除缓存并触发预加载
    watch(
      [playNextList, () => (isShuffle.value ? shuffleList.value : playList.value)],
      () => {
        nextTrack.value = undefined
        if (prefetchTimer) clearTimeout(prefetchTimer)
        scheduleNextTrackPrefetch()
      },
      { deep: true }
    )

    watch(
      () => playing.value && settingsStore.general.preventSuspension,
      (value) => {
        window.mainApi?.send('update-powersave', value)
      }
    )

    // library 被禁用时清空 FM 缓存并退出 FM 模式
    watch(
      () => pluginStore.enableLibrary,
      (enable) => {
        if (!enable) {
          isPersonalFM.value = false
        }
      }
    )

    watch(enableDRP, (value) => {
      if (value && playing.value) {
        playDiscordPresence(currentTrack.value!, engineStore.getCurrentTime())
      } else {
        pauseDiscordPresence(currentTrack.value!)
      }
    })

    // ─────────────────────────────────────────────
    // 方法转发
    // 方法不需要包 computed，直接引用子 store 的函数即可。
    // ─────────────────────────────────────────────

    async function replacePlaylist(
      source: PlaylistSourceInfo,
      sourceContext: [PluginId, Record<string, any>][],
      index: number
    ) {
      await engineStore.pause()
      playlistSource.value = source
      isPersonalFM.value = false
      playList.value = sourceContext
      nextTrack.value = undefined

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
      const list = playList.value.filter((_, index) => index !== firstID)
      shuffleList.value = shuffleFn(list)
      shuffleList.value.unshift(playList.value[firstID])
    }

    function reportPlayback(type: 'start' | 'progress' | 'end') {
      const track = currentTrack.value
      if (!track) return

      const duration = ~~(track.duration / 1000)
      const position = ~~engineStore.getCurrentTime()

      const trackPluginId = track.pluginId
      const trackSourceCtx =
        playlistSource.value.pluginSourceContexts?.[trackPluginId] ??
        playlistSource.value.sourceContext

      window.mainApi?.send(
        'report-playback',
        JSON.parse(
          JSON.stringify({
            type,
            pluginId: track.pluginId,
            rawCtx: track.sourceContext,
            track: {
              name: track.name,
              artist: track.artists[0]?.name || '未知歌手',
              album: track.album?.name || '未知专辑',
              duration,
              no: track.no || 1
            },
            playing: playing.value,
            position,
            duration,
            sourceCtx: {
              ...playlistSource.value,
              plugin: trackPluginId,
              sourceContext: trackSourceCtx
            }
          })
        )
      )
    }

    async function replaceCurrentTrack(
      plugin: PluginId,
      sourceContext: Record<string, any>,
      autoPlay = true,
      reportEnd = true
    ) {
      if (autoPlay && reportEnd && currentTrack.value?.name && !_pendingEndReport) {
        reportPlayback('end')
      }
      _pendingEndReport = false

      if (
        nextTrack.value?.pluginId === plugin &&
        JSON.stringify(nextTrack.value?.sourceContext) === JSON.stringify(sourceContext)
      ) {
        currentTrack.value = nextTrack.value
        nextTrack.value = undefined
      } else {
        nextTrack.value = undefined
        const res = await pluginMethodCall(plugin, 'getTrackDetail', { tracks: [sourceContext] })

        currentTrack.value = {
          ...res.data[0],
          album: { ...res.data[0].album, pluginId: plugin },
          artists: res.data[0].artists.map((it) => ({ ...it, pluginId: plugin })),
          albumArtists: res.data[0].albumArtists.map((it) => ({ ...it, pluginId: plugin })),
          pluginId: plugin
        }
      }

      const songUrlResult: {
        url: string[]
        replayGain: number
        peak: number
        cueOffset?: number
        cueDuration?: number
      } = (await window.mainApi?.invoke('get-song-url', {
        pluginId: plugin,
        sourceContext: JSON.parse(JSON.stringify(sourceContext)),
        track: JSON.parse(JSON.stringify(currentTrack.value))
      })) ?? { url: [], replayGain: 0, peak: 1 }

      engineStore.playAudioSource(
        songUrlResult.url,
        songUrlResult.replayGain,
        songUrlResult.peak,
        autoPlay,
        songUrlResult.cueOffset || 0,
        songUrlResult.cueDuration || 0
      )
      playing.value = autoPlay

      if (autoPlay) {
        reportPlayback('start')
      }

      triggerTrackMatch(currentTrack.value)
      scheduleNextTrackPrefetch()
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
      const nextTrackInfo = list.value[next]
      if (
        nextTrackInfo &&
        currentTrack.value &&
        nextTrackInfo[0] === currentTrack.value.pluginId &&
        JSON.stringify(nextTrackInfo[1]) === JSON.stringify(currentTrack.value.sourceContext)
      ) {
        const skipNext = next + 1
        if (skipNext < list.value.length) {
          return [list.value[skipNext], skipNext, false]
        }
        if (repeatMode.value === 'on') {
          return [list.value[0], 0, false]
        }
        return [undefined, next, false]
      }
      return [nextTrackInfo, next, false]
    }

    function _peekNextTrack(): [PluginId, Record<string, any>] | undefined {
      if (playNextList.value.length > 0) {
        return playNextList.value[0]
      }
      const next = currentTrackIndex.value + 1
      if (repeatMode.value === 'on' && list.value.length === next) {
        return list.value[0]
      }
      const nextTrackInfo = list.value[next]
      if (
        nextTrackInfo &&
        currentTrack.value &&
        nextTrackInfo[0] === currentTrack.value.pluginId &&
        JSON.stringify(nextTrackInfo[1]) === JSON.stringify(currentTrack.value.sourceContext)
      ) {
        const skipNext = next + 1
        if (skipNext < list.value.length) {
          return list.value[skipNext]
        }
        if (repeatMode.value === 'on') {
          return list.value[0]
        }
        return undefined
      }
      return nextTrackInfo
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
        playing.value = true
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

    function _playNext(autoPlay = true) {
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
        replaceCurrentTrack(...trackInfo, autoPlay)
        playing.value = autoPlay
      }
    }

    async function refillFMTracks() {
      const plugin = pluginStore.services.find((s) => s.active && s.type === 'library')
      if (!plugin) return

      try {
        const result = await pluginMethodCall(plugin.code, 'personalFM', {})
        if (result.code === 200 && result.data?.length) {
          for (const track of result.data) {
            fmTracks.value.push({
              ...track,
              album: { ...track.album, pluginId: plugin.code },
              artists: track.artists.map((it) => ({ ...it, pluginId: plugin.code })),
              albumArtists: track.albumArtists.map((it) => ({ ...it, pluginId: plugin.code })),
              pluginId: plugin.code
            })
          }
        }
      } catch {}
    }

    async function playNextFM(autoPlay = true) {
      if (fmTracks.value.length === 0) {
        await refillFMTracks()
        if (fmTracks.value.length === 0) return
      }
      const track = fmTracks.value.shift()!
      nextTrack.value = track
      await replaceCurrentTrack(track.pluginId, track.sourceContext, autoPlay)
      playing.value = autoPlay
      if (fmTracks.value.length === 0) {
        refillFMTracks()
      }
    }

    async function playPersonalFM(playing: boolean) {
      const plugin = pluginStore.services.find((s) => s.active && s.type === 'library')
      if (!plugin) {
        showToast('无可用的音乐源')
        return
      }

      isPersonalFM.value = true
      if (!enabled.value) enabled.value = true

      if (fmTracks.value.length === 0) {
        await refillFMTracks()
        if (fmTracks.value.length === 0) {
          showToast('获取 FM 歌曲失败')
          isPersonalFM.value = false
          return
        }
      }

      const track = fmTracks.value.shift()!
      nextTrack.value = track // 跳过 getTrackDetail
      await replaceCurrentTrack(track.pluginId, track.sourceContext, playing)
      if (fmTracks.value.length === 0) {
        refillFMTracks()
      }
    }

    async function moveToFMTrash() {
      if (isPersonalFM.value) {
        const track = currentTrack.value
        if (track) {
          pluginMethodCall(track.pluginId, 'fmTrash', { ...track.sourceContext }).catch(() => {})
        }
        await playNextFM()
      } else {
        if (fmTracks.value.length === 0) return
        const track = fmTracks.value.shift()!
        pluginMethodCall(track.pluginId, 'fmTrash', { ...track.sourceContext }).catch(() => {})
        if (fmTracks.value.length === 0) {
          refillFMTracks()
        }
      }
    }

    async function playNext(isPersonal: boolean, autoPlay = true) {
      await engineStore.pause()
      if (isPersonal) {
        await playNextFM(autoPlay)
      } else {
        _playNext(autoPlay)
      }
    }

    function _nextTrackCallback() {
      reportPlayback('end')
      _pendingEndReport = true
      isEnd.value = true
      lyricStore.isEnd = true
      engineStore.setPosition(0)
      progress.value = 0
      lyricStore.updateIndex()
      if (!isPersonalFM.value && repeatMode.value === 'one') {
        const { pluginId, sourceContext } = currentTrack.value!
        replaceCurrentTrack(pluginId, sourceContext)
      } else {
        playNext(isPersonalFM.value)
      }
    }

    function _handleTimeUpdate() {
      if (window.env?.isLinux) {
        window.mainApi?.send('synchronize-player-info', { seek: engineStore.getCurrentTime() })
      }
      const now = Date.now()
      if (now - lastProgressReport.value >= 15000) {
        reportPlayback('progress')
        lastProgressReport.value = now
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
      nextTrack.value = undefined
      if (playNow) playNext(false)
    }

    function clearPlayNextList() {
      playNextList.value = []
      nextTrack.value = undefined
    }

    const resetPlayer = (resetAll = true) => {
      playList.value = []
      shuffleList.value = []
      playNextList.value = []
      fmTracks.value = []
      enabled.value = false
      currentTrackIndex.value = 0
      currentTrack.value = undefined
      nextTrack.value = undefined
      progress.value = 0
      isPersonalFM.value = false
      lyrics.value = []
      _pendingEndReport = false
      lastProgressReport.value = 0

      if (resetAll) {
        volume.value = 0.5
        volumeBeforeMuted.value = 0
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

    const fetchLyric = async () => {
      const res = (await window.mainApi?.invoke('plugin-lyric', {
        pluginId: currentTrack.value?.pluginId,
        sourceContext: {
          rawCtx: JSON.parse(JSON.stringify(currentTrack.value?.sourceContext || {}))
        }
      })) as { code: number; data: LyricLine[] }

      if (!res || res.code !== 200 || !res.data?.length) {
        lyrics.value = []
        return
      }

      let data = res.data
        .filter((l) => !/^作(词|曲)\s*(:|：)\s*无$/.exec(l.lyric.text))
        .map((line) => {
          if (line.end === 0 && line.start > line.end) {
            line.end = Math.min(duration.value, line.start + 10)
          }
          return line
        })
      const includeAM =
        data.length <= 10 && data.some((l) => ['纯音乐，请欣赏', '暂无歌词'].includes(l.lyric.text))
      const reg = /^作(词|曲)\s*(:|：)\s*/
      const artists = currentTrack.value!.artists
      const author = artists[0]?.name
      data = data.filter((l) => {
        const regExpArr = l.lyric.text.match(reg)
        return !regExpArr || l.lyric.text.replace(regExpArr[0], '') !== author
      })
      isEnd.value = false
      lyricStore.isEnd = false
      lyrics.value = data.length === 1 && includeAM ? [] : data
    }

    watch(currentTrack, async (value) => {
      if (!value) return

      chorus.value = 0
      const nextPos = playing.value ? 0 : progress.value
      engineStore.setPosition(nextPos)
      progress.value = nextPos
      lyricStore.updateIndex()
      const plugin = value.pluginId

      if (value.type !== 'library') {
        await triggerTrackMatch(value)
      }

      await Promise.all([
        pluginMethodCall(plugin, 'resizePicUrl', { url: value.picUrl, size: 512 }).then(
          (result) => {
            pic.value = result.data
          }
        ),
        fetchLyric()
      ])

      // 从数据库加载该歌曲的歌词偏移量
      try {
        const dbOffset = await window.mainApi?.invoke('get-lyric-offset', {
          pluginId: value.pluginId,
          trackId: String(value.id)
        })
        if (typeof dbOffset === 'number') {
          lyricStore.offset = dbOffset
        } else {
          lyricStore.offset = 0
        }
      } catch {
        lyricStore.offset = 0
      }

      // if (settingsStore.general.showChorus) {
      //   pluginMethodCall(plugin, 'songChorus', { ...value.sourceContext })
      //     .then((res: any) => {
      //       if (res.data?.length) {
      //         chorus.value = res.data[0].startTime / 1000 - (lyricOffset.value || 0)
      //       }
      //     })
      //     .catch(() => {})
      // }

      lyricStore.updateIndex()
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
    })

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
      eventBus.on('playNext', (autoPlay) => {
        showToast(`播放错误，正在切歌: ${currentTrack.value?.reason}`)
        // 无参 emit（自然播放结束）时 autoPlay 为 undefined，兜底 true 自动播放
        playNext(isPersonalFM.value, (autoPlay ?? true) as boolean)
      })
    }

    // ─────────────────────────────────────────────
    // 跨平台歌曲匹配（播放时触发 + 预匹配下一首）
    // ─────────────────────────────────────────────

    async function triggerTrackMatch(track: Track | undefined) {
      if (!track) return Promise.resolve()
      if (track.type === 'library') {
        fetch(track.picUrl).catch(() => {})
        return Promise.resolve()
      }

      const meta = {
        trackId: String(track.id),
        name: track.name,
        album: track.album?.name,
        artists: track.artists.map((a) => a.name),
        duration: track.duration,
        sourcePlugin: track.pluginId,
        sourceType: track.type,
        sourceContext: { ...track.sourceContext },
        currentPlayingPath: currentTrack.value?.filePath ?? null
      }

      const result = await (window.mainApi?.invoke('trackMatch', meta) ?? Promise.resolve())
      if (result?.picUrl) {
        track.picUrl = result.picUrl
        const song = pluginStore.tracks[track.pluginId].data.find(
          (t) => String(t.id) === String(track.id)
        )
        if (song) song.picUrl = result.picUrl
      }
      fetch(track.picUrl).catch(() => {})
      return result
    }

    let prefetchTimer: ReturnType<typeof setTimeout> | null = null

    function scheduleNextTrackPrefetch() {
      if (prefetchTimer) clearTimeout(prefetchTimer)

      prefetchTimer = setTimeout(() => {
        prefetchTimer = null

        if (isPersonalFM.value) {
          // FM 模式：队列中已是完整 Track，直接缓存 + 预热封面
          const next = fmTracks.value[0]
          if (!next) return
          nextTrack.value = next
          if (next.picUrl) {
            fetch(next.picUrl).catch(() => {})
          }
          return
        }

        const nextInfo = _peekNextTrack()
        if (!nextInfo) return

        const [nextPlugin, nextSourceContext] = nextInfo

        // 获取下一首的详细信息
        pluginMethodCall(nextPlugin as PluginId, 'getTrackDetail', {
          tracks: [nextSourceContext]
        }).then((res) => {
          if (!res.data?.[0]) return

          const track = res.data[0] as Track

          // 保存 nextTrack 缓存，供 replaceCurrentTrack 复用
          nextTrack.value = {
            ...track,
            album: { ...track.album, pluginId: nextPlugin },
            artists: track.artists.map((it) => ({ ...it, pluginId: nextPlugin })),
            albumArtists: track.albumArtists.map((it) => ({ ...it, pluginId: nextPlugin })),
            pluginId: nextPlugin
          }

          triggerTrackMatch(nextTrack.value)
        })
      }, 20000)
    }

    onMounted(() => {
      engineStore
        .setup({ onTimeUpdate: _handleTimeUpdate, onEnded: _nextTrackCallback })
        .then(() => {
          engineStore.applyVolume(volume.value)
        })
      lyricStore.setTimeGetter(engineStore.getCurrentTime)
      lyricStore.setPlayingGetter(() => playing.value)
      lyricStore.setRateGetter(() => playbackRate.value)
      lyricStore.setTrackGetter(() => currentTrack.value)

      handleEventBus()

      // FM 启动预取：library 开启且队列为空时后台获取
      if (pluginStore.enableLibrary && fmTracks.value.length === 0) {
        refillFMTracks()
      }

      if (enabled.value && currentTrack.value) {
        const { pluginId, sourceContext } = currentTrack.value
        replaceCurrentTrack(pluginId, sourceContext, false).catch(() => {
          playing.value = false
          reportPlayback('start')
        })
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
      playList,
      shuffleList,
      playNextList,
      list,
      personalFMTrack,
      fmTracks,
      hasListSource,
      getListSourcePath,
      isEnd,
      setSeek,

      replacePlaylist,
      replaceCurrentTrack,
      playOrPause,
      playPrev,
      playNext,
      switchRepeatMode,
      addTrackToPlayNext,
      clearPlayNextList,
      playPersonalFM,
      moveToFMTrash,
      resetPlayer,

      // ── 来自 lyric ──
      lyrics,
      currentIndex,
      noLyric,
      lyricOffset,

      // ── 来自 engine ──
      biquadParams: engineStore.biquadParams,
      biquadUser: engineStore.biquadUser,
      convolverParams: engineStore.convolverParams,
      pitch,
      outputDevice,
      fadeDuration,
      setConvolver,
      setDevice,
      setBalance
    }
  },
  {
    persist: {
      omit: ['pic', 'title', 'fmTracks']
    }
  }
)
