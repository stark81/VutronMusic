<template>
  <div class="header">
    <Transition enter-active-class="animated-fast fadeIn" leave-active-class="animated fadeOut">
      <div v-show="true" class="btns">
        <button class="btn"><svg-icon icon-class="logo" /></button>
        <button class="btn" @click="handleOnTop"
          ><svg-icon :icon-class="alwaysOnTop ? 'offTop' : 'onTop'"
        /></button>
        <button class="btn" @click="handleLock"><svg-icon icon-class="lock" /></button>
        <button class="btn" @click="handleClose"><svg-icon icon-class="close" /></button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'
import SvgIcon from './SvgIcon.vue'

const osdLyricStore = useOsdLyricStore()
const { isLock, alwaysOnTop } = storeToRefs(osdLyricStore)

const handleClose = () => {
  window.mainApi.send('set-osd-window', { show: false })
}

const handleOnTop = () => {
  alwaysOnTop.value = !alwaysOnTop.value
  window.mainApi.send('set-osd-window', { isAlwaysOnTop: alwaysOnTop.value })
}

const handleLock = () => {
  isLock.value = !isLock.value
  window.mainApi.send('set-osd-window', { isLock: isLock.value })
}
</script>

<style lang="scss" scoped>
.header {
  position: relative;
  transition: opacity 0.3s ease;
  opacity: 0.7;
}

.btns {
  display: flex;
  height: 40px;
  flex-flow: row wrap;
  align-items: center;
  // justify-content: center;
}

.btn {
  padding: 0 10px;
  cursor: pointer;
  border: none;
  outline: none;
  background: none;
  color: #fff;
  transition: opacity 0.3s ease;
  // &:hover {
  //   opacity: 0.7;
  // }
}

.animated-fast {
  animation-duration: 0.3s;
  animation-fill-mode: both;
}

.animated {
  animation-duration: 0.5s;
  animation-fill-mode: both;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}
@keyframes fadeOut {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}
.fadeIn {
  animation-name: fadeIn;
}
.fadeOut {
  animation-name: fadeOut;
}
</style>
