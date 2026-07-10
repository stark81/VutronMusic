<template>
  <div id="titleBar" class="header">
    <div class="header-left">
      <button class="btn" :style="{ color: unplayLrcColor }" @click="showMain"
        ><svg-icon icon-class="logo"
      /></button>
      <div class="header-title-container">
        <MarqueeText :text="title" width="100%" :active="!!visible" :color="unplayLrcColor" />
      </div>
    </div>
    <div class="header-center">
      <button class="btn" :style="{ color: unplayLrcColor }" @click="playPrev"
        ><svg-icon icon-class="previous"
      /></button>
      <button class="btn" :style="{ color: unplayLrcColor }" @click="playOrPause"
        ><svg-icon :icon-class="isPlaying ? 'pause' : 'play'"
      /></button>
      <button class="btn" :style="{ color: unplayLrcColor }" @click="playNext"
        ><svg-icon icon-class="next"
      /></button>
    </div>
    <div class="header-right">
      <button class="btn" :style="{ color: unplayLrcColor }" @click="switchMode"
        ><svg-icon :icon-class="type === 'small' ? 'normal-mode' : 'mini-mode'"
      /></button>
      <button class="btn" :style="{ color: unplayLrcColor }" tabindex="-1" @click="isLock = true"
        ><svg-icon icon-class="lock"
      /></button>
      <button class="btn" :style="{ color: unplayLrcColor }" @click="show = !show"
        ><svg-icon icon-class="close"
      /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, toRefs } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'
import SvgIcon from './SvgIcon.vue'
import MarqueeText from './MarqueeText.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    visible?: boolean
  }>(),
  { title: '', visible: false }
)

const isPlaying = ref(false)

const osdLyricStore = useOsdLyricStore()
const { isLock, type, show, unplayLrcColor } = storeToRefs(osdLyricStore)
const { title } = toRefs(props)

const showMain = () => {
  window.mainApi?.send('from-osd', 'showMainWin')
}
const playPrev = () => {
  window.mainApi?.send('from-osd', 'playPrev')
}
const playOrPause = () => {
  isPlaying.value = !isPlaying.value
  window.mainApi?.send('from-osd', 'playOrPause')
}
const playNext = () => {
  window.mainApi?.send('from-osd', 'playNext')
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
  height: 44px;
  justify-content: space-between;
  align-items: center;
  position: relative;
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.header-left,
.header-center,
.header-right {
  display: flex;
  align-items: center;
  flex: 0 0 25%;
  min-width: 0;
  max-width: 25%;
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.header-left {
  justify-content: flex-start;
}

.header-center {
  justify-content: center;
}

.header-right {
  justify-content: flex-end;
}

.header-title-container {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  -webkit-app-region: no-drag;
}

.btn {
  padding: 0 8px;
  cursor: pointer;
  border: none;
  outline: none;
  height: 44px;
  width: 40px;
  background: none;
  color: #fff;
  transition: opacity 0.3s ease;
  -webkit-app-region: no-drag;
}
</style>
