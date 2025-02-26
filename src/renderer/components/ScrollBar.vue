<template>
  <div>
    <div v-show="show" class="scrollbar">
      <div
        :class="{ active }"
        class="thumbContainer"
        :style="thumbStyle"
        @mouseenter="handleMouseenter"
        @mouseleave="handleMouseleave"
        @mousedown="handleDragStart"
      >
        <div></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref, computed, inject, watch } from 'vue'
import eventBus from '../utils/eventBus'
import { useNormalStateStore } from '../store/state'
import { useRouter } from 'vue-router'

const show = ref(false)
const active = ref(false)
const isOnDrag = ref(false)
const onDragClientY = ref(0)
const hideTimer = ref()
const router = useRouter()
const updateUserSelect = inject('updateUserSelect', ref(false))

const normalState = useNormalStateStore()
const { scrollbar } = storeToRefs(normalState)

const scrollHeight = computed(() => {
  return scrollbar.value.active
    ? scrollbar.value.instances[scrollbar.value.active].listHeight - 64
    : 0
})

const clientHeight = computed(() => {
  return scrollbar.value.active
    ? scrollbar.value.instances[scrollbar.value.active].containerHeight - 64
    : 0
})

const scrollTop = computed(() => {
  return scrollbar.value.active ? scrollbar.value.instances[scrollbar.value.active].scrollTop : 0
})

watch(scrollTop, () => {
  show.value = true
  setScrollbarHideTimeout()
})

watch(
  () => scrollbar.value.active,
  (value) => {
    if (!value) {
      if (hideTimer.value) clearTimeout(hideTimer.value)
      hideTimer.value = null
      show.value = false
    }
  }
)

const thumbStyle = computed(() => {
  if (!scrollHeight.value) return {}
  let thumHeight = ~~((clientHeight.value / scrollHeight.value) * clientHeight.value)
  const top = ~~((scrollTop.value / scrollHeight.value) * clientHeight.value)
  thumHeight = Math.max(thumHeight, 30)
  return { height: `${thumHeight}px`, transform: `translateY(${top}px)` }
})

const handleMouseenter = () => {
  active.value = true
}

const handleMouseleave = () => {
  setScrollbarHideTimeout()
  active.value = false
}

const setScrollbarHideTimeout = () => {
  if (hideTimer.value) clearTimeout(hideTimer.value)
  hideTimer.value = setTimeout(() => {
    if (!active.value) show.value = false
    hideTimer.value = null
  }, 4000)
}

const handleDragStart = (event: MouseEvent) => {
  isOnDrag.value = true
  onDragClientY.value = event.clientY
  updateUserSelect.value = true
  eventBus.emit('update-start')
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
}

const handleDragMove = (e: MouseEvent) => {
  if (!isOnDrag.value) return
  const offset = ~~(((e.clientY - onDragClientY.value) / clientHeight.value) * scrollHeight.value)
  eventBus.emit('update-scroll-bar', { active: scrollbar.value.active, offset })
}

const handleDragEnd = () => {
  isOnDrag.value = false
  updateUserSelect.value = false
  eventBus.emit('update-done')
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
}

router.beforeEach((to, from, next) => {
  show.value = false
  next()
})
</script>

<style scoped lang="scss">
.scrollbar {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 16px;
  z-index: 1000;

  .thumbContainer {
    margin-top: 64px;
    div {
      transition: background 0.4s;
      position: absolute;
      right: 4px;
      width: 8px;
      height: 100%;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.38);
    }
  }

  .thumbContainer.active div {
    background: rgba(128, 128, 128, 0.58);
  }
}
</style>
