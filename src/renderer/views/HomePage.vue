<template>
  <div v-show="show">
    <div v-if="general.showBanner" ref="bannerRef" class="banner">
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
      <CoverRow :items="recommendPlaylist" type="playlist" sub-text="copywriter" />
    </div>
    <div class="index-row">
      <div class="title"> For You </div>
      <div class="for-you-row">
        <DailyTracksCard ref="DailyTracksCardRef" />
        <FMCard />
      </div>
    </div>
    <div class="index-row">
      <div class="title">{{ $t('home.recommendArtist') }}</div>
      <CoverRow :items="recommendArtists" type="artist" :colunm-number="6" />
    </div>
    <div class="index-row">
      <div class="title">
        {{ $t('home.newAlbum') }}
        <a @click="toExplore('newAlbum')">{{ $t('home.seeMore') }}</a>
      </div>
      <CoverRow :items="newReleasesAlbum.items" type="album" sub-text="artist" />
    </div>
    <div class="index-row">
      <div class="title">
        {{ $t('home.charts') }}
        <a @click="toExplore('chart')">{{ $t('home.seeMore') }}</a>
      </div>
      <CoverRow :items="topList.items" type="playlist" sub-text="copywriter" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onBeforeUnmount,
  watch,
  onMounted,
  computed,
  nextTick
  // onDeactivated,
  // onActivated
} from 'vue'
import { tricklingProgress } from '../utils/tricklingProgress'
import CoverRow from '../components/CoverRow.vue'
import DailyTracksCard from '../components/DailyTracksCard.vue'
import FMCard from '../components/FMCard.vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../store/settings'
import { useNormalStateStore } from '../store/state'
import { usePlayerStore } from '../store/player'
import { usePluginMusic } from '../store/pluginMusic'
import { storeToRefs } from 'pinia'
import Utils from '../utils'
import { Album, Artist, Banner, Playlist, PluginId } from '@/types/plugin'

const { general } = storeToRefs(useSettingsStore())
const { exploreTab, showLyrics, dailyTracks } = storeToRefs(useNormalStateStore())
const { addTrackToPlayNext } = usePlayerStore()

const pluginMusicStore = usePluginMusic()
const { pluginMethodCall } = pluginMusicStore

const router = useRouter()

// banner
const banner = ref<Banner[]>([])
const bannerRef = ref<HTMLElement>()
const left = ref(-1)
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

const toExplore = (tab: string, Category = '全部') => {
  exploreTab.value = tab
  router.push({ name: 'explore', query: { category: Category, tab, type: '全部' } })
}

const bannerChange = () => {
  if (!bannerRef.value) return
  left.value =
    (current.value - 1 + bannerRef.value!.children.length) % bannerRef.value!.children.length
  const right = (current.value + 1) % bannerRef.value!.children.length
  if (bannerRef.value) {
    Array.from(bannerRef.value.children).forEach((item) => {
      item.className = 'banner-item'
    })
    bannerRef.value.children[left.value].className = 'banner-item left'
    bannerRef.value.children[current.value].className = 'banner-item center'
    bannerRef.value?.children[current.value].addEventListener('click', () => {
      handleBannerClick(banner.value[current.value])
    })
    bannerRef.value.children[right].className = 'banner-item right'
  }
}

const bannerNext = () => {
  current.value = (current.value + 1) % banner.value.length
  bannerChange()
  setTimeout(() => {
    const newNode = bannerRef.value?.children[left.value].cloneNode(true)
    if (!newNode) return
    bannerRef.value?.children[left.value].replaceWith(newNode)
  }, 800)
}

const handleBannerClick = (banner: Banner) => {
  if (banner.type === 'track') {
    addTrackToPlayNext(Number(banner.sourceId), true, true)
  } else if (banner.type === 'album') {
    router.push(`/album/${banner.sourceId}`)
  } else if (banner.type === 'playlist') {
    router.push(`/playlist/${banner.sourceId}`)
  } else if (banner.type === 'mv') {
    router.push(`/mv/${banner.sourceId}`)
  } else if (banner.url) {
    Utils.openExternal(banner.url)
  }
}

const loadData = async () => {
  if (!pluginId.value) return
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)

  if (general.value.showBanner) {
    pluginMethodCall(pluginId.value, 'getBanner').then((res) => {
      banner.value = res.data
      setTimeout(bannerChange)
      handleBanner()
    })
  }

  pluginMethodCall(pluginId.value, 'getRecommendPlaylist').then((res) => {
    recommendPlaylist.value = res.data.map((item) => ({ ...item, pluginId: pluginId.value }))
    tricklingProgress.done()
    show.value = true
  })

  pluginMethodCall(pluginId.value, 'getRecommendTracks').then((result) => {
    dailyTracks.value = result.data.map((item) => ({ ...item, pluginId: pluginId.value }))
  })

  pluginMethodCall(pluginId.value, 'topArtists').then((res) => {
    const artists = res.data.map((item) => ({ ...item, pluginId: pluginId.value }))
    const idx: number[] = []
    while (idx.length < 6) {
      const tmp = ~~(Math.random() * artists.length)
      if (!idx.includes(tmp)) idx.push(tmp)
    }
    recommendArtists.value = artists
      .filter((l, index) => idx.includes(index))
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
  timer.value = setInterval(() => {
    bannerNext()
  }, 8000)
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
    handleBanner()
  } else {
    clearInterval(timer.value)
  }
})

document.addEventListener('visibilitychange', handleVisibleChange)

watch(pluginId, (value) => {
  if (value) loadData()
})

// onActivated(() => {
//   loadData()
//   // setTimeout(loadData, 1000)
// })

// onDeactivated(() => {
//   show.value = false
//   clearInterval(timer.value)
// })

// onBeforeMount(async () => {
//   await getPlugins()
// })

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
    transform: translateX(calc(220px - 42.5vw));
    z-index: 1;
  }
  .banner-item.right {
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
