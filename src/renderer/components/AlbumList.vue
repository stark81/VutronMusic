<template>
  <div class="album-container">
    <VirtualScroll
      :list="albums"
      class="album-list"
      :item-height="60"
      :show-position="false"
      :is-end="true"
    >
      <template #default="{ item, index }">
        <AlbumListItem
          :key="index"
          class="album-item"
          :selected="selectedIdx === index"
          :style="{ marginRight: '20px' }"
          :track-prop="tracks.filter((t) => t.album.name === item.name)"
          type-prop="album"
          @click="selectedIdx = index"
        />
      </template>
    </VirtualScroll>
    <VirtualScroll
      :list="showTracks"
      :item-height="48"
      class="track-list"
      :above-value="5"
      :below-value="5"
      :show-position="false"
      :is-end="true"
    >
      <template #default="{ item, index }">
        <TrackListItem
          :key="index"
          :track-prop="item"
          :track-no="item.no || index + 1"
          :show-service="item.type === 'stream'"
          type-prop="album"
          :style="{ marginLeft: '20px' }"
          @dblclick="playThisList(item.id)"
        />
      </template>
      <template #footer>
        <div
          v-if="albums[selectedIdx]?.matched && albums[selectedIdx]?.id !== 0"
          class="listen-more"
        >
          <span
            >听听
            <router-link :to="`/album/${albums[selectedIdx].id}`">{{
              albums[selectedIdx].name
            }}</router-link>
            的其他歌曲</span
          >
        </div>
      </template>
    </VirtualScroll>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, onMounted, onBeforeUnmount, provide, inject } from 'vue'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import AlbumListItem from './AlbumListItem.vue'
import TrackListItem from './TrackListItem.vue'
import { usePlayerStore } from '../store/player'

const props = defineProps<{
  tracks: any[]
}>()

// ====================    ref   ==================== //
const { tracks } = toRefs(props)
const selectedIdx = ref(0)
const playerStore = usePlayerStore()
const { replacePlaylist } = playerStore

// ==================== computed ==================== //
const albums = computed(() => {
  const al = props.tracks.map((track) => track.album)
  return [...new Map(al.map((item) => [item.name, item])).values()]
})

// 右边显示的已选择的专辑歌曲
const showTracks = computed(() => {
  const album = albums.value[selectedIdx.value]
  return tracks.value.filter((track) => track.album.name === album.name).sort((a, b) => a.no - b.no)
})

// ==================== function ==================== //
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

<style scoped lang="scss">
.album-container {
  display: grid;
  grid-template-columns: 300px 1fr;
}
.album-list {
  height: 100%;
  width: 300px;
  border-right: 1px solid var(--color-secondary-bg);
  scrollbar-width: none;
  scroll-behavior: smooth;
}
.track-list {
  padding-left: 20px;
  .listen-more {
    display: flex;
    justify-content: center;
    place-items: center;
    height: 40px;
    line-height: 40px;
    font-size: 14px;
    opacity: 0.75;
  }
}
.album-item {
  box-sizing: border-box;
  border-radius: 6px;
  height: 60px;
}
.active {
  background-color: var(--color-secondary-bg);
}
</style>
