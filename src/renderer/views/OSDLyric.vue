<template>
  <div
    id="container"
    :class="[{ lock: isLock }, { hide: isMouseEnter && isHoverHide }]"
    @mousedown="handleMouseDown"
  >
    <div id="main">
      <Transition
        enter-active-class="animated-fast fadeIn"
        leave-active-class="animated-fast fadeOut"
      >
        <div v-show="!isLock" class="control-bar">
          <Header />
        </div>
      </Transition>
      <div v-show="isLock" class="control-lock">
        <button id="osd-lock" class="btn btn-lock" @click="handleLock"
          ><SvgIcon icon-class="lock"></SvgIcon></button
      ></div>
      <LyricContainer />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import Header from '../components/OsdHeader.vue'
import LyricContainer from '../components/OsdLyricContainer.vue'
import SvgIcon from '../components/SvgIcon.vue'
import { useOsdLyricStore } from '../store/osdLyric'
import useLyricWin from '../utils/lyricWin'

const osdLyricStore = useOsdLyricStore()
const { isLock } = storeToRefs(osdLyricStore)
const { isMouseEnter, isHoverHide } = useLyricWin()
const isMsDown = ref(false)
const msDownX = ref(0)
const msDownY = ref(0)

const handleMouseMove = (event: MouseEvent) => {
  if (isMsDown.value) {
    window.mainApi.send('setWindowPosition', {
      x: event.clientX - msDownX.value,
      y: event.clientY - msDownY.value,
      w: window.innerWidth,
      h: window.innerHeight
    })
  }
}
const handleMouseDown = (event: MouseEvent) => {
  isMsDown.value = true
  msDownX.value = event.clientX
  msDownY.value = event.clientY
}

const handleLock = () => {
  isLock.value = !isLock.value
  window.mainApi.send('set-osd-window', { isLock: isLock.value })
}

const handleMouseUp = () => {
  isMsDown.value = false
}

onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style lang="scss" scoped>
html {
  scrollbar-width: none;
}
body {
  user-select: none;
  height: 100vh;
  box-sizing: border-box;
  color: #fff;
  opacity: 0.7;
}
#lyric {
  height: 100%;
}
#container {
  box-sizing: border-box;
  height: 100%;
  transition: opacity 0.3s ease;
  opacity: 1;
  &.lock {
    #main {
      background-color: transparent;
    }
  }
  &.hide {
    opacity: 0.5;
  }
}

.control-bar {
  position: fixed;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  overflow: hidden;
  top: 0;
  left: 0;
  width: 100%;
  opacity: 0;
  background-color: rgba(0, 0, 0, 0.3);
  transition: opacity 0.3s ease;
  z-index: 1;
}

.control-lock {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 40px;
  z-index: 1;
  display: flex;
  height: 40px;
  justify-content: center;
  align-items: center;
}
.btn {
  padding: 0 10px;
  cursor: pointer;
  border: none;
  outline: none;
  background: none;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.3);
  transition: opacity 0.3s ease;
  // &:hover {
  //   opacity: 0.7;
  // }
}

#main {
  position: relative;
  box-sizing: border-box;
  transition: background-color 0.3s ease;
  min-height: 0;
  border-radius: 4px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.2);

  &:hover {
    .control-bar {
      opacity: 1;
    }
  }
}

#main.drag {
  -webkit-app-region: drag;
}
.fadeIn {
  animation-name: fadeIn;
}
.fadeOut {
  animation-name: fadeOut;
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
</style>
