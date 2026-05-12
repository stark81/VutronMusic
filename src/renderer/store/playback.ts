import { defineStore } from 'pinia'
import { PluginId } from '@/types/plugin'
import { ref } from 'vue'

export const usePlaybackStore = defineStore('playback', () => {
  const playing = ref(false)
  const list = ref<[PluginId, string | number][]>([])
  const shuffle = ref<[PluginId, string | number][]>([])

  function replacePlaylist() {}
  function replaceCurrentTrack() {}
  function playPrev() {}
  function play() {}
  function pause() {}
  function playOrPause() {}
  function playNext() {}
  function switchRepeatMode() {}
  function shuffleTheList() {}

  function moveToFMTrash() {}

  return {
    playing,
    list,
    shuffle,

    replacePlaylist,
    replaceCurrentTrack,
    playPrev,
    play,
    pause,
    playOrPause,
    playNext,
    switchRepeatMode,
    shuffleTheList,

    moveToFMTrash
  }
})
