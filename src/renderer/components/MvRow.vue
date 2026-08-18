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
          @click="goToMv(item)"
        >
          <img :src="item.picUrl" loading="lazy" />
          <transition name="fade">
            <div
              v-show="hoverVideoID === item.id"
              class="shadow"
              :style="{ background: 'url(' + item.picUrl + ')' }"
            ></div>
          </transition>
        </div>
        <div class="info">
          <div class="title" :title="item.name">
            <router-link :to="`/mv/${item.pluginId}/${item.sourceContext}`">{{
              item.name
            }}</router-link>
          </div>
          <div v-same-html="getSubTitle(item)" class="artist"></div>
        </div>
      </div>
    </template>
  </VirtualList>
</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, PropType, ref, toRefs } from 'vue'
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
// const listRef = ref()
const router = useRouter()

const goToMv = (mv: Mv) => {
  router.push(`/mv/${mv.pluginId}/${JSON.stringify(mv.sourceContext)}`)
}

const getSubTitle = (item: Mv) => {
  if (props.subtitle === 'artist') {
    const artist = item.artists?.[0]
    if (!artist) return ''
    const artistName = artist.name
    const sourceContext = JSON.stringify(artist.sourceContext)
    return `<a href='/#/artist/${artist.pluginId}/${sourceContext}''>${artistName}</a>`
  } else if (props.subtitle === 'publishTime') {
    return formatDate(item.publishTime, 'YYYY-MM-DD')
  }
}

const updatePadding = inject('updatePadding') as (padding: number) => void

onMounted(() => {
  updatePadding(0)
})
onBeforeUnmount(() => {
  updatePadding(96)
})
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
