<template>
  <div v-show="show" class="search-page">
    <div class="info">
      <span class="title">{{ keywords }}</span>
      <span class="sub-title">找到 {{ displayCount }} {{ tagMap[searchTab] }}</span>
    </div>
    <div v-if="searchTab === 'tracks'" class="container">
      <TrackList
        :items="displayData"
        :colunm-number="1"
        :plugin="plugin"
        :source-context="{ id: 'search' }"
        :show-service="true"
        :load-more="() => loadData(false)"
        :type="'Playlist'"
        :is-end="true"
      />
    </div>
    <div v-else-if="searchTab === 'mvs'" class="container">
      <MvRow
        :mvs="displayData"
        :is-end="true"
        :column-number="5"
        :load-more="() => loadData(false)"
      />
    </div>
    <div v-else class="container">
      <CoverRow
        :items="displayData"
        :type="typeMap[searchTab]"
        :item-height="260"
        :colunm-number="5"
        :sub-text="'artist'"
        :load-more="() => loadData(false)"
        :is-end="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch, inject, nextTick, onBeforeUnmount } from 'vue'
import { useNormalStateStore } from '../store/state'
import { usePluginMusic } from '../store/pluginMusic'
import { useRoute, onBeforeRouteUpdate } from 'vue-router'
import { storeToRefs } from 'pinia'
import TrackList from '../components/VirtualTrackList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import MvRow from '../components/MvRow.vue'
import { PluginId, STREAM_SENTINEL } from '@/types/schemas'
import { Album, Artist, Mv, Playlist, Track, SearchTab } from '@/types/plugin'

const show = ref(false)
const keywords = ref('')
const plugin = ref('' as PluginId)
const tagMap = {
  tracks: '首歌曲',
  albums: '张专辑',
  artists: '位歌手',
  playlists: '个歌单',
  mvs: '个视频'
}

const pluginStore = usePluginMusic()
const { services } = storeToRefs(pluginStore)

const tracks = reactive<
  Record<PluginId, { data: Track[]; count: number; sourceContext: Record<string, any> }>
>(
  Object.fromEntries(services.value.map((s) => [s.code, { data: [], count: 0, sourceContext: {} }]))
)

const albums = reactive<
  Record<PluginId, { data: Album[]; count: number; sourceContext: Record<string, any> }>
>(
  Object.fromEntries(services.value.map((s) => [s.code, { data: [], count: 0, sourceContext: {} }]))
)

const artists = reactive<
  Record<PluginId, { data: Artist[]; count: number; sourceContext: Record<string, any> }>
>(
  Object.fromEntries(services.value.map((s) => [s.code, { data: [], count: 0, sourceContext: {} }]))
)

const playlists = reactive<
  Record<PluginId, { data: Playlist[]; count: number; sourceContext: Record<string, any> }>
>(
  Object.fromEntries(services.value.map((s) => [s.code, { data: [], count: 0, sourceContext: {} }]))
)

const mvs = reactive<
  Record<PluginId, { data: Mv[]; count: number; sourceContext: Record<string, any> }>
>(
  Object.fromEntries(services.value.map((s) => [s.code, { data: [], count: 0, sourceContext: {} }]))
)

const searchResult = { tracks, albums, artists, playlists, mvs }
type SearchSlot<T> = { data: T[]; count: number; sourceContext: Record<string, any> }

/**
 * 结果槽位按需创建：services 可能在组件挂载后才加载完成，
 * 也可能收到一个已失效的 pluginId，此时不能假设槽位一定存在。
 */
const ensureSlot = (tab: SearchTab, pluginId: PluginId): SearchSlot<any> => {
  const bucket = searchResult[tab] as Record<PluginId, SearchSlot<any>>
  if (!bucket[pluginId]) {
    bucket[pluginId] = { data: [], count: 0, sourceContext: {} }
  }
  return bucket[pluginId]
}

const { searchTab } = storeToRefs(useNormalStateStore())
const { pluginMethodCall } = pluginStore
const route = useRoute()
const typeMap = {
  tracks: 'Playlist',
  albums: 'Album',
  artists: 'Artist',
  playlists: 'Playlist',
  mvs: 'Mv'
} as const

// stream 搜索时：从所有已登录 stream 插件的 per-plugin 槽位实时展平
const displayData = computed<any[]>(() => {
  const currentService = services.value.find((s) => s.code === plugin.value)
  const isStream = plugin.value === STREAM_SENTINEL || currentService?.type === 'stream'
  if (!isStream) {
    if (searchTab.value === 'tracks') return tracks[plugin.value]?.data || []
    if (searchTab.value === 'albums') return albums[plugin.value]?.data || []
    if (searchTab.value === 'artists') return artists[plugin.value]?.data || []
    if (searchTab.value === 'playlists') return playlists[plugin.value]?.data || []
    if (searchTab.value === 'mvs') return mvs[plugin.value]?.data || []
    return []
  }
  const streamTargets = services.value
    .filter((s) => s.type === 'stream' && s.status === 'login')
    .map((s) => s.code)
  if (searchTab.value === 'tracks') return streamTargets.flatMap((p) => tracks[p]?.data || [])
  if (searchTab.value === 'albums') return streamTargets.flatMap((p) => albums[p]?.data || [])
  if (searchTab.value === 'artists') return streamTargets.flatMap((p) => artists[p]?.data || [])
  if (searchTab.value === 'playlists') return streamTargets.flatMap((p) => playlists[p]?.data || [])
  if (searchTab.value === 'mvs') return streamTargets.flatMap((p) => mvs[p]?.data || [])
  return []
})

const displayCount = computed(() => {
  const currentService = services.value.find((s) => s.code === plugin.value)
  const isStream = plugin.value === STREAM_SENTINEL || currentService?.type === 'stream'
  if (!isStream) {
    return searchResult[searchTab.value][plugin.value]?.count || 0
  }
  const streamTargets = services.value
    .filter((s) => s.type === 'stream' && s.status === 'login')
    .map((s) => s.code)
  return streamTargets.reduce((sum, p) => sum + (searchResult[searchTab.value][p]?.count || 0), 0)
})

const resolveSearchPlugin = (raw?: unknown): PluginId => {
  const requested = typeof raw === 'string' ? (raw as PluginId) : undefined
  if (requested === STREAM_SENTINEL) return STREAM_SENTINEL
  // 兼容旧链接：允许直接指定某个 library/stream 插件
  if (
    services.value.some(
      (s) => s.code === requested && (s.type === 'library' || s.type === 'stream')
    )
  ) {
    return requested as PluginId
  }
  const libraryServices = services.value.filter((s) => s.type === 'library')
  return libraryServices.find((s) => s.active)?.code ?? libraryServices[0]?.code ?? STREAM_SENTINEL
}

const loadData = async (reset = true) => {
  const currentPlugin = plugin.value
  const currentTab = searchTab.value

  // 判断当前插件类型，stream 则向所有已登录的 stream 插件搜索
  const currentService = services.value.find((s) => s.code === currentPlugin)
  const isStream = currentPlugin === STREAM_SENTINEL || currentService?.type === 'stream'
  let targets: PluginId[] = [currentPlugin]
  if (isStream) {
    targets = services.value
      .filter((s) => s.type === 'stream' && s.status === 'login')
      .map((s) => s.code)
  }

  // sentinel 不是真实插件；没有已登录的流媒体时不应发起请求
  targets = targets.filter((p) => p !== STREAM_SENTINEL && services.value.some((s) => s.code === p))

  if (!targets.length || !keywords.value) {
    show.value = true
    return
  }

  try {
    // 重置所有目标槽位
    if (reset) {
      targets.forEach((p) => {
        const slot = ensureSlot(currentTab, p)
        slot.data = []
        slot.count = 0
      })
    }

    // 并行搜索所有目标
    const results = await Promise.all(
      targets.map(async (p) => {
        // 只有加载更多才带插件返回的分页上下文。重新搜索时若把它一起展开，
        // 上下文里的旧字段会覆盖本次请求：netease 的 sourceContext 就带着
        // `keywords`，导致「标题是新关键词、结果还是上一次的」（issue #431）。
        // 同时把本次参数放在后面，任何插件的上下文都不能改写 tab/keywords/reset。
        const sourceContext = reset ? {} : ensureSlot(currentTab, p).sourceContext || {}
        const res = await pluginMethodCall(p, 'search', {
          ...sourceContext,
          tab: currentTab,
          keywords: keywords.value,
          reset
        })
        return { plugin: p, res }
      })
    )

    // 处理每个结果，存入 per-plugin 槽位
    for (const { plugin: p, res } of results) {
      const slot = ensureSlot(currentTab, p)
      slot.count = res.count
      slot.sourceContext = res.sourceContext

      switch (currentTab) {
        case 'tracks': {
          const data = (res.data as Track[]).map((item) => ({
            ...item,
            pluginId: p,
            album: { ...item.album, pluginId: p },
            artists: item.artists.map((it) => ({ ...it, pluginId: p })),
            albumArtists: item.albumArtists.map((it) => ({ ...it, pluginId: p }))
          }))
          slot.data.push(...data)
          break
        }
        case 'albums': {
          const data = (res.data as Album[]).map((item) => ({
            ...item,
            artists: item.artists?.map((it) => ({
              ...it,
              pluginId: p
            })),
            pluginId: p
          }))
          slot.data.push(...data)
          break
        }
        case 'artists': {
          const data = (res.data as Artist[]).map((item) => ({
            ...item,
            pluginId: p
          }))
          slot.data.push(...data)
          break
        }
        case 'playlists': {
          const data = (res.data as Playlist[]).map((item) => ({
            ...item,
            pluginId: p,
            creator: { ...item.creator, pluginId: p }
          }))
          slot.data.push(...data)
          break
        }
        case 'mvs': {
          const data = (res.data as Mv[]).map((item) => ({
            ...item,
            pluginId: p,
            artists: item.artists?.map((it) => ({
              ...it,
              pluginId: p
            }))
          }))
          slot.data.push(...data)
          break
        }
        default:
          break
      }
    }
  } catch (error) {
    console.error('[SearchPage] 搜索失败:', error)
  } finally {
    show.value = true
  }
}

const updatePadding = inject('updatePadding') as (value: number) => void

watch(searchTab, () => {
  if (!keywords.value) return
  show.value = false
  loadData()
  nextTick(() => {
    updatePadding(0)
  })
})

onBeforeRouteUpdate((to, from, next) => {
  show.value = false
  keywords.value = (to.query.keywords as string) || ''
  plugin.value = resolveSearchPlugin(to.query.plugin)

  if (keywords.value) loadData()
  else show.value = true
  next()
})

onMounted(() => {
  updatePadding(0)
  plugin.value = resolveSearchPlugin(route.query.plugin)
  keywords.value = (route.query.keywords as string) || ''
  if (keywords.value) loadData()
  else show.value = true
})

onBeforeUnmount(() => {
  updatePadding(96)
})
</script>

<style scoped lang="scss">
.info {
  display: -webkit-box;
  .title {
    font-size: 30px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub-title {
    margin-left: 14px;
    opacity: 0.7;
  }
}
.container {
  margin-top: 20px;
}
</style>
