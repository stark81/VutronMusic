import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'
import { Track, Album, Artist, Playlist } from './localMusic'
import _ from 'lodash'

export interface StreamPlaylist extends Omit<Playlist, 'id'> {
  id: string
  trackItemIds: Record<number, number>
}

export const servers = ['navidrome', 'jellyfin', 'emby'] as const
export type streamServer = (typeof servers)[number]
export type streamStatus = 'logout' | 'login' | 'offline'

export const useStreamMusicStore = defineStore(
  'streamMusic',
  () => {
    const enable = ref(false)
    const select = ref<streamServer>('navidrome')
    const status = reactive<Record<streamServer, streamStatus>>({
      navidrome: 'logout',
      jellyfin: 'logout',
      emby: 'logout'
    })
    const streamTracks = ref<Track[]>([])
    const albums = ref<Album[]>([])
    const artists = ref<Artist[]>([])
    const playlists = ref<StreamPlaylist[]>([])
    const sortBy = ref('default')
    const message = ref('')

    const fetchStreamMusic = async () => {
      if (status[select.value] === 'logout') return
      await window.mainApi
        .invoke('get-stream-songs', { platform: select.value })
        .then((data: { code: number; message: string; tracks: any; playlists: any }) => {
          if (data.code === 200) {
            status[select.value] = 'login'
            streamTracks.value = data.tracks
            playlists.value = data.playlists
          } else if (data.code === 504) {
            // console.log('get-stream-songs response = ', data)
            status[select.value] = 'offline'
            streamTracks.value = []
            playlists.value = []
            message.value = data.message
          } else {
            console.log('get-stream-songs response = ', data)
            // status[select.value] = 'logout'
          }
        })
    }

    const fetchStreamPlaylist = async () => {
      window.mainApi
        .invoke('get-stream-playlists', { platform: select.value })
        .then((data: { code: number; playlists: StreamPlaylist[] }) => {
          if (data.code === 200) {
            playlists.value = data.playlists
          }
        })
    }

    const addOrRemoveTrackFromStreamPlaylist = async (
      op: string,
      playlistId: string,
      ids: string[]
    ) => {
      let newIDs: any[] = []
      if (op === 'add') {
        const playlist = playlists.value.find((p) => p.id === playlistId)
        newIDs = _.difference(ids, (playlist?.trackIds || []) as unknown as string[])
        if (!newIDs.length) return false
      }

      const status: boolean = await window.mainApi.invoke('updateStreamPlaylist', {
        op,
        platform: select.value,
        playlistId,
        ids: op === 'add' ? newIDs : ids
      })
      if (status) {
        fetchStreamPlaylist()
      }
      return status
    }

    const scrobble = (id: string) => {
      window.mainApi.send('scrobbleStreamMusic', { platform: select.value, id })
    }

    const handleStreamLogout = () => {
      window.mainApi
        .invoke('logoutStreamMusic', { platform: select.value })
        .then((res: boolean) => {
          status[select.value] = 'logout'
        })
    }

    watch(select, (value) => {
      streamTracks.value = []
      playlists.value = []
      if (status[value] === 'login') {
        fetchStreamMusic()
      }
    })

    return {
      enable,
      select,
      status,
      streamTracks,
      albums,
      artists,
      playlists,
      sortBy,
      message,
      scrobble,
      handleStreamLogout,
      fetchStreamMusic,
      fetchStreamPlaylist,
      addOrRemoveTrackFromStreamPlaylist
    }
  },
  {
    persist: {
      paths: ['sortBy', 'enable', 'status', 'select']
    }
  }
)
