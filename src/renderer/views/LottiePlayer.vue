<template>
  <Vue3Lottie
    ref="container"
    :animation-data="snow"
    :auto-play="false"
    height="100vh"
    width="100vw"
  />
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onMounted } from 'vue'
import { Vue3Lottie } from 'vue3-lottie'
import { usePlayerStore } from '../store/player'

import snow from '../assets/lottie/snow.json'
import { storeToRefs } from 'pinia'

const playerStore = usePlayerStore()
const { playing } = storeToRefs(playerStore)

const container = ref()
watch(playing, (value) => {
  if (value) {
    container.value?.play()
  } else {
    container.value?.pause()
  }
})

onMounted(() => {
  setTimeout(() => {
    if (playing.value) container.value?.play()
  }, 1000)
})

onBeforeUnmount(() => {
  container.value?.stop()
  container.value?.destroy()
})
</script>
