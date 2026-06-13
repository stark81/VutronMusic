<template>
  <div v-show="show" class="search-page">
    <div class="info">
      <span class="title">{{ keywords }}</span>
      <span class="sub-title"
        >找到 {{ searchResult[searchTab][plugin]?.count }} {{ tagMap[searchTab] }}</span
      >
    </div>
    <div v-if="searchTab === 'tracks'" class="container">
      <TrackList
        :items="tracks[plugin]?.data || []"
        :colunm-number="1"
        :plugin="plugin"
        :source-context="{}"
        :show-service="true"
        :load-more="() => loadData(false)"
        :type="'Playlist'"
        :is-end="true"
      />
    </div>
    <div v-else-if="searchTab === 'lyrics'" class="container">
      <TrackList
        :items="[]"
        :plugin="plugin"
        :source-context="{}"
        :colunm-number="1"
        :item-height="152.5"
        :is-lyric="true"
        :load-more="() => loadData(false)"
        :type="'Playlist'"
        :is-end="true"
      />
    </div>
    <div v-else-if="searchTab === 'mvs'" class="container">
      <MvRow
        :mvs="searchResult['mvs'][plugin]?.data || []"
        :is-end="true"
        :column-number="5"
        :load-more="() => loadData(false)"
      />
    </div>
    <div v-else class="container">
      <CoverRow
        :items="searchResult[searchTab][plugin]?.data || []"
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
import { ref, onMounted, reactive, watch, inject, nextTick, onBeforeUnmount } from 'vue'
import { useNormalStateStore } from '../store/state'
import { usePluginMusic } from '../store/pluginMusic'
import { useRoute, onBeforeRouteUpdate } from 'vue-router'
import { storeToRefs } from 'pinia'
import TrackList from '../components/VirtualTrackList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import MvRow from '../components/MvRow.vue'
import { PluginId } from '@/types/schemas'
import { Album, Artist, LyricLine, Mv, Playlist, Track } from '@/types/plugin'

const show = ref(false)
const keywords = ref('')
const plugin = ref('' as PluginId)
const tagMap = {
  tracks: '首歌曲',
  albums: '张专辑',
  artists: '位歌手',
  playlists: '个歌单',
  mvs: '个视频',
  lyrics: '个歌词'
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

const lyrics = reactive<
  Record<PluginId, { data: LyricLine[]; count: number; sourceContext: Record<string, any> }>
>(
  Object.fromEntries(services.value.map((s) => [s.code, { data: [], count: 0, sourceContext: {} }]))
)

const searchResult = { tracks, albums, artists, playlists, mvs, lyrics }
const { searchTab } = storeToRefs(useNormalStateStore())
const { pluginMethodCall } = pluginStore
const route = useRoute()
const typeMap = {
  tracks: 'Playlist',
  albums: 'Album',
  artists: 'Artist',
  playlists: 'Playlist',
  mvs: 'Mv',
  lyrics: 'Lyric'
} as const

const loadData = async (reset = true) => {
  const result = searchResult[searchTab.value][plugin.value]
  const sourceContext = result.sourceContext || {}

  const res = await pluginMethodCall(plugin.value, 'search', {
    tab: searchTab.value,
    keywords: keywords.value,
    reset,
    ...sourceContext
  })

  switch (searchTab.value) {
    case 'tracks': {
      if (reset) tracks[plugin.value].data = []
      tracks[plugin.value].count = res.count
      tracks[plugin.value].sourceContext = res.sourceContext

      const data = res.data as Track[]
      tracks[plugin.value].data.push(
        ...data.map((item) => ({
          ...item,
          pluginId: plugin.value,
          album: { ...item.album, pluginId: plugin.value },
          artists: item.artists.map((it) => ({ ...it, pluginId: plugin.value })),
          albumArtists: item.albumArtists.map((it) => ({ ...it, pluginId: plugin.value }))
        }))
      )
      show.value = true
      break
    }
    case 'albums': {
      if (reset) albums[plugin.value].data = []
      albums[plugin.value].count = res.count
      albums[plugin.value].sourceContext = res.sourceContext

      const data = res.data as Album[]
      albums[plugin.value].data.push(
        ...data.map((item) => ({
          ...item,
          artists: item.artists?.map((it) => ({
            ...it,
            pluginId: plugin.value
          })),
          pluginId: plugin.value
        }))
      )
      show.value = true
      break
    }
    case 'artists': {
      if (reset) artists[plugin.value].data = []
      artists[plugin.value].count = res.count
      artists[plugin.value].sourceContext = res.sourceContext
      const data = res.data as Artist[]
      artists[plugin.value].data.push(
        ...data.map((item) => ({
          ...item,
          pluginId: plugin.value
        }))
      )
      show.value = true
      break
    }
    case 'playlists': {
      if (reset) playlists[plugin.value].data = []
      playlists[plugin.value].count = res.count
      playlists[plugin.value].sourceContext = res.sourceContext
      const data = res.data as Playlist[]
      playlists[plugin.value].data.push(
        ...data.map((item) => ({
          ...item,
          pluginId: plugin.value,
          creator: { ...item.creator, pluginId: plugin.value }
        }))
      )
      show.value = true
      break
    }
    case 'mvs': {
      if (reset) mvs[plugin.value].data = []
      mvs[plugin.value].count = res.count
      mvs[plugin.value].sourceContext = res.sourceContext
      const data = res.data as Mv[]
      mvs[plugin.value].data.push(
        ...data.map((item) => ({
          ...item,
          pluginId: plugin.value,
          artists: item.artists?.map((it) => ({
            ...it,
            pluginId: plugin.value
          }))
        }))
      )
      show.value = true
      break
    }
    default: {
      break
    }
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
  keywords.value = to.query.keywords as string
  plugin.value = to.query.plugin as PluginId

  if (keywords.value) {
    loadData()
  }
  next()
})

onMounted(() => {
  updatePadding(0)
  plugin.value = route.query.plugin as PluginId
  keywords.value = route.query.keywords as string
  loadData()
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
