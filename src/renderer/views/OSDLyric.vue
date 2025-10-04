<template>
  <div
    id="main"
    :class="{ 'is-lock': isLock }"
    :style="{ backgroundColor: bground.bg }"
    @mouseenter="hover = true"
  >
    <div v-show="!isLock">
      <Header v-show="hover" :class="{ lock: isLock }" :style="headerStyle" />
      <div v-show="!hover" class="header-title" :class="{ show: bground.alpha }">{{ title }}</div>
    </div>
    <div v-show="isLock" class="control-lock" tabindex="-1">
      <button
        v-if="!isLinux"
        v-show="showButtonWhenLock"
        id="osd-lock"
        class="btn btn-lock"
        :style="lockStyle"
        tabindex="-1"
        @click="handleLock"
        ><SvgIcon icon-class="lock" style="margin-right: 4px" tabindex="-1" />解锁</button
      ></div
    >
    <LyricContainer tabindex="-1" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Header from '../components/OsdHeader.vue'
import LyricContainer from '../components/OsdLyricContainer.vue'
import SvgIcon from '../components/SvgIcon.vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { ref, computed, onMounted } from 'vue'

const isLinux = window.env?.isLinux

const osdLyricStore = useOsdLyricStore()
const { isLock, playedLrcColor, backgroundColor, showButtonWhenLock } = storeToRefs(osdLyricStore)
const hover = ref(false)
const title = ref('听你想听的音乐')

const lockStyle = computed(() => {
  const textColor = playedLrcColor.value === 'white' ? '#222' : 'white'
  return { color: textColor, backgroundColor: playedLrcColor.value }
})

const bground = computed(() => {
  const parts = backgroundColor.value.slice(5, -1).split(',')
  const red = parseInt(parts[0].trim(), 10) // 红色
  const green = parseInt(parts[1].trim(), 10) // 绿色
  const blue = parseInt(parts[2].trim(), 10) // 蓝色
  const alpha = parseFloat(parts[3].trim()) // 透明度
  if (!hover.value || isLock.value) return { bg: backgroundColor.value, alpha }
  return { bg: `rgba(${red}, ${green}, ${blue}, ${Math.min(alpha + 0.2, 1)})`, alpha }
})

const headerStyle = computed(() => {
  return { opacity: hover.value ? 1 : 0 }
})

const handleLock = () => {
  isLock.value = !isLock.value
}

document.addEventListener('mouseleave', () => {
  window.mainApi?.send('windowMouseleave')
})

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data.type === 'update-osd-status') {
    for (const [key, value] of Object.entries(event.data.data) as [string, any]) {
      if (key === 'title') {
        title.value = value
      }
    }
  }
})

window.mainApi?.on('mouseInWindow', (_: any, value: boolean) => {
  hover.value = value
})

onMounted(() => {
  if (isLinux) {
    isLock.value = false
  }
})
</script>

<style lang="scss" scoped>
#main {
  box-sizing: border-box;
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100vh;
  padding: 10px 20px;
}

.header {
  transition: opacity 0.3s;

  .lock {
    opacity: 0 !important;
  }
}

.header-title {
  display: flex;
  height: 34px;
  justify-content: center;
  align-items: center;
  opacity: 0;
  font-size: 16px;
  color: #fff;
}

.show {
  opacity: 1 !important;
}

.control-lock {
  width: 100%;
  height: 34px;
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
