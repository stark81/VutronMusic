<template>
  <div
    ref="listRef"
    class="infinite-list-container"
    :style="{ height: containerHeight + 'px' }"
    @scroll="scrollEvent"
  >
    <div class="infinite-list-phantom" :style="{ height: listHeight + 'px' }"></div>
    <div v-if="showPosition" class="position">
      <slot name="position" :scroll-to-current="scrollTocurrent"></slot>
      <div @click="scrollToTop"><svg-icon icon-class="arrow-up-alt"></svg-icon></div>
    </div>
    <div :style="listStyles" class="infinite-list">
      <div
        v-for="row in visibleData"
        :id="row._key.toString()"
        ref="itemsRef"
        :key="row._key"
        class="infinite-list-item-container"
      >
        <slot name="default" :index="row._key" :item="row.value"></slot>
      </div>
      <div v-if="showFooter" ref="footerRef">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import {
  ref,
  toRefs,
  onMounted,
  computed,
  nextTick,
  onUpdated,
  watch,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  inject
} from 'vue'
import SvgIcon from './SvgIcon.vue'
import eventBus from '../utils/eventBus'

type ScrollBehavior = 'auto' | 'instant' | 'smooth'

const props = withDefaults(
  defineProps<{
    list: T[]
    itemSize?: number
    columnNumber?: number
    aboveValue?: number
    belowValue?: number
    paddingBottom?: number
    showPosition?: boolean
    isEnd: boolean
    showFooter?: boolean
    gap?: number
    height?: number
    enableVirtualScroll?: boolean
    frozen?: boolean
    loadMore?: () => void
  }>(),
  {
    itemSize: 65,
    columnNumber: 1,
    aboveValue: 2,
    belowValue: 2,
    paddingBottom: 64,
    showPosition: true,
    showFooter: true,
    gap: 4,
    height: 0,
    enableVirtualScroll: true,
    frozen: false,
    loadMore: () => {}
  }
)

const lock = ref(false)
const listRef = ref()
const footerRef = ref()
const itemsRef = ref()
const startRow = ref(0)
const styleBefore = ref()
const startOffset = ref(0)
const position = ref<any[]>([])
const windowHeight = ref(window.innerHeight)
const scrollToIndex = ref(0)
const instanceId = ref('')
const { list, itemSize } = toRefs(props)

const normalState = useNormalStateStore()
const { enableScrolling, virtualScrolling } = storeToRefs(normalState)
const { registerInstance, unregisterInstance, updateScroll } = normalState

// 1. 恢复 _listData，做对象引用缓存
const _listData = computed(() => {
  return list.value.reduce<{ _key: number; value: T }[]>((init, cur, index) => {
    init.push({
      _key: index,
      value: cur
    })
    return init
  }, [])
})

const listHeight = computed(() => {
  const totalRows = Math.ceil(_listData.value.length / props.columnNumber)
  const idx = Math.floor((position.value.length - 1) / props.columnNumber) * props.columnNumber
  return (
    (position.value[idx]?.bottom || totalRows * itemSize.value) +
    (props.showFooter ? footerHeight.value : 0) +
    (props.isEnd ? props.paddingBottom : 0)
  )
})

const footerHeight = computed(() => footerRef.value?.clientHeight || 0)

const containerHeight = computed(() => {
  const navBarHeight = hasCustomTitleBar.value ? 84 : 64
  const winHeight = windowHeight.value - navBarHeight
  const height = props.height || winHeight
  return props.enableVirtualScroll ? Math.min(height, listHeight.value) : listHeight.value
})
const contentTransform = computed(() => `translateY(${startOffset.value}px)`)
const anchorPoint = computed(() =>
  position.value.length ? position.value[startRow.value * props.columnNumber] : null
)
const visibleCount = computed(() => Math.floor(containerHeight.value / itemSize.value))
const endRow = computed(() => startRow.value + visibleCount.value)
const aboveCount = computed(() => Math.min(startRow.value, props.aboveValue))
const belowCount = computed(() => Math.min(list.value.length - endRow.value, props.belowValue))

// 2. visibleData 直接 slice 缓存
const visibleData = computed(() => {
  const _start = (startRow.value - aboveCount.value) * props.columnNumber
  const _end = (endRow.value + belowCount.value) * props.columnNumber
  return _listData.value.slice(_start, _end)
})

const listStyles = computed(() => {
  return {
    gap: `0 ${props.gap}px`,
    gridTemplateColumns: `repeat(${props.columnNumber}, 1fr)`,
    transform: contentTransform.value
  }
})

const visibleMiddle = computed(() => (endRow.value + startRow.value) / 2)

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))
const mainRef = inject('mainRef', ref<HTMLElement>())
const scrollMainTo = inject('scrollMainTo', (to: number) => {})

const _isPrefixSubset = (oldArray: any[], newArray: any[]) => {
  if (newArray.length < oldArray.length || !oldArray.length) return false
  for (let i = 0; i < oldArray.length; i++) {
    if (oldArray[i] === newArray[i]) continue

    const oldItem = oldArray[i]?.value || {}
    const newItem = newArray[i]?.value || {}

    const hasCommentId = Object.prototype.hasOwnProperty.call(newItem, 'commentId')
    const hasId = Object.prototype.hasOwnProperty.call(newItem, 'id')

    if (hasCommentId && newItem.commentId !== oldItem.commentId) return false
    if (hasId && newItem.id !== oldItem.id) return false
    if (!hasCommentId && !hasId) return false
  }
  return true
}

// 3. 移除 over 死代码
const initPosition = () => {
  const oldPositions = position.value
  position.value = _listData.value.map((d: any, index: number) => {
    const oldPos = oldPositions[index]
    if (oldPos) {
      return { index, height: oldPos.height, top: oldPos.top, bottom: oldPos.bottom }
    }
    return {
      index,
      height: itemSize.value,
      top: Math.floor(index / props.columnNumber) * itemSize.value,
      bottom: (Math.floor(index / props.columnNumber) + 1) * itemSize.value
    }
  })
}

const updateItemsSize = () => {
  let dirty = false
  itemsRef.value?.forEach((node) => {
    if (node.id % props.columnNumber === 0) {
      const rect = node.getBoundingClientRect()
      const height = rect.height
      const index = +node.id
      const entry = position.value[index]
      if (!entry) return
      const oldHeight = entry.height
      const dValue = oldHeight - height

      if (dValue) {
        dirty = true
        entry.bottom -= dValue
        entry.height = height

        for (let k = index + 1; k < position.value.length; k++) {
          if (k % props.columnNumber !== 0) break
          position.value[k].top = position.value[k - props.columnNumber].bottom
          position.value[k].bottom -= dValue
        }
      }
    }
  })
  return dirty
}

const setStartOffset = () => {
  if (!position.value.length) return
  if (startRow.value >= 1) {
    const size =
      position.value[startRow.value * props.columnNumber]?.top -
      (position.value[(startRow.value - aboveCount.value) * props.columnNumber]?.top || 0)
    startOffset.value = position.value[(startRow.value - 1) * props.columnNumber]?.bottom - size
  } else {
    startOffset.value = 0
  }
}

watch(visibleMiddle, (value) => {
  if (Math.abs(scrollToIndex.value - value) <= 100) {
    virtualScrolling.value = false
  }
})

let lastScrollTop = listRef.value?.scrollTop

const scrollTocurrent = (index: number, behavior: ScrollBehavior = 'smooth') => {
  scrollToIndex.value = index
  const idx = index / props.columnNumber - Math.floor(visibleCount.value / 2)

  if (Math.abs(index - visibleMiddle.value) > 100) {
    virtualScrolling.value = true
  }
  if (idx > 0) {
    const elTop =
      listRef.value.getBoundingClientRect().top -
      (mainRef.value!.firstElementChild?.getBoundingClientRect()?.top || 0) +
      30
    scrollMainTo(elTop)
  } else {
    if (index >= startRow.value) {
      const el = itemsRef.value?.find((el) => el.id === index.toString())
      if (el) {
        const elTop = el.getBoundingClientRect().top
        const dist =
          mainRef.value!.scrollTop - (window.innerHeight / 2 - elTop - itemSize.value / 2)
        scrollMainTo(Math.max(dist, 0))
        nextTick(() => {
          el?.scrollIntoView({ block: 'center', behavior })
        })
        return
      }
    }
  }

  let top: number
  if (visibleCount.value % 2 === 0) {
    top = position.value[idx * props.columnNumber + 1]?.top || 0
  } else {
    top = position.value[idx * props.columnNumber]?.top || 0
  }
  listRef.value.scrollTo({ top, behavior })

  if (idx < 0 && index < startRow.value) {
    let isScrolling = true
    const checkScrolling = () => {
      const currentScrollTop = listRef.value?.scrollTop
      if (currentScrollTop === lastScrollTop) {
        if (isScrolling) {
          isScrolling = false
          scrollTocurrent(index)
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
}

const scrollToTop = () => {
  scrollToIndex.value = 0
  let isScrolling = true
  if (Math.abs(visibleMiddle.value) > 100) {
    virtualScrolling.value = true
  }
  listRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  const checkScrolling = () => {
    const currentScrollTop = listRef.value?.scrollTop
    if (currentScrollTop === lastScrollTop) {
      if (isScrolling) {
        isScrolling = false
        scrollMainTo(0)
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

const getStartIndex = (scrollTop = 0) => {
  return binarySearch(scrollTop)
}

// 4. 修复 binarySearch 性能问题：end = midIndex - 1
const binarySearch = (value: any) => {
  let start = 0
  let end = Math.ceil(position.value.length / props.columnNumber) - 1
  let tempIndex: number | null = null

  while (start <= end) {
    const midIndex = Math.floor((start + end) / 2)
    const midValue = position.value[midIndex * props.columnNumber].bottom
    if (midValue === value) {
      return midIndex + 1
    } else if (midValue < value) {
      start = midIndex + 1
    } else if (midValue > value) {
      if (tempIndex === null || tempIndex > midIndex) {
        tempIndex = midIndex
      }
      end = midIndex - 1 // 修复性能退化
    }
  }
  return tempIndex!
}

const rafThrottle = (fn: Function) => {
  lock.value = false
  return (...args: any[]) => {
    if (!lock.value) {
      lock.value = true
      window.requestAnimationFrame(() => {
        fn(...args)
        lock.value = false
      })
    }
  }
}

const loadingMore = ref(false)
let lastScrollSync = 0
let loadMoreTimer: ReturnType<typeof setTimeout> | null = null

const onScrollToBottom = () => {
  const scrollTop = listRef.value.scrollTop
  const containerHeight = listRef.value.clientHeight
  const contentHeight = listRef.value.scrollHeight

  const now = Date.now()
  registerInstance(instanceId.value)
  if (now - lastScrollSync > 100) {
    lastScrollSync = now
    updateScroll(instanceId.value, {
      scrollTop,
      containerHeight,
      listHeight: listHeight.value
    })
  }

  if (scrollTop + containerHeight >= contentHeight) {
    if (!loadingMore.value) {
      loadingMore.value = true
      props.loadMore()
      if (loadMoreTimer) clearTimeout(loadMoreTimer)
      loadMoreTimer = setTimeout(() => {
        loadingMore.value = false
        loadMoreTimer = null
      }, 5000)
    }
  }
}

const onScroll = () => {
  const scrollTop = listRef.value.scrollTop
  if (scrollTop > anchorPoint.value?.bottom || scrollTop < anchorPoint.value?.top) {
    startRow.value = getStartIndex(scrollTop)
    setStartOffset()
  }
}

const scrollEvent = rafThrottle(() => {
  onScrollToBottom()
  if (!props.frozen) onScroll()
})

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        listRef.value.style.overflowY = 'scroll'
        styleBefore.value = 'scroll'
      } else {
        listRef.value.style.overflowY = 'hidden'
        styleBefore.value = 'hidden'
      }
    })
  },
  {
    root: null,
    rootMargin: `-64px 0px 0px 0px`,
    threshold: 0.99
  }
)

const updateWindowHeight = () => {
  windowHeight.value = window.innerHeight
}

watch(enableScrolling, (value) => {
  if (value) {
    listRef.value.style.overflowY = styleBefore.value
  } else {
    listRef.value.style.overflowY = 'hidden'
  }
})

// 5. 修正多列增量追加坐标计算，并移除无用 lock
watch(_listData, (newList, oldList) => {
  const isMore = _isPrefixSubset(oldList, newList)
  if (isMore) {
    let lastBottom = 0
    if (position.value.length > 0) {
      // 考虑 columnNumber，取当前最后一行第一个元素的 bottom
      const lastIdx = position.value.length - 1
      const rowStartIdx = Math.floor(lastIdx / props.columnNumber) * props.columnNumber
      lastBottom = position.value[rowStartIdx]?.bottom || 0
    }

    const newItems = newList.slice(oldList.length)
    newItems.forEach(({ _key }) => {
      const idx = _key
      // 如果当前元素是新一行的第一个元素，更新 lastBottom 为上一行最后一个元素的 bottom
      if (idx % props.columnNumber === 0 && idx !== oldList.length) {
        lastBottom = position.value[idx - 1]?.bottom || lastBottom
      }
      const top = lastBottom
      const bottom = top + itemSize.value
      position.value.push({ index: idx, height: itemSize.value, top, bottom })
    })
  } else {
    if (newList.length < startRow.value) {
      startRow.value = 0
    }
    initPosition()
  }
  loadingMore.value = false
})

initPosition()

let updateScrollStart = 0

const startEvent = () => {
  updateScrollStart = listRef.value?.scrollTop || 0
}

const updateEvent = (data: { active: string; offset: number }) => {
  if (data.active !== instanceId.value) return
  if (updateScrollStart === 0) updateScrollStart = listRef.value?.scrollTop
  const top = Math.min(listRef.value?.scrollHeight, Math.max(updateScrollStart + data.offset, 0))
  listRef.value.scrollTo({ top, behavior: 'instant' })
}

eventBus.on('update-start', startEvent)

// @ts-ignore
eventBus.on('update-scroll-bar', updateEvent)

eventBus.on('update-done', startEvent)

onActivated(() => {
  nextTick(() => {
    observer.observe(listRef.value)
    setTimeout(() => {
      updateItemsSize()
    }, 100)
  })
})

onDeactivated(() => {
  unregisterInstance(instanceId.value)
  observer.unobserve(listRef.value)
  virtualScrolling.value = false
})

onMounted(() => {
  instanceId.value = Math.random().toString(36).substring(2, 9)
  registerInstance(instanceId.value)
  window.addEventListener('resize', updateWindowHeight)
  nextTick(() => {
    observer.observe(listRef.value)
    setTimeout(() => {
      updateItemsSize()
    }, 100)
  })
})

onUpdated(() => {
  nextTick(() => {
    updateItemsSize()
    setStartOffset()
  })
})

onBeforeUnmount(() => {
  unregisterInstance(instanceId.value)
  window.removeEventListener('resize', updateWindowHeight)
  observer.unobserve(listRef.value)
  virtualScrolling.value = false
  eventBus.off('update-start', startEvent)
  // @ts-ignore
  eventBus.off('update-scroll-bar', updateEvent)
  eventBus.off('update-done', startEvent)
})

defineExpose({ listRef, position, getStartIndex, binarySearch })
</script>

<style scoped>
.infinite-list-container::-webkit-scrollbar {
  width: 0;
}

.infinite-list-container {
  overflow-x: hidden;
  width: 100%;
  overflow-y: auto;
  position: relative;
}

.infinite-list-phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  /* z-index: -1; */
}

.infinite-list {
  left: 0;
  right: 0;
  top: 0;
  display: grid;
  position: absolute;
  box-sizing: border-box;
}
.position {
  position: fixed;
  display: flex;
  flex-direction: row;
  gap: 12px;
  padding: 12px;
  border-radius: 9999px;
  box-shadow: 0 8px 12px -6px rgba(0, 0, 0, 0.1);
  background: var(--color-secondary-bg);
  border: 1px solid rgba(60, 60, 60, 0.08);
  opacity: 0.75;
  bottom: 52px;
  right: 24px;
  transform: translate(0, -50%);
  transition: opacity 0.3s ease;
  z-index: 15;
}
.position > * {
  display: flex;
}
.position:hover {
  opacity: 0.9;
  cursor: pointer;
}
</style>
