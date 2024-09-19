<template>
  <div
    ref="containerRef"
    class="scroll-box"
    :style="{ height: useHeight + 'px' }"
    @scroll="handleScroll"
  >
    <div v-if="showPosition" class="position">
      <div v-show="currentTrack && showScrollTo" @click="scrollToCurrent">{{
        $t('localMusic.positionTrack')
      }}</div>
      <div @click="scrollToTop">{{ $t('localMusic.scrollToTop') }}</div>
    </div>
    <div class="virtual-list" :style="listStyles">
      <div
        v-for="row in visibleItems"
        :id="row._key"
        :key="row._key"
        :ref="(el) => (itemRefs[row._key] = el)"
      >
        <slot name="default" :item="row.value" :index="row._key"></slot>
      </div>
      <div ref="footerRef">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNormalStateStore } from '../store/state'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import {
  ref,
  computed,
  toRefs,
  onActivated,
  onDeactivated,
  onMounted,
  onBeforeUnmount,
  PropType,
  watch
} from 'vue'

const props = defineProps({
  list: { type: Array as PropType<{ [key: string]: any }[]>, default: () => [] },
  type: { type: String, default: 'tracklist' },
  disabled: { type: Boolean, default: false },
  pid: { type: Number, default: 0 },
  columnNumber: { type: Number, default: 1 },
  gap: { type: Number, default: 4 },
  height: { type: Number, default: 650 },
  bottomGap: { type: Number, default: 4 },
  highlightPlayingTrack: { type: Boolean, default: true },
  extraContextMenuItem: { type: Array as PropType<any[]>, default: () => [] },
  showPosition: { type: Boolean, default: true },
  loadMore: { type: Function, default: () => {} },
  itemHeight: { type: Number, default: 40 },
  containerHeight: { type: Number, default: 0 },
  isFullScreen: { type: Boolean, default: true }
})

const { list, columnNumber, gap, disabled } = toRefs(props)
const containerRef = ref()
const footerRef = ref()
const styleBefore = ref()
// const innerHeight = ref(window.innerHeight - 70)
const start = ref(0)
const itemRefs = ref<any[]>([])

const stateStore = useNormalStateStore()
const { enableScrolling } = storeToRefs(stateStore)

const playerStore = usePlayerStore()
const { playlistSource, currentTrack } = storeToRefs(playerStore)
// const trackList = computed(() => playerStore.list)

// 这里的innerHeight需要减去一个比navbar高度略大一些的值，此项目里navbar宽度为64px
const _listData = computed(() => {
  return list.value.reduce((init, cur, index) => {
    init.push({
      _key: index,
      value: cur
    })
    return init
  }, [])
})
const innerHeight = computed(() =>
  props.isFullScreen ? window.innerHeight - 65 : props.containerHeight
)
const footerHeight = computed(() => footerRef.value?.clientHeight || 0)
const totalRows = computed(() => Math.ceil(list.value.length / columnNumber.value))
const visibleRows = computed(() => Math.ceil(innerHeight.value / oneHeight.value))
const containerRefHeight = computed(() => {
  return (
    totalRows.value * oneHeight.value + (totalRows.value - 1) * props.bottomGap + footerHeight.value
  )
})

const useHeight = computed(() => {
  return disabled.value
    ? containerRefHeight.value
    : Math.min(innerHeight.value, containerRefHeight.value, props.height)
})

const oneHeight = computed(() => {
  const result: number[] = []
  const els = itemRefs.value
  if (els.length === 0) return props.itemHeight
  els.map((el) => {
    const height = el?.getBoundingClientRect().height
    result.push(height || props.itemHeight)
  })

  // 这里当元素没有渲染时，返回一个较小的默认值，否则当后续请求到数据后会因为没有高度而无法渲染数据
  return Math.max(...result)
})

const showScrollTo = computed(() => {
  return (
    (playlistSource.value.type === props.type && playlistSource.value.id === props.pid) ||
    (playlistSource.value.type === 'localPlaylist' && props.pid === 0)
  )
})

let lastScrollTop = containerRef.value?.scrollTop
const scrollToTop = () => {
  let isScrolling = true
  containerRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  const checkScrolling = () => {
    const currentScrollTop = containerRef.value?.scrollTop
    if (currentScrollTop === lastScrollTop) {
      if (isScrolling) {
        isScrolling = false
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } else {
      lastScrollTop = currentScrollTop
      requestAnimationFrame(checkScrolling)
    }
  }
  setTimeout(() => {
    requestAnimationFrame(checkScrolling)
  }, 30)
}

const paddingTop = computed(() => start.value * oneHeight.value)
const paddingBottom = computed(() => {
  const paddingBT = (totalRows.value - start.value - visibleRows.value * 2) * oneHeight.value
  return Math.max(paddingBT, 0)
})

const listStyles = computed(() => {
  return {
    gap: `0 ${gap.value}px`,
    gridTemplateColumns: `repeat(${columnNumber.value}, 1fr)`,
    paddingTop: disabled.value ? '0px' : paddingTop.value + 'px',
    paddingBottom: disabled.value ? '0px' : paddingBottom.value + 'px'
  }
})

const visibleItems = computed(() => {
  return _listData.value.slice(
    start.value * columnNumber.value,
    (start.value + visibleRows.value * 2) * columnNumber.value
  )
})

watch(enableScrolling, (newVal) => {
  containerRef.value.style.overflowY = newVal ? styleBefore.value : 'hidden'
})

const rafThrottle = (fn: Function) => {
  let locked = false
  return (...args: any[]) => {
    if (!locked) {
      locked = true
      window.requestAnimationFrame(() => {
        fn(...args)
        locked = false
      })
    }
  }
}

const updateVisibleItems = () => {
  const scrollTop = containerRef.value?.scrollTop ?? 0
  const newStart = Math.max(Math.ceil(scrollTop / oneHeight.value - visibleRows.value / 2) - 1, 0)
  start.value = newStart
}

const scrollToCurrent = () => {
  const index = list.value.findIndex((track) => track.id === currentTrack.value?.id)
  const root = document.documentElement
  root.scrollTo({
    top: 384,
    behavior: 'smooth'
  })
  start.value = Math.max(index - visibleRows.value, 0)
  const offset = (index - visibleRows.value / 2 + 1) * oneHeight.value
  containerRef.value.scrollTo({ top: offset, behavior: 'smooth' })
}

const onScrollToBottom = () => {
  const scrollTop = containerRef.value?.scrollTop ?? 0
  const scrollHeight = containerRef.value?.scrollHeight ?? 0
  const clientHeight = containerRef.value?.clientHeight ?? 0
  if (scrollTop + clientHeight >= scrollHeight) {
    props.loadMore()
  }
}

const handleScroll = rafThrottle(() => {
  if (disabled.value) return
  onScrollToBottom()
  updateVisibleItems()
})

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && containerRefHeight.value > innerHeight.value) {
        containerRef.value.style.overflowY = 'scroll'
        styleBefore.value = 'scroll'
      } else {
        containerRef.value.style.overflowY = 'hidden'
        styleBefore.value = 'hidden'
      }
    })
  },
  {
    root: null,
    threshold: 1
  }
)

onActivated(() => {
  if (!props.isFullScreen) return
  observer.observe(containerRef.value)
})

onDeactivated(() => {
  start.value = 0
  if (!props.isFullScreen) return
  observer.unobserve(containerRef.value)
})

onMounted(() => {
  if (!props.isFullScreen) return
  observer.observe(containerRef.value)
})

onBeforeUnmount(() => {
  if (!props.isFullScreen) return
  observer.unobserve(containerRef.value)
})
</script>

<style scoped lang="scss">
.scroll-box {
  scrollbar-width: none;
  scroll-behavior: smooth;
  overflow-y: scroll;
  padding-bottom: 64px;
  transition: all 0.3s ease-in-out;
}
.virtual-list {
  display: grid;
}
.position {
  position: fixed;
  width: 100px;
  line-height: 40px;
  padding: 10px 0;
  border-radius: 10px;
  box-shadow: 0 8px 12px -6px rgba(0, 0, 0, 0.1);
  text-align: center;
  background: var(--color-secondary-bg);
  border: 1px solid rgba(60, 60, 60, 0.08);
  opacity: 0.75;
  top: 50%;
  right: 30px;
  transform: translate(0, -50%);
  transition: opacity 0.3s ease;
  z-index: 100;
}
.position:hover {
  opacity: 0.9;
  cursor: pointer;
}
</style>
