<template>
  <div ref="containerRef" class="marquee-container" :style="{ width }">
    <span ref="textRef" class="marquee-text" :style="textStyle">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    width: string
    active?: boolean
    color?: string
  }>(),
  { active: true }
)

const containerRef = ref<HTMLElement | null>(null)
const textRef = ref<HTMLElement | null>(null)
const translateX = ref(0)
const cssTransition = ref('none')
const overflowDistance = ref(0)
let marqueeTarget = 0
let marqueeTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

const textStyle = computed(() => ({
  transform: `translateX(${translateX.value}px)`,
  transition: cssTransition.value,
  ...(props.color ? { color: props.color } : {})
}))

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    marqueeTimer = setTimeout(resolve, ms)
  })

const getCurrentTranslateX = (): number => {
  const el = textRef.value
  if (!el) return translateX.value
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return translateX.value
  // matrix(a, b, c, d, tx, ty)
  const m = t.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+)/)
  return m ? parseFloat(m[1]) : translateX.value
}

const checkOverflow = () => {
  const container = containerRef.value
  const text = textRef.value
  if (container && text) {
    overflowDistance.value = Math.max(0, text.scrollWidth - container.clientWidth)
  }
}

const SCROLL_SPEED = 60 // px/s

const scrollTo = (target: number) => {
  marqueeTarget = target
  const distance = Math.abs(target - translateX.value)
  const duration = Math.max(2000, Math.min(12000, (distance / SCROLL_SPEED) * 1000))
  cssTransition.value = `transform ${duration}ms linear`
  translateX.value = target
  return delay(duration)
}

// freeze=true: 立即冻结位置（startMarquee 重启前用）
// freeze=false: 只停掉定时器，让当前 CSS 过渡自然跑完（外部 active→false 时用）
const pauseMarquee = (freeze = false) => {
  if (marqueeTimer !== null) {
    clearTimeout(marqueeTimer)
    marqueeTimer = null
  }
  if (freeze) {
    translateX.value = getCurrentTranslateX()
    cssTransition.value = 'none'
  }
}

const startMarquee = async () => {
  if (overflowDistance.value <= 0) return
  pauseMarquee(true)

  const dist = overflowDistance.value

  const pos = translateX.value
  const atEnd = Math.abs(pos + dist) < 1
  const atStart = Math.abs(pos) < 1

  if (!atEnd && !atStart) {
    await scrollTo(marqueeTarget)
    if (!props.active) return
  }

  if (Math.abs(translateX.value) < 1) {
    await scrollTo(-dist)
    if (!props.active) return
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!props.active) break
    await delay(2000)
    if (!props.active) break

    await scrollTo(0)
    if (!props.active) break

    await delay(2000)
    if (!props.active) break

    await scrollTo(-dist)
    if (!props.active) break
  }

  pauseMarquee()
}

watch(
  () => [props.active, overflowDistance.value],
  async ([active]) => {
    if (active && overflowDistance.value > 0) {
      startMarquee()
    } else {
      pauseMarquee()
    }
  }
)

watch(
  () => props.text,
  async () => {
    await nextTick()
    translateX.value = 0
    checkOverflow()
  }
)

onMounted(() => {
  const container = containerRef.value
  const text = textRef.value
  if (container && text) {
    resizeObserver = new ResizeObserver(() => {
      checkOverflow()
    })
    resizeObserver.observe(container)
    resizeObserver.observe(text)
  }
  nextTick(() => checkOverflow())
})

onBeforeUnmount(() => {
  pauseMarquee()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.marquee-container {
  overflow: hidden;
  min-width: 0;
}

.marquee-text {
  display: inline-block;
  white-space: nowrap;
}
</style>
