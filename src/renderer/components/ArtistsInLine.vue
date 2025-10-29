<template>
  <span class="artist-in-line">
    {{ computedPrefix }}
    <span v-for="(ar, index) in filteredArtists" :key="index">
      <router-link v-if="ar.id !== 0 && ar.matched !== false" :to="`/artist/${ar.id}`">{{
        ar.name
      }}</router-link>
      <span v-else>{{ ar.name }}</span>
      <span v-if="index !== filteredArtists.length - 1" class="separator">,</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { PropType, computed } from 'vue'
import { Artist } from '@/types/music.d'

const props = defineProps({
  artists: {
    type: Array as PropType<Artist[]>,
    required: true
  },
  exclude: {
    type: String,
    default: ''
  },
  prefix: {
    type: String,
    default: ''
  }
})

const filteredArtists = computed(() => {
  return props.artists?.filter((a) => a.name !== props.exclude)
})

const computedPrefix = computed(() => {
  if (filteredArtists.value?.length !== 0) return props.prefix
  else return ''
})
</script>

<style scoped lang="scss">
.artist-in-line {
  // display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  overflow: hidden;
}
.separator {
  /* make separator distinct enough in long list */
  margin-left: 1px;
  margin-right: 4px;
  position: relative;
  top: 0.5px;
}
</style>
