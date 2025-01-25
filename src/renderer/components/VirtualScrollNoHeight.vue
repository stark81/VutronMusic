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
      <div v-if="showFooter" ref="footerRef">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
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
  onDeactivated,
  inject
} from 'vue'

type ScrollBehavior = 'auto' | 'instant' | 'smooth'

const props = defineProps({
  list: { type: Array as PropType<any[]>, required: true },
  itemSize: { type: Number, default: 65 },
  columnNumber: { type: Number, default: 1 },
  aboveValue: { type: Number, default: 2 },
  belowValue: { type: Number, default: 2 },
  paddingBottom: { type: Number, default: 64 },
  showPosition: { type: Boolean, default: true },
  isEnd: { type: Boolean, required: true },
  showFooter: { type: Boolean, default: true },
  gap: { type: Number, default: 4 },
  height: { type: Number, default: 0 },
  enableVirtualScroll: { type: Boolean, default: true },
  loadMore: { type: Function as PropType<() => void>, default: () => {} }
})

const lock = ref(false)
const listRef = ref()
const footerRef = ref()
const itemsRef = ref()
const startRow = ref(0)
const styleBefore = ref()
const startOffset = ref(0)
const position = ref<any[]>([])
const windowHeight = ref(window.innerHeight)
const { list, itemSize } = toRefs(props)

const normalState = useNormalStateStore()
const { enableScrolling } = storeToRefs(normalState)

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
const visibleCount = computed(() => {
  const result = Math.floor(containerHeight.value / itemSize.value)
  if (result % 2 === 0) return result - 1
  return result
})
const endRow = computed(() => startRow.value + visibleCount.value)
const aboveCount = computed(() => Math.min(startRow.value, props.aboveValue))
const belowCount = computed(() => Math.min(list.value.length - endRow.value, props.belowValue))
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

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))

const _isPrefixSubset = (oldArray: any[], newArray: any[]) => {
  if (newArray.length < oldArray.length || !oldArray.length) return false
  for (let i = 0; i < oldArray.length; i++) {
    if (
      Object.prototype.hasOwnProperty.call(newArray[i].value, 'commentId') &&
      newArray[i].value?.commentId !== oldArray[i].value?.commentId
    ) {
      return false
    } else if (
      Object.prototype.hasOwnProperty.call(newArray[i].value, 'id') &&
      newArray[i].value?.id !== oldArray[i].value?.id
    ) {
      return false
    }
  }
  return true
}

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
  if (!position.value.length) return
  if (startRow.value >= 1) {
    // 此处可能有bug
    const size =
      position.value[startRow.value * props.columnNumber]?.top -
      (position.value[(startRow.value - aboveCount.value) * props.columnNumber]?.top || 0)
    startOffset.value = position.value[(startRow.value - 1) * props.columnNumber]?.bottom - size
  } else {
    startOffset.value = 0
  }
}

const scrollTocurrent = (index: number, behavior: ScrollBehavior = 'smooth') => {
  const elTop =
    listRef.value.getBoundingClientRect().top - document.documentElement.getBoundingClientRect().top
  const root = document.documentElement
  root.scrollTo({
    top: elTop,
    behavior
  })
  const idx = index / props.columnNumber - Math.floor(visibleCount.value / 2)
  const top = position.value[idx * props.columnNumber]?.top || 0
  listRef.value.scrollTo({ top, behavior })
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
    setStartOffset()
  }
}

const scrollEvent = rafThrottle(() => {
  onScrollToBottom()
  onScroll()
})

/**
 * 条件：
 * 1. 该组件请在页面的最后来使用，如果在页面中间使用时，请确保传入的props.height小于window.innerHeight - 84(64)
 * 2. 当滚动组件与窗口的intersect为1时，将window设置为不可滚动，组件内部设置为可滚动，同时记录滚动距离；
 * 3. 当内部滚动到顶部、底部时，设置窗口可滚动、组件内部不可滚动；
 */
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
    rootMargin: `-${hasCustomTitleBar.value ? 84 : 64}px 0px 0px 0px`,
    // 这里设置成0.98的目的，是为了确保在special-playlist页面可以正常进入到滚动状态
    // 某些情况下，页面会无法达到1，导致无法滚动
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

watch(_listData, (newList, oldList) => {
  const isMore = _isPrefixSubset(oldList, newList)
  if (isMore) {
    lock.value = true
    const newItems = newList.slice(oldList.length)

    newItems.forEach(({ _key }) => {
      const idx = _key
      // idx的top，应该是上一行第一个的bottom，获取上一行第一个的index
      const i = (Math.floor(idx / props.columnNumber) - 1) * props.columnNumber
      const top = position.value[i]?.bottom
      position.value.push({ index: idx, height: itemSize.value, top, bottom: top + itemSize.value })
    })

    lock.value = false
  } else {
    initPosition()
  }
})

initPosition()

onActivated(() => {
  observer.observe(listRef.value)
  setTimeout(() => {
    // 恢复虚拟列表的位置
    // scrollTocurrent(
    //   startRow.value * props.columnNumber + Math.ceil(visibleCount.value / 2),
    //   'instant'
    // )
    updateItemsSize()
  }, 100)
})

onDeactivated(() => {
  // startRow.value = 0
  observer.unobserve(listRef.value)
})

onMounted(() => {
  // startRow.value = 0
  window.addEventListener('resize', updateWindowHeight)
  observer.observe(listRef.value)
  setTimeout(() => {
    updateItemsSize()
  }, 100)
})

onUpdated(() => {
  nextTick(() => {
    updateItemsSize()
    setStartOffset()
  })
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateWindowHeight)
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
  z-index: 15;
}
.position:hover {
  opacity: 0.9;
  cursor: pointer;
}
</style>
