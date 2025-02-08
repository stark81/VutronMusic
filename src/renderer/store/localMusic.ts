import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import _ from 'lodash'

type TrackType = 'online' | 'local' | 'stream'

export interface Artist {
  id: number
  name: string
  picUrl: string
  matched: boolean
  [key: string]: any
}

export interface Album {
  id: number
  name: string
  artist: Artist
  picUrl: string
  matched: boolean
  [key: string]: any
}

export interface Track {
  id: number
  name: string
  dt: number
  filePath: string
  type?: TrackType
  matched?: boolean
  offset?: number
  md5?: string
  createTime: number
  alias: string[]
  album: Album
  artists: Artist[]
  picUrl: string
  source?: string
  gain: number
  peak: number
  [key: string]: any
}

export interface Playlist {
  id: number
  name: string
  description: string
  coverImgUrl: string
  updateTime: number
  trackCount: number
  trackIds: number[]
  creator?: any
}

export const useLocalMusicStore = defineStore(
  'localMusic',
  () => {
    const localTracks = ref<Track[]>([])
    const albums = ref<Album[]>([])
    const artists = ref<any[]>([])
    const playlists = ref<Playlist[]>([])
    const sortBy = ref('default')
    const sortPlaylistsIDs = ref<number[]>([])

    const updateTrack = (filePath: string, track: any) => {
      const localTrack = localTracks.value.find((t) => t.filePath === filePath)
      if (!localTrack) return

      // 更新本地歌单里对应的歌曲ID
      playlists.value.forEach((p) => {
        if (p.trackIds.includes(localTrack.id)) {
          p.trackIds.splice(p.trackIds.indexOf(localTrack.id), 1, track.id)
          p.coverImgUrl = `atom://get-playlist-pic/${p.trackIds[p.trackIds.length - 1]}`
          p.updateTime = Date.now()
        }
      })

      _.merge(localTrack, track)
      localTrack.matched = true
      localTrack.type = 'local'
      localTrack.album.matched = true
      localTrack.artists.forEach((a: any) => {
        a.matched = true
      })
    }

    const createLocalPlaylist = async (params: any) => {
      const playlist = {
        id: playlists.value.length + 1,
        name: params.name as string,
        description: '',
        coverImgUrl: params.coverImgUrl as string,
        updateTime: Date.now(),
        trackCount: params.trackCount as number,
        trackIds: params.trackIds as number[]
      }
      const result = await window.mainApi.invoke('upsertLocalPlaylist', playlist)
      if (result) {
        playlists.value.push(playlist)
        sortPlaylistsIDs.value.unshift(playlist.id)
        return playlist
      }
      return false
    }

    const addTrackToLocalPlaylist = (playlistId: number, tracks: number[]) => {
      return new Promise((resolve) => {
        const playlist = playlists.value.find((p) => p.id === playlistId)
        if (!playlist) return
        const newIDs = _.difference(tracks, playlist.trackIds) as number[]
        if (newIDs.length === 0) return resolve(false)
        const idx = tracks.length - 1
        const imgID = tracks[idx]
        playlist.coverImgUrl = `atom://get-playlist-pic/${imgID}`
        playlist.trackIds = [...playlist.trackIds, ...newIDs]
        playlist.trackCount = playlist.trackIds.length
        window.mainApi.invoke('upsertLocalPlaylist', toRaw(playlist))
        resolve(true)
      })
    }

    const deleteLocalTracks = (trackIDs: number[]) => {
      for (const trackId of trackIDs) {
        const idx = localTracks.value.findIndex((t) => t.id === trackId)
        const plists = playlists.value.filter((p) => p.trackIds.includes(trackId))
        plists.forEach((p) => {
          removeTrackFromPlaylist(p.id, trackId)
        })
        localTracks.value.splice(idx, 1)
      }
    }

    const removeTrackFromPlaylist = (playlistId: number, trackId: number) => {
      return new Promise((resolve) => {
        const playlist = playlists.value.find((p) => p.id === playlistId)
        if (!playlist) return
        playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId)
        const idx = playlist.trackIds.length - 1
        playlist.coverImgUrl =
          idx >= 0
            ? `atom://get-playlist-pic/${playlist.trackIds[idx]}`
            : 'https://p1.music.126.net/jWE3OEZUlwdz0ARvyQ9wWw==/109951165474121408.jpg?param=512y512'
        playlist.trackCount = playlist.trackIds.length
        window.mainApi.invoke('upsertLocalPlaylist', toRaw(playlist))
        resolve(true)
      })
    }

    const deleteLocalPlaylist = async (playlistId: number) => {
      const result = (await window.mainApi.invoke('deleteLocalPlaylist', playlistId)) as boolean
      if (result) {
        playlists.value = playlists.value.filter((p) => p.id !== playlistId)
        sortPlaylistsIDs.value = sortPlaylistsIDs.value.filter((id) => id !== playlistId)
      }
      return result
    }

    const fetchLocalMusic = async () => {
      await window.mainApi?.invoke('getLocalMusic').then((res: any) => {
        const tracks = res.songs
        const playLists = res.playlists
        localTracks.value = tracks
        playlists.value = playLists
        if (playlists.value.length !== sortPlaylistsIDs.value.length) {
          sortPlaylistsIDs.value = playlists.value.map((p) => p.id)
        }
      })
    }

    const resetLocalMusic = () => {
      localTracks.value = []
      albums.value = []
      artists.value = []
      playlists.value = []
      sortBy.value = 'default'
    }

    return {
      localTracks,
      albums,
      artists,
      playlists,
      sortPlaylistsIDs,
      sortBy,
      updateTrack,
      fetchLocalMusic,
      resetLocalMusic,
      createLocalPlaylist,
      addTrackToLocalPlaylist,
      removeTrackFromPlaylist,
      deleteLocalPlaylist,
      deleteLocalTracks
    }
  },
  {
    persist: {
      paths: ['sortBy', 'sortPlaylistsIDs']
    }
  }
)
