<template>
  <div
    id="main"
    :class="{ 'is-lock': isLock }"
    :style="{ backgroundColor: bground }"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Header v-show="!isLock" class="header" :class="{ lock: isLock }" />
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
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Header from '../components/OsdHeader.vue'
import LyricContainer from '../components/OsdLyricContainer.vue'
import SvgIcon from '../components/SvgIcon.vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { ref, computed } from 'vue'

const isLinux = window.env?.isLinux

const osdLyricStore = useOsdLyricStore()
const { isLock, playedLrcColor, backgroundColor } = storeToRefs(osdLyricStore)
const hover = ref(false)

const lockStyle = computed(() => {
  const textColor = playedLrcColor.value === 'white' ? '#222' : 'white'
  return { color: textColor, backgroundColor: playedLrcColor.value }
})

const bground = computed(() => {
  if (!hover.value) return backgroundColor.value
  const parts = backgroundColor.value.slice(5, -1).split(',')
  const red = parseInt(parts[0].trim(), 10) // 红色
  const green = parseInt(parts[1].trim(), 10) // 绿色
  const blue = parseInt(parts[2].trim(), 10) // 蓝色
  const alpha = parseFloat(parts[3].trim()) // 透明度
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(alpha + 0.2, 1)})`
})

const handleLock = () => {
  isLock.value = !isLock.value
}
</script>

<style lang="scss" scoped>
#main {
  box-sizing: border-box;
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100vh;
}

.header {
  width: 100vw;
  height: 40px;
  opacity: 0;
  -webkit-app-region: drag;
  transition: opacity 0.3s;

  .lock {
    opacity: 0 !important;
  }
}

.control-lock {
  width: 100%;
  height: 40px;
  z-index: 1;
  display: flex;
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
  border-radius: 4px;
  transition: opacity 0.3s ease;
}
</style>
