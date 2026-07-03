<template>
  <div
    id="main"
    :class="{ 'is-lock': isLock }"
    :style="{ backgroundColor: bground.bg }"
    @mouseenter="hover = true"
    @mouseleave="onMouseLeave"
  >
    <div class="resize-handle top" @pointerdown="startResize('top', $event)" />
    <div class="resize-handle bottom" @pointerdown="startResize('bottom', $event)" />
    <div class="resize-handle left" @pointerdown="startResize('left', $event)" />
    <div class="resize-handle right" @pointerdown="startResize('right', $event)" />
    <div class="resize-handle top-left" @pointerdown="startResize('top-left', $event)" />
    <div class="resize-handle top-right" @pointerdown="startResize('top-right', $event)" />
    <div class="resize-handle bottom-left" @pointerdown="startResize('bottom-left', $event)" />
    <div class="resize-handle bottom-right" @pointerdown="startResize('bottom-right', $event)" />
    <div v-show="!isLock">
      <Header :title="title" :visible="hover" :class="{ lock: isLock }" :style="headerStyle" />
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

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
  if (!hover.value || isLock.value) return { bg: backgroundColor.value }
  return { bg: `rgba(${red}, ${green}, ${blue}, ${Math.min(alpha + 0.2, 1)})` }
})

// 用 opacity + pointer-events 实现真正的过渡动画（配合下面 <style> 里的 transition），
// 不再用 v-show 控制 Header 的显隐，避免 display:none 打断 opacity 过渡导致"跳变"。
// 当背景不透明时（alpha > 0），header 始终显示，方便用户操作。
const headerStyle = computed(() => {
  const parts = backgroundColor.value.slice(5, -1).split(',')
  const alpha = parseFloat(parts[3]?.trim() || '0')
  const bgVisible = alpha > 0
  const visible = hover.value || bgVisible
  return {
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? ('auto' as const) : ('none' as const)
  }
})

const handleLock = () => {
  isLock.value = !isLock.value
}

const onWindowBlur = () => {
  hover.value = false
}

const onMouseLeave = () => {
  hover.value = false
}

const onOsdMouseState = (e: Event) => {
  hover.value = (e as CustomEvent).detail.inside
}

// 改用 PointerEvent + setPointerCapture：
// mousedown/mouseup 在无边框窗口里，如果用户把鼠标拖出窗口范围再松手，
// mouseup 不一定能派发到本窗口，导致主进程那边的 resize 轮询永远收不到 stop 信号。
// setPointerCapture 会让指针事件（包括 pointerup）持续路由到发起 capture 的元素，
// 不管指针后续是否移出了该元素甚至窗口边界，从根源上保证一定能发出 osd-stop-resize。
const startResize = (direction: string, event: PointerEvent) => {
  event.preventDefault()
  event.stopPropagation()
  ;(event.target as Element)?.setPointerCapture?.(event.pointerId)
  window.mainApi?.send('osd-start-resize', {
    direction,
    mouseX: event.screenX,
    mouseY: event.screenY
  })
}

const onMouseUp = () => {
  window.mainApi?.send('osd-stop-resize')
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data.type === 'update-osd-status') {
    for (const [key, value] of Object.entries(event.data.data) as [string, any]) {
      if (key === 'title') {
        title.value = value
      }
    }
  }
})

onMounted(() => {
  if (isLinux) {
    isLock.value = false
  }
  window.addEventListener('blur', onWindowBlur)
  // 改成监听 pointerup 而不是 mouseup，配合 setPointerCapture 才能稳定收到松手事件
  window.addEventListener('pointerup', onMouseUp)

  // 监听 preload 脚本通过轮询传来的鼠标进出状态（安全网，兜底修正）
  const rootEl = document.getElementById('main')
  rootEl?.addEventListener('osd-mouse-enter-leave', onOsdMouseState)
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('pointerup', onMouseUp)

  const rootEl = document.getElementById('main')
  rootEl?.removeEventListener('osd-mouse-enter-leave', onOsdMouseState)
})
</script>

<style lang="scss" scoped>
#main {
  position: relative;
  box-sizing: border-box;
  border-radius: 4px;
  overflow: visible;
  transition: all 0.3s ease;
  min-height: 100vh;
  padding: 10px 20px;
  -webkit-app-region: drag;
}

.resize-handle {
  position: absolute;
  z-index: 10;
  -webkit-app-region: no-drag;

  &.top {
    top: 0;
    left: 8px;
    right: 8px;
    height: 6px;
    cursor: ns-resize;
  }
  &.bottom {
    bottom: 0;
    left: 8px;
    right: 8px;
    height: 6px;
    cursor: ns-resize;
  }
  &.left {
    top: 8px;
    bottom: 8px;
    left: 0;
    width: 6px;
    cursor: ew-resize;
  }
  &.right {
    top: 8px;
    bottom: 8px;
    right: 0;
    width: 6px;
    cursor: ew-resize;
  }
  &.top-left {
    top: 0;
    left: 0;
    width: 8px;
    height: 8px;
    cursor: nwse-resize;
  }
  &.top-right {
    top: 0;
    right: 0;
    width: 8px;
    height: 8px;
    cursor: nesw-resize;
  }
  &.bottom-left {
    bottom: 0;
    left: 0;
    width: 8px;
    height: 8px;
    cursor: nesw-resize;
  }
  &.bottom-right {
    bottom: 0;
    right: 0;
    width: 8px;
    height: 8px;
    cursor: nwse-resize;
  }
}

.header {
  transition: opacity 0.3s;

  .lock {
    opacity: 0 !important;
  }
}

.control-lock {
  width: 100%;
  height: 44px;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  -webkit-app-region: no-drag;
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
