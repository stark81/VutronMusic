import z from 'zod'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { PluginResultSchema } from '@/types/schemas'
import router from '../router'
import {
  service,
  PluginMethodCall,
  PluginId,
  MusicType,
  defaultMap,
  User,
  PluginAPI,
  PlaylistCatlist,
  Track,
  Playlist,
  Artist,
  Album
} from '@/types/plugin'

const _buildService = (code: PluginId, meta: { name: string; type: MusicType }): service => {
  return {
    code,
    name: meta.name,
    type: meta.type,
    active: false,
    status: 'logout',
    options: { sort: 'id', order: 'ASC' }
  }
}

export const usePluginMusic = defineStore(
  'pluginMusic',
  () => {
    const services = ref<service[]>([])
    const users = reactive<Record<service['code'], User>>({})

    const tracks = reactive<Record<service['code'], Track[]>>({})
    const albums = reactive<Record<service['code'], Album[]>>({})
    const artists = reactive<Record<service['code'], Artist[]>>({})
    const playlists = reactive<Record<service['code'], Playlist[]>>({})
    const mvs = reactive<Record<service['code'], any[]>>({})
    const likedTracks = reactive<Record<service['code'], Track[]>>({})
    const cloudDisks = reactive<Record<service['code'], Track[]>>({})
    const playHistory = reactive<Record<service['code'], { week: Track[]; all: Track[] }[]>>({})

    const additionalTags = reactive<Record<service['code'], PlaylistCatlist['static']>>({})

    const pluginIdSet = computed(() => {
      return new Set(services.value.map((s) => s.code))
    })

    const pluginMethodCall: PluginMethodCall = async (pluginId, methodName, ...args) => {
      try {
        if (!pluginIdSet.value.has(pluginId)) {
          throw new Error(`Invalid pluginId: ${pluginId}`)
        }

        const params = args[0] ?? {}

        const rawResult = await window.mainApi!.invoke('plugin-method-call', {
          pluginId,
          methodName,
          params
        })
        rawResult.pluginId = pluginId

        const schema = PluginResultSchema[methodName]
        if (!schema) {
          console.warn(`[pluginMethodCall] No schema defined for ${methodName}, skip validation`)
          return rawResult as unknown as PluginAPI[typeof methodName]['result']
        }

        const parsed = schema.safeParse(rawResult)
        if (parsed.success) {
          return parsed.data as unknown as PluginAPI[typeof methodName]['result']
        } else {
          console.log('[data] = ', rawResult)
          console.error(
            `[pluginMethodCall] Invalid return data for ${pluginId}.${methodName}:`,
            z.treeifyError(parsed.error)
          )
          return defaultMap[methodName] as PluginAPI[typeof methodName]['result']
        }
      } catch (error: any) {
        if (error?.message.includes('UNAUTHORIZED')) {
          await router.push(`/onlineMusic/login/${pluginId}`)
        }

        console.log(`[pluginMethodCall ${pluginId} ${methodName} ERROR]:`, error)
        return defaultMap[methodName] as unknown as PluginAPI[typeof methodName]['result']
      }
    }

    const uploadPlugin = async () => {
      window
        .mainApi!.invoke('upload-plugin')
        .then((result: { code: number; error?: string; message?: string }) => {
          console.log('===1===', result)
        })
    }

    const getPlugins = async () => {
      await window.mainApi
        ?.invoke('get-plugins')
        .then((result: Record<PluginId, { name: string; type: MusicType }>) => {
          for (const [code, meta] of Object.entries(result)) {
            const pluginId = code as PluginId
            if (!pluginIdSet.value.has(pluginId)) {
              const info = _buildService(pluginId, meta)
              services.value.push(info)
            }
          }
        })
      const active = services.value.find((item) => item.active)
      if (!active) {
        services.value.find((item) => item.code === 'netease')!.active = true
      }
    }

    return {
      services,
      tracks,
      albums,
      artists,
      playlists,
      likedTracks,
      playHistory,
      cloudDisks,
      mvs,
      additionalTags,
      users,
      pluginMethodCall,
      uploadPlugin,
      getPlugins
    }
  },
  {
    persist: { pick: ['additionalTags'] }
  }
)
