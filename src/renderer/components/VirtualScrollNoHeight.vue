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
import SvgIcon from './SvgIcon.vue'
import eventBus from '../utils/eventBus'

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
const scrollToIndex = ref(0)
const instanceId = ref('')
const { list, itemSize } = toRefs(props)

const normalState = useNormalStateStore()
const { enableScrolling, virtualScrolling } = storeToRefs(normalState)
const { registerInstance, unregisterInstance, updateScroll } = normalState

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

watch(visibleMiddle, (value) => {
  if (Math.abs(scrollToIndex.value - value) <= 100) {
    virtualScrolling.value = false
  }
})

let lastScrollTop = listRef.value?.scrollTop

/**
 * 一、向下滚动: index > startRow.value
 *   1. 定位的元素小于窗口元素的一半时，此时虚拟列表不需要完全占据窗口，此时直接找到定位元素滚动到中间即可；
 *   2. 定位的元素大于窗口元素的一半时，虚拟列表完全占据窗口：
 *     1）、将虚拟列表滚动到占据整个窗口为止；
 *     2）、将定位的元素滚动到列表中间；
 * 二、向上滚动 index <= startRow.value
 *   1.定位元素大于窗口元素的一半时，虚拟列表完全占据窗口。此时虚拟列表滚动前后都完全占据窗口，只需要滚动元素即可；
 *   2. 定位元素大小窗口元素的一半时，说明虚拟列表由完全占据窗口滚动到部分占据窗口：
 *     1）、先把虚拟列表内部滚动到顶部；
 *     2）、然后找到定位元素滚动到页面中间；
 */
const scrollTocurrent = (index: number, behavior: ScrollBehavior = 'smooth') => {
  scrollToIndex.value = index
  const idx = index / props.columnNumber - Math.floor(visibleCount.value / 2)

  // 当定位元素和当前元素差距大于100时，会触发元素内的“快速”滚动，在一些流媒体音乐中可能会导致
  // 短时间内大量加载图片，导致响应错误。因此设置一个标志位，处于快速滚动时请求本地图片；
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
    const el = itemsRef.value?.find((el) => el.id === index.toString())
    el?.scrollIntoView({ block: 'center', behavior })
  }

  let top: number
  if (visibleCount.value % 2 === 0) {
    top = position.value[idx * props.columnNumber + 1]?.top || 0
  } else {
    top = position.value[idx * props.columnNumber]?.top || 0
  }
  if (listRef.value) listRef.value.scrollTo({ top, behavior })

  if (idx < 0 && index < startRow.value) {
    let isScrolling = true
    const checkScrolling = () => {
      const currentScrollTop = listRef.value?.scrollTop
      if (currentScrollTop === lastScrollTop) {
        if (isScrolling) {
          isScrolling = false
          const el = document.getElementById(index.toString())
          el?.scrollIntoView({ block: 'center', behavior })
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
  if (listRef.value) listRef.value.scrollTo({ top: 0, behavior: 'smooth' })
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

/**
 * 为了防止虚拟列表滚动速度过快，导致频繁请求本地歌曲封面/流媒体音乐封面，我们可以对正处于
 * 快速滚动的歌曲返回一张程序内的图片资源，以减轻资源占用问题。
 * 快速滚动的判定条件为：
 * 1. 虚拟列表处于滚动状态；
 * 2. 计算目标位置与当前位置之间的关系，如果两者初始差距大于100,则认为它会发生快速滚动，
 *    这里的100需要再次查证后进行调整（小于100则认为仅仅会发生慢速滚动，不会导致资源占用
 *    问题）
 * 当满足以上两个条件时，则认为虚拟列表正在快速滚动，此时这两个封面图片返回两张asset内的图片
 */

const getStartIndex = (scrollTop = 0) => {
  return binarySearch(scrollTop)
}

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

  registerInstance(instanceId.value)
  updateScroll(instanceId.value, {
    scrollTop,
    containerHeight,
    listHeight: listHeight.value
  })

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
    if (newList.length < startRow.value) {
      startRow.value = 0
    }
    initPosition()
  }
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
  if (listRef.value) listRef.value.scrollTo({ top, behavior: 'instant' })
}

eventBus.on('update-start', startEvent)

// @ts-ignore
eventBus.on('update-scroll-bar', updateEvent)

eventBus.on('update-done', startEvent)

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
  unregisterInstance(instanceId.value)
  observer.unobserve(listRef.value)
  virtualScrolling.value = false
})

onMounted(() => {
  // startRow.value = 0
  instanceId.value = Math.random().toString(36).substring(2, 9)
  registerInstance(instanceId.value)
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
  unregisterInstance(instanceId.value)
  window.removeEventListener('resize', updateWindowHeight)
  observer.unobserve(listRef.value)
  virtualScrolling.value = false
  eventBus.off('update-start', startEvent)
  // @ts-ignore
  eventBus.off('update-scroll-bar', updateEvent)
  eventBus.off('update-done', startEvent)
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
