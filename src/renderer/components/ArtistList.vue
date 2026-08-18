<template>
  <div ref="albumContainerRef" class="album-container">
    <VirtualScroll
      :list="artistsArray"
      class="artist-list"
      :item-size="64"
      :show-position="false"
      :is-end="true"
    >
      <template #default="{ item, index }">
        <ArtistListItem
          :key="index"
          class="artist-item"
          :selected="selectedIdx === index"
          :style="{ marginRight: '20px' }"
          :artist-prop="item"
          :track-prop="tracks.filter((track) => track.artists.some((ar) => ar.name === item.name))"
          @click="selectedIdx = index"
        />
      </template>
    </VirtualScroll>
    <VirtualScroll
      :list="showTracks"
      :item-size="64"
      class="track-list"
      :show-position="false"
      :padding-bottom="116"
      :is-end="true"
    >
      <template #default="{ item, index }">
        <TrackListItem
          :key="index"
          :track-prop="item"
          :track-no="index + 1"
          type-prop="Artist"
          :show-service="item.type === 'stream'"
          :style="{ marginLeft: '20px' }"
          @dblclick="playThisList(item.id)"
        />
      </template>
      <template #footer>
        <div class="listen-more">
          <span
            >听听<router-link
              v-for="value in plugins"
              :key="value"
              class="plugin-link"
              :to="getArtistLink(value)"
              >{{ ` ${value} - ${artistsArray[selectedIdx]?.name} ` }}</router-link
            >的其他歌曲</span
          >
        </div>
      </template>
    </VirtualScroll>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, onMounted, onBeforeUnmount, provide, inject } from 'vue'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import { ArtistType, PluginId, Track } from '@/types/plugin'
import ArtistListItem from './ArtistListItem.vue'
import TrackListItem from './TrackListItem.vue'
import { usePlayerStore } from '../store/player'

const props = withDefaults(
  defineProps<{
    type: ArtistType
    tracks: Track[]
  }>(),
  { type: 'artists' }
)

// ====================    ref   ==================== //
const { tracks } = toRefs(props)
const selectedIdx = ref(0)
const playerStore = usePlayerStore()
const { replacePlaylist } = playerStore

// ==================== computed ==================== //
const artistsArray = computed(() => {
  const ar = props.tracks.map((track) => track[props.type]).flat()
  return [...new Map(ar.map((item) => [item.name, item])).values()]
})

// 右边显示的已选择的专辑歌曲
const showTracks = computed(() => {
  const artist = artistsArray.value[selectedIdx.value]
  const trackArray = tracks.value.filter((track) => {
    const artists = track.artists
    return artists.some((item) => item.name === artist.name)
  })
  return trackArray
})

const plugins = computed(() => [...new Set(showTracks.value.map((track) => track.pluginId))])

const playThisList = (id: number | string) => {
  const artist = artistsArray.value[selectedIdx.value]
  const IDs = showTracks.value.map((track) => [track.pluginId, track.sourceContext]) as [
    PluginId,
    Record<string, any>
  ][]
  const idx = showTracks.value.findIndex((item) => item.id === id)
  replacePlaylist(
    { type: 'Artist', plugin: artist.pluginId, sourceContext: artist.sourceContext },
    IDs,
    idx
  )
}

const getArtistLink = (code: PluginId) => {
  const artist = showTracks.value.find((item) => item.pluginId === code)?.[props.type]
  return `/artist/${code}/${JSON.stringify(artist?.[0]?.sourceContext || {})}`
}

const updatePadding = inject('updatePadding') as (padding: number) => void
provide('playThisList', playThisList)

onMounted(() => {
  updatePadding(0)
})

onBeforeUnmount(() => {
  updatePadding(96)
})
</script>

<style scoped>
.album-container {
  display: grid;
  grid-template-columns: 250px 1fr;
}
.artist-list {
  height: 100%;
  width: 250px;
  border-right: 1px solid var(--color-secondary-bg);
  overflow-y: scroll;
  scrollbar-width: none;
  scroll-behavior: smooth;
}
.track-list {
  padding-left: 20px;
  .listen-more {
    display: grid;
    place-items: center;
    height: 40px;
    font-size: 14px;
    opacity: 0.75;

    .plugin-link:not(:last-child)::after {
      content: ', ';
    }
  }
}
.artist-item {
  box-sizing: border-box;
  border-radius: 6px;
  height: 64px;
}
.active {
  background-color: var(--color-secondary-bg);
}
</style>
