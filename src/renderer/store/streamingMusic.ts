import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { Track, Playlist } from './localMusic'
import _ from 'lodash'

export interface StreamPlaylist extends Omit<Playlist, 'id'> {
  id: string
  trackItemIds: Record<number, number>
}

export const servicesName = ['navidrome', 'jellyfin', 'emby'] as const
export type serviceName = (typeof servicesName)[number]
export type streamStatus = 'logout' | 'login' | 'offline'

export type serviceType = {
  name: serviceName
  selected: boolean
  status: streamStatus
}

export const useStreamMusicStore = defineStore(
  'streamMusic',
  () => {
    const enable = ref(false)
    const services = ref<serviceType[]>([
      { name: 'navidrome', selected: true, status: 'logout' },
      { name: 'jellyfin', selected: false, status: 'logout' },
      { name: 'emby', selected: false, status: 'logout' }
    ])
    const streamTracks = ref<Track[]>([])
    const playlists = ref<StreamPlaylist[]>([])
    const sortBy = ref('default')
    const message = ref('')

    const streamLikedTracks = computed(() => {
      return streamTracks.value.filter((track) => track.starred)
    })

    const currentService = computed(() => services.value.find((s) => s.selected)!)

    const fetchStreamMusic = async () => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      await window.mainApi
        ?.invoke('get-stream-songs', { platform: service.name })
        .then((data: { code: number; message: string; tracks: any; playlists: any }) => {
          if (data?.code === 200) {
            streamTracks.value = data.tracks
            playlists.value = data.playlists
            service.status = 'login'
          } else if (data.code === 504) {
            service.status = 'offline'
            streamTracks.value = []
            playlists.value = []
          } else {
            console.log('get-stream-songs response = ', data)
          }
        })
        .catch((error) => error)
    }

    const fetchStreamPlaylist = async () => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      window.mainApi
        ?.invoke('get-stream-playlists', { platform: service.name })
        .then((data: { code: number; playlists: StreamPlaylist[] }) => {
          if (data.code === 200) {
            playlists.value = data.playlists
          }
        })
    }

    const addOrRemoveTrackFromStreamPlaylist = async (
      op: 'add' | 'del',
      playlistId: string,
      ids: string[]
    ) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      let newIDs: any[] = []
      if (op === 'add') {
        const playlist = playlists.value.find((p) => p.id === playlistId)
        newIDs = _.difference(ids, (playlist?.trackIds || []) as unknown as string[])
        if (!newIDs.length) return false
      }

      const status: boolean = await window.mainApi?.invoke('updateStreamPlaylist', {
        op,
        platform: service.name,
        playlistId,
        ids: op === 'add' ? newIDs : ids
      })
      if (status) {
        fetchStreamPlaylist()
      }
      return status
    }

    const scrobble = (id: string | number) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      window.mainApi?.send('scrobbleStreamMusic', { platform: service.name, id })
    }

    const getStreamLyric = async (id: string | number) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      let data = {
        lrc: { lyric: [] as any[] },
        tlyric: { lyric: [] as any[] },
        romalrc: { lyric: [] as any[] },
        yrc: { lyric: [] as any[] },
        ytlrc: { lyric: [] as any[] },
        yromalrc: { lyric: [] as any[] }
      }
      data = await fetch(`atom://get-stream-lyric/${id}`).then((res) => res.json())
      return data
    }

    const handleStreamLogout = () => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      window.mainApi?.invoke('logoutStreamMusic', { platform: service.name }).then(() => {
        service.status = 'logout'
      })
    }

    const getStreamPic = async (track: Track, size: number = 512) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      let id = track.id as any
      const match = (track.album || track.al).picUrl.match(/get-stream-pic\/(.*)/)
      if (match) {
        id = match[1].replace('/64', `/${size}`)
        return await fetch(`atom://get-stream-pic/${id}`)
          .then((res) => res.blob())
          .then((res) => URL.createObjectURL(res))
          .catch(() => null)
      } else {
        return new URL(`../assets/images/default.jpg`, import.meta.url).href
      }
    }

    const likeAStreamTrack = (op: 'unstar' | 'star', id: string | number) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      window.mainApi
        ?.invoke('likeAStreamTrack', { platform: service.name, operation: op, id })
        .then((res: boolean) => {
          if (res) {
            const track = streamTracks.value.find((track) => track.id === id)
            if (track) track.starred = !track.starred
          }
        })
    }

    const getAStreamTrack = (id: string | number) => {
      return streamTracks.value.find((track) => track.id === id)
    }

    watch(currentService, () => {
      streamTracks.value = []
      playlists.value = []
      fetchStreamMusic()
      fetchStreamPlaylist()
    })

    return {
      enable,
      services,
      currentService,
      streamTracks,
      streamLikedTracks,
      playlists,
      sortBy,
      message,
      scrobble,
      getStreamLyric,
      getStreamPic,
      getAStreamTrack,
      likeAStreamTrack,
      handleStreamLogout,
      fetchStreamMusic,
      fetchStreamPlaylist,
      addOrRemoveTrackFromStreamPlaylist
    }
  },
  {
    persist: {
      pick: ['sortBy', 'enable', 'services']
    }
  }
)
