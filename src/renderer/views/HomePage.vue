<template>
  <div v-show="show">
    <div ref="bannerRef" class="banner">
      <div v-for="item in banner" :key="item.id" class="banner-item">
        <img :src="imgFilter(item.imageUrl ?? item.pic)" alt="" />
        <div class="subtitle" :style="{ backgroundColor: item.titleColor }">{{
          item.typeTitle
        }}</div>
      </div>
    </div>
    <div class="index-row">
      <div class="title">
        {{ $t('home.recommendPlaylist') }}
        <a @click="toExplore('playlist', '推荐歌单')">{{ $t('home.seeMore') }}</a>
        <!-- <router-link to="/explore?category=推荐歌单">{{ $t('home.seeMore') }}</router-link> -->
      </div>
      <CoverRow :items="recommendPlaylist.items" type="playlist" sub-text="copywriter" />
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
      <CoverRow :items="recommendArtists.items" type="artist" :colunm-number="6" />
    </div>
    <div class="index-row">
      <div class="title">
        {{ $t('home.newAlbum') }}
        <a @click="toExplore('newAlbum')">{{ $t('home.seeMore') }}</a>
        <!-- <router-link to="/new-album">{{ $t('home.seeMore') }}</router-link> -->
      </div>
      <CoverRow :items="newReleasesAlbum.items" type="album" sub-text="artist" />
    </div>
    <div class="index-row">
      <div class="title">
        {{ $t('home.charts') }}
        <a @click="toExplore('chart')">{{ $t('home.seeMore') }}</a>
        <!-- <router-link :to="toExplore('排行榜')">{{ $t('home.seeMore') }}</router-link> -->
      </div>
      <CoverRow :items="topList.items" type="playlist" sub-text="updateFrequency" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onActivated, ref, onBeforeUnmount } from 'vue'
import { getBanner } from '../api/other'
import { toplistOfArtists } from '../api/artist'
import { newAlbums } from '../api/album'
import { toplists } from '../api/playlist'
import { getRecommendPlayList } from '../utils/playlist'
import { tricklingProgress } from '../utils/tricklingProgress'
import CoverRow from '../components/CoverRow.vue'
import DailyTracksCard from '../components/DailyTracksCard.vue'
import FMCard from '../components/FMCard.vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../store/settings'
import { useNormalStateStore } from '../store/state'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import Utils from '../utils'

const toplistOfArtistsAreaTable = {
  all: null,
  zh: 1,
  ea: 2,
  jp: 4,
  kr: 3
}
const { general } = storeToRefs(useSettingsStore())
const { exploreTab } = storeToRefs(useNormalStateStore())
const { addTrackToPlayNext } = usePlayerStore()

const router = useRouter()

// banner
const banner = ref<any[]>([])
const bannerRef = ref<HTMLElement>()
const left = ref(-1)
const current = ref(0)
const timer = ref<any>(null)
const show = ref(false)

// 推荐歌单
const recommendPlaylist = ref<{ items: any[] }>({ items: [] })

// 推荐歌手
const recommendArtists = ref<{ items: any[]; indexs: any[] }>({
  items: [],
  indexs: []
})

// 新专速递
const newReleasesAlbum = ref<{ items: any[] }>({ items: [] })

// 排行榜
const topList = ref<{ items: any[]; ids: number[] }>({
  items: [],
  ids: [19723756, 180106, 60198, 3812895, 60131]
})

const toExplore = (tab: string, Category = '全部') => {
  exploreTab.value = tab
  router.push({ name: 'explore', query: { category: Category, tab, type: '全部' } })
}

const bannerChange = () => {
  if (!bannerRef.value || !bannerRef.value.children || bannerRef.value.children.length === 0) return;
  left.value =
    (current.value - 1 + bannerRef.value.children.length) % bannerRef.value.children.length
  const right = (current.value + 1) % bannerRef.value.children.length
  Array.from(bannerRef.value.children).forEach((item, index) => {
    if (item) item.className = 'banner-item'
  })
  if (bannerRef.value.children[left.value]) {
    bannerRef.value.children[left.value].className = 'banner-item left'
  }
  if (bannerRef.value.children[current.value]) {
    bannerRef.value.children[current.value].className = 'banner-item center'
    bannerRef.value.children[current.value].addEventListener('click', () => {
      handleBannerClick(banner.value[current.value])
    })
  }
  if (bannerRef.value.children[right]) {
    bannerRef.value.children[right].className = 'banner-item right'
  }
}

const bannerNext = () => {
  current.value = (current.value + 1) % banner.value.length
  bannerChange()
}

const handleBannerClick = (banner: any) => {
  if (['新歌首发', '热歌推荐'].includes(banner.typeTitle)) {
    addTrackToPlayNext(banner.targetId, true, true)
  } else if (banner.typeTitle === '新碟首发') {
    router.push(`/album/${banner.targetId}`)
  } else if (banner.typeTitle === '数字专辑') {
    // 数字专辑，跳转至数字专辑详情
    const url = new URL(banner.url)
    const id = url.searchParams.get('id')
    router.push(`/album/${id}`)
  } else if (banner.typeTitle === '歌单推荐') {
    router.push(`/playlist/${banner.targetId}`)
  } else if (banner.typeTitle === 'MV首发') {
    router.push(`/mv/${banner.targetId}`)
  } else if (banner.url) {
    Utils.openExternal(banner.url)
  }
}

const imgFilter = (img: string) => {
  return img.replace('http://', 'https://')
}

const loadData = () => {
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)
  getBanner({ type: 0 }).then((res) => {
    banner.value = res.banners.filter((item: any) => item.typeTitle !== '广告')
    setTimeout(bannerChange)

    if (timer.value) clearInterval(timer.value)
    timer.value = setInterval(() => {
      bannerNext()
      // 轮播后，需要把左边那一张图的点击事件取消掉，这里直接使用节点替换的方式更为彻底，需要在切换动画结束后再进行
      setTimeout(() => {
        if (bannerRef.value && bannerRef.value.children[left.value]) {
          const newNode = bannerRef.value.children[left.value].cloneNode(true)
          bannerRef.value.children[left.value].replaceWith(newNode)
        }
      }, 800)
    }, 8000)
  })

  getRecommendPlayList(10, false).then((items) => {
    recommendPlaylist.value.items = items
    tricklingProgress.done()
    show.value = true
  })

  toplistOfArtists(toplistOfArtistsAreaTable[general.value.musicLanguage ?? 'all']).then((data) => {
    const indexs: any[] = []
    while (indexs.length < 6) {
      const tmp = ~~(Math.random() * 100)
      if (!indexs.includes(tmp)) indexs.push(tmp)
    }
    recommendArtists.value.indexs = indexs
    recommendArtists.value.items = data.list.artists.filter((l, index) => indexs.includes(index))
  })

  newAlbums({
    area: general.value.musicLanguage ?? 'all',
    limit: 10
  }).then((data) => {
    newReleasesAlbum.value.items = data.albums
  })

  toplists().then((data: any) => {
    topList.value.items = data.list.filter((l: any) => topList.value.ids.includes(l.id))
  })
}

onActivated(() => {
  loadData()
})

onBeforeUnmount(() => {
  clearInterval(timer.value)
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
      font-weight: bold;
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
