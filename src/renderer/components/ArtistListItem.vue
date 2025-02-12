<template>
  <div class="item" :class="{ selected: selected }">
    <img :src="`${image}?param=64y64`" loading="lazy" />
    <div class="title-and-artist">
      <div class="container">
        <div class="title"> {{ artistProp.name }} </div>
        <div class="artist">共 {{ trackProp.length }} 首歌 </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { PropType, computed } from 'vue'
import { Track, Artist } from '../store/localMusic'

const props = defineProps({
  trackProp: {
    type: Array as PropType<Track[]>,
    required: true
  },
  artistProp: {
    type: Object as PropType<Artist>,
    required: true
  },
  selected: {
    type: Boolean,
    required: true
  }
})

const artist = computed(() => props.artistProp)

const image = computed(() => {
  return artist.value.matched ? artist.value.img1v1Url : artist.value.picUrl
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
  border-radius: 50%;
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
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
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
