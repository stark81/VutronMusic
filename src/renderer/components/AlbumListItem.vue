<template>
  <div class="item" :class="{ selected: selected }">
    <img :src="image" loading="lazy" />
    <div class="title-and-artist">
      <div class="container">
        <div class="title">
          {{ tracks[0].album.name || '未知专辑' }}
        </div>
        <div class="artist">
          <ArtistsInLine :artists="artists" />
          - 共 {{ tracks.length }} 首歌
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { PropType, computed } from 'vue'
import ArtistsInLine from './ArtistsInLine.vue'
// import { useSettingsStore } from '../store/settings'
import { Track } from '@/types/plugin'

// const settingsStore = useSettingsStore()
// const { scanning } = toRefs(settingsStore.localMusic)

const props = defineProps({
  trackProp: {
    type: Array as PropType<Track[]>,
    required: true
  },
  selected: {
    type: Boolean,
    required: true
  }
})

const tracks = computed(() => props.trackProp)
// const pic = ref()

const image = computed(() => {
  return tracks.value[0].picUrl
})

const artists = computed(() => {
  const { artists } = tracks.value[0]
  return artists ?? []
})
</script>

<style scoped lang="scss">
.item {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  &:hover {
    background-color: var(--color-secondary-bg);
  }
}
.item.selected {
  background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
  color: var(--color-primary);
  .artist {
    font-weight: 600;
  }
}
img {
  border-radius: 6px;
  height: 44px;
  width: 44px;
  object-fit: cover;
  margin-right: 10px;
}
.title-and-artist {
  flex: 1;
  display: flex;
  .container {
    display: flex;
    flex-direction: column;
  }
  .title {
    font-size: 16px;
    font-weight: 600;
    cursor: default;
    padding-right: 16px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
    word-break: break-all;
  }
  .artist {
    margin-top: 2px;
    font-size: 13px;
    opacity: 0.68;
    // display: -webkit-box;
    // display: flex;
    display: flex;
    // -webkit-box-orient: vertical;
    // -webkit-line-clamp: 1;
    // line-clamp: 1;
    // overflow: hidden;
    a {
      span {
        margin-right: 3px;
        opacity: 0.8;
      }
      &:hover {
        text-decoration: underline;
        cursor: pointer;
      }
    }
  }
}
</style>
