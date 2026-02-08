import { defineStore } from 'pinia'
import { computed, onMounted, reactive } from 'vue'
import { service, Track, Playlist, PluginMethodCall, PluginId } from '@/types/plugin'

const _buildService = (code: PluginId, meta: { name: string; type: 'online' | 'stream' }) => {
  return {
    code,
    name: meta.name,
    type: meta.type,
    status: 'logout' as 'login' | 'logout' | 'offline',
    tracks: [] as Track[],
    playlists: [] as Playlist[],
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

interface User {
  userId: number | null
  avatarUrl: string
  nickname: string
  [key: string]: any
}

export const usePluginMusic = defineStore(
  'pluginMusic',
  () => {
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

    const users = reactive<Record<service['name'], User>>({})
    const pluginIdSet = computed(() => {
      return new Set(services.services.map((s) => s.code))
    })

    /**
     * 调用插件的某个具体方法。本地音乐、流媒体音乐后续也改到这里
     * @param {String} pluginId 被调用插件的id
     * @param {String} methodName 被调用的方法名
     * @param {Object} params 被调用方法对应的参数
     */
    const pluginMethodCall: PluginMethodCall = (
      pluginId: PluginId,
      methodName: string,
      ...args
    ) => {
      if (!pluginIdSet.value.has(pluginId)) {
        throw new Error(`Invalid pluginId: ${pluginId}`)
      }

      const params = args[0] ?? {}

      return window.mainApi!.invoke('plugin-method-call', {
        pluginId,
        methodName,
        params
      })
    }

    const uploadPlugin = async () => {
      window
        .mainApi!.invoke('upload-plugin')
        .then((result: { code: number; error?: string; message?: string }) => {
          console.log('===1===', result)
        })
    }

    const getPlugins = async () => {
      services.services = []
      await window.mainApi
        ?.invoke('get-plugins')
        .then((result: Record<string, { name: string; type: 'online' | 'stream' }>) => {
          for (const [code, meta] of Object.entries(result)) {
            const info = _buildService(code as PluginId, meta)
            services.services.push(info)
          }
        })
    }

    onMounted(async () => {
      await getPlugins()
    })

    return { services, users, pluginMethodCall, uploadPlugin, getPlugins }
  },
  {
    persist: true
  }
)
