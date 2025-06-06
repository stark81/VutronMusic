import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
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

    const fetchLikedPlaylist = async () => {
      if (!user.value.userId) return
      await userPlaylist({
        uid: user.value.userId,
        limit: 2000,
        timestamp: new Date().getTime()
      }).then((res) => {
        if (res.playlist) {
          liked.playlists = res.playlist
          likedSongPlaylistID.value = res.playlist[0].id
        }
      })
    }

    const fetchLikedSongs = async () => {
      if (!user.value.userId) return
      await userLikedSongsIDs(user.value.userId).then((res) => {
        if (res.ids) {
          liked.songs = res.ids
        }
      })
    }

    const fetchLikedAlbums = () => {
      if (!isAccountLoggedIn()) return
      return likedAlbums({ limit: 2000 }).then((result) => {
        if (result.data) {
          liked.albums = result.data
        }
      })
    }

    const fetchLikedArtists = () => {
      if (!isAccountLoggedIn()) return
      return likedArtists({ limit: 2000 }).then((result) => {
        if (result.data) {
          liked.artists = result.data
        }
      })
    }

    const fetchLikedMVs = () => {
      if (!isAccountLoggedIn()) return
      return likedMVs({ limit: 1000 }).then((result) => {
        if (result.data) {
          liked.mvs = result.data
        }
      })
    }

    const fetchCloudDisk = () => {
      if (!isAccountLoggedIn()) return
      return cloudDisk({ limit: 1000 })
        .then((result) => {
          if (result.data) {
            liked.cloudDisk = result.data
          }
        })
        .catch((err) => {
          showToast(err)
        })
    }

    const fetchPlayHistory = () => {
      if (!isAccountLoggedIn()) return
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
      return getPlaylistDetail(likedSongPlaylistID.value, true).then((result) => {
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
