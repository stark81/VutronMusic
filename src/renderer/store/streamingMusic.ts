import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { Track, Playlist } from './localMusic'
import _ from 'lodash'

export interface StreamPlaylist extends Omit<Playlist, 'id'> {
  id: string
  trackItemIds: Record<number, number>
}

export type serviceName = 'navidrome' | 'jellyfin' | 'emby'
export type streamStatus = 'logout' | 'login' | 'offline'

export type serviceType = {
  name: serviceName
  status: streamStatus
}

export const useStreamMusicStore = defineStore(
  'streamMusic',
  () => {
    const enable = ref(false)
    const services = ref<serviceType[]>([
      { name: 'navidrome', status: 'logout' },
      { name: 'jellyfin', status: 'logout' },
      { name: 'emby', status: 'logout' }
    ])
    const streamTracks = reactive<Record<serviceName, Track[]>>({
      navidrome: [],
      jellyfin: [],
      emby: []
    })
    const playlists = reactive<Record<serviceName, StreamPlaylist[]>>({
      navidrome: [],
      jellyfin: [],
      emby: []
    })
    const sortBy = ref('default')
    const groundBy = ref<serviceName | 'all'>('all')
    const message = ref('')

    const loginedServices = computed(() => {
      return services.value.filter((s) => s.status === 'login')
    })

    const streamLikedTracks = computed(() => {
      const result = {} as Record<serviceName, Track[]>
      services.value.forEach((service) => {
        result[service.name] = (streamTracks[service.name] || []).filter((track) => track.starred)
      })
      return result
    })

    const fetchStreamMusic = async () => {
      const loginServices = loginedServices.value.map((s) => s.name)
      if (!loginServices.length || !enable.value) return

      await window.mainApi
        ?.invoke('get-stream-songs', { platforms: loginServices })
        .then((data: { platform: serviceName; tracks: Track[] }[]) => {
          loginServices.forEach((service) => {
            streamTracks[service] = data.find((d) => d.platform === service)?.tracks || []
          })
        })
        .catch((error) => error)
    }

    const fetchStreamPlaylist = async () => {
      const loginServices = loginedServices.value.map((s) => s.name)
      if (!loginServices.length || !enable.value) return

      window.mainApi
        ?.invoke('get-stream-playlists', { platforms: loginServices })
        .then((data: { platform: serviceName; playlists: StreamPlaylist[] }[]) => {
          loginServices.forEach((service) => {
            playlists[service] = data.find((d) => d.platform === service)?.playlists || []
          })
        })
    }

    const addOrRemoveTrackFromStreamPlaylist = async (
      op: 'add' | 'del',
      service: serviceName,
      playlistId: string,
      ids: string[]
    ) => {
      if (!enable.value) return
      let newIDs: any[] = []
      if (op === 'add') {
        const playlist = playlists[service].find((p) => p.id === playlistId)
        newIDs = _.difference(ids, (playlist?.trackIds || []) as unknown as string[])
        if (!newIDs.length) return false
      }

      const status: boolean = await window.mainApi?.invoke('updateStreamPlaylist', {
        op,
        platform: service,
        playlistId,
        ids: op === 'add' ? newIDs : ids
      })
      if (status) {
        fetchStreamPlaylist()
      }
      return status
    }

    const scrobble = (track: Track) => {
      if (!enable.value) return
      const service = track.source as serviceName
      window.mainApi?.send('scrobbleStreamMusic', { platform: service, id: track.id })
    }

    const getStreamLyric = async (track: Track) => {
      if (!enable.value) return
      const service = track.source as serviceName

      let data = {
        lrc: { lyric: [] as any[] },
        tlyric: { lyric: [] as any[] },
        romalrc: { lyric: [] as any[] },
        yrc: { lyric: [] as any[] },
        ytlrc: { lyric: [] as any[] },
        yromalrc: { lyric: [] as any[] }
      }
      data = await window.mainApi?.invoke('get-stream-lyric', {
        platform: service,
        id: track.source === 'emby' ? track.lrcId : track.id
      })
      return data
    }

    const handleStreamLogout = (service: serviceName) => {
      const selectedService = services.value.find((s) => s.name === service)!
      if (!enable.value || selectedService.status === 'logout') return
      window.mainApi?.invoke('logoutStreamMusic', { platform: service }).then(() => {
        selectedService.status = 'logout'
        streamTracks[service] = []
        playlists[service] = []
      })
    }

    const getStreamPic = (track: Track, size: number = 512) => {
      const service = track.source as serviceName
      const selectedService = services.value.find((s) => s.name === service)!
      if (!enable.value || selectedService.status === 'logout') return

      let url = (track.album || track.al).picUrl
      const regex = /size=\d+/
      url = url.replace(regex, `size=${size}`)
      return url
    }

    const likeAStreamTrack = (op: 'unstar' | 'star', track: Track) => {
      const service = track.source as serviceName
      const selectedService = services.value.find((s) => s.name === service)!
      if (!enable.value || selectedService.status === 'logout') return

      window.mainApi
        ?.invoke('likeAStreamTrack', { platform: service, operation: op, id: track.id })
        .then(async (res: boolean) => {
          if (res) {
            const t = streamTracks[service].find((t) => t.id === track.id)
            if (t) t.starred = !t.starred
          }
        })
    }

    const getAStreamTrack = (id: string | number) => {
      return _.cloneDeep(_.flatten(Object.values(streamTracks)).find((track) => track.id === id)!)
    }

    const checkStreamStatus = async () => {
      await window.mainApi?.invoke('systemPing').then((res: Record<serviceName, streamStatus>) => {
        services.value.forEach((service) => {
          service.status = res[service.name] || 'logout'
          if (service.status !== 'login') {
            streamTracks[service.name] = []
            playlists[service.name] = []
          }
        })
      })
    }
    checkStreamStatus()

    return {
      enable,
      services,
      loginedServices,
      streamTracks,
      streamLikedTracks,
      playlists,
      sortBy,
      groundBy,
      message,
      scrobble,
      getStreamLyric,
      checkStreamStatus,
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
