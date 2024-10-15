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
      <div @click="scrollToTop">{{ $t('localMusic.scrollToTop') }}</div>
    </div>
    <div :style="listStyles" class="infinite-list">
      <div
        v-for="row in visibleData"
        :id="row._key"
        ref="itemsRef"
        :key="row._key"
        class="infinite-list-item-container"
      >
        <div class="infinite-item">
          <slot name="default" :index="row._key" :item="row.value"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  toRefs,
  PropType,
  onMounted,
  computed,
  nextTick,
  onUpdated,
  watch,
  onBeforeUnmount,
  onActivated,
  onDeactivated
} from 'vue'

const props = defineProps({
  list: { type: Array as PropType<any[]>, required: true },
  itemSize: { type: Number, default: 65 },
  columnNumber: { type: Number, default: 1 },
  aboveValue: { type: Number, default: 2 },
  belowValue: { type: Number, default: 2 },
  paddingBottom: { type: Number, default: 64 },
  showPosition: { type: Boolean, default: true },
  gap: { type: Number, default: 4 },
  height: { type: Number, default: 656 },
  loadMore: { type: Function as PropType<() => void>, default: () => {} }
})

const lock = ref(false)
const listRef = ref()
const itemsRef = ref()
const startRow = ref(0)
// const endRow = ref(0)
const styleBefore = ref()
const startOffset = ref(0)
const position = ref<any[]>([])
const { list, itemSize } = toRefs(props)

const _listData = computed(() => {
  return list.value.reduce((init, cur, index) => {
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
  return position.value[idx]?.bottom || totalRows * itemSize.value
})

const containerHeight = computed(() => {
  const navBarHeight = hasCustomTitleBar.value ? 84 : 64
  const windowHeight = window.innerHeight - navBarHeight
  return Math.min(windowHeight, listHeight.value, props.height)
})
const contentTransform = computed(() => `translateY(${startOffset.value}px)`)
const anchorPoint = computed(() =>
  position.value.length ? position.value[startRow.value * props.columnNumber] : null
)
const visibleCount = computed(() => Math.floor(containerHeight.value / itemSize.value))
const endRow = computed(() => startRow.value + visibleCount.value)
const aboveCount = computed(() => Math.min(startRow.value, props.aboveValue))
const belowCount = computed(() => Math.min(list.value.length - endRow.value, props.belowValue))
const visibleData = computed(() => {
  const _start = (startRow.value - aboveCount.value) * props.columnNumber
  const _end = (endRow.value + belowCount.value) * props.columnNumber
  return _listData.value.slice(_start, _end)
})
const listStyles = computed(() => {
  const navBarHeight = hasCustomTitleBar.value ? 84 : 64
  const windowHeight = window.innerHeight - navBarHeight
  return {
    gap: `0 ${props.gap}px`,
    gridTemplateColumns: `repeat(${props.columnNumber}, 1fr)`,
    transform: contentTransform.value,
    paddingBottom: `${listHeight.value > windowHeight ? props.paddingBottom : 0}px`
  }
})
const hasCustomTitleBar = computed(() => {
  return window.env?.isLinux || window.env?.isWindows
})

const initPosition = () => {
  position.value = _listData.value.map((d: any, index: number) => ({
    index,
    height: itemSize.value,
    top: Math.floor(index / props.columnNumber) * itemSize.value,
    bottom: (Math.floor(index / props.columnNumber) + 1) * itemSize.value
  }))
}
const updateItemsSize = () => {
  itemsRef.value?.forEach((node) => {
    if (node.id % props.columnNumber === 0) {
      const rect = node.getBoundingClientRect()
      const height = rect.height
      const index = +node.id
      const oldHeight = position.value[index].height
      const dValue = oldHeight - height

      if (dValue) {
        position.value[index].bottom -= dValue
        position.value[index].height = height
        position.value[index].over = true

        for (let k = index + 1; k < position.value.length; k++) {
          if (k % props.columnNumber !== 0) break
          position.value[k].top = position.value[k - props.columnNumber].bottom
          position.value[k].bottom -= dValue
        }
      }
    }
  })
}
const setStartOffset = () => {
  if (startRow.value >= 1) {
    // 此处可能有bug
    const size =
      position.value[startRow.value * props.columnNumber].top -
      (position.value[(startRow.value - aboveCount.value) * props.columnNumber].top || 0)
    startOffset.value = position.value[(startRow.value - 1) * props.columnNumber].bottom - size
  } else {
    startOffset.value = 0
  }
}

const scrollTocurrent = (index: number) => {
  const elTop =
    listRef.value.getBoundingClientRect().top - document.documentElement.getBoundingClientRect().top
  const root = document.documentElement
  root.scrollTo({
    top: elTop,
    behavior: 'smooth'
  })
  const idx = Math.floor((index - props.aboveValue) / props.columnNumber) || 0
  const top = position.value[idx * props.columnNumber]?.top || 0
  listRef.value.scrollTo({ top, behavior: 'smooth' })
}

let lastScrollTop = listRef.value?.scrollTop
const scrollToTop = () => {
  let isScrolling = true
  listRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  const checkScrolling = () => {
    const currentScrollTop = listRef.value?.scrollTop
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

const getStartIndex = (scrollTop = 0) => {
  return binarySearch(scrollTop)
}

// 此处可能有bug
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
      end = end - 1
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

const onScrollToBottom = () => {
  const scrollTop = listRef.value.scrollTop
  const containerHeight = listRef.value.clientHeight
  const contentHeight = listRef.value.scrollHeight

  if (scrollTop + containerHeight >= contentHeight) {
    props.loadMore()
  }
}

const onScroll = () => {
  const scrollTop = listRef.value.scrollTop
  if (scrollTop > anchorPoint.value?.bottom || scrollTop < anchorPoint.value?.top) {
    startRow.value = getStartIndex(scrollTop)
    // endRow.value = startRow.value + visibleCount.value
    setStartOffset()
  }
}

const scrollEvent = rafThrottle(() => {
  onScrollToBottom()
  onScroll()
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
    threshold: 1
  }
)

watch(_listData, (newList, oldList) => {
  if (newList.length > oldList.length) {
    lock.value = true
    const newItems = newList.slice(oldList.length)

    newItems.forEach(({ _key }) => {
      const idx = _key
      const top = itemSize.value * Math.floor(idx / props.columnNumber)
      position.value.push({ index: idx, height: itemSize.value, top, bottom: top + itemSize.value })
    })

    lock.value = false
  } else if (newList.length === oldList.length) {
    nextTick(() => {
      initPosition()
      startRow.value = 0
      // endRow.value = startRow.value + visibleCount.value
    })
  } else {
    initPosition()
  }
})

initPosition()

onActivated(() => {
  observer.observe(listRef.value)
})

onDeactivated(() => {
  startRow.value = 0
  // endRow.value = startRow.value + visibleCount.value
  observer.unobserve(listRef.value)
})

onMounted(() => {
  startRow.value = 0
  // endRow.value = startRow.value + visibleCount.value
  observer.observe(listRef.value)
})

onUpdated(() => {
  nextTick(() => {
    updateItemsSize()
    setStartOffset()
  })
})
onBeforeUnmount(() => {
  observer.unobserve(listRef.value)
})
</script>

<style scoped>
.infinite-list-container::-webkit-scrollbar {
  width: 0;
}

.infinite-list-container {
  /* overflow-x: hidden; */
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
  z-index: 1;
}
.position:hover {
  opacity: 0.9;
  cursor: pointer;
}
</style>
