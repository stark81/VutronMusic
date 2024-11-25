<template>
  <div id="main" :class="{ 'is-lock': isLock }">
    <Header v-show="!isLock" class="control-bar" />
    <div v-show="isLock" class="control-lock">
      <button
        v-if="!isLinux"
        id="osd-lock"
        class="btn btn-lock"
        :style="lockStyle"
        @click="handleLock"
        ><SvgIcon icon-class="lock" style="margin-right: 4px" />解锁</button
      ></div
    >
    <LyricContainer />
    <div
      v-show="showMenu"
      ref="menu"
      class="menu"
      :style="{ top: topValue, left: leftValue }"
      @click="closeMenu"
    >
      <div class="item" @click="fontColor = 'white'">典雅白</div>
      <div class="item" @click="fontColor = 'black'">高级黑</div>
      <div class="item" @click="fontColor = 'blue'">深邃蓝</div>
      <div class="item" @click="fontColor = 'green'">清新绿</div>
      <div class="item" @click="fontColor = 'red'">活力红</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Header from '../components/OsdHeader.vue'
import LyricContainer from '../components/OsdLyricContainer.vue'
import SvgIcon from '../components/SvgIcon.vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { nextTick, provide, ref, computed } from 'vue'

const isLinux = window.env?.isLinux
const showMenu = ref(false)
const menu = ref<HTMLElement | null>(null)
const topValue = ref('0px')
const leftValue = ref('0px')

const lockStyle = computed(() => {
  const textColor = fontColor.value === 'white' ? '#222' : 'white'
  return { color: textColor, backgroundColor: fontColor.value }
})

const osdLyricStore = useOsdLyricStore()
const { isLock, fontColor } = storeToRefs(osdLyricStore)

const handleLock = () => {
  isLock.value = !isLock.value
  window.mainApi.send('set-osd-window', { isLock: isLock.value })
}
const setMenu = (top: number, left: number) => {
  const largestHeight = window.innerHeight - (menu.value?.offsetHeight || 0)
  const largestWidth = window.innerWidth - (menu.value?.offsetWidth || 0) - 25
  if (top > largestHeight) top = largestHeight
  if (left > largestWidth) left = largestWidth
  topValue.value = top + 'px'
  leftValue.value = left + 'px'
}

const openMenu = (e: MouseEvent): void => {
  showMenu.value = true
  nextTick(() => {
    setMenu(e.y, e.x)
    menu.value?.focus()
  })
  e.preventDefault()
}

const closeMenu = () => {
  showMenu.value = false
}

provide('openMenu', openMenu)
</script>

<style lang="scss" scoped>
.control-lock {
  width: 100%;
  height: 38px;
  z-index: 1;
  display: flex;
  // height: 40px;
  justify-content: center;
  align-items: center;
}
.btn {
  display: flex;
  padding: 4px 10px;
  cursor: pointer;
  border: none;
  outline: none;
  background: none;
  // color: white;
  // background-color: var(--color-bg);
  border-radius: 4px;
  transition: opacity 0.3s ease;
}

#main {
  position: relative;
  box-sizing: border-box;
  min-height: 0;
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.3s ease;

  .control-bar {
    opacity: 0;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    -webkit-app-region: drag;
    transition: opacity 0.3s ease;
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.2);
    .control-bar {
      opacity: 1;
    }
  }

  &.is-lock:hover {
    background-color: rgba(0, 0, 0, 0);
    .control-bar {
      opacity: 1;
    }
  }
}

.menu {
  position: fixed;
  list-style: none;
  background: rgba(220, 220, 220, 0.8);
  box-shadow: 0 6px 12px -4px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(12px);
  border-radius: 6px;
  box-sizing: border-box;
  padding: 6px;
  -webkit-app-region: no-drag;
  z-index: 110;
  display: flex;
  transition:
    background 125ms ease-out,
    opacity 125ms ease-out,
    transform 125ms ease-out;

  &:focus {
    outline: none;
  }
}

.menu .item {
  font-weight: 600;
  font-size: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: default;
  display: flex;
  align-items: center;
  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-bg-for-transparent);
    transition:
      opacity 125ms ease-out,
      transform 125ms ease-out;
  }
  &:active {
    opacity: 0.75;
    transform: scale(0.95);
  }
}
</style>
