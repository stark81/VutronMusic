<template>
  <div id="titleBar" class="header">
    <div class="header-left">
      <button class="btn" :style="{ color: unplayLrcColor }" @click="showMain"
        ><svg-icon icon-class="logo"
      /></button>
      <div ref="titleContainerRef" class="header-title-container">
        <span
          ref="titleTextRef"
          class="header-title-text"
          :style="[titleStyle, { color: unplayLrcColor }]"
          >{{ title }}</span
        >
      </div>
    </div>
    <div class="header-center">
      <button class="btn" :style="{ color: unplayLrcColor }" @click="playPrev"
        ><svg-icon icon-class="previous"
      /></button>
      <button class="btn" :style="{ color: unplayLrcColor }" @click="playOrPause"
        ><svg-icon :icon-class="isPlaying ? 'pause' : 'play'"
      /></button>
      <button class="btn" :style="{ color: unplayLrcColor }" @click="playNext"
        ><svg-icon icon-class="next"
      /></button>
    </div>
    <div class="header-right">
      <button class="btn" :style="{ color: unplayLrcColor }" @click="switchMode"
        ><svg-icon :icon-class="type === 'small' ? 'normal-mode' : 'mini-mode'"
      /></button>
      <button class="btn" :style="{ color: unplayLrcColor }" tabindex="-1" @click="isLock = true"
        ><svg-icon icon-class="lock"
      /></button>
      <button class="btn" :style="{ color: unplayLrcColor }" @click="show = !show"
        ><svg-icon icon-class="close"
      /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch, onBeforeUnmount, nextTick, toRefs } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'
import SvgIcon from './SvgIcon.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    visible?: boolean
  }>(),
  { title: '', visible: false }
)

const isPlaying = ref(false)

const osdLyricStore = useOsdLyricStore()
const { isLock, type, show, unplayLrcColor } = storeToRefs(osdLyricStore)
const { title } = toRefs(props)

const showMain = () => {
  window.mainApi?.send('from-osd', 'showMainWin')
}
const playPrev = () => {
  window.mainApi?.send('from-osd', 'playPrev')
}
const playOrPause = () => {
  isPlaying.value = !isPlaying.value
  window.mainApi?.send('from-osd', 'playOrPause')
}
const playNext = () => {
  window.mainApi?.send('from-osd', 'playNext')
}

const switchMode = () => {
  type.value = type.value === 'small' ? 'normal' : 'small'
}

// --- 标题溢出滚动 (marquee) ---

const titleContainerRef = ref<HTMLElement | null>(null)
const titleTextRef = ref<HTMLElement | null>(null)
const translateX = ref(0)
const titleTransition = ref('none')
const overflowDistance = ref(0)

const titleStyle = computed(() => ({
  transform: `translateX(${translateX.value}px)`,
  transition: titleTransition.value
}))

let marqueeTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    marqueeTimer = setTimeout(resolve, ms)
  })

const checkOverflow = () => {
  const container = titleContainerRef.value
  const text = titleTextRef.value
  if (container && text) {
    overflowDistance.value = Math.max(0, text.scrollWidth - container.clientWidth)
  }
}

const SCROLL_SPEED = 60 // px/s

const scrollTo = (target: number) => {
  const duration = Math.max(2000, Math.min(12000, (Math.abs(target) / SCROLL_SPEED) * 1000))
  titleTransition.value = `transform ${duration}ms linear`
  translateX.value = target
  return delay(duration)
}

const jumpTo = (target: number) => {
  titleTransition.value = 'none'
  translateX.value = target
}

const clearMarquee = () => {
  if (marqueeTimer !== null) {
    clearTimeout(marqueeTimer)
    marqueeTimer = null
  }
  jumpTo(0)
}

// 主动画循环
const startMarquee = async () => {
  if (overflowDistance.value <= 0) return
  clearMarquee()

  // 先确保在起点
  jumpTo(0)
  await nextTick()

  // 首次滚动：向左滚到尽头
  await scrollTo(-overflowDistance.value)

  // 循环
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // 暂停在终点 2s（每轮循环开始检查一次可见性，避免循环中变成不可见还继续等待）
    if (!props.visible) break
    await delay(2000)
    if (!props.visible) break

    // 滚回起点
    await scrollTo(0)
    if (!props.visible) break

    // 暂停在起点 2s
    await delay(2000)
    if (!props.visible) break

    // 再次滚到终点
    await scrollTo(-overflowDistance.value)
    if (!props.visible) break
  }

  // 如果因不可见退出循环，确保复位
  if (!props.visible) {
    jumpTo(0)
  }
}

// visible 或溢出距离变化时启动/停止
watch(
  () => [props.visible, overflowDistance.value],
  async ([visible]) => {
    if (visible && overflowDistance.value > 0) {
      startMarquee()
    } else {
      clearMarquee()
    }
  }
)

// 监听标题变化后重新检测溢出
watch(
  () => props.title,
  async () => {
    await nextTick()
    checkOverflow()
  }
)

onMounted(() => {
  isLock.value = window.env?.isLinux ? false : isLock.value
  const player = JSON.parse(localStorage.getItem('player') || '{}')
  isPlaying.value = player.playing
  window.mainApi?.on('update-osd-playing-status', (event: any, res: boolean) => {
    isPlaying.value = res
  })

  // 设置 ResizeObserver 监听容器和文本尺寸变化
  const container = titleContainerRef.value
  const text = titleTextRef.value
  if (container && text) {
    resizeObserver = new ResizeObserver(() => {
      checkOverflow()
    })
    resizeObserver.observe(container)
    resizeObserver.observe(text)
  }

  // 初始检测
  nextTick(() => checkOverflow())
})

onBeforeUnmount(() => {
  clearMarquee()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  height: 44px;
  justify-content: space-between;
  align-items: center;
  position: relative;
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.header-left,
.header-center,
.header-right {
  display: flex;
  align-items: center;
  flex: 0 0 25%;
  min-width: 0;
  max-width: 25%;
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.header-left {
  justify-content: flex-start;
}

.header-center {
  justify-content: center;
}

.header-right {
  justify-content: flex-end;
}

.header-title-container {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  -webkit-app-region: no-drag;
}

.header-title-text {
  display: inline-block;
  font-size: 16px;
  white-space: nowrap;
  margin-left: 2px;
}

.btn {
  padding: 0 8px;
  cursor: pointer;
  border: none;
  outline: none;
  height: 44px;
  width: 40px;
  background: none;
  color: #fff;
  transition: opacity 0.3s ease;
  -webkit-app-region: no-drag;
}
</style>
