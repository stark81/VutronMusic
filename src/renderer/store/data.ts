import { defineStore } from 'pinia'
import { ref, reactive, watch } from 'vue'
import { userPlaylist } from '../api/auth'
import {
  userLikedSongsIDs,
  likedAlbums,
  likedArtists,
  likedMVs,
  cloudDisk,
  userPlayHistory
} from '../api/user'
import { getTrackDetail, likeTrack } from '../api/track'
import { useNormalStateStore } from './state'
import { isAccountLoggedIn } from '../utils/auth'
import { useI18n } from 'vue-i18n'
import { getPlaylistDetail } from '../api/playlist'
import { localDataCache } from '../utils/localDataCache'
import { networkMonitor } from '../utils/networkMonitor'

interface User {
  userId: number | null
  avatarUrl: string
  nickname: string
  [key: string]: any
}

export const useDataStore = defineStore(
  'data',
  () => {
    const user = ref<User>({
      userId: null,
      avatarUrl: 'https://s4.music.126.net/style/web2/img/default/default_avatar.jpg?param=60y60',
      nickname: ''
    })
    const likedSongPlaylistID = ref<number>(0)
    const lastRefreshCookieDate = ref<number>(0)
    const loginMode = ref<string | null>(null)
    const libraryPlaylistFilter = ref<string>('all')
    const { t } = useI18n()

    const liked = reactive<{
      songs: number[]
      songsWithDetails: any[]
      playlists: any[]
      albums: any[]
      artists: any[]
      mvs: any[]
      cloudDisk: any[]
      playHistory: {
        weekData: any[]
        allData: any[]
      }
    }>({
      songs: [],
      songsWithDetails: [], // 只有前12首
      playlists: [],
      albums: [],
      artists: [],
      mvs: [],
      cloudDisk: [],
      playHistory: {
        weekData: [],
        allData: []
      }
    })

    const { showToast } = useNormalStateStore()

    // Load cached data eagerly on store creation
    const initFromCache = async () => {
      const [songs, playlists, songsWithDetails, albums, artists, mvs, cloud, history] =
        await Promise.all([
          localDataCache.loadData<number[]>(localDataCache.Keys.librarySongs),
          localDataCache.loadData<any[]>(localDataCache.Keys.libraryPlaylists),
          localDataCache.loadData<any[]>(localDataCache.Keys.librarySongsWithDetails),
          localDataCache.loadData<any[]>(localDataCache.Keys.libraryAlbums),
          localDataCache.loadData<any[]>(localDataCache.Keys.libraryArtists),
          localDataCache.loadData<any[]>(localDataCache.Keys.libraryMVs),
          localDataCache.loadData<any[]>(localDataCache.Keys.libraryCloudDisk),
          localDataCache.loadData<{ weekData: any[]; allData: any[] }>(
            localDataCache.Keys.libraryPlayHistory
          )
        ])
      if (songs) liked.songs = songs
      if (playlists) liked.playlists = playlists
      if (songsWithDetails) liked.songsWithDetails = songsWithDetails
      if (albums) liked.albums = albums
      if (artists) liked.artists = artists
      if (mvs) liked.mvs = mvs
      if (cloud) liked.cloudDisk = cloud
      if (history) liked.playHistory = history
    }
    initFromCache()

    const fetchLikedPlaylist = async () => {
      if (!user.value.userId) return
      if (networkMonitor.isOfflineMode.value && liked.playlists.length > 0) return
      await userPlaylist({
        uid: user.value.userId,
        limit: 2000,
        timestamp: new Date().getTime()
      }).then((res) => {
        if (res.playlist) {
          liked.playlists = res.playlist
          likedSongPlaylistID.value = res.playlist[0].id
          localDataCache.saveData(localDataCache.Keys.libraryPlaylists, res.playlist)
        }
      })
    }

    const fetchLikedSongs = async () => {
      if (!user.value.userId) return
      if (networkMonitor.isOfflineMode.value) return
      await userLikedSongsIDs(user.value.userId).then((res) => {
        if (res.ids) {
          liked.songs = res.ids
          localDataCache.saveData(localDataCache.Keys.librarySongs, res.ids)
        }
      })
    }

    const fetchLikedAlbums = () => {
      if (!isAccountLoggedIn()) return
      if (networkMonitor.isOfflineMode.value && liked.albums.length > 0) return
      return likedAlbums({ limit: 2000 }).then((result) => {
        if (result.data) {
          liked.albums = result.data
          localDataCache.saveData(localDataCache.Keys.libraryAlbums, result.data)
        }
      })
    }

    const fetchLikedArtists = () => {
      if (!isAccountLoggedIn()) return
      if (networkMonitor.isOfflineMode.value && liked.artists.length > 0) return
      return likedArtists({ limit: 2000 }).then((result) => {
        if (result.data) {
          liked.artists = result.data
          localDataCache.saveData(localDataCache.Keys.libraryArtists, result.data)
        }
      })
    }

    const fetchLikedMVs = () => {
      if (!isAccountLoggedIn()) return
      if (networkMonitor.isOfflineMode.value && liked.mvs.length > 0) return
      return likedMVs({ limit: 1000 }).then((result) => {
        if (result.data) {
          liked.mvs = result.data
          localDataCache.saveData(localDataCache.Keys.libraryMVs, result.data)
        }
      })
    }

    const fetchCloudDisk = () => {
      if (!isAccountLoggedIn()) return
      if (networkMonitor.isOfflineMode.value && liked.cloudDisk.length > 0) return
      return cloudDisk({ limit: 1000 })
        .then((result) => {
          if (result.data) {
            liked.cloudDisk = result.data
            localDataCache.saveData(localDataCache.Keys.libraryCloudDisk, result.data)
          }
        })
        .catch((err) => {
          showToast(err)
        })
    }

    const fetchPlayHistory = () => {
      if (!isAccountLoggedIn()) return
      if (networkMonitor.isOfflineMode.value && liked.playHistory.weekData.length > 0) return
      return Promise.all([
        userPlayHistory({ uid: user.value.userId as number, type: 0 }),
        userPlayHistory({ uid: user.value.userId as number, type: 1 })
      ]).then((result) => {
        const data: { allData: any[]; weekData: any[] } = { allData: [], weekData: [] }
        const dataType = { 0: 'allData', 1: 'weekData' }
        if (result[0] && result[1]) {
          for (let i = 0; i < result.length; i++) {
            const songData = result[i][dataType[i]].map((item) => {
              const song = item.song
              song.playCount = item.playCount
              return song
            })
            data[dataType[i] as 'weekData' | 'allData'] = songData
          }
          liked.playHistory = data
          localDataCache.saveData(localDataCache.Keys.libraryPlayHistory, data)
        }
      })
    }

    const resetUserInfo = () => {
      user.value = {
        userId: null,
        avatarUrl: 'https://s4.music.126.net/style/web2/img/default/default_avatar.jpg?param=60y60',
        nickname: ''
      }
      likedSongPlaylistID.value = 0
    }

    const likeATrack = (id: number) => {
      if (!isAccountLoggedIn()) {
        showToast(t('toast.needToLogin'))
        return
      }
      let like = true
      if (liked.songs.includes(id)) like = false
      likeTrack({ id, like })
        .then(() => {
          if (!like) {
            liked.songs = liked.songs.filter((item) => item !== id)
          } else {
            liked.songs.push(id)
          }
        })
        .catch(() => {
          showToast(t('toast.addFailed'))
        })
    }

    const fetchLikedSongsWithDetails = () => {
      if (networkMonitor.isOfflineMode.value && liked.songsWithDetails.length > 0) {
        return Promise.resolve()
      }
      return getPlaylistDetail(likedSongPlaylistID.value, true).then((result) => {
        if (!result) return
        if (result.playlist?.trackIds?.length === 0) {
          return new Promise<void>((resolve) => {
            resolve()
          })
        }
        return getTrackDetail(
          result.playlist.trackIds
            .slice(0, 8)
            .map((t) => t.id)
            .join(',')
        ).then((result) => {
          liked.songsWithDetails = result.songs
          localDataCache.saveData(localDataCache.Keys.librarySongsWithDetails, result.songs)
        })
      })
    }

    const resetLiked = () => {
      liked.songs = []
      liked.songsWithDetails = []
      liked.playlists = []
      liked.albums = []
      liked.artists = []
      liked.mvs = []
      liked.cloudDisk = []
      liked.playHistory = {
        weekData: [],
        allData: []
      }
    }

    return {
      user,
      likedSongPlaylistID,
      lastRefreshCookieDate,
      loginMode,
      liked,
      libraryPlaylistFilter,
      fetchLikedPlaylist,
      fetchLikedSongs,
      resetUserInfo,
      likeATrack,
      fetchLikedSongsWithDetails,
      resetLiked,
      fetchLikedAlbums,
      fetchLikedArtists,
      fetchLikedMVs,
      fetchCloudDisk,
      fetchPlayHistory
    }
  },
  {
    persist: {
      pick: ['user', 'likedSongPlaylistID', 'lastRefreshCookieDate', 'loginMode']
    }
  }
)
