import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import shuffleFn from 'lodash/shuffle'
import cloneDeep from 'lodash/cloneDeep'
import { PluginId, Track } from '@/types/plugin'
import { RepeatMode } from '@/types/music'
import { usePluginMusic } from './pluginMusic'

export const usePlaybackStore = defineStore('playback', () => {
  const pluginStore = usePluginMusic()
  const { pluginMethodCall } = pluginStore

  // 播放列表相关
  const playList = ref<Track[]>([])
  const shuffleList = ref<Track[]>([])
  const playNextList = ref<Track[]>([])

  const list = computed({
    get: () => (isShuffle.value ? shuffleList.value : playList.value),
    set: (value) => (playList.value = value)
  })

  // 当前歌曲信息
  const currentTrackIndex = ref(0)
  const isPersonalFM = ref(false)

  const currentTrackInfo = reactive({
    track: null as Track | null,
    chorus: 0,
    pic: ''
  })

  const nextTrackInfo = reactive({
    track: null as Track | null,
    chorus: 0,
    pic: ''
  })

  const fmTrackInfo = reactive({
    track: null as Track | null,
    chorus: 0,
    pic: ''
  })

  // 其他内容
  const isShuffle = ref(false)
  const repeatMode = ref<RepeatMode>('off')
  const title = ref('VutronMusic')

  /**
   * @param tracks 歌曲列表
   * @param autoPlayTrackID 自动播放歌曲的index
   * @returns 替换播放列表后，当前歌曲的播放链接以及gain、peak信息
   */
  async function replacePlaylist(tracks: Track[], autoPlayTrackID: number) {
    isPersonalFM.value = false
    playList.value = cloneDeep(tracks)

    if (isShuffle.value) {
      shuffleTheList(autoPlayTrackID)
      currentTrackIndex.value = 0
      const track = list.value[currentTrackIndex.value]
      currentTrackInfo.track = track
      return replaceCurrentTrack(track)
    } else {
      currentTrackIndex.value = autoPlayTrackID
      const track = list.value[currentTrackIndex.value]
      currentTrackInfo.track = track
      return replaceCurrentTrack(track)
    }
  }

  async function replaceCurrentTrack(track: Track) {
    const plugin = track.pluginId as PluginId

    // 注意，这里返回的replayGain和peak
    const result = await pluginMethodCall(plugin, 'songUrl', { ...track.sourceContext })
    return result
  }
  function playPrev() {}
  function play() {}
  function pause() {}
  function playOrPause() {}
  function playNext() {}
  function switchRepeatMode() {}

  function shuffleTheList(firstID = 0) {
    const id = playList.value[firstID]
    const list = playList.value.filter((item) => item !== id)
    shuffleList.value = shuffleFn(list)
    shuffleList.value.unshift(id)
  }

  function addTrackToPlayNext(
    plugin: PluginId,
    sourceContext: Record<string, any>,
    playNow: boolean,
    addToHead: boolean
  ) {
    console.log('===2=2===', plugin, sourceContext, playNow, addToHead)
  }
  function clearPlayNextList() {}
  function resetPlayer() {}

  function moveToFMTrash() {}

  return {
    playList,
    shuffleList,
    playNextList,

    currentTrackInfo,
    nextTrackInfo,
    fmTrackInfo,

    repeatMode,
    isPersonalFM,
    currentTrackIndex,
    title,
    isShuffle,

    replacePlaylist,
    replaceCurrentTrack,
    playPrev,
    play,
    pause,
    playOrPause,
    playNext,
    switchRepeatMode,
    shuffleTheList,

    addTrackToPlayNext,
    clearPlayNextList,
    resetPlayer,

    moveToFMTrash
  }
})
