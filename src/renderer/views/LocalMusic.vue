<template>
  <div class="local-music">
    <div ref="sectionOneRef" class="section-one">
      <div class="left" style="width: 100%">
        <svg id="bgSvg" style="height: 100%; width: 100%">
          <defs>
            <linearGradient v-if="!isDarkMode" id="gradient" gradientTransform="rotate(30)">
              <stop offset="0%" stop-color="#fdfbfb"></stop>
              <stop offset="40%" stop-color="#ededed"></stop>
              <stop offset="150%" stop-color="#fff"></stop>
            </linearGradient>
            <linearGradient v-else id="gradient" gradientTransform="rotate(30)">
              <stop offset="0%" stop-color="#323232"></stop>
              <stop offset="40%" stop-color="#3F3F3F"></stop>
              <stop offset="150%" stop-color="#222"></stop>
            </linearGradient>
          </defs>
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M 408 240  L 0 240  L 0 119.676748582231  L 0 0  L 493.923 0  L 542 61.401  L 408 240  Z M 523.673 190  L 502.983 216.435  L 521.427 240  L 819.671 240  L 802.435 217.978  C 801.723 217.07  801.723 215.801  802.435 214.885  L 821.917 190  L 523.673 190  Z M 809.178 216.435  L 827.621 240  L 843.477 240  L 826.241 217.978  C 825.528 217.07  825.528 215.801  826.241 214.885  L 859.723 172  L 843.868 172  L 829.868 190  L 809.178 216.435  Z M 517.178 59.0216  L 486.421 19.7349  C 486.059 19.265  485.493 19  484.903 19  L 475.59 19  C 474.783 19  474.337 19.9276  474.831 20.5541  L 506.805 61.407  L 474.831 102.26  C 474.337 102.886  474.783 103.814  475.59 103.814  L 484.903 103.814  C 485.493 103.814  486.059 103.537  486.421 103.079  L 517.178 63.7803  C 517.71 63.1016  518 62.2638  518 61.401  C 518 60.5382  517.71 59.7004  517.178 59.0216  Z M 449.796 19.7349  C 449.435 19.265  448.869 19  448.278 19  L 438.966 19  C 438.159 19  437.713 19.9276  438.207 20.5541  L 470.181 61.407  L 438.207 102.26  C 437.713 102.886  438.159 103.814  438.966 103.814  L 448.278 103.814  C 448.869 103.814  449.435 103.537  449.796 103.079  L 480.554 63.7803  C 481.086 63.1016  481.376 62.2638  481.376 61.401  C 481.376 60.5382  481.086 59.7004  480.554 59.0216  L 449.796 19.7349  Z M 496.241 214.885  L 528.723 172  L 510.868 172  L 460.7 240  L 513.477 240  L 496.241 217.978  C 495.529 217.07  495.529 215.801  496.241 214.885  Z "
            fill="url(#gradient)"
          />
        </svg>
        <div class="content">
          <h2 style="margin-bottom: 20px">本地歌曲</h2>
          <div
            style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-gap: 20px 40px;
              align-items: center;
            "
          >
            <div>
              <div class="subtitle">全部歌曲</div>
              <div class="text">{{ localTracks.length }}首</div>
            </div>
            <div>
              <div class="subtitle">歌曲总时长</div>
              <div class="text">{{ formatedTime }}</div>
            </div>
            <div>
              <div class="subtitle">离线歌单</div>
              <div class="text">{{ playlists.length }}个</div>
            </div>
            <div>
              <div class="subtitle">本地歌手</div>
              <div class="text">{{ artists.length }}位</div>
            </div>
          </div>
        </div>
      </div>
      <div class="right-top" @click="playThisTrack">
        <p>
          <span v-for="(line, index) in pickedLyric" v-show="line !== ''" :key="`${line}${index}`"
            >{{ line }}<br
          /></span>
        </p>
      </div>
      <div class="right-bottom">{{ artist }} - {{ trackName }}</div>
    </div>
    <div class="section-two">
      <div ref="tabsRowRef" class="tabs-row">
        <div class="tabs">
          <div
            class="tab dropdown"
            :class="{ active: currentTab === 'localTracks' }"
            @click="updateTab('localTracks')"
          >
            <span class="text">{{ $t('localMusic.songs') }}</span>
            <span class="icon" @click.stop="openLocalTracksTabMenu"
              ><svg-icon icon-class="dropdown"
            /></span>
          </div>
          <div v-if="isBatchOp" class="tab" @click="selectAll">{{
            $t('contextMenu.selectAll')
          }}</div>
          <div v-if="isBatchOp" class="tab" @click="addToPlaylist">{{
            $t('localMusic.playlist.addToPlaylist')
          }}</div>
          <div
            v-else
            class="tab"
            :class="{ active: currentTab === 'localPlaylist' }"
            @click="updateTab('localPlaylist')"
          >
            {{ $t('localMusic.playlist.text') }}
          </div>
          <div v-if="isBatchOp" class="tab" @click="addTracksToQueue">{{
            $t('contextMenu.addToQueue')
          }}</div>
          <div
            v-else
            class="tab"
            :class="{ active: currentTab === 'album' }"
            @click="updateTab('album')"
          >
            {{ $t('localMusic.albums') }}
          </div>
          <div v-if="isBatchOp" class="tab" @click="finishBatchOp">{{
            $t('contextMenu.finish')
          }}</div>
          <div
            v-else
            class="tab"
            :class="{ active: currentTab === 'artist' }"
            @click="updateTab('artist')"
          >
            {{ $t('localMusic.artists') }}
          </div>
        </div>
        <div v-if="currentTab !== 'localPlaylist'" class="search-box">
          <SearchBox ref="localSearchBoxRef" :placeholder="$t('localMusic.placeholder')" />
        </div>
        <button
          v-show="currentTab === 'localPlaylist'"
          class="tab-button"
          @click="openAddPlaylistModal"
          ><svg-icon icon-class="plus" />{{ $t('library.playlist.newPlaylist') }}
        </button>
      </div>
      <div class="section-two-content">
        <TrackList
          v-if="currentTab === 'localTracks'"
          :id="0"
          ref="trackListRef"
          :items="sortedLocalTracks"
          :type="'localPlaylist'"
          :colunm-number="1"
          :extra-context-menu-item="[
            'showInFolder',
            'removeLocalTrack',
            'addToLocalList',
            'accurateMatch'
          ]"
        ></TrackList>
        <div v-else-if="currentTab === 'localPlaylist'">
          <CoverRow :items="playlists" :type="currentTab" />
        </div>
        <AlbumList v-else-if="currentTab === 'album'" :tracks="filterLocalTracks" />
        <ArtistList v-else-if="currentTab === 'artist'" :tracks="filterLocalTracks" />
      </div>
    </div>

    <AccurateMatchModal />

    <ContextMenu ref="playlistTabMenu">
      <div class="item" @click="sortBy = 'default'">{{ $t('contextMenu.defaultSort') }}</div>
      <div class="item" @click="sortBy = 'byname'">{{ $t('contextMenu.sortByName') }}</div>
      <div class="item" @click="sortBy = 'descend'">{{ $t('contextMenu.descendSort') }}</div>
      <div class="item" @click="sortBy = 'ascend'">{{ $t('contextMenu.ascendSort') }}</div>
      <hr v-show="!isBatchOp" />
      <div v-show="!isBatchOp" class="item" @click="scanLocalMusic">{{
        $t('contextMenu.reScan')
      }}</div>
      <div v-show="!isBatchOp" class="item" @click="isBatchOp = true">{{
        $t('contextMenu.batchOperation')
      }}</div>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import { useLocalMusicStore } from '../store/localMusic'
import { usePlayerStore } from '../store/player'
import { useSettingsStore } from '../store/settings'
import {
  computed,
  ref,
  shallowRef,
  provide,
  inject,
  onMounted,
  onUnmounted,
  watch,
  nextTick
} from 'vue'
import TrackList from '../components/VirtualTrackList.vue'
import AlbumList from '../components/AlbumList.vue'
import ArtistList from '../components/ArtistList.vue'
import CoverRow from '../components/CoverRow.vue'
import SvgIcon from '../components/SvgIcon.vue'
import SearchBox from '../components/SearchBox.vue'
import ContextMenu from '../components/ContextMenu.vue'
import AccurateMatchModal from '../components/AccurateMatchModal.vue'
import { randomNum } from '../utils/index'
import { lyricParse } from '../utils/lyric'

// load
const localMusicStore = useLocalMusicStore()
const { localTracks, playlists, sortBy } = storeToRefs(localMusicStore)

const { newPlaylistModal } = storeToRefs(useNormalStateStore())
const { addTrackToPlayNext } = usePlayerStore()

const { theme } = storeToRefs(useSettingsStore())

// ref
const currentTab = ref('localTracks')
const isDarkMode = ref(false)
const localSearchBoxRef = ref<InstanceType<typeof SearchBox>>()
const playlistTabMenu = ref<InstanceType<typeof ContextMenu>>()
const trackListRef = shallowRef<InstanceType<typeof TrackList>>()
const tabsRowRef = ref()
const randomID = ref<number>(1)
const randomLyric = ref<{ content: string }[]>([])
const artist = ref<string>('')
const trackName = ref<string>('')
const noLyricTracks = ref<number[]>([])
const isBatchOp = ref(false)

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  isDarkMode.value =
    theme.value.appearance === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme.value.appearance === 'dark'
})

const formatedTime = computed(() => {
  const dt = localTracks.value.map((track) => track.dt).reduce((acc, cur) => acc + cur, 0) / 1000
  const hourse = Math.floor(dt / 3600)
  const minutes = Math.floor((dt % 3600) / 60)
  const seconds = Math.floor(dt % 60)
  return `${hourse}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`
})

const artists = computed(() => {
  const ar = localTracks.value.map((track) => track.artists).flat()
  return [...new Map(ar.map((ar) => [ar.name, ar])).values()]
})

const localTrackIDs = computed(() => {
  const ids = localTracks.value.map((track) => track.id)
  const result = ids.filter((id) => !noLyricTracks.value.includes(id))
  return result
})

const updateTab = (val: string) => {
  currentTab.value = val
  observeTab.disconnect()
  observeTab.observe(tabsRowRef.value!)
}

const scanLocalMusic = inject('scanLocalMusic') as () => Promise<void>
const selectAll = () => {
  trackListRef.value?.selectAll()
}

const finishBatchOp = () => {
  isBatchOp.value = false
  trackListRef.value?.doFinish()
}

const addToPlaylist = () => {
  trackListRef.value?.addToLocalPlaylist()
}

const addTracksToQueue = () => {
  trackListRef.value?.addToQueue()
}

// function
const pickedLyric = computed(() => {
  if (randomLyric.value.length === 0) return []
  const filterWords =
    /(作词|作曲|编曲|和声|混音|录音|OP|SP|MV|吉他|二胡|古筝|曲编|键盘|贝斯|鼓|弦乐|打击乐|混音|制作人|配唱|提琴|海报|特别鸣谢)/i
  const lyricLines = randomLyric.value
    .filter((l) => !filterWords.test(l.content))
    .map((l) => l.content)
  const lyricsToPick = Math.min(lyricLines.length, 3)
  const randomUpperBound = lyricLines.length - lyricsToPick
  const startLyricLineIndex = randomNum(0, randomUpperBound - 1)

  return lyricLines.slice(startLyricLineIndex, startLyricLineIndex + lyricsToPick)
})

const keyword = computed(() => localSearchBoxRef.value?.keywords || '')

const sortedLocalTracks = computed(() => {
  if (sortBy.value === 'default') {
    return filterLocalTracks.value.slice()
  } else {
    return filterLocalTracks.value.slice().sort((a, b) => {
      if (sortBy.value === 'ascend') {
        const timeA = new Date(a.createTime).getTime()
        const timeB = new Date(b.createTime).getTime()
        return timeA - timeB
      } else if (sortBy.value === 'descend') {
        const timeA = new Date(a.createTime).getTime()
        const timeB = new Date(b.createTime).getTime()
        return timeB - timeA
      } else return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
    })
  }
})

const filterLocalTracks = computed(() => {
  return localTracks.value.filter(
    (track) =>
      (track.name && track.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      (track.album?.name &&
        track.album.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      track.artists.find(
        (ar) => ar.name && ar.name.toLowerCase().includes(keyword.value?.toLowerCase())
      )
  )
})

// const scrollToItem = inject('scrollToItem') as (idx: number) => void

const playThisTrack = () => {
  addTrackToPlayNext(randomID.value, true, true)
}

const openLocalTracksTabMenu = (e: MouseEvent): void => {
  playlistTabMenu.value?.openMenu(e)
}

const openAddPlaylistModal = () => {
  newPlaylistModal.value = {
    isLocal: true,
    afterCreateAddTrackID: [],
    show: true
  }
}

// provide
provide('isBatchOp', isBatchOp)

const navBarRef = inject('navBarRef') as any

// 这里需要进行调整
// 1. 将滚动条组件变更为控制root元素滚动，而非main元素滚动
// 2. root元素滚动应该和虚拟列表滚动互斥，即root元素滚动时虚拟列表不滚动，反之亦然
const observeTab = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const intersectionRatio = entry.intersectionRatio
      const maxPadding = 42
      const maxPaddingRight = 42
      if (intersectionRatio > 0) {
        const paddingLeft = maxPadding * (1 - intersectionRatio)
        const paddingRight = maxPaddingRight * (1 - intersectionRatio)
        tabsRowRef.value.style.paddingLeft = `${paddingLeft}px`
        tabsRowRef.value.style.width = `calc(100% - ${paddingRight}px)`
        if (navBarRef.value) navBarRef.value.searchBoxRef.$el.style.display = ''
      } else {
        tabsRowRef.value.style.paddingLeft = `${maxPadding}px`
        tabsRowRef.value.style.width = `calc(100% - ${maxPaddingRight}px)`
        if (navBarRef.value) navBarRef.value.searchBoxRef.$el.style.display = 'none'
      }
    })
  },
  {
    root: null,
    rootMargin: `-${navBarRef.value?.$el?.offsetHeight | 64}px 0px 0px 0px`,
    threshold: Array.from({ length: 101 }, (v, i) => i / 100)
  }
)

const handleResize = () => {
  observeTab.unobserve(tabsRowRef.value)
  observeTab.disconnect()
  if (tabsRowRef.value) observeTab.observe(tabsRowRef.value)
}

const getRandomTrack = async (id: number) => {
  if (!id) return
  const data = await fetch(`atom://get-lyric/${id}`)
    .then((res) => res.json())
    .catch(() => {
      noLyricTracks.value.push(id)
      return null
    })
  if (!data?.lrc?.lyric?.length) {
    noLyricTracks.value.push(id)
    randomID.value = localTrackIDs.value[randomNum(0, localTrackIDs.value.length - 1)]
    getRandomTrack(randomID.value)
    return
  }
  const { lyric } = lyricParse(data)
  const isInstrumental = lyric.filter((l) => l.content?.includes('纯音乐，请欣赏'))
  if (isInstrumental.length > 0) {
    randomID.value = localTrackIDs.value[randomNum(0, localTrackIDs.value.length - 1)]
    getRandomTrack(randomID.value)
    return
  }
  const track = localTracks.value.find((track) => track.id === id)
  randomLyric.value = lyric
  trackName.value = track!.name
  artist.value = track!.artists[0].name
}

const updatePadding = inject('updatePadding') as (padding: number) => void

watch(currentTab, () => {
  nextTick(() => {
    updatePadding(0)
  })
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
  updatePadding(0)
  isDarkMode.value =
    theme.value.appearance === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme.value.appearance === 'dark'
  if (tabsRowRef.value) {
    observeTab.observe(tabsRowRef.value)
  }
  if (!localTrackIDs.value.length) return
  randomID.value = localTrackIDs.value[randomNum(0, localTrackIDs.value.length - 1)]
  getRandomTrack(randomID.value)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  updatePadding(96)
  navBarRef.value.searchBoxRef.$el.style.display = ''
  observeTab.disconnect()
  // observeSectionOne.disconnect()
})
</script>

<style scoped lang="scss">
.local-music {
  transition: all 0.4s;
}
.section-one {
  margin-top: 20px;
  box-sizing: border-box;
  background: var(--color-primary-bg);
  border-radius: 14px;
  height: 240px;
  transition: all 0.4s;
  position: relative;
  .left {
    position: absolute;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;
    .content {
      position: absolute;
      top: 0;
      left: 0;
      width: 410px;
      height: 100%;
      padding: 30px 100px;
      box-sizing: border-box;
      .subtitle {
        font-size: 14px;
      }
      .text {
        font-size: 18px;
      }
    }
  }
  .right-top {
    position: absolute;
    height: 190px;
    left: 580px;
    width: 270px;
    font-size: 18px;
    line-height: 30px;
    color: blue;
    display: flex;
    justify-content: center;
    flex-direction: column;
    cursor: pointer;
  }
  .right-bottom {
    position: absolute;
    white-space: nowrap;
    overflow: hidden;
    width: 270px;
    height: 50px;
    top: 190px;
    left: 530px;
    font-size: 18px;
    font-weight: 500;
    line-height: 50px;
    justify-content: center;
    text-align: center;
    box-sizing: border-box;
    // z-index: 1;
  }
  .bottom {
    position: absolute;
    border-radius: 50%;
    background: var(--color-primary-bg);
    left: 860px;
    bottom: 4px;
    display: flex;
    justify-content: center;
    button {
      margin-bottom: 2px;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 40px;
      width: 40px;
      background: var(--color-primary);
      border-radius: 50%;
      transition: 0.2s;
      box-shadow: 0 6px 12px -4px rgba(0, 0, 0, 0.2);
      cursor: default;

      .svg-icon {
        color: var(--color-primary-bg);
        margin-left: 4px;
        height: 16px;
        width: 16px;
      }
      &:hover {
        transform: scale(1.06);
        box-shadow: 0 6px 12px -4px rgba(0, 0, 0, 0.4);
      }
      &:active {
        transform: scale(0.94);
      }
    }
  }
}

.section-two {
  position: relative;
  margin-top: 20px;
  min-height: calc(100vh - 190px);
  padding-top: 64px;
  // background: red;
}
.tabs-row {
  position: absolute;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  width: 100%;
  z-index: 10;
  background-color: rgba(0, 0, 0, 0);
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  font-size: 18px;
  -webkit-app-region: no-drag;
  .tab {
    font-weight: 600;
    padding: 8px 14px;
    margin-right: 14px;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    transition: 0.2s;
    opacity: 0.68;
    &:hover {
      opacity: 0.88;
      background-color: var(--color-secondary-bg);
    }
  }
  .tab.active {
    opacity: 0.88;
    background-color: var(--color-secondary-bg);
  }
  .tab.dropdown {
    display: flex;
    align-items: center;
    padding: 0;
    overflow: hidden;
    .text {
      padding: 8px 3px 8px 14px;
    }
    .icon {
      height: 100%;
      display: flex;
      align-items: center;
      padding: 0 8px 0 3px;
      .svg-icon {
        height: 16px;
        width: 16px;
      }
    }
  }
}

button.tab-button {
  color: var(--color-text);
  border-radius: 8px;
  padding: 8px 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: 0.2s;
  opacity: 0.68;
  font-weight: 500;
  font-size: 14px;
  .svg-icon {
    width: 14px;
    height: 14px;
    margin-right: 8px;
  }
  &:hover {
    opacity: 1;
    background: var(--color-secondary-bg);
  }
  &:active {
    opacity: 1;
    transform: scale(0.92);
  }
}

.section-two-content {
  height: calc(100vh - 64px);
}
</style>
