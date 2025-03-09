<template>
  <div id="titleBar" class="header">
    <button class="btn" :style="{ color: unplayLrcColor }" @click="showMain"
      ><svg-icon icon-class="logo"
    /></button>
    <button class="btn" :style="{ color: unplayLrcColor }" @click="playPrev"
      ><svg-icon icon-class="previous"
    /></button>
    <button class="btn" :style="{ color: unplayLrcColor }" @click="playOrPause"
      ><svg-icon :icon-class="isPlaying ? 'pause' : 'play'"
    /></button>
    <button class="btn" :style="{ color: unplayLrcColor }" @click="playNext"
      ><svg-icon icon-class="next"
    /></button>
    <button class="btn" :style="{ color: unplayLrcColor }" @click="switchMode"
      ><svg-icon :icon-class="type === 'small' ? 'normal-mode' : 'mini-mode'"
    /></button>
    <button class="btn" :style="{ color: unplayLrcColor }" @click="isLock = true"
      ><svg-icon icon-class="lock"
    /></button>
    <button class="btn" :style="{ color: unplayLrcColor }" @click="show = !show"
      ><svg-icon icon-class="close"
    /></button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'
import SvgIcon from './SvgIcon.vue'

const isPlaying = ref(false)

const osdLyricStore = useOsdLyricStore()
const { isLock, type, show, unplayLrcColor } = storeToRefs(osdLyricStore)

const showMain = () => {
  window.mainApi.send('from-osd', 'showMainWin')
}
const playPrev = () => {
  window.mainApi.send('from-osd', 'playPrev')
}
const playOrPause = () => {
  isPlaying.value = !isPlaying.value
  window.mainApi.send('from-osd', 'playOrPause')
}
const playNext = () => {
  window.mainApi.send('from-osd', 'playNext')
}

const switchMode = () => {
  type.value = type.value === 'small' ? 'normal' : 'small'
}

onMounted(() => {
  isLock.value = window.env?.isLinux ? false : isLock.value
  const player = JSON.parse(localStorage.getItem('player') || '{}')
  isPlaying.value = player.playing
  window.mainApi?.on('update-osd-playing-status', (event: any, res: boolean) => {
    isPlaying.value = res
  })
})
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  height: 43px;
  justify-content: center;
  align-items: center;
  position: relative;
  opacity: 0.7;
}

.btn {
  padding: 0 10px;
  cursor: pointer;
  border: none;
  outline: none;
  height: 44px;
  width: 44px;
  background: none;
  color: #fff;
  transition: opacity 0.3s ease;
  -webkit-app-region: no-drag;
}
</style>
