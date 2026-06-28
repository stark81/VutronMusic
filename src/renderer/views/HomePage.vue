<template>
  <div v-show="show">
    <div
      v-if="general.showBanner"
      ref="bannerRef"
      class="banner"
      @click="handleBannerContainerClick"
    >
      <div v-for="item in banner" :key="item.id" class="banner-item">
        <img :src="item.picUrl" alt="" />
        <div class="subtitle" :style="{ backgroundColor: 'red' }">{{ item.typeTitle }}</div>
      </div>
    </div>
    <div class="index-row">
      <div class="title">
        {{ $t('home.recommendPlaylist') }}
        <a @click="toExplore('playlist', '推荐歌单')">{{ $t('home.seeMore') }}</a>
      </div>
      <CoverRow :items="recommendPlaylist" type="Playlist" sub-text="copywriter" />
    </div>
    <div class="index-row">
      <div class="title"> For You </div>
      <div class="for-you-row">
        <DailyTracksCard ref="DailyTracksCardRef" :plugin="pluginId" />
        <FMCard />
      </div>
    </div>
    <div class="index-row">
      <div class="title">{{ $t('home.recommendArtist') }}</div>
      <CoverRow :items="recommendArtists" type="Artist" :colunm-number="6" />
    </div>
    <div class="index-row">
      <div class="title">
        {{ $t('home.newAlbum') }}
        <a @click="toExplore('newAlbum')">{{ $t('home.seeMore') }}</a>
      </div>
      <CoverRow :items="newReleasesAlbum.items" type="Album" sub-text="artist" />
    </div>
    <div class="index-row">
      <div class="title">
        {{ $t('home.charts') }}
        <a @click="toExplore('chart')">{{ $t('home.seeMore') }}</a>
      </div>
      <CoverRow :items="topList.items" type="Playlist" sub-text="copywriter" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, watch, onMounted, computed, nextTick } from 'vue'
import { tricklingProgress } from '../utils/tricklingProgress'
import CoverRow from '../components/CoverRow.vue'
import DailyTracksCard from '../components/DailyTracksCard.vue'
import FMCard from '../components/FMCard.vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../store/settings'
import { useNormalStateStore } from '../store/state'
import { usePluginMusic } from '../store/pluginMusic'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import Utils from '../utils'
import { Album, Artist, Banner, ExploreTab, Playlist, PluginId } from '@/types/plugin'

const { general } = storeToRefs(useSettingsStore())
const { exploreTab, showLyrics } = storeToRefs(useNormalStateStore())

const pluginMusicStore = usePluginMusic()
const { pluginMethodCall } = pluginMusicStore

const { addTrackToPlayNext } = usePlayerStore()

const router = useRouter()

// banner
const banner = ref<Banner[]>([])
const bannerRef = ref<HTMLElement>()
const current = ref(0)
const timer = ref<any>(null)
const show = ref(false)

const pluginId = computed(() => {
  const active = pluginMusicStore.services.find((item) => item.active)
  return active?.code ?? ('' as PluginId)
})

// 推荐歌单
const recommendPlaylist = ref<Playlist[]>([])

// 推荐歌手
const recommendArtists = ref<Artist[]>([])

// 新专速递
const newReleasesAlbum = ref<{ hasMore: boolean; items: Album[] }>({ hasMore: false, items: [] })

// 排行榜
const topList = ref<{ items: Playlist[]; ids: number[] }>({
  items: [],
  ids: [19723756, 180106, 60198, 3812895, 60131]
})

const toExplore = (tab: ExploreTab, Category = '全部') => {
  exploreTab.value = tab
  router.push({ name: 'explore', query: { category: Category, tab, type: '全部' } })
}

const bannerChange = () => {
  if (!bannerRef.value) return
  const total = bannerRef.value.children.length
  const leftIdx = (current.value - 1 + total) % total
  const rightIdx = (current.value + 1) % total

  Array.from(bannerRef.value.children).forEach((item, index) => {
    // 移除所有位置 class，保留其他 class
    item.classList.remove('left', 'center', 'right')
    if (index === leftIdx) item.classList.add('left')
    else if (index === current.value) item.classList.add('center')
    else if (index === rightIdx) item.classList.add('right')
  })
}

const bannerNext = () => {
  if (!banner.value.length) return
  current.value = (current.value + 1) % banner.value.length
  bannerChange()
}

const bannerPrev = () => {
  if (!banner.value.length) return
  current.value = (current.value - 1 + banner.value.length) % banner.value.length
  bannerChange()
}

// 修复：事件委托统一处理点击，左图切换到上一张，右图切换到下一张，中间图跳转内容
const handleBannerContainerClick = (e: MouseEvent) => {
  if (!bannerRef.value) return
  const target = (e.target as HTMLElement).closest('.banner-item')
  if (!target) return

  const index = Array.from(bannerRef.value.children).indexOf(target)
  const total = bannerRef.value.children.length
  const leftIdx = (current.value - 1 + total) % total
  const rightIdx = (current.value + 1) % total

  if (index === current.value) {
    handleBannerClick(banner.value[current.value])
  } else if (index === leftIdx) {
    bannerPrev()
  } else if (index === rightIdx) {
    bannerNext()
  }
}

const handleBannerClick = (bannerItem: Banner) => {
  if (bannerItem.type === 'track') {
    addTrackToPlayNext([[bannerItem.pluginId, bannerItem.sourceContext]], true, true)
  } else if (bannerItem.type === 'album') {
    router.push(`/album/${pluginId.value}/${JSON.stringify(bannerItem.sourceContext)}`)
  } else if (bannerItem.type === 'playlist') {
    router.push(`/playlist/${pluginId.value}/${JSON.stringify(bannerItem.sourceContext)}`)
  } else if (bannerItem.type === 'mv') {
    router.push(`/mv/${bannerItem.sourceId}`)
  } else if (bannerItem.url) {
    Utils.openExternal(bannerItem.url)
  }
}

const loadData = async () => {
  if (!pluginId.value) return
  show.value = true
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)

  if (general.value.showBanner) {
    pluginMethodCall(pluginId.value, 'getBanner').then((res) => {
      banner.value = res.data.map((it) => ({ ...it, pluginId: pluginId.value }))
      current.value = 0
      nextTick(() => {
        bannerChange()
        handleBanner()
      })
    })
  }

  pluginMethodCall(pluginId.value, 'getRecommendPlaylist').then((res) => {
    recommendPlaylist.value = res.data.map((item) => ({ ...item, pluginId: pluginId.value }))
    tricklingProgress.done()
  })

  pluginMethodCall(pluginId.value, 'topArtists', { reset: true, isFull: false }).then((res) => {
    const artists = res.data.map((item) => ({ ...item, pluginId: pluginId.value }))
    const idx: number[] = []
    const targetCount = Math.min(6, artists.length)
    while (idx.length < targetCount) {
      const tmp = ~~(Math.random() * artists.length)
      if (!idx.includes(tmp)) idx.push(tmp)
    }
    recommendArtists.value = artists
      .filter((_, index) => idx.includes(index))
      .map((item) => ({ ...item, pluginId: pluginId.value }))
  })

  pluginMethodCall(pluginId.value, 'topAlbums').then((data) => {
    newReleasesAlbum.value.hasMore = data.hasMore
    newReleasesAlbum.value.items = data.albums.map((item) => ({
      ...item,
      artists: item.artists?.map((it) => ({ ...it, pluginId: pluginId.value })),
      pluginId: pluginId.value
    }))
  })

  pluginMethodCall(pluginId.value, 'rankTop').then((result) => {
    topList.value.items = result.data
      .slice(0, 5)
      .map((item) => ({ ...item, pluginId: pluginId.value }))
  })
}

const handleBanner = () => {
  if (timer.value) clearInterval(timer.value)
  timer.value = setInterval(bannerNext, 8000)
}

const handleVisibleChange = () => {
  if (document.hidden) {
    clearInterval(timer.value)
  } else {
    handleBanner()
  }
}

watch(showLyrics, (value) => {
  if (value) {
    clearInterval(timer.value)
  } else {
    handleBanner()
  }
})

document.addEventListener('visibilitychange', handleVisibleChange)

watch(pluginId, (value) => {
  if (value) loadData()
})

onMounted(async () => {
  await nextTick()
  loadData()
})

onBeforeUnmount(() => {
  show.value = false
  clearInterval(timer.value)
  document.removeEventListener('visibilitychange', handleVisibleChange)
})
</script>

<style scoped lang="scss">
.banner {
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
  height: 180px;

  .banner-item {
    width: 440px;
    position: absolute;
    overflow: hidden;
    z-index: 0;
    transition: all 0.45s ease-in-out;

    img {
      width: 100%;
      border-radius: 8px;
      object-fit: cover;
      display: block;
    }

    .subtitle {
      position: absolute;
      bottom: 0;
      right: 0;
      font-size: 10px;
      font-weight: 600;
      color: white;
      padding: 2px 4px;
      border-radius: 8px 0 8px 0;
    }
  }

  .banner-item.center {
    cursor: pointer;
    transform: scale(1.2);
    z-index: 2;
  }

  .banner-item.left {
    cursor: pointer;
    transform: translateX(calc(220px - 42.5vw));
    z-index: 1;
  }

  .banner-item.right {
    cursor: pointer;
    transform: translateX(calc(42.5vw - 220px));
    z-index: 1;
  }
}

.index-row {
  margin-top: 50px;

  .title {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 20px;
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text);

    a {
      font-size: 13px;
      font-weight: 600;
      opacity: 0.68;
    }
  }
}

.for-you-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 78px;
}
</style>
