<template>
  <div class="dir-container">
    <VirtualScroll
      :list="dirs"
      class="dir-list"
      :item-size="30"
      :show-position="false"
      :is-end="true"
    >
      <template #default="{ item, index }">
        <div
          class="dir-name"
          :class="{ active: selectedIdx === index }"
          @click="selectedIdx = index"
        >
          <SvgIcon icon-class="folder" />
          <span>{{ item }}</span>
        </div>
      </template>
    </VirtualScroll>
    <VirtualScroll :list="showTracks" :item-size="64" :show-position="false" :is-end="true">
      <template #default="{ item, index }">
        <TrackListItem
          :key="index"
          :track-prop="item"
          :track-no="item.no || index + 1"
          type-prop="localPlaylist"
          @dblclick="playThisList(item.id)"
        />
      </template>
    </VirtualScroll>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, toRefs } from 'vue'
import { usePlayerStore } from '../store/player'
import SvgIcon from './SvgIcon.vue'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import TrackListItem from './TrackListItem.vue'

const props = defineProps<{ tracks: any[] }>()

const { tracks } = toRefs(props)
const selectedIdx = ref(0)
const playerStore = usePlayerStore()
const { replacePlaylist } = playerStore

const dirs = computed(() => {
  return [...new Set(tracks.value.map((track) => track.dirName).flat())] as string[]
})

const showTracks = computed(() => {
  const dir = dirs.value[selectedIdx.value]
  return tracks.value.filter((track) => track.dirName === dir)
})

const playThisList = (id: number) => {
  const ids = showTracks.value.map((track) => track.id)
  const idx = showTracks.value.findIndex((item) => item.id === id)
  replacePlaylist('localPlaylist', 0, ids, idx)
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
.dir-container {
  display: grid;
  grid-template-columns: 250px 1fr;
}

.dir-list {
  height: 100%;
  width: 240px;
  border-right: 1px solid var(--color-secondary-bg);
  scrollbar-width: none;
  scroll-behavior: smooth;
}

.dir-name {
  width: 220px;
  height: 44px;
  display: flex;
  font-size: 18px;
  place-items: center;
  box-sizing: border-box;
  padding: 10px;
  border-radius: 6px;
  margin-right: 20px;
  cursor: pointer;

  &.active {
    background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
    color: var(--color-primary);
  }

  .svg-icon {
    width: 24px;
    height: 24px;
    opacity: 0.9;
  }

  span {
    margin-left: 6px;
  }
}
</style>
