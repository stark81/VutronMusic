<template>
  <div>
    <transition name="fade">
      <div v-show="show">
        <div :style="thumbStyle"></div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const show = ref(false)
const top = ref(0)
const thumbHeight = ref(0)
const positions = ref({
  home: { scrollTop: 0, params: {} }
})

const mainRef = inject('mainRef') as any

const route = useRoute()
const router = useRouter()

const handleScroll = () => {
  const clientHeight = mainRef.value?.clientHeight - 128
  const scrollHeight = mainRef.value?.scrollHeight - 128
  const scrollTop = mainRef.value?.scrollTop
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

const thumbStyle = computed(() => {
  return {
    transform: `translateY(${top.value}px)`,
    height: `${thumbHeight.value}px`
  }
})

const restorePosition = () => {
  if (
    !route.meta.savePosition ||
    positions.value[route.name!] === undefined ||
    mainRef.value === undefined
  ) {
    return
  }
  document.documentElement.scrollTo({ top: positions.value[route.name!].scrollTop })
  mainRef.value.scrollTo({ top: positions.value[route.name!].scrollTop })
}

onMounted(() => {
  router.beforeEach((to, from, next) => {
    show.value = false
    if (route.meta.savePosition) {
      positions.value[route.name!] = {
        scrollTop: mainRef.value?.scrollTop,
        params: route.params
      }
    }
    if (!to.meta.keepAlive) {
      mainRef.value?.scrollTo({ top: 0 })
      document.documentElement.scrollTo({ top: 0 })
    }
    next()
  })
})

const hideTimer = ref()
const active = ref(false)

const setScrollbarHideTimeout = () => {
  if (hideTimer.value !== null) clearTimeout(hideTimer.value)
  hideTimer.value = setTimeout(() => {
    if (!active.value) show.value = false
    hideTimer.value = null
  }, 4000)
}

defineExpose({ handleScroll, restorePosition })
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
