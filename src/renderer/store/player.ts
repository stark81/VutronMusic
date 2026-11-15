import { defineStore } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useAudioEngineStore } from './audioEngine'
import { useLyricStore } from './lyric'
import { usePluginMusic } from './pluginMusic'
import { useNormalStateStore } from './state'
import { useSettingsStore } from './settings'
import eventBus from '../utils/eventBus'
import { preloadImage } from '../utils/preloadImage'

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
    /**
     * nextTrack 对应的「插件的 sourceContext 指纹」。
     *
     * 不能拿 nextTrack.sourceContext 反推：插件 getTrackDetail 返回的 sourceContext
     * 未必和播放列表里的完全一致（字段增减、类型差异都会让 JSON 比较失败），
     * 一失败就会重新走 getTrackDetail + 实时拉歌词/封面，表现为切歌卡 1~2 秒。
     * 这里比较的是我们自己当初传进去的那份上下文，一定对得上。
     */
    let nextTrackKey: string | null = null
    const clearNextTrack = () => {
      nextTrack.value = undefined
      nextTrackKey = null
    }

    /**
     * 预取状态。
     *
     * 刻意声明在这里而不是真正的预取实现旁边：`replaceCurrentTrack` 与下面两个
     * 「播放列表变化」watch 都会用到它们，而 `let` 有 TDZ —— 声明晚于首次使用
     * 就可能在 setup 阶段被意外调用时抛 ReferenceError。
     */
    let prefetchTimer: ReturnType<typeof setTimeout> | null = null
    /**
     * 预取代际。切换歌曲 / 更换播放列表后，之前在飞行中的预取结果必须作废：
     * 否则它会覆盖新的 nextTrack，并对已经不再播放的歌曲发起预热请求
     * （歌词候选遍历、trackMatch 都会占用插件 HTTP 连接，挤掉真正的播放请求）。
     */
    let prefetchGen = 0

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
        clearNextTrack()
        if (prefetchTimer) clearTimeout(prefetchTimer)
        scheduleNextTrackPrefetch()
      }
    })

    // 监听播放列表/播放队列变化，自动清除缓存并触发预加载
    watch(
      [playNextList, () => (isShuffle.value ? shuffleList.value : playList.value)],
      () => {
        clearNextTrack()
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
      clearNextTrack()

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

    /**
     * 切换当前歌曲（不改动播放列表）。
     *
     * 返回 `false` 表示拿不到歌曲详情、`currentTrack` 没有变化，调用方需要把
     * 「正在播放」的状态改回去。刻意不抛错：9 处调用方里多数是 fire-and-forget，
     * 抛错会变成未处理的 promise rejection。
     */
    async function replaceCurrentTrack(
      plugin: PluginId,
      sourceContext: Record<string, any>,
      autoPlay = true,
      reportEnd = true
    ): Promise<boolean> {
      // 切歌后旧的预取结果一律作废，避免它回来覆盖 nextTrack / 触发无谓的预热请求
      prefetchGen++

      if (autoPlay && reportEnd && currentTrack.value?.name && !_pendingEndReport) {
        reportPlayback('end')
      }
      _pendingEndReport = false

      if (nextTrack.value && nextTrackKey === contextCacheKey(plugin, sourceContext)) {
        currentTrack.value = nextTrack.value
        clearNextTrack()
      } else {
        clearNextTrack()
        const res = await pluginMethodCall(plugin, 'getTrackDetail', { tracks: [sourceContext] })
        const detail = res?.data?.[0]

        // 详情拿不到（插件超时 / 被插件判为不可用）时不要用空数据覆盖 currentTrack，
        // 更不要让 undefined 解构冒泡成未捕获异常。
        // 注意：prefetchGen 上面已经自增，这里必须补一次调度，否则下一首预取会
        // 一直停摆到下一次成功切歌；同时把「正在播放」改回 false，避免 UI 显示
        // 播放中但实际没有声音。是否自动跳下一首交给调用方决定（默认不跳）。
        if (!detail) {
          showToast(`获取歌曲信息失败: ${plugin}`)
          playing.value = false
          engineStore.pause().catch(() => {})
          scheduleNextTrackPrefetch()
          return false
        }

        currentTrack.value = {
          ...detail,
          album: { ...(detail.album ?? {}), pluginId: plugin },
          artists: (detail.artists ?? []).map((it) => ({ ...it, pluginId: plugin })),
          albumArtists: (detail.albumArtists ?? []).map((it) => ({ ...it, pluginId: plugin })),
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
      return true
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
      nextTrackKey = contextCacheKey(track.pluginId, track.sourceContext)
      const ok = await replaceCurrentTrack(track.pluginId, track.sourceContext, autoPlay)
      playing.value = autoPlay && ok
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
      nextTrackKey = contextCacheKey(track.pluginId, track.sourceContext)
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
      if (window.env?.isWindows) {
        navigator.mediaSession.setPositionState({
          duration: duration.value,
          playbackRate: playbackRate.value,
          position: engineStore.getCurrentTime()
        })
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
      clearNextTrack()
      if (playNow) playNext(false)
    }

    function clearPlayNextList() {
      playNextList.value = []
      clearNextTrack()
    }

    const resetPlayer = (resetAll = true) => {
      playList.value = []
      shuffleList.value = []
      playNextList.value = []
      fmTracks.value = []
      enabled.value = false
      currentTrackIndex.value = 0
      currentTrack.value = undefined
      clearNextTrack()
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

    /**
     * 加载指定歌曲的歌词并做过滤处理。
     * 返回 undefined 表示请求失败（调用方会重试一次），[] 表示确实没有歌词（不重试）。
     * 注意：内部不能依赖 currentTrack / duration，预取下一首时传入的是下一首的 track。
     */
    const buildLyric = async (track: Track): Promise<LyricLine[] | undefined> => {
      try {
        const res = (await window.mainApi?.invoke('plugin-lyric', {
          pluginId: track.pluginId,
          sourceContext: {
            rawCtx: JSON.parse(JSON.stringify(track.sourceContext || {}))
          }
        })) as { code: number; data: LyricLine[] } | undefined

        // 主进程用非 200 表达「候选插件全部失败」，必须和「确实没有歌词」
        // （200 + 空 data）区分开，否则一次超时会被缓存成「这首歌没有歌词」。
        if (!res) return undefined
        if (res.code !== 200) return undefined
        if (!res.data?.length) return []

        const trackDuration = ~~((track.duration || 1000) / 1000)
        const rawData = res.data
          .filter((l) => !/^作(词|曲)\s*(:|：)\s*无$/.exec(l.lyric.text))
          .map((line) => {
            if (line.end === 0 && line.start > line.end) {
              line.end = Math.min(trackDuration, line.start + 10)
            }
            return line
          })
        const includeAM =
          rawData.length <= 10 &&
          rawData.some((l) => ['纯音乐，请欣赏', '暂无歌词'].includes(l.lyric.text))
        const reg = /^作(词|曲)\s*(:|：)\s*/
        // 与 replaceCurrentTrack / prefetch 里的 artists 处理保持一致：
        // artists 缺失时不能让整个歌词流程抛错（否则每次切歌都会白发一次请求）。
        const author = track.artists?.[0]?.name
        const data = rawData.filter((l) => {
          const regExpArr = l.lyric.text.match(reg)
          return !regExpArr || l.lyric.text.replace(regExpArr[0], '') !== author
        })
        return data.length === 1 && includeAM ? [] : data
      } catch {
        return undefined
      }
    }

    /** 应用歌词到播放器状态（lyrics 的 setter 会继续做空文本过滤与空格压缩） */
    const applyLyric = (data: LyricLine[]) => {
      isEnd.value = false
      lyricStore.isEnd = false
      lyrics.value = data
    }

    // ─────────────────────────────────────────────
    // 预取：详情 + 歌词 + 封面
    //
    // 缓存以「哪一首歌」为 key，而不是「下一首」这个槽位。
    // 只缓存一个 nextTrack 槽位时，只要下面任何一条成立，预取就等于没做：
    //   · 预取预测的下一首和真正播的不是同一首（顺序变化、插入下一首播放）
    //   · 预取还没跑完用户就切走了
    //   · 预取因为一次 IPC 抖动被丢弃
    // 换成按歌曲索引之后，切歌那一刻只要这首歌曾经被预取过，
    // 歌词与封面就能同步上屏，不再等任何网络请求。
    // ─────────────────────────────────────────────

    /** trackMatch 的返回（null = 跑过但没有可用结果，避免重复请求） */
    type TrackMatchResult = { picUrl?: string } | null

    type TrackPrefetch = {
      /** 封面最终展示地址（resizePicUrl 的结果，须与 <img :src> 完全一致才能命中浏览器缓存） */
      coverUrl?: string
      /** resizePicUrl 所依据的 picUrl：跨插件匹配改写 picUrl 后需要重算 */
      picUrl?: string
      /** 封面是否已下载 + 解码完成 */
      coverReady?: boolean
      /** 歌词；undefined 表示还没有结果（预取中或预取失败） */
      lyrics?: LyricLine[]
      lyricPromise?: Promise<LyricLine[] | undefined>
      coverPromise?: Promise<string | undefined>
      /**
       * 跨插件匹配结果。同一首歌只跑一次 matchTrack，且结果要能应用到**每一个**
       * 调用方的 track 对象上：预取用的对象和真正播放的对象可能不是同一个实例。
       */
      matchResult?: TrackMatchResult
      matchPromise?: Promise<TrackMatchResult>
    }

    const PREFETCH_LIMIT = 8
    const prefetchCache = new Map<string, TrackPrefetch>()

    /** 播放列表里的「哪一首」：插件 + 上下文指纹 */
    const contextCacheKey = (pluginId: string, sourceContext?: Record<string, any>) =>
      `${pluginId}::ctx:${JSON.stringify(sourceContext ?? {})}`

    /**
     * 歌曲缓存 key。
     * id 为空时（kugou 等插件的 track.id 可能是空串）退化为 sourceContext 指纹，
     * 否则不同歌曲会命中同一份数据。
     */
    const getTrackCacheKey = (track: Track) => {
      const id = String(track.id ?? '')
      if (id) return `${track.pluginId}::${id}`
      return contextCacheKey(track.pluginId, track.sourceContext)
    }

    /** 取（或创建）缓存条目；命中时移到尾部，让淘汰顺序是 LRU 而不是 FIFO */
    const getPrefetchEntry = (track: Track) => {
      const key = getTrackCacheKey(track)
      const existing = prefetchCache.get(key)
      if (existing) {
        // 命中也要刷新顺序：正在循环重播的歌不该被下一个预取挤掉
        prefetchCache.delete(key)
        prefetchCache.set(key, existing)
        return existing
      }

      const entry: TrackPrefetch = {}
      prefetchCache.set(key, entry)
      while (prefetchCache.size > PREFETCH_LIMIT) {
        const oldest = prefetchCache.keys().next().value
        if (oldest === undefined || oldest === key) break
        prefetchCache.delete(oldest)
      }
      return entry
    }

    /** 封面地址：缓存优先；并发调用复用同一次 IPC */
    const ensureCover = (track: Track, entry: TrackPrefetch): Promise<string | undefined> => {
      if (entry.coverUrl) return Promise.resolve(entry.coverUrl)
      if (entry.coverPromise) return entry.coverPromise
      if (!track.picUrl) return Promise.resolve(undefined)

      const picUrlAtIssue = track.picUrl
      const task = pluginMethodCall(track.pluginId, 'resizePicUrl', {
        url: picUrlAtIssue,
        size: 512
      })
        .then((res) => {
          // 期间 picUrl 被跨插件匹配改写：丢弃这次结果，按新地址重算
          if (track.picUrl !== picUrlAtIssue) return undefined
          const url = res?.data
          if (url) {
            entry.coverUrl = url
            entry.picUrl = picUrlAtIssue
          }
          return url
        })
        .catch(() => undefined)

      entry.coverPromise = task
      task.then(() => {
        if (entry.coverPromise === task) entry.coverPromise = undefined
      })
      return task
    }

    /** 封面预热：把图下载 + 解码进浏览器缓存，切歌时 <img> 换 src 即可直接出图 */
    const warmCover = (task: Promise<string | undefined>, entry: TrackPrefetch) =>
      task.then((url) => {
        if (!url) return
        preloadImage(url).then((ready) => {
          if (entry.coverUrl === url) entry.coverReady = ready
        })
      })

    /** 歌词：预取与切歌共用同一个 Promise，同一首歌不会发两次请求 */
    const ensureLyrics = (track: Track, entry: TrackPrefetch) => {
      if (entry.lyrics) return Promise.resolve(entry.lyrics)
      if (entry.lyricPromise) return entry.lyricPromise

      const task = buildLyric(track).then((data) => {
        // 失败时保留 undefined，切歌时会再试一次
        if (data) entry.lyrics = data
        if (entry.lyricPromise === task) entry.lyricPromise = undefined
        return data
      })
      entry.lyricPromise = task
      return task
    }

    /**
     * 跨插件匹配改写了 picUrl 后，按新地址重算封面并预热封面。
     * 返回可上屏的封面地址；picUrl 没变则直接返回已缓存的地址。
     */
    const refreshCoverAfterMatch = async (track: Track, entry: TrackPrefetch) => {
      // 最多两轮：第一轮可能命中「按旧地址发出、正在飞行」的请求
      for (let attempt = 0; attempt < 2; attempt++) {
        if (entry.picUrl === track.picUrl) return entry.coverUrl
        entry.coverUrl = undefined
        entry.coverReady = false
        const url = await ensureCover(track, entry)
        if (url && entry.picUrl === track.picUrl) return url
      }
      return undefined
    }

    /**
     * 预热一首歌：歌词、封面、跨插件封面匹配三者互不依赖，全部并行发起。
     * 之前封面预热挂在 trackMatch 之后，只要某个 library 插件的 matchTrack
     * 卡住（它有 12s 的 worker 超时），封面就永远等不到预热。
     */
    function warmUpTrack(track: Track) {
      const entry = getPrefetchEntry(track)

      ensureLyrics(track, entry).catch(() => {})
      warmCover(ensureCover(track, entry), entry).catch(() => {})

      // 跨插件匹配可能换掉 picUrl：命中后重算地址并补热新图
      const picUrlBefore = track.picUrl
      triggerTrackMatch(track)
        .then(() => {
          if (track.picUrl === picUrlBefore) return
          warmCover(refreshCoverAfterMatch(track, entry), entry).catch(() => {})
        })
        .catch(() => {})
    }

    const toggleMute = () => {
      if (volume.value === 0) {
        volume.value = volumeBeforeMuted.value || 1
      } else {
        volumeBeforeMuted.value = volume.value
        volume.value = 0
      }
    }

    /**
     * 切歌序号。旧歌曲的异步结果（歌词、封面、匹配）回来时不能覆盖新歌曲，
     * 否则连续切歌会出现「歌词/封面还是上一首」的错乱。
     */
    let switchSeq = 0

    watch(currentTrack, async (value) => {
      if (!value) return
      const seq = ++switchSeq

      chorus.value = 0
      const nextPos = playing.value ? 0 : progress.value
      engineStore.setPosition(nextPos)
      progress.value = nextPos
      lyricStore.updateIndex()

      const entry = getPrefetchEntry(value)

      /**
       * 切歌耗时探针：`localStorage.setItem('debug:prefetch', '1')` 后重载窗口，
       * 每次切歌会打印预取命中情况与封面/歌词实际上屏的时刻。
       * 排查「切歌卡 1~2 秒」时先看 cover/lyric 是 miss（预取没命中）
       * 还是 hit 但上屏仍慢（那就不在预取，而在渲染或图片解码）。
       */
      const t0 = localStorage.getItem('debug:prefetch') === '1' ? performance.now() : 0
      const logSwitch = (what: string) => {
        if (!t0) return
        console.debug(
          `[prefetch] ${value.name} · ${what} +${(performance.now() - t0).toFixed(0)}ms ` +
            `(cover ${entry.coverUrl ? 'hit' : 'miss'}, lyric ${entry.lyrics ? 'hit' : 'miss'})`
        )
      }

      // ① 预取命中的部分同步上屏：
      //    这里是「切歌后封面/歌词还要等 1~2 秒」的关键——封面地址和歌词
      //    都不该再等任何 IPC / 网络请求。
      if (entry.coverUrl) {
        pic.value = entry.coverUrl
        if (!entry.coverReady) {
          preloadImage(entry.coverUrl).then((ready) => {
            entry.coverReady = ready
          })
        }
      } else {
        const coverTask = ensureCover(value, entry)
        warmCover(coverTask, entry).catch(() => {})
        coverTask
          .then((url) => {
            if (seq !== switchSeq) return
            // 新歌没有封面 / resizePicUrl 失败时必须清掉旧封面，否则会一直显示
            // 上一首的图（`pic` 还派生背景主题色）。旧实现是无条件赋值。
            pic.value = url ?? ''
            logSwitch('cover')
          })
          .catch(() => {})
      }

      // ② 歌词：命中预取就同步应用；否则复用飞行中的请求，没有就现取
      if (entry.lyrics) {
        applyLyric(entry.lyrics)
      } else {
        ensureLyrics(value, entry)
          // 请求失败（undefined）时重试一次，仍失败才当作无歌词
          .then((data) => data || ensureLyrics(value, entry))
          .then((data) => {
            if (seq !== switchSeq) return
            applyLyric(data ?? [])
            logSwitch('lyric')
          })
          .catch(() => {})
      }

      logSwitch('sync')

      // ③ 非 library 来源的跨插件匹配：并行跑，不再阻塞上屏。
      //    等它结束才显示封面的话，一次 matchTrack 网络搜索就是 1~2 秒空白。
      if (value.type !== 'library') {
        triggerTrackMatch(value)
          .then(() => {
            if (seq !== switchSeq) return
            const coverTask = refreshCoverAfterMatch(value, entry)
            coverTask
              .then((url) => {
                if (url && seq === switchSeq) pic.value = url
              })
              .catch(() => {})
          })
          .catch(() => {})
      }

      // ④ 从数据库加载该歌曲的歌词偏移量
      try {
        const dbOffset = await window.mainApi?.invoke('get-lyric-offset', {
          pluginId: value.pluginId,
          trackId: String(value.id)
        })
        if (seq !== switchSeq) return
        lyricStore.offset = typeof dbOffset === 'number' ? dbOffset : 0
      } catch {
        if (seq !== switchSeq) return
        lyricStore.offset = 0
      }

      // if (settingsStore.general.showChorus) {
      //   pluginMethodCall(value.pluginId, 'songChorus', { ...value.sourceContext })
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
        replaceCurrentTrack(pluginId, sourceContext, false).then((ok) => {
          // 详情没拿到时不要再 play() 一次坏音源：那会立刻触发 onerror →
          // loadCurrentTrack 二次重试，退化成「播放错误，正在切歌」。
          if (!ok) {
            playing.value = false
            return
          }
          seek.value = currentTime
          engineStore.setPosition(currentTime)
          if (autoPlay) {
            playing.value = true
            engineStore.play()
          }
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

    /**
     * 把跨插件匹配结果写回传入的 track 与当前列表里的同名条目。
     * 一定要按「调用方传入的对象」应用，不能只在发起请求的那一次写自己：
     * 预取与真正播放可能持有同一首歌的两个 Track 实例。
     */
    function applyTrackMatch(track: Track, result: TrackMatchResult) {
      if (!result?.picUrl) return
      track.picUrl = result.picUrl
      const song = pluginStore.tracks[track.pluginId]?.data?.find(
        (t) => String(t.id) === String(track.id)
      )
      if (song) song.picUrl = result.picUrl
    }

    async function runTrackMatch(track: Track): Promise<TrackMatchResult> {
      const meta = {
        trackId: String(track.id),
        name: track.name,
        album: track.album?.name,
        artists: (track.artists ?? []).map((a) => a.name),
        duration: track.duration,
        sourcePlugin: track.pluginId,
        sourceType: track.type,
        sourceContext: { ...track.sourceContext },
        currentPlayingPath: currentTrack.value?.filePath ?? null
      }

      // library 来源不需要跨插件匹配，自己的封面就是最终封面
      return (await (window.mainApi?.invoke('trackMatch', meta) ?? Promise.resolve())) ?? null
    }

    /**
     * 跨插件匹配：同一首歌只会真正请求一次。
     *
     * 结果缓存在 prefetchCache 的条目里（受 PREFETCH_LIMIT 约束），因此
     *   · 预取时已经匹配过的歌，真正播放时不会再搜一次；
     *   · 后到的调用方拿到的是同一个结果，并被写回**自己的** track 对象。
     */
    async function triggerTrackMatch(
      track: Track | undefined
    ): Promise<TrackMatchResult | undefined> {
      if (!track) return undefined
      if (track.type === 'library') return undefined

      const entry = getPrefetchEntry(track)

      if (entry.matchResult !== undefined) {
        applyTrackMatch(track, entry.matchResult)
        return entry.matchResult
      }

      if (!entry.matchPromise) {
        // 失败不向外抛：匹配只决定「封面好不好看」，失败就保持原封面、下次再试。
        // 成功结果写进 matchResult（null = 跑过但没有结果）避免重复搜索。
        entry.matchPromise = runTrackMatch(track)
          .then((result) => {
            entry.matchResult = result
            return result
          })
          .catch(() => null)
          .finally(() => {
            entry.matchPromise = undefined
          })
      }

      const result = await entry.matchPromise
      applyTrackMatch(track, result)
      return result
    }

    /**
     * 切歌后多久开始预取下一首。
     *
     * 这里曾经是 20s —— 而播放列表里 20s 内被切掉的歌曲非常多，
     * 于是预取要么没开始，要么做完时已经切走了，等于没做。
     * 现在只留一点余量让当前歌曲自身的请求（播放链接 / 歌词 / 封面）先发出去，
     * 剩下的交给插件连接池（16 条）去消化。
     */
    const PREFETCH_DELAY = 2500

    function scheduleNextTrackPrefetch() {
      if (prefetchTimer) clearTimeout(prefetchTimer)
      const gen = ++prefetchGen

      prefetchTimer = setTimeout(() => {
        prefetchTimer = null
        if (gen !== prefetchGen) return
        prefetchNextTrack(gen).catch(() => {})
      }, PREFETCH_DELAY)
    }

    async function prefetchNextTrack(gen: number) {
      if (isPersonalFM.value) {
        // FM 模式：队列中已是完整 Track，直接缓存 + 预取歌词/预热封面
        const next = fmTracks.value[0]
        if (!next) return
        nextTrack.value = next
        nextTrackKey = contextCacheKey(next.pluginId, next.sourceContext)
        warmUpTrack(next)
        return
      }

      const nextInfo = _peekNextTrack()
      if (!nextInfo) return

      const [nextPlugin, nextSourceContext] = nextInfo

      // 获取下一首的详细信息
      const res = await pluginMethodCall(nextPlugin as PluginId, 'getTrackDetail', {
        tracks: [nextSourceContext]
      }).catch(() => undefined)

      // 预取期间可能已经切歌 / 换了播放列表，丢弃过期结果
      if (gen !== prefetchGen) return
      const track = res?.data?.[0] as Track | undefined
      if (!track) return

      // 保存 nextTrack 缓存，供 replaceCurrentTrack 复用
      const nextTrackInfo: Track = {
        ...track,
        album: { ...(track.album ?? {}), pluginId: nextPlugin },
        artists: (track.artists ?? []).map((it) => ({ ...it, pluginId: nextPlugin })),
        albumArtists: (track.albumArtists ?? []).map((it) => ({
          ...it,
          pluginId: nextPlugin
        })),
        pluginId: nextPlugin
      }
      nextTrack.value = nextTrackInfo
      nextTrackKey = contextCacheKey(nextPlugin, nextSourceContext)

      // 歌词 + 封面 + 跨插件匹配并行预热
      warmUpTrack(nextTrackInfo)
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
        const recoverFromFailedRestore = () => {
          playing.value = false
          reportPlayback('start')
        }
        replaceCurrentTrack(pluginId, sourceContext, false)
          .then((ok) => {
            // 启动恢复失败时也要把 playing 改回 false（旧实现靠 promise reject
            // 走 catch，现在失败是 resolve(false)）
            if (!ok) recoverFromFailedRestore()
          })
          .catch(recoverFromFailedRestore)
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
      toggleMute,

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
