import z from 'zod'
import { defineStore } from 'pinia'
import { computed, reactive, ref, toRaw, watch } from 'vue'
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
  Album,
  Tool,
  Mv,
  ArtistCatlist,
  TrackCatlist,
  exploreTabList
} from '@/types/plugin'

const _buildService = (code: PluginId, meta: { name: string; type: MusicType }): service => {
  return {
    code,
    name: meta.name,
    type: meta.type,
    active: false,
    status: 'logout'
  }
}

export const usePluginMusic = defineStore(
  'pluginMusic',
  () => {
    const services = ref<service[]>([])
    const users = reactive<Record<PluginId, User>>({})

    const tracks = reactive<
      Record<PluginId, { data: Track[]; sourceContext: Record<string, any> }>
    >({})
    const albums = reactive<
      Record<PluginId, { data: Album[]; sourceContext: Record<string, any> }>
    >({})
    const artists = reactive<
      Record<PluginId, { data: Artist[]; sourceContext: Record<string, any> }>
    >({})
    const playlists = reactive<
      Record<
        PluginId,
        { liked: Playlist | null; data: Playlist[]; sourceContext: Record<string, any> }
      >
    >({})
    const mvs = reactive<Record<PluginId, { data: Mv[]; sourceContext: Record<string, any> }>>({})
    const likedTracks = reactive<
      Record<PluginId, { data: Track[]; sourceContext: Record<string, any> }>
    >({})
    const cloudDisks = reactive<
      Record<PluginId, { data: Track[]; sourceContext: Record<string, any> }>
    >({})
    const playHistory = reactive<Record<PluginId, { week: Track[]; all: Track[] }[]>>({})

    const tools = reactive<Record<service['type'], Tool>>({
      library: { groundBy: 'all', sortBy: 'id', orderBy: 'ASC', artistBy: 'artist' },
      stream: { groundBy: 'all', sortBy: 'id', orderBy: 'ASC', artistBy: 'artist' },
      local: { groundBy: 'all', sortBy: 'id', orderBy: 'ASC', artistBy: 'artist' }
    })

    const additionalTags = reactive<Record<PluginId, PlaylistCatlist['static']>>({})
    const activeCats = reactive<
      Record<
        PluginId,
        { playlist: string; album: string; track: string; artist: [string, string][] }
      >
    >({})

    const _playlistCategory = reactive<Record<PluginId, PlaylistCatlist>>({})
    const artistCategory = reactive<Record<PluginId, ArtistCatlist[]>>({})
    const albumCategory = reactive<Record<PluginId, TrackCatlist[]>>({})
    const trackCategory = reactive<Record<PluginId, TrackCatlist[]>>({})

    const playlistCategory = computed(() => {
      const data = Object.entries(_playlistCategory).map(([plugin, value]) => {
        const staticTag = toRaw(value.static).concat(
          (additionalTags[plugin as PluginId] || []).map((it) => ({ ...it, active: false }))
        )
        return [plugin, { static: staticTag, tagList: value.tagList }] as const
      })

      const result: Record<PluginId, PlaylistCatlist> = {}
      data.forEach(([key, value]) => {
        result[key as PluginId] = value
      })

      return result
    })

    const pluginIdSet = computed(() => {
      return new Set(services.value.map((s) => s.code))
    })

    const loggedInServices = computed(() =>
      services.value.filter((item) => item.status === 'login')
    )

    const pluginMethodCall: PluginMethodCall = async (pluginId, methodName, ...args) => {
      try {
        if (!pluginIdSet.value.has(pluginId)) {
          throw new Error(`Invalid pluginId: ${pluginId}`)
        }

        const params = args[0] ?? {}

        const rawResult = await window.mainApi!.invoke('plugin-method-call', {
          pluginId,
          methodName,
          params: JSON.parse(JSON.stringify(params))
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

        console.error(`[pluginMethodCall ${pluginId} ${methodName} ERROR]:`, error)
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
              _initPluginData(pluginId)
            }
            _initTempInfo(pluginId)
          }
        })
      const active = services.value.find((item) => item.active)
      if (!active) {
        services.value.find((item) => item.code === 'netease')!.active = true
      }
    }

    const _initPluginData = (pluginId: PluginId) => {
      tracks[pluginId] = { data: [], sourceContext: {} }
      albums[pluginId] = { data: [], sourceContext: {} }
      artists[pluginId] = { data: [], sourceContext: {} }
      playlists[pluginId] = { liked: null, data: [], sourceContext: {} }
      likedTracks[pluginId] = { data: [], sourceContext: {} }
      cloudDisks[pluginId] = { data: [], sourceContext: {} }
      mvs[pluginId] = { data: [], sourceContext: {} }

      if (!additionalTags[pluginId]) {
        additionalTags[pluginId] = []
      }
    }

    const _initTempInfo = (pluginId: PluginId) => {
      _playlistCategory[pluginId] = { static: [], tagList: [] }
      artistCategory[pluginId] = []
      albumCategory[pluginId] = []
      trackCategory[pluginId] = []
      if (!additionalTags[pluginId]) {
        additionalTags[pluginId] = []
      }
      if (!users[pluginId]) {
        users[pluginId] = { userId: '', nickname: '', avatarUrl: '', isVip: false, signature: '' }
      }
      activeCats[pluginId] = { playlist: '', track: '', album: '', artist: [] }
    }

    /**
     * - 由于部分插件的用户歌单和收藏的专辑在同一个接口，所以这里也在统一接口里进行请求.
     * - 返回数据为红心歌单、用户歌单、专辑
     */
    const fetchLikedPlaylists = (plugins: PluginId[], loadedMore: boolean = false) => {
      return Promise.all(
        plugins.map(async (item) => {
          if (!playlists[item]) playlists[item] = { liked: null, data: [], sourceContext: {} }
          if (!albums[item]) albums[item] = { data: [], sourceContext: {} }
          const result = await pluginMethodCall(
            item,
            'userPlaylist',
            loadedMore
              ? {
                  ...playlists[item].sourceContext
                }
              : {}
          )
          if (result.liked) {
            playlists[item].liked = { ...result.liked, pluginId: item }
          }
          if (result.playlists?.length) {
            if (loadedMore) {
              playlists[item].data.push(
                ...result.playlists.map((it) => ({ ...it, pluginId: item }))
              )
            } else {
              playlists[item].data = result.playlists.map((it) => ({ ...it, pluginId: item }))
            }

            playlists[item].sourceContext = result.sourceContext
          }
          if (result.albums.length) {
            if (loadedMore) {
              albums[item].data.push(
                ...result.albums.map((it) => ({
                  ...it,
                  artists: it.artists?.map((i) => ({ ...i, pluginId: item })),
                  pluginId: item
                }))
              )
            } else {
              albums[item].data = result.albums.map((it) => ({
                ...it,
                artists: it.artists?.map((i) => ({ ...i, pluginId: item })),
                pluginId: item
              }))
            }
            albums[item].sourceContext = result.sourceContext
          }
        })
      )
    }

    const getPlaylistDetail = async (plugin: PluginId, params: Record<string, any>) => {
      const result = await pluginMethodCall(plugin, 'getPlaylistDetail', params)
      if (!result?.data) return result
      result.data.pluginId = plugin
      result.data.tracks = result.data.tracks.map((track) => ({
        ...track,
        album: { ...track.album, pluginId: plugin },
        artists: track.artists.map((it) => ({ ...it, pluginId: plugin })),
        pluginId: plugin
      }))
      if (result.data.trackCount > result.data.tracks.length) {
        const res = await fetchPlaylistTracks(plugin, result.data.sourceContext)
        result.data.tracks.push(...res.data)
        result.data.sourceContext = res.sourceContext
      }
      return result
    }

    const fetchPlaylistTracks = async (plugin: PluginId, params: Record<string, any>) => {
      const result = await pluginMethodCall(plugin, 'getPlaylistTracks', { ...params })
      result.data = result.data.map((item) => ({
        ...item,
        album: { ...item.album, pluginId: plugin },
        artists: item.artists.map((it) => ({ ...it, pluginId: plugin })),
        pluginId: plugin
      }))
      return result
    }

    const fetchLikedSongsWithDetails = (plugins: PluginId[]) => {
      return Promise.all(
        plugins.map(async (item) => {
          if (!likedTracks[item]) {
            likedTracks[item] = { data: [], sourceContext: {} }
          }
          const plists = playlists[item].liked
          if (plists) {
            const result = await getPlaylistDetail(item, { ...plists.sourceContext })
            if (!result?.data) return
            likedTracks[item].data = result.data?.tracks ?? []
            likedTracks[item].sourceContext = result.data?.sourceContext ?? {}
          }
        })
      )
    }

    const fetchLikedArtists = (plugins: PluginId[], loadedMore: boolean = false) => {
      return Promise.all(
        plugins.map(async (item) => {
          if (!artists[item]) {
            artists[item] = { data: [], sourceContext: {} }
          }

          const result = await pluginMethodCall(
            item,
            'userLikedArtists',
            loadedMore
              ? {
                  ...artists[item].sourceContext
                }
              : {}
          )
          if (loadedMore) {
            artists[item].data.push(
              ...result.data.map((it) => ({
                ...it,
                pluginId: item
              }))
            )
          } else {
            artists[item].data = result.data.map((it) => ({
              ...it,
              pluginId: item
            }))
          }
          artists[item].sourceContext = result.sourceContext
        })
      )
    }

    const fetchLikedMVs = (plugins: PluginId[], loadedMore: boolean = false) => {
      return Promise.all(
        plugins.map(async (item) => {
          if (!mvs[item]) {
            mvs[item] = { data: [], sourceContext: {} }
          }

          const result = await pluginMethodCall(
            item,
            'userLikedMVs',
            loadedMore
              ? {
                  ...mvs[item].sourceContext
                }
              : {}
          )
          if (loadedMore) {
            mvs[item].data.push(
              ...result.data.map((it) => ({
                ...it,
                pluginId: item,
                artists: it.artists.map((i) => ({ ...i, pluginId: item }))
              }))
            )
          } else {
            mvs[item].data = result.data.map((it) => ({
              ...it,
              pluginId: item,
              artists: it.artists.map((i) => ({ ...i, pluginId: item }))
            }))
          }

          mvs[item].sourceContext = result.sourceContext
        })
      )
    }

    const fetchCloudDisk = (plugins: PluginId[], loadedMore: boolean = false) => {
      return Promise.all(
        plugins.map(async (item) => {
          if (!cloudDisks[item]) {
            cloudDisks[item] = { data: [], sourceContext: {} }
          }

          const result = await pluginMethodCall(
            item,
            'cloudDisk',
            loadedMore
              ? {
                  ...cloudDisks[item].sourceContext
                }
              : {}
          )
          if (loadedMore) {
            cloudDisks[item].data.push(
              ...result.data.map((it) => ({
                ...it,
                pluginId: item,
                album: { ...it.album, pluginId: item },
                artists: it.artists.map((i) => ({ ...i, pluginId: item }))
              }))
            )
          } else {
            cloudDisks[item].data = result.data.map((it) => ({
              ...it,
              pluginId: item,
              album: { ...it.album, pluginId: item },
              artists: it.artists.map((i) => ({ ...i, pluginId: item }))
            }))
          }
          cloudDisks[item].sourceContext = result.sourceContext
        })
      )
    }

    const fetchLyric = async (plugin: PluginId, sourceContext: Record<string, any>) => {
      return pluginMethodCall(plugin, 'getLyric', { ...sourceContext }).then((result) => {
        if (result.code === 200) return result.data
        return []
      })
    }

    const resizeImage = async (plugin: PluginId, pic: string, size: number) => {
      const result = await pluginMethodCall(plugin, 'resizePicUrl', { url: pic, size })
      return result.data
    }

    const likeATrack = async (track: Track) => {
      const plugin = track.pluginId
      const playlist = playlists[plugin].liked

      const idx = likedTracks[plugin].data.findIndex((item) => String(item.id) === String(track.id))
      const op = idx === -1 ? 'add' : 'del'

      pluginMethodCall(plugin, 'likeATrack', {
        op,
        playlist: playlist?.sourceContext || {},
        tracks: [track.sourceContext]
      }).then((res) => {
        if (res.code === 200) {
          if (op === 'add') {
            likedTracks[plugin]!.data.unshift(track)
          } else {
            likedTracks[plugin!].data.splice(idx, 1)
          }
        }
      })
    }

    const isAccountLoggedIn = (plugin: PluginId) => {
      const user = users[plugin]?.userId
      return !!user
    }

    const _getPlaylistCategory = (plugin: PluginId) =>
      pluginMethodCall(plugin, 'catlist').then((result) => {
        if (!result.data) return
        _playlistCategory[plugin].static = result.data.static
        _playlistCategory[plugin].tagList = result.data.tagList
        activeCats[plugin].playlist = result.data.static[0].name
      })

    const _getArtistCategory = (plugin: PluginId) =>
      pluginMethodCall(plugin, 'getArtistCatlist').then((result) => {
        if (!result.data) return
        artistCategory[plugin] = result.data
        activeCats[plugin].artist = result.data.map((it) => [it.name, it.sub[0].name])
      })

    const _getAlbumCategory = (plugin: PluginId) =>
      pluginMethodCall(plugin, 'getAlbumCatlist').then((result) => {
        if (!result.data) return
        albumCategory[plugin] = result.data
        activeCats[plugin].album = result.data[0].name
      })

    const _getTrackCategory = (plugin: PluginId) =>
      pluginMethodCall(plugin, 'getTrackCatlist').then((result) => {
        if (!result.data) return
        trackCategory[plugin] = result.data
        activeCats[plugin].track = result.data[0].name
      })

    const getExploreBtn = async (plugin: PluginId) => {
      await Promise.all(
        exploreTabList.map((tab) => {
          const map = {
            playlist: _getPlaylistCategory,
            artist: _getArtistCategory,
            newTrack: _getTrackCategory,
            newAlbum: _getAlbumCategory
          }
          map[tab]?.(plugin)
        })
      )
    }

    watch(
      services,
      async (value) => {
        const plugin = value.find((service) => service.active)?.code
        if (plugin) {
          await getExploreBtn(plugin)
        }
      },
      { immediate: true }
    )

    return {
      tools,
      services,
      loggedInServices,
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

      playlistCategory,
      artistCategory,
      albumCategory,
      trackCategory,
      activeCats,

      getExploreBtn,
      likeATrack,
      fetchLyric,
      resizeImage,
      pluginMethodCall,
      getPlaylistDetail,
      isAccountLoggedIn,
      uploadPlugin,
      getPlugins,
      fetchLikedMVs,
      fetchCloudDisk,
      fetchLikedArtists,
      fetchLikedPlaylists,
      fetchPlaylistTracks,
      fetchLikedSongsWithDetails
    }
  },
  {
    persist: {
      pick: ['services', 'additionalTags', 'users', 'tools']
    }
  }
)
