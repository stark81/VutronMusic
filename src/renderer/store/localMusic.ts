import { defineStore } from 'pinia'
import { ref, toRaw, toRefs } from 'vue'
import { useSettingsStore } from './settings'
import { useNormalStateStore } from './state'
import { compare } from 'compare-versions'
import difference from 'lodash/difference'
import merge from 'lodash/merge'
import { Track, Playlist, lyricLine } from '@/types/music'

export const sortList = ['default', 'byname', 'ascend', 'descend'] as const

export const useLocalMusicStore = defineStore(
  'localMusic',
  () => {
    const enable = ref(true)
    const version = ref('2.4.0')
    const localTracks = ref<Track[]>([])
    const playlists = ref<Playlist[]>([])
    const sortBy = ref<(typeof sortList)[number]>('default')
    const artistBy = ref(0)
    const sortPlaylistsIDs = ref<number[]>([])

    const updateTrack = (filePath: string, track: any) => {
      const localTrack = localTracks.value.find((t) => t.filePath === filePath)
      if (!localTrack) return

      // 更新本地歌单里对应的歌曲ID
      playlists.value.forEach((p) => {
        if (p.trackIds.includes(localTrack.id)) {
          p.trackIds.splice(p.trackIds.indexOf(localTrack.id), 1, track.id)
          p.coverImgUrl = `atom://local-asset?type=pic&id=${p.trackIds[p.trackIds.length - 1]}`
          p.updateTime = Date.now()
        }
      })

      merge(localTrack, track)
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
      const result = await window.mainApi?.invoke('upsertLocalPlaylist', playlist)
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
        const newIDs = difference(tracks, playlist.trackIds) as number[]
        if (newIDs.length === 0) return resolve(false)
        const idx = tracks.length - 1
        const imgID = tracks[idx]
        playlist.coverImgUrl = `atom://local-asset?type=pic&id=${imgID}&size=512`
        playlist.trackIds = [...playlist.trackIds, ...newIDs]
        playlist.trackCount = playlist.trackIds.length
        window.mainApi?.invoke('upsertLocalPlaylist', toRaw(playlist))
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
            ? `atom://local-asset?type=pic&id=${playlist.trackIds[idx]}`
            : 'https://p1.music.126.net/jWE3OEZUlwdz0ARvyQ9wWw==/109951165474121408.jpg?param=512y512'
        playlist.trackCount = playlist.trackIds.length
        window.mainApi?.invoke('upsertLocalPlaylist', toRaw(playlist))
        resolve(true)
      })
    }

    const deleteLocalPlaylist = async (playlistId: number) => {
      const result = (await window.mainApi?.invoke('deleteLocalPlaylist', playlistId)) as boolean
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

    const getLocalLyric = async (id: number) => {
      const res = await fetch(`atom://local-asset?type=lyric&id=${id}`)
      return (await res.json()) as lyricLine[]
    }

    const getALocalTrack = (query: Partial<Track>): Track | undefined => {
      return localTracks.value.find((track) =>
        Object.entries(query).every(([key, value]) => track[key as keyof Track] === value)
      )
    }

    const getLocalPic = async (id: number, size: number) => {
      const pic = new URL(`../assets/images/default.jpg`, import.meta.url).href
      const result = await fetch(`atom://local-asset?type=pic&id=${id}&size=${size}`)
        .then((res) => res.blob())
        .then((res) => URL.createObjectURL(res))
        .catch(() => null)
      return result ?? pic
    }

    const scanLocalMusic = async (update = false) => {
      const settingsStore = useSettingsStore()
      const { scanDir, scanning, enble } = toRefs(settingsStore.localMusic)

      window.mainApi?.send('clearDeletedMusic')

      if (!scanDir.value || !enble.value) return
      const isExist = await window.mainApi?.invoke('msgCheckFileExist', scanDir.value)
      if (!isExist) return
      scanning.value = true
      window.mainApi?.send('msgScanLocalMusic', { filePath: scanDir.value, update })
    }

    const resetLocalMusic = () => {
      localTracks.value = []
      playlists.value = []
      sortBy.value = 'default'
    }

    const updateApp = async () => {
      const result = (await window.mainApi?.invoke('msgRequestGetVersion')) as string
      if (compare(version.value || '2.4.0', '2.9.0', '<=')) {
        const { showToast } = useNormalStateStore()
        showToast('扫描歌曲开始')
        scanLocalMusic(true)
      }
      version.value = result
    }
    updateApp()

    return {
      enable,
      version,
      localTracks,
      playlists,
      sortPlaylistsIDs,
      sortBy,
      artistBy,
      updateTrack,
      scanLocalMusic,
      fetchLocalMusic,
      getLocalLyric,
      getALocalTrack,
      resetLocalMusic,
      createLocalPlaylist,
      addTrackToLocalPlaylist,
      removeTrackFromPlaylist,
      deleteLocalPlaylist,
      getLocalPic,
      deleteLocalTracks
    }
  },
  {
    persist: true
  }
)
