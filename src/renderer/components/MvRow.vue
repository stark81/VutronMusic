<template>
  <VirtualList
    ref="listRef"
    :list="mvs"
    :gap="gap"
    :column-number="columnNumber"
    :is-end="isEnd"
    :item-size="itemSize"
    :show-position="showPosition"
    :show-footer="false"
    :padding-bottom="paddingBottom"
    :load-more="loadMore"
  >
    <template #default="{ item }">
      <div class="mv">
        <div
          class="cover"
          @mousemove="hoverVideoID = item.id"
          @mouseleave="hoverVideoID = 0"
          @click="goToMv(item.id)"
        >
          <img :src="getUrl(item)" loading="lazy" />
          <transition name="fade">
            <div
              v-show="hoverVideoID === getID(item)"
              class="shadow"
              :style="{ background: 'url(' + getUrl(item) + ')' }"
            ></div>
          </transition>
        </div>
        <div class="info">
          <div class="title" :title="item.name">
            <router-link :to="`/mv/${getID(item)}`">{{ item.name }}</router-link>
          </div>
          <div v-same-html="getSubTitle(item)" class="artist"></div>
        </div>
      </div>
    </template>
  </VirtualList>
</template>

<script setup lang="ts">
import { PropType, ref, toRefs } from 'vue'
import VirtualList from './VirtualScrollNoHeight.vue'
import { useRouter } from 'vue-router'
import { Mv } from '@/types/plugin'
import { formatDate } from '../utils'

const props = defineProps({
  mvs: {
    type: Array as () => Mv[],
    required: true
  },
  isEnd: {
    type: Boolean,
    default: false
  },
  columnNumber: {
    type: Number,
    default: 5
  },
  subtitle: {
    type: String,
    default: 'artist'
  },
  gap: {
    type: Number,
    default: 20
  },
  itemSize: {
    type: Number,
    default: 163
  },
  showPosition: {
    type: Boolean,
    default: false
  },
  paddingBottom: {
    type: Number,
    default: 64
  },
  loadMore: {
    type: Function as PropType<() => void>,
    default: () => {}
  }
})

const { mvs } = toRefs(props)
const hoverVideoID = ref<number | string>(0)
const listRef = ref()
const router = useRouter()

const getID = (item: { [key: string]: any }) => {
  if (item.id !== undefined) {
    return item.id
  } else {
    return item.vid
  }
}

const goToMv = (id: number | string) => {
  router.push(`/mv/${id}`)
}

const getSubTitle = (item: Mv) => {
  if (props.subtitle === 'artist') {
    let artistName = ''
    let artistID: number | string = 0
    artistName = item.artists[0].name
    artistID = item.artists[0].id
    return `<a href="/#/artist/${artistID}">${artistName}</a>`
  } else if (props.subtitle === 'publishTime') {
    return formatDate(item.publishTime, 'YYYY-MM-DD')
  }
}

const getUrl = (item: Mv) => {
  const url = item.picUrl // item.imgurl16v9 ?? item.cover ?? item.coverUrl
  return url.replace(/^http:/, 'https:') + '?param=464y260'
}

// const updatePadding = inject('updatePadding') as (padding: number) => void

// onActivated(() => {
//   updatePadding(0)
// })
// onDeactivated(() => {
//   updatePadding(96)
// })

// onMounted(() => {
//   updatePadding(0)
// })
// onBeforeUnmount(() => {
//   updatePadding(96)
// })
</script>

<style scoped lang="scss">
.cover {
  position: relative;
  transition: transform 0.3s;
  &:hover {
    cursor: pointer;
  }
}
img {
  border-radius: 0.75em;
  width: 100%;
  aspect-ratio: 16 / 9;
  user-select: none;
}
.shadow {
  position: absolute;
  top: 6px;
  height: 100%;
  width: 100%;
  filter: blur(16px) opacity(0.4);
  transform: scale(0.9, 0.9);
  z-index: -1;
  background-size: cover;
  border-radius: 0.75em;
}
.mv {
  color: var(--color-text);
  padding-bottom: 20px;
}
.title {
  font-size: 16px;
  font-weight: 600;
  opacity: 0.88;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  overflow: hidden;
  word-break: break-all;
}
.artist {
  font-size: 12px;
  opacity: 0.68;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  overflow: hidden;
}
</style>
