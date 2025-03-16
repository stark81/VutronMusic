<template>
  <div class="explore-page">
    <div v-if="exploreTab === 'playlist'">
      <div class="buttons">
        <div
          v-for="category in general.enabledPlaylistCategories"
          :key="category"
          class="button"
          :class="{ active: category === activeCategory && !showCatOptions }"
          @click="goToCategory('playlist', category)"
        >
          {{ category }}
        </div>
        <div
          class="button more"
          :class="{ active: showCatOptions }"
          @click="showCatOptions = !showCatOptions"
        >
          <svg-icon icon-class="more"></svg-icon>
        </div>
      </div>

      <div v-show="showCatOptions" class="panel">
        <div v-for="bigCat in allBigCats" :key="bigCat" class="big-cat">
          <div class="name">{{ bigCat }}</div>
          <div class="cats">
            <div
              v-for="cat in getCatsByBigCat(bigCat)"
              :key="cat.name"
              class="cat"
              :class="{
                active: general.enabledPlaylistCategories.includes(cat.name)
              }"
              @click="togglePlaylistCategory(cat.name)"
              ><span>{{ cat.name }}</span></div
            >
          </div>
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'chart'" class="chart-list">
      <div v-for="(lst, index) in showList" :key="index" class="chart-item">
        <div class="img">
          <Cover :id="lst?.id" :type="'playlist'" :image-url="lst?.coverImgUrl" class="cover" />
          <div class="update">{{ lst?.updateFrequency }}</div>
        </div>
        <div class="track">
          <div v-for="(key, idx) in getTrack(lst?.tracks)" :key="idx" class="track-item"
            >{{ key.join(' - ').slice(0, 33) }}
          </div>
          <!-- <div class="track-item">{{ lst?.updateFrequency }}</div> -->
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'artist'">
      <div class="panel" style="background-color: unset">
        <div
          v-for="bigCat in artistBigCats"
          :key="bigCat"
          class="big-cat"
          style="margin-bottom: 10px"
        >
          <div class="name">{{ bigCat }}</div>
          <div class="cats">
            <div
              v-for="cat in getArtistCatsByBigCat(bigCat)"
              :key="cat.name"
              class="cat unset"
              :class="{
                active: activeArtistCat.includes(cat)
              }"
              @click="toggleArtistCategory(cat)"
              ><span>{{ cat.name }}</span></div
            >
          </div>
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'newTrack'">
      <div class="buttons">
        <div
          v-for="category in newTrackBtn"
          :key="category"
          class="button"
          :class="{ active: category === activeCategory }"
          @click="goToCategory('newTrack', category)"
        >
          {{ category }}
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'newAlbum'" class="albumsTab">
      <div class="buttons">
        <div
          v-for="category in newTrackBtn"
          :key="category"
          class="button"
          :class="{ active: category === activeCategory }"
          @click="goToCategory('newAlbum', category)"
        >
          {{ category }}
        </div>
      </div>
      <div class="buttons">
        <div
          v-for="(type, index) in albumTypeBtn"
          :key="index"
          class="button"
          :class="{ active: type === albumType }"
          :style="{ backgroundColor: 'unset', margin: '10px 0 6px 0' }"
          @click="updateType(type)"
          >{{ type }}</div
        >
      </div>
    </div>

    <div v-if="exploreTab === 'newTrack'" class="playlists">
      <TrackList :id="11" :items="tracks" :colunm-number="1" :type="'playlist'" :is-end="true" />
    </div>
    <div v-else-if="exploreTab === 'newAlbum'" class="playlists">
      <div v-if="albumType === '热门' && newAlbumInfo.topAlbum.weekData.length !== 0">
        <div :style="{ margin: '20px 0', fontSize: '20px', fontWeight: 'bold' }">本周新碟</div>
        <CoverRow
          v-if="show"
          :items="newAlbumInfo.topAlbum.weekData"
          :type="'album'"
          :sub-text="'artist'"
          :show-play-button="false"
          :show-play-count="false"
          :show-position="true"
          :padding-bottom="0"
          :colunm-number="5"
          :is-end="true"
        />
      </div>
      <div>
        <div :style="{ margin: '20px 0', fontSize: '20px', fontWeight: 'bold' }">本月新碟</div>
        <CoverRow
          v-if="show"
          :items="
            albumType === '热门' ? newAlbumInfo.topAlbum.monthData : newAlbumInfo.newAlbums.albums
          "
          :type="'album'"
          :sub-text="'artist'"
          :show-play-button="false"
          :show-play-count="false"
          :show-position="true"
          :padding-bottom="0"
          :is-end="true"
          :colunm-number="5"
          :load-more="loadMore"
        />
      </div>
    </div>
    <div v-else class="playlists">
      <CoverRow
        v-if="show"
        :items="playlists"
        :type="exploreTab === 'artist' ? 'artist' : 'playlist'"
        :sub-text="subText"
        :show-play-button="true"
        :show-position="true"
        :padding-bottom="0"
        :is-end="true"
        :show-play-count="activeCategory !== '排行榜' && exploreTab !== 'artist' ? true : false"
        :item-height="exploreTab === 'artist' ? 224 : 270"
        :colunm-number="5"
        :load-more="loadMore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount, reactive, watch, nextTick, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import { playlistCategories, artistCategories } from '../utils/common'
import SvgIcon from '../components/SvgIcon.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import Cover from '../components/CoverBox.vue'
import TrackList from '../components/VirtualTrackList.vue'
import { tricklingProgress } from '../utils/tricklingProgress'
import { useRouter, useRoute, onBeforeRouteUpdate } from 'vue-router'
import { getRecommendPlayList } from '../utils/playlist'
import { highQualityPlaylist, topPlaylist, toplists, toplistDetail } from '../api/playlist'
import { getArtistList } from '../api/artist'
import { topAlbum, topSong } from '../api/track'
import { newAlbums } from '../api/album'

const router = useRouter()
const route = useRoute()

const { exploreTab } = storeToRefs(useNormalStateStore())
const settingStore = useSettingsStore()
const { general } = storeToRefs(settingStore)
const { togglePlaylistCategory } = settingStore

const playlistInfo = reactive({
  activeCategory: '全部',
  allBigCats: ['语种', '风格', '场景', '情感', '主题'],
  total: 0,
  more: true,
  lasttime: 0
})
// const chartInfo = reactive({})
// const newTrackInfo = reactive({})
const newAlbumInfo = reactive({
  newAlbums: { albums: [] as any[], total: 0 },
  topAlbum: { hasMore: true, monthData: [] as any[], weekData: [] as any[] }
})
const artistInfo = reactive({
  more: true
})

const activeCategory = ref('全部')
const saveCategory = ref('全部')
const showCatOptions = ref(false)
const allBigCats = ref(['语种', '风格', '场景', '情感', '主题'])
const artistBigCats = ref(['语种', '分类', '筛选'])
const playlists = ref<any[]>([])
const tracks = ref<any[]>([])
const show = ref(false)
// const hasMore = ref(true)
const showList = ref<any[]>([])
const activeArtistCat = ref(artistCategories.filter((cat) => cat.enable))
const newTrackBtn = ref(['全部', '华语', '欧美', '日本', '韩国'])
const albumTypeBtn = ref(['热门', '全部'])
const albumType = ref('热门')

const subText = computed(() => {
  if (activeCategory.value === '排行榜') return 'updateFrequency'
  if (activeCategory.value === '推荐歌单') return 'copywriter'
  return 'none'
})

const goToCategory = (tab: string, Category: string) => {
  show.value = false
  showCatOptions.value = false
  router.push({ name: 'explore', query: { tab, category: Category } })
}

const updateType = (type: string) => {
  albumType.value = type
  router.push({ name: 'explore', query: { tab: 'newAlbum', category: activeCategory.value, type } })
}

const toggleArtistCategory = (category: any) => {
  category.enable = true
  const idx = activeArtistCat.value.findIndex((cat) => cat.bigCat === category.bigCat)!
  activeArtistCat.value[idx].enable = false
  activeArtistCat.value[idx] = category
  playlists.value = []
  getPlaylist()
}

const getCatsByBigCat = (bigCat: string) => {
  return playlistCategories.filter((cat) => cat.bigCat === bigCat)
}

const getArtistCatsByBigCat = (bigCat: string) => {
  return artistCategories.filter((cat) => cat.bigCat === bigCat)
}

const getTrack = (tracks: any[]) => {
  return tracks.map((track) => {
    return [track.first, track.second]
  })
}

const updatePlaylist = (playlistList: any[]) => {
  tracks.value = []
  playlists.value.push(...playlistList)
  tricklingProgress.done()
  show.value = true
}

const getHighQualityPlaylist = () => {
  if (!playlistInfo.more) return
  const before = playlistInfo.lasttime
  highQualityPlaylist({ limit: 50, before }).then((data) => {
    playlistInfo.more = data.more
    playlistInfo.lasttime = data.lasttime
    playlistInfo.total = data.total
    updatePlaylist(data.playlists)
  })
}

const loadMore = () => {
  if (['推荐歌单', '排行榜'].includes(activeCategory.value) === false) {
    getPlaylist()
  }
}

const getTopLists = () => {
  toplistDetail().then((data) => {
    showList.value.push(data.list.find((item) => item.name === '飙升榜')!)
    showList.value.push(data.list.find((item) => item.name === '新歌榜')!)
    showList.value.push(data.list.find((item) => item.name === '原创榜')!)
    showList.value.push(data.list.find((item) => item.name === '热歌榜')!)
  })
  toplists().then((data) => {
    playlists.value = []
    updatePlaylist(data.list)
    playlists.value = playlists.value.slice(4)
  })
}

const getNewTrack = () => {
  const trackMap = {
    全部: 0,
    华语: 7,
    欧美: 96,
    日本: 8,
    韩国: 16
  }
  topSong(trackMap[activeCategory.value]).then((data) => {
    playlists.value = []
    tracks.value = data.data
    tricklingProgress.done()
    show.value = true
  })
}

const getNewAlbum = () => {
  const albumMap = {
    全部: 'ALL',
    华语: 'ZH',
    欧美: 'EA',
    日本: 'JP',
    韩国: 'KR'
  }
  if (albumType.value === '热门') {
    if (!newAlbumInfo.topAlbum.hasMore) return
    topAlbum({ area: albumMap[activeCategory.value] }).then((data) => {
      newAlbumInfo.topAlbum.hasMore = data.hasMore
      newAlbumInfo.topAlbum.weekData = data.weekData
      newAlbumInfo.topAlbum.monthData = data.monthData
      tricklingProgress.done()
      show.value = true
    })
  } else {
    if (
      newAlbumInfo.newAlbums.albums.length > 0 &&
      newAlbumInfo.newAlbums.albums.length === newAlbumInfo.newAlbums.total
    )
      return
    newAlbums({
      area: albumMap[activeCategory.value],
      limit: 50,
      offset: newAlbumInfo.newAlbums.albums.length
    }).then((data) => {
      newAlbumInfo.newAlbums.albums.push(...data.albums)
      tricklingProgress.done()
      show.value = true
    })
  }
}

const getPlaylist = () => {
  if (exploreTab.value === 'artist') {
    return getArtists()
  } else if (exploreTab.value === 'chart') {
    return getTopLists()
  } else if (exploreTab.value === 'playlist') {
    if (activeCategory.value === '推荐歌单') {
      return getRecommendPlayList(100, true).then((list) => {
        playlists.value = []
        updatePlaylist(list)
      })
    } else if (activeCategory.value === '精品歌单') {
      return getHighQualityPlaylist()
    } else {
      return topPlaylist({ cat: activeCategory.value, offset: playlists.value.length }).then(
        (data) => {
          playlistInfo.more = data.more
          playlistInfo.total = data.total
          playlistInfo.lasttime = 0
          updatePlaylist(data.playlists)
          // hasMore.value = data.more
        }
      )
    }
  } else if (exploreTab.value === 'newTrack') {
    show.value = false
    return getNewTrack()
  } else if (exploreTab.value === 'newAlbum') {
    playlists.value = []
    return getNewAlbum()
  }
}

const getArtists = () => {
  if (!artistInfo.more) return
  const params = {
    type: activeArtistCat.value[1].code,
    area: activeArtistCat.value[0].code,
    initial: activeArtistCat.value[2].code ?? activeArtistCat.value[2].name,
    limit: 50,
    offset: playlists.value.length
  }
  getArtistList(params).then((data) => {
    updatePlaylist(data.artists)
    artistInfo.more = data.more
  })
}

const loadData = () => {
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)
  activeCategory.value = (route.query.category as string) || saveCategory.value
  getPlaylist()
}

const updatePadding = inject('updatePadding') as (val: number) => void

watch(albumType, () => {
  nextTick(() => {
    updatePadding(0)
  })
})

onBeforeRouteUpdate((to, from, next) => {
  updatePadding(0)
  playlists.value = []
  showList.value = []
  activeCategory.value = (to.query.category as string) || saveCategory.value
  getPlaylist()
  next()
})

onMounted(() => {
  updatePadding(0)
  showList.value = []
  activeCategory.value = (route.query.category as string) || saveCategory.value
  loadData()
})

onBeforeUnmount(() => {
  updatePadding(96)
  exploreTab.value = 'playlist'
})
</script>

<style scoped lang="scss">
.albumsTab {
  display: flex;
  justify-content: space-between;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
}
.button {
  user-select: none;
  cursor: pointer;
  padding: 8px 16px;
  margin: 10px 16px 6px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 600;
  font-size: 18px;
  border-radius: 10px;
  background-color: var(--color-secondary-bg);
  color: var(--color-secondary);
  transition: 0.2s;

  &:hover {
    background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
    color: var(--color-primary);
  }
}
.button.active {
  background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
  color: var(--color-primary);
}
.panel {
  margin-top: 10px;
  background: var(--color-secondary-bg);
  border-radius: 10px;
  padding: 8px;
  color: var(--color-text);

  .big-cat {
    display: flex;
    margin-bottom: 32px;
  }

  .name {
    font-size: 24px;
    font-weight: 700;
    opacity: 0.68;
    margin-left: 24px;
    min-width: 54px;
    height: 26px;
    margin-top: 8px;
  }
  .cats {
    margin-left: 24px;
    display: flex;
    flex-wrap: wrap;
  }
  .cat {
    user-select: none;
    margin: 4px 0px 0 0;
    display: flex;
    // justify-content: center;
    align-items: center;
    font-weight: 500;
    font-size: 16px;
    transition: 0.2s;
    min-width: 98px;

    span {
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      padding: 6px 12px;
      height: 26px;
      border-radius: 10px;
      opacity: 0.88;
      &:hover {
        opacity: 1;
        background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
        color: var(--color-primary);
      }
    }
  }
  .cat.unset {
    span {
      &:hover {
        background-color: unset;
      }
    }
  }
  .cat.active {
    color: var(--color-primary);
  }
}

.chart-list {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-gap: 20px;
}

.chart-item {
  // width: 100%;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;

  .img {
    flex: 0.8;
    justify-content: center;
    position: relative;
    .update {
      font-size: 14px;
      font-weight: 500;
      color: white;
      position: absolute;
      top: 68%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  }

  .track {
    flex: 1.2;
    flex-direction: column;
    justify-content: center;
    font-size: 12px;
    padding-left: 10px;
    display: flex;

    .track-item {
      height: 40px;
      line-height: 40px;
      align-items: center;
      overflow: hidden;
      text-overflow: ellipsis;
      // margin-bottom: 10px;
      padding: 0 10px;
      border-radius: 8px;
      user-select: none;
    }

    .track-item:nth-child(odd) {
      background-color: var(--color-secondary-bg);
    }
  }
}

.playlists {
  margin-top: 24px;
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

.button.more {
  .svg-icon {
    height: 24px;
    width: 24px;
  }
}
</style>
