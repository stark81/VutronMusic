import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { Track, Playlist, Album, Artist } from '@/types/music'

type service = {
  name: string
  type: 'online' | 'stream' | 'local'
  status: 'logout' | 'login' | 'offline'
  tracks: Track[]
  playlists: Playlist[]
  lastRefreshCookieDate?: number
  linkTo?: string // 仅本地音乐可用，音乐匹配的线上数据服务，如网易云、酷狗
  liked?: {
    likedSongPlaylistID: number
    songs: number[]
    songsWithDetails: Track[]
    playlists: Playlist[]
    albums: Album[]
    artists: Artist[]
    mvs: any[]
    cloudDisk: Track[]
    playHistory: {
      weekData: Track[]
      allData: Track[]
    }
  }
}

export const pluginMusic = defineStore('pluginMusic', () => {
  const services = reactive<{
    active: service['name']
    sortBy: 'default' | ''
    groupBy: 'all'
    artistBy: 'artist' | 'albumArtist'
    services: service[]
  }>({
    active: 'netease', // 首页、探索页面数据来源
    sortBy: 'default', // 本地音乐、自建流媒体歌曲的排序
    groupBy: 'all', // 自建流媒体歌曲聚合情况
    artistBy: 'artist', // 本地音乐、自建流媒体的艺人显示模式
    services: []
  })

  /**
   * 调用插件的某个具体方法。本地音乐、流媒体音乐后续也改到这里
   * @param {String} pluginId 被调用插件的id
   * @param {String} methodName 被调用的方法名
   * @param {Object} params 被调用方法对应的参数
   */
  const pluginMethodCall = (
    pluginId: string,
    methodName: string,
    params: Record<string, any>,
    method: 'GET' | 'PST' = 'GET'
  ) => {
    return window.mainApi?.invoke('plugin-method-call', { pluginId, methodName, params, method })
  }

  return { services, pluginMethodCall }
})
