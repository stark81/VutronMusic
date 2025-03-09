<template>
  <div
    id="main"
    :class="{ 'is-lock': isLock }"
    :style="{ backgroundColor: bground }"
    @mouseenter="hover = true"
  >
    <Header v-show="!isLock" :class="{ lock: isLock }" :style="headerStyle" />
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
    <!-- <TestLyric /> -->
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Header from '../components/OsdHeader.vue'
import LyricContainer from '../components/OsdLyricContainer.vue'
// import TestLyric from '../components/TestLyric.vue'
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
  if (!hover.value || isLock.value) return backgroundColor.value
  const parts = backgroundColor.value.slice(5, -1).split(',')
  const red = parseInt(parts[0].trim(), 10) // 红色
  const green = parseInt(parts[1].trim(), 10) // 绿色
  const blue = parseInt(parts[2].trim(), 10) // 蓝色
  const alpha = parseFloat(parts[3].trim()) // 透明度
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(alpha + 0.2, 1)})`
})

const headerStyle = computed(() => {
  return { opacity: hover.value ? 1 : 0 }
})

const handleLock = () => {
  isLock.value = !isLock.value
}

document.addEventListener('mouseleave', () => {
  window.mainApi.send('windowMouseleave')
})

window.mainApi?.on('mouseleave-completely', () => {
  hover.value = false
})
</script>

<style lang="scss" scoped>
#main {
  // box-sizing: border-box;
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100vh;
}

.header {
  transition: opacity 0.3s;
  margin-top: 1px;

  .lock {
    opacity: 0 !important;
  }
}

.control-lock {
  margin-top: 1px;
  width: 100%;
  height: 43px;
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
