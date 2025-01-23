<template>
  <div>
    <transition name="fade">
      <div v-show="show" id="scrollbar">
        <div
          id="thumbContainer"
          :style="thumbStyle"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
          @mousedown="handleDragStart"
          @click.stop
        >
          <div></div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const show = ref(false)
const hideTimer = ref()
const active = ref(false)
const top = ref(0)
const thumbHeight = ref(0)
const onDragClientY = ref(0)
const isOnDrag = ref(false)
const positions = ref({
  home: { scrollTop: 0, params: {} }
})

const thumbStyle = computed(() => ({
  transform: `translateY(${top.value}px)`,
  height: `${thumbHeight.value}px`
}))

const mainRef = document.documentElement

const route = useRoute()
const router = useRouter()

const handleScroll = () => {
  const clientHeight = mainRef.clientHeight - 128
  const scrollHeight = mainRef.scrollHeight - 128
  const scrollTop = mainRef.scrollTop
  let top1 = ~~((scrollTop / scrollHeight) * clientHeight)
  let thumbHeight1 = ~~((clientHeight / scrollHeight) * clientHeight)

  if (thumbHeight1 < 24) thumbHeight1 = 24
  if (top1 > clientHeight - thumbHeight1) {
    top1 = clientHeight - thumbHeight1
  }

  top.value = top1
  thumbHeight.value = thumbHeight1
  if (!show.value && clientHeight !== thumbHeight1) show.value = true
  setScrollbarHideTimeout()

  if (route.meta.savePosition) {
    positions.value[route.name!] = {
      scrollTop,
      params: route.params
    }
  }
}

const handleMouseEnter = () => {
  active.value = true
}

const handleMouseLeave = () => {
  active.value = false
  setScrollbarHideTimeout()
}

const handleDragStart = (e: MouseEvent) => {
  onDragClientY.value = e.clientY
  isOnDrag.value = true
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
}

const handleDragMove = (e: MouseEvent) => {
  if (!isOnDrag.value) return
  const clientHeight = mainRef.clientHeight - 128
  const scrollHeight = mainRef.scrollHeight - 128
  const clientY = e.clientY
  const scrollTop = mainRef.scrollTop

  const offset = ~~(((clientY - onDragClientY.value) / clientHeight) * scrollHeight)

  top.value = ~~((scrollTop / scrollHeight) * clientHeight)
  mainRef.scrollBy(0, offset)
  onDragClientY.value = clientY
}

const handleDragEnd = (e: MouseEvent) => {
  isOnDrag.value = false
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
}

const restorePosition = () => {
  if (!route.meta.savePosition || positions.value[route.name!] === undefined) {
    return
  }
  mainRef.scrollTo({ top: positions.value[route.name!].scrollTop })
}

const setScrollbarHideTimeout = () => {
  if (hideTimer.value !== null) clearTimeout(hideTimer.value)
  hideTimer.value = setTimeout(() => {
    if (!active.value) show.value = false
    hideTimer.value = null
  }, 3000)
}

defineExpose({ restorePosition })

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  router.beforeEach((to, from, next) => {
    // show.value = false
    if (route.meta.savePosition) {
      positions.value[route.name!] = {
        scrollTop: mainRef.scrollTop,
        params: route.params
      }
    }
    if (!to.meta.keepAlive) {
      mainRef.scrollTo({ top: 0 })
      document.documentElement.scrollTo({ top: 0 })
    }
    next()
  })
})
</script>

<style scoped lang="scss">
#scrollbar {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 16px;
  z-index: 1000;

  #thumbContainer {
    margin-top: 64px;
    div {
      transition: background 0.4s;
      position: absolute;
      right: 2px;
      width: 8px;
      height: 100%;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.38);
    }
  }
  #thumbContainer.active div {
    background: rgba(128, 128, 128, 0.58);
  }
}

[data-theme='dark'] {
  #thumbContainer div {
    background: var(--color-secondary-bg);
  }
}

#scrollbar.on-drag {
  left: 0;
  width: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
