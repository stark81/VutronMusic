import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  getNavidromeTracks,
  getNavidromePlaylists,
  opTracksFromePlaylist,
  navidromeScrobble,
  likeANavidromeTrack,
  getNavidromeLyric,
  getRestUrl
} from '../api/navidrome'
import { Track, Playlist } from './localMusic'
import { updateStreamInfo } from '../utils/db'
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
      if (service.name === 'navidrome') {
        await getNavidromeTracks().then((res) => {
          if (res?.code === 200) {
            streamTracks.value = res.data
          }
        })
      } else if (service.name === 'emby') {
        //
      }
    }

    const fetchStreamPlaylist = async () => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      if (service.name === 'navidrome') {
        getNavidromePlaylists().then((res) => {
          if (res?.code === 200) {
            playlists.value = res.data
          }
        })
      } else if (service.name === 'emby') {
        //
      }
    }

    const addOrRemoveTrackFromStreamPlaylist = async (
      op: 'add' | 'del',
      playlistId: string,
      ids: string[]
    ) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      if (service.name === 'navidrome') {
        let newIDs: any[] = []
        if (op === 'add') {
          const playlist = playlists.value.find((p) => p.id === playlistId)
          newIDs = _.difference(ids, (playlist?.trackIds || []) as unknown as string[])
          if (!newIDs.length) return false
        }

        const status = await opTracksFromePlaylist(op, playlistId, op === 'add' ? newIDs : ids)
        if (status) {
          fetchStreamPlaylist()
        }
        return status
      }
    }

    const scrobble = (id: string | number) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      if (service.name === 'navidrome') {
        navidromeScrobble(id as string)
      }
    }

    const getStreamLyric = (id: string | number) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      const data = {
        lrc: { lyric: [] as any[] },
        tlyric: { lyric: [] as any[] },
        romalrc: { lyric: [] as any[] },
        yrc: { lyric: [] as any[] },
        ytlrc: { lyric: [] as any[] },
        yromalrc: { lyric: [] as any[] }
      }
      if (service.name === 'navidrome') {
        return getNavidromeLyric(id as string)
      }
      return Promise.resolve(data)
    }

    const handleStreamLogout = () => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      if (service.name === 'navidrome') {
        updateStreamInfo(service.name, { authorization: '', clientID: '' }).then(() => {
          service.status = 'logout'
          streamTracks.value = []
          playlists.value = []
        })
      }
    }

    const getStreamPic = async (track: Track, size: number = 512) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      if (service.name === 'navidrome') {
        const pic = await getRestUrl('getCoverArt', { id: track.album.id, size })
        return window.env?.isElectron
          ? await fetch(pic!)
              .then((res) => res.blob())
              .then((res) => URL.createObjectURL(res))
          : pic
      }
    }

    const likeAStreamTrack = (op: 'unstar' | 'star', id: string | number) => {
      if (!enable.value) return
      const service = services.value.find((s) => s.selected)!
      if (service.status === 'logout') return
      if (service.name === 'navidrome') {
        likeANavidromeTrack(op, id as string).then((res: boolean) => {
          if (res) {
            const track = streamTracks.value.find((track) => track.id === id)
            if (track) track.starred = !track.starred
          }
        })
      }
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
