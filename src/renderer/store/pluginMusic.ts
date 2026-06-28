import z from 'zod'
import { defineStore } from 'pinia'
import { computed, reactive, ref, toRaw, watch, readonly } from 'vue'
import { PluginResultSchema } from '@/types/schemas'
import { useNormalStateStore } from './state'
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

const _buildService = (
  code: PluginId,
  meta: {
    name: string
    type: MusicType
    icon?: string
    capabilities?: service['capabilities']
    builtIn?: boolean
  }
): service => {
  return {
    code,
    name: meta.name,
    icon: meta.icon,
    type: meta.type,
    active: false,
    status: 'logout',
    loadFull: meta.type !== 'library',
    capabilities: meta.capabilities,
    builtIn: meta.builtIn
  }
}

export const usePluginMusic = defineStore(
  'pluginMusic',
  () => {
    const { showToast } = useNormalStateStore()
    const scanDir = ref<string[]>([])
    const scanning = ref(false)
    const services = ref<service[]>([])
    const users = reactive<Record<PluginId, User>>({})

    const enableLibrary = ref(true)
    const enableStream = ref(true)
    const enableLocal = ref(true)

    const tracks = reactive<
      Record<PluginId, { data: Track[]; count: number; sourceContext: Record<string, any> }>
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
    const playHistory = reactive<Record<PluginId, { week: Track[]; all: Track[] }>>({})
    const _pagePerPlugin = reactive<Record<PluginId, number>>({})

    const tools = reactive<Record<service['type'], Tool>>({
      library: {
        groundBy: 'all',
        sortBy: 'name',
        orderBy: 'ASC',
        artistBy: 'artists',
        pageSize: 500
      },
      stream: {
        groundBy: 'all',
        sortBy: 'name',
        orderBy: 'ASC',
        artistBy: 'artists',
        pageSize: 1000
      },
      local: { groundBy: 'all', sortBy: 'name', orderBy: 'ASC', artistBy: 'artists', pageSize: 0 }
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
        if (!rawResult || typeof rawResult !== 'object') {
          return defaultMap[methodName] as PluginAPI[typeof methodName]['result']
        }
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
        if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
          const service = services.value.find((item) => item.code === pluginId)
          if (service) service.status = 'logout'
          console.log(`${pluginId} UNAUTHORIZED`)
          showToast(`${pluginId} UNAUTHORIZED`)
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
      await window.mainApi?.invoke('get-plugins').then(
        (
          result: Record<
            PluginId,
            {
              name: string
              icon: string
              type: MusicType
              capabilities?: service['capabilities']
              builtIn?: boolean
            }
          >
        ) => {
          for (const [code, meta] of Object.entries(result)) {
            const pluginId = code as PluginId
            const existing = services.value.find((s) => s.code === pluginId)

            if (existing) {
              // 已存在：同步字段，保留用户状态
              existing.name = meta.name
              existing.icon = meta.icon
              existing.type = meta.type
              existing.capabilities = meta.capabilities
              existing.builtIn = meta.builtIn
              // active, status, loadFull 保持不变（用户运行时状态）
            } else {
              // 新插件：创建完整对象
              const info = _buildService(pluginId, meta)
              services.value.push(info)
              _initPluginData(pluginId)
            }
            _initTempInfo(pluginId)
          }
        }
      )

      const typeOrder = {
        library: 0,
        stream: 1,
        local: 2
      }

      services.value.sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
      const active = services.value.find((item) => item.active)
      if (!active) {
        const fallback = services.value.find(
          (item) =>
            (item.type === 'library' && enableLibrary.value) ||
            (item.type === 'stream' && enableStream.value) ||
            (item.type === 'local' && enableLocal.value)
        )
        if (fallback) fallback.active = true
        else services.value.find((item) => item.code === 'netease')!.active = true
      }
    }

    const _initPluginData = (pluginId: PluginId) => {
      tracks[pluginId] = { data: [], count: 0, sourceContext: {} }
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
    const fetchLikedPlaylists = async (item: PluginId, loadedMore: boolean = false) => {
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

      if (!loadedMore) {
        playlists[item].data = []
        albums[item].data = []
      }

      playlists[item].data.push(...result.playlists.map((it) => ({ ...it, pluginId: item })))
      playlists[item].sourceContext = { ...playlists[item].sourceContext, ...result.sourceContext }

      albums[item].data.push(
        ...result.albums.map((it) => ({
          ...it,
          artists: it.artists?.map((i) => ({ ...i, pluginId: item })),
          pluginId: item
        }))
      )
      albums[item].sourceContext = { ...albums[item].sourceContext, ...result.sourceContext }
    }

    const getPlaylistDetail = async (plugin: PluginId, params: Record<string, any>) => {
      const result = await pluginMethodCall(plugin, 'getPlaylistDetail', params)
      if (!result?.data) return result
      result.data.pluginId = plugin
      result.data.tracks = result.data.tracks.map((track) => ({
        ...track,
        album: { ...track.album, pluginId: plugin },
        artists: track.artists.map((it) => ({ ...it, pluginId: plugin })),
        albumArtists: track.albumArtists.map((it) => ({ ...it, pluginId: plugin })),
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
        albumArtists: item.albumArtists.map((it) => ({ ...it, pluginId: plugin })),
        pluginId: plugin
      }))
      return result
    }

    const fetchLikedSongsWithDetails = async (item: PluginId) => {
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
    }

    const fetchLikedArtists = async (item: PluginId, loadedMore: boolean = false) => {
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
    }

    const fetchAllTracks = async (item: PluginId, reset = false) => {
      const plugin = services.value.find((it) => it.code === item)
      if (!plugin || plugin.type === 'library') return
      if (!tracks[item]) tracks[item] = { data: [], count: 0, sourceContext: {} }

      const tool = tools[plugin.type]
      const pluginTracks = tracks[item]

      if (reset) {
        pluginTracks.data = []
      }

      const loadTracks = async () => {
        const result = await pluginMethodCall(item, 'getAllTracks', {
          ...pluginTracks.sourceContext,
          sort: tool.sortBy,
          order: tool.orderBy,
          pageSize: tool.pageSize || 1000,
          ...(reset && { reset: true })
        })
        const prevLength = pluginTracks.data.length
        pluginTracks.data.push(
          ...result.data.map((_item) => ({
            ..._item,
            album: { ..._item.album, pluginId: item },
            artists: _item.artists.map((it) => ({ ...it, pluginId: item })),
            albumArtists: _item.albumArtists.map((it) => ({ ...it, pluginId: item })),
            pluginId: item
          }))
        )
        // 首次加载后记录 page（实际返回数量）
        if (prevLength === 0 && result.data.length > 0) {
          _pagePerPlugin[item] = 0
        }
        pluginTracks.count = result.data.length ? result.count : pluginTracks.data.length
        pluginTracks.sourceContext = {
          ...result.sourceContext,
          hasMore: pluginTracks.count > pluginTracks.data.length
        }
      }

      const backgroundSync = async () => {
        try {
          while (plugin.loadFull && pluginTracks.count > pluginTracks.data.length) {
            await loadTracks()
          }
        } catch (err) {
          console.log(err)
        }
      }

      await loadTracks()

      if (plugin.loadFull && pluginTracks.count > pluginTracks.data.length) {
        backgroundSync()
      }
    }

    const loadTrackPage = async (pluginId: PluginId, page: number) => {
      const plugin = services.value.find((it) => it.code === pluginId)
      if (!plugin || plugin.type === 'library') return
      if (!tracks[pluginId]) tracks[pluginId] = { data: [], count: 0, sourceContext: {} }

      const pluginTracks = tracks[pluginId]
      const tool = tools[plugin.type]

      // 计算偏移量：同时传 _start（navidrome 风格）和 page（emby/jellyfin 风格）
      // 每个插件只取自己需要的字段。
      const pageSize = tool.pageSize || 1000
      const _start = page * pageSize
      const params: Record<string, any> = {
        _start,
        page,
        sort: tool.sortBy,
        order: tool.orderBy,
        pageSize
      }

      const result = await pluginMethodCall(pluginId, 'getAllTracks', params)

      pluginTracks.data = result.data.map((_item) => ({
        ..._item,
        album: { ..._item.album, pluginId },
        artists: _item.artists.map((it) => ({ ...it, pluginId })),
        albumArtists: _item.albumArtists.map((it) => ({ ...it, pluginId })),
        pluginId
      }))
      pluginTracks.count = result.data.length ? result.count : pluginTracks.data.length
      pluginTracks.sourceContext = result.sourceContext || {}
      _pagePerPlugin[pluginId] = page
    }

    const fetchLikedMVs = async (item: PluginId, loadedMore: boolean = false) => {
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
    }

    const fetchCloudDisk = async (item: PluginId, loadedMore: boolean = false) => {
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
            artists: it.artists.map((i) => ({ ...i, pluginId: item })),
            albumArtists: it.albumArtists.map((it) => ({ ...it, pluginId: item }))
          }))
        )
      } else {
        cloudDisks[item].data = result.data.map((it) => ({
          ...it,
          pluginId: item,
          album: { ...it.album, pluginId: item },
          artists: it.artists.map((i) => ({ ...i, pluginId: item })),
          albumArtists: it.albumArtists.map((i) => ({ ...i, pluginId: item }))
        }))
      }
      cloudDisks[item].sourceContext = result.sourceContext
    }

    const fetchPlayHistory = async (item: PluginId) => {
      if (!playHistory[item]) {
        playHistory[item] = { week: [], all: [] }
      }

      const result = await pluginMethodCall(item, 'userRecord', {})

      if (result.code === 200) {
        const injectPluginId = (tracks: Track[]) =>
          tracks.map((track) => ({
            ...track,
            album: { ...track.album, pluginId: item },
            artists: track.artists.map((it) => ({ ...it, pluginId: item })),
            albumArtists: track.albumArtists.map((it) => ({ ...it, pluginId: item })),
            pluginId: item
          }))

        playHistory[item] = {
          week: injectPluginId(result.weekData),
          all: injectPluginId(result.allData)
        }
      }

      return result
    }

    const fetchLyric = async (track: Track) => {
      const res = await window.mainApi?.invoke('plugin-lyric', {
        pluginId: track.pluginId,
        sourceContext: { rawCtx: JSON.parse(JSON.stringify(track.sourceContext || {})) }
      })
      if (res?.code === 200 && res.data?.length) return res.data
      return []
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
      const service = services.value.find((s) => s.code === plugin)
      if (!service) return false

      const hasUser = !!users[plugin]?.userId
      const isLogin = service.status === 'login'

      return hasUser && isLogin
    }

    const handleStatusChange = (pluginId: PluginId, status: 'login' | 'logout' | 'offline') => {
      const service = services.value.find((s) => s.code === pluginId)
      if (!service) return

      service.status = status

      if (status === 'logout') {
        delete users[pluginId]
      }
    }

    const createPluginInstance = async (
      basePluginId: PluginId,
      name: string
    ): Promise<PluginId | null> => {
      const result = await window.mainApi?.invoke('create-plugin-instance', {
        basePluginId,
        name
      })
      if (result?.success && result.id && result.plugin) {
        const pluginId = result.id as PluginId
        if (!pluginIdSet.value.has(pluginId)) {
          const info = _buildService(pluginId, result.plugin)
          services.value.push(info)
          _initPluginData(pluginId)
          _initTempInfo(pluginId)
        }
        return pluginId
      }
      return null
    }

    const deletePluginInstance = async (pluginId: PluginId): Promise<boolean> => {
      const result = await window.mainApi?.invoke('delete-plugin-instance', pluginId)
      if (result?.success) {
        const idx = services.value.findIndex((s) => s.code === pluginId)
        if (idx !== -1) services.value.splice(idx, 1)
        delete tracks[pluginId]
        delete albums[pluginId]
        delete artists[pluginId]
        delete playlists[pluginId]
        delete likedTracks[pluginId]
        delete cloudDisks[pluginId]
        delete mvs[pluginId]
        delete users[pluginId]
        return true
      }
      return false
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
          return map[tab]?.(plugin)
        })
      )
    }

    const getPluginName = (plugin: PluginId) => {
      const service = services.value.find((it) => it.code === plugin)
      return service?.name || ''
    }

    const scanLocalMusic = async () => {
      window.mainApi?.send('clearDeletedMusic')
      if (!scanDir.value.length) return
      const existResults = (await window.mainApi?.invoke(
        'msgCheckFileExist',
        toRaw(scanDir.value)
      )) as {
        path: string
        exist: boolean
      }[]
      const validDirs = existResults.filter((item) => item.exist).map((item) => item.path)
      if (!validDirs.length) return
      scanning.value = true

      const localService = services.value.find((s) => s.type === 'local')
      const cb = localService?.status === 'login' && enableLocal.value

      window.mainApi?.send('msgScanLocalMusic', {
        filePath: validDirs,
        cb
      })
    }

    watch(
      services,
      async (value) => {
        const service = value.find((service) => service.active)
        if (service && service.type === 'library') {
          await getExploreBtn(service.code)
        }
      },
      { immediate: true }
    )

    watch(scanDir, () => {
      scanLocalMusic()
    })

    const _syncToMain = () => {
      window.mainApi?.send('setPluginEnable', {
        enableLibrary: enableLibrary.value,
        enableStream: enableStream.value,
        enableLocal: enableLocal.value
      })
    }

    // 当前活跃服务类型被禁用时，降级到第一个可用的替代服务
    const _fallbackActiveService = () => {
      const activeService = services.value.find((s) => s.active)
      if (!activeService) return

      const disabled =
        (activeService.type === 'library' && !enableLibrary.value) ||
        (activeService.type === 'stream' && !enableStream.value) ||
        (activeService.type === 'local' && !enableLocal.value)
      if (!disabled) return

      const fallbackType = enableLibrary.value
        ? 'library'
        : enableStream.value
          ? 'stream'
          : enableLocal.value
            ? 'local'
            : null
      if (!fallbackType) return

      const fallback = services.value.find((s) => s.type === fallbackType)
      if (fallback) {
        activeService.active = false
        fallback.active = true
      }
    }

    // 高优先级类型重新启用时，自动切换到该类型
    const _applyReenablePriority = (oldVals: any[], newVals: any[]) => {
      const activeService = services.value.find((s) => s.active)
      if (!activeService) return

      const typePriority: Record<string, number> = { library: 0, stream: 1, local: 2 }
      const [newLib, newStr, newLoc] = newVals
      const [oldLib, oldStr, oldLoc] = oldVals

      const reenabled: string[] = []
      if (!oldLib && newLib) reenabled.push('library')
      if (!oldStr && newStr) reenabled.push('stream')
      if (!oldLoc && newLoc) reenabled.push('local')
      if (reenabled.length === 0) return

      const highestReenabled = reenabled.sort((a, b) => typePriority[a] - typePriority[b])[0]
      if (typePriority[highestReenabled] >= (typePriority[activeService.type] ?? 99)) return

      const target = services.value.find((s) => s.type === highestReenabled)
      if (target) {
        activeService.active = false
        target.active = true
      }
    }

    watch([enableLibrary, enableStream, enableLocal], (newVals, oldVals) => {
      _syncToMain()

      const [newLib, newStr, newLoc] = newVals as boolean[]
      const [oldLib, oldStr, oldLoc] = oldVals as boolean[]

      const anyDisabled = (oldLib && !newLib) || (oldStr && !newStr) || (oldLoc && !newLoc)
      const anyReenabled = (!oldLib && newLib) || (!oldStr && newStr) || (!oldLoc && newLoc)

      if (anyDisabled) {
        _fallbackActiveService()
      } else if (anyReenabled) {
        _applyReenablePriority(oldVals, newVals)
      }
    })

    // IPC 监听：扫描进度和完成
    const _registerScanListeners = () => {
      window.mainApi?.on(
        'scanLocalMusicProgress',
        (
          _: any,
          data: {
            newTracks: number
          }
        ) => {
          const plugin = services.value.find((item) => item.type === 'local')
          if (!plugin) return
          const key = plugin.code
          if (tracks[key]) tracks[key].count += data.newTracks
        }
      )

      window.mainApi?.on('scanLocalMusicDone', async () => {
        scanning.value = false
        showToast('scanLocalMusicDone')
        const key = 'local' as PluginId
        if (tracks[key]) {
          tracks[key].data = []
          tracks[key].count = 0
        }
        if (albums[key]) {
          albums[key].data = []
        }
        if (artists[key]) {
          artists[key].data = []
        }
        await fetchAllTracks(key)
      })
    }
    _registerScanListeners()

    return {
      scanDir,
      scanning,
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
      _pagePerPlugin: readonly(_pagePerPlugin),

      enableLibrary,
      enableStream,
      enableLocal,

      playlistCategory,
      artistCategory,
      albumCategory,
      trackCategory,
      activeCats,

      getExploreBtn,
      getPluginName,
      likeATrack,
      fetchLyric,
      resizeImage,
      pluginMethodCall,
      getPlaylistDetail,
      isAccountLoggedIn,
      handleStatusChange,
      createPluginInstance,
      deletePluginInstance,
      uploadPlugin,
      scanLocalMusic,
      getPlugins,
      fetchLikedMVs,
      fetchCloudDisk,
      fetchPlayHistory,
      fetchAllTracks,
      loadTrackPage,
      fetchLikedArtists,
      fetchLikedPlaylists,
      fetchPlaylistTracks,
      fetchLikedSongsWithDetails,

      syncPluginEnable: _syncToMain
    }
  },
  {
    persist: {
      pick: [
        'services',
        'additionalTags',
        'users',
        'tools',
        'scanDir',
        'enableLibrary',
        'enableStream',
        'enableLocal'
      ]
    }
  }
)
