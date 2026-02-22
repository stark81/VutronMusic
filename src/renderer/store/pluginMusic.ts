import { defineStore } from 'pinia'
import { onMounted, reactive } from 'vue'
import { service } from '@/types/music'

const _buildService = (code: string, meta: { name: string; type: 'online' | 'stream' }) => {
  return {
    code,
    name: meta.name,
    type: meta.type,
    status: 'logout',
    tracks: [],
    playlists: [],
    lastRefreshCookieDate: 0,
    liked: {
      likedSongPlaylistID: 0,
      songs: [],
      songsWithDetails: [],
      playlists: [],
      albums: [],
      artists: [],
      mvs: [],
      cloudDisk: [],
      playHistory: {
        weekData: [],
        allData: []
      }
    }
  }
}

export const usePluginMusic = defineStore('pluginMusic', () => {
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
   * @param {'GET' | 'POST'} method 调用方式
   */
  const pluginMethodCall = (
    pluginId: string,
    methodName: string,
    params: Record<string, any> = {},
    method: 'GET' | 'POST' = 'GET'
  ) => {
    return window.mainApi!.invoke('plugin-method-call', { pluginId, methodName, params, method })
  }

  onMounted(() => {
    window.mainApi
      ?.invoke('get-plugins')
      .then((result: Record<string, { name: string; type: 'online' | 'stream' }>) => {
        for (const [code, meta] of Object.entries(result)) {
          const info = _buildService(code, meta)
          console.log('===2===', info)
        }
      })
  })

  return { services, pluginMethodCall }
})
