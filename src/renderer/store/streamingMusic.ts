import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Track, Album, Artist, Playlist } from './localMusic'
import { useSettingsStore } from './settings'
import _ from 'lodash'

export interface StreamPlaylist extends Omit<Playlist, 'id'> {
  id: string
}

export const useStreamMusicStore = defineStore('streamMusic', () => {
  const streamTracks = ref<Track[]>([])
  const albums = ref<Album[]>([])
  const artists = ref<Artist[]>([])
  const playlists = ref<StreamPlaylist[]>([])
  const sortBy = ref('default')

  const fetchStreamMusic = async () => {
    const settingsStore = useSettingsStore()
    const stream = settingsStore.stream
    window.mainApi.invoke('get-stream-songs', { platform: stream.select }).then((data: any) => {
      streamTracks.value = data.tracks
      playlists.value = data.playlists
    })
  }

  const fetchStreamPlaylist = async () => {
    const settingsStore = useSettingsStore()
    const stream = settingsStore.stream
    window.mainApi.invoke('get-stream-playlists', { platform: stream.select }).then((data: any) => {
      playlists.value = data.playlists
    })
  }

  const addOrRemoveTrackFromStreamPlaylist = async (
    op: string,
    playlistId: string,
    ids: string[]
  ) => {
    const settingsStore = useSettingsStore()
    const stream = settingsStore.stream

    const playlist = playlists.value.find((p) => p.id === playlistId)!
    const newIDs = _.difference(ids, playlist.trackIds as unknown as string[])
    if (!newIDs.length) return false

    const status: boolean = await window.mainApi.invoke('updateStreamPlaylist', {
      op,
      platform: stream.select,
      playlistId,
      ids
    })
    if (status) {
      fetchStreamPlaylist()
    }
    return status
  }

  return {
    streamTracks,
    albums,
    artists,
    playlists,
    sortBy,
    fetchStreamMusic,
    fetchStreamPlaylist,
    addOrRemoveTrackFromStreamPlaylist
  }
})
