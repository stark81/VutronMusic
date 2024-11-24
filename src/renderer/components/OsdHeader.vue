<template>
  <div class="header-container">
    <div class="header">
      <div class="btns">
        <button class="btn" @click="showMain"><svg-icon icon-class="logo" /></button>
        <button class="btn" @click="playPrev"><svg-icon icon-class="previous" /></button>
        <button class="btn" @click="playOrPause"
          ><svg-icon :icon-class="isPlaying ? 'pause' : 'play'"
        /></button>
        <button class="btn" @click="playNext"><svg-icon icon-class="next" /></button>
        <button class="btn" @click="openMenu"><svg-icon icon-class="color-plate" /></button>
        <button class="btn" @click="switchMode"
          ><svg-icon :icon-class="type === 'small' ? 'normal-mode' : 'mini-mode'"
        /></button>
        <button class="btn" @click="handleLock"><svg-icon icon-class="lock" /></button>
        <button class="btn" @click="handleClose"><svg-icon icon-class="close" /></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, inject, ref } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'
import SvgIcon from './SvgIcon.vue'

const isPlaying = ref(false)

const osdLyricStore = useOsdLyricStore()
const { isLock, type } = storeToRefs(osdLyricStore)

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

const handleClose = () => {
  window.mainApi.send('set-osd-window', { show: false })
}

const handleLock = () => {
  isLock.value = !isLock.value
  window.mainApi.send('set-osd-window', { isLock: isLock.value })
}

const switchMode = () => {
  type.value = type.value === 'small' ? 'normal' : 'small'
  window.mainApi.send('switchOsdWinMode', type.value)
}

const openMenu = inject('openMenu') as (e: MouseEvent) => void

onMounted(() => {
  isLock.value = window.env?.isLinux ? false : isLock.value
  window.mainApi?.invoke('get-playing-status').then((res: boolean) => {
    isPlaying.value = res
  })
})
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  opacity: 0.7;
}

.btns {
  display: flex;
  height: 34px;
  padding-top: 4px;
  flex-flow: row wrap;
  align-items: center;
  justify-content: center;
}

.btn {
  padding: 0 10px;
  cursor: pointer;
  border: none;
  outline: none;
  background: none;
  color: #fff;
  transition: opacity 0.3s ease;
  -webkit-app-region: no-drag;
}

.animated-fast {
  animation-duration: 0.3s;
  animation-fill-mode: both;
}

.animated {
  animation-duration: 0.5s;
  animation-fill-mode: both;
}
</style>
