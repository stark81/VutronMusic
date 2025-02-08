<template>
  <div ref="albumContainerRef" class="album-container">
    <VirtualScroll
      :list="artistsArray"
      class="artist-list"
      :item-height="64"
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
      :item-height="64"
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
          type-prop="artist"
          :style="{ marginLeft: '20px' }"
          @dblclick="playThisList(item.id)"
        />
      </template>
      <template #footer>
        <div v-if="artistsArray[selectedIdx]?.matched" class="listen-more">
          <span
            >听听<router-link :to="`/artist/${artistsArray[selectedIdx].id}`">{{
              artistsArray[selectedIdx].name
            }}</router-link
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
import { Track } from '../store/localMusic'
import ArtistListItem from './ArtistListItem.vue'
import TrackListItem from './TrackListItem.vue'
import { usePlayerStore } from '../store/player'

const props = defineProps<{
  tracks: Track[]
}>()

// ====================    ref   ==================== //
const { tracks } = toRefs(props)
const selectedIdx = ref(0)
const playerStore = usePlayerStore()
const { replacePlaylist } = playerStore

// ==================== computed ==================== //
const artistsArray = computed(() => {
  const ar = props.tracks.map((track) => track.artists).flat()
  return [...new Map(ar.map((item) => [item.name, item])).values()]
})

// 右边显示的已选择的专辑歌曲
const showTracks = computed(() => {
  const artist = artistsArray.value[selectedIdx.value]
  return tracks.value.filter((track) => track.artists.some((item) => item.name === artist.name))
})

const playThisList = (id: number) => {
  const IDs = showTracks.value.map((track) => track.id)
  const idx = showTracks.value.findIndex((item) => item.id === id)
  const type = showTracks.value[0].type
  replacePlaylist(type === 'local' ? 'localPlaylist' : 'streamPlaylist', 0, IDs, idx)
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
