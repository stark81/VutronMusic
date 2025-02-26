<template>
  <div class="local-music">
    <div class="section-one">
      <div class="left" style="width: 100%">
        <InfoBG />
        <div class="content">
          <h2 style="margin-bottom: 20px">本地歌曲</h2>
          <div class="content-info">
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
          <span
            v-for="(line, index) in pickedLyricLines"
            v-show="line !== ''"
            :key="`${line}${index}`"
            >{{ line }}<br
          /></span>
        </p>
      </div>
      <div class="right-bottom">{{ randomTrack?.artists[0].name }} - {{ randomTrack?.name }}</div>
    </div>
    <div class="section-two">
      <div
        ref="tabsRowRef"
        class="tabs-row"
        :style="{
          height: (hasCustomTitleBar ? 84 : 64) + 'px',
          paddingTop: (hasCustomTitleBar ? 20 : 0) + 'px'
        }"
      >
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
          <SearchBox ref="localSearchBoxRef" :placeholder="`搜索${placeHolderMap(currentTab)}`" />
        </div>
        <button
          v-show="currentTab === 'localPlaylist'"
          class="tab-button"
          @click="openAddPlaylistModal"
          ><svg-icon icon-class="plus" />{{ $t('library.playlist.newPlaylist') }}
        </button>
      </div>
      <div class="section-two-content" :style="tabStyle">
        <div v-show="currentTab === 'localTracks'">
          <TrackList
            :id="0"
            ref="trackListRef"
            :items="sortedLocalTracks"
            :type="'localPlaylist'"
            :colunm-number="1"
            :is-end="true"
            :extra-context-menu-item="[
              'showInFolder',
              'removeLocalTrack',
              'addToLocalList',
              'accurateMatch'
            ]"
          ></TrackList>
        </div>

        <div v-show="currentTab === 'localPlaylist'">
          <CoverRow
            v-if="playlists.length"
            :items="playlists"
            :type="currentTab"
            :style="{ paddingBottom: '96px' }"
          />
        </div>
        <div v-show="currentTab === 'album'">
          <AlbumList :tracks="sortedLocalTracks" />
        </div>
        <div v-show="currentTab === 'artist'">
          <ArtistList :tracks="sortedLocalTracks" />
        </div>
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
import { Track, useLocalMusicStore } from '../store/localMusic'
import { usePlayerStore } from '../store/player'
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
import InfoBG from '../components/InfoBG.vue'
import AlbumList from '../components/AlbumList.vue'
import ArtistList from '../components/ArtistList.vue'
import CoverRow from '../components/CoverRow.vue'
import SvgIcon from '../components/SvgIcon.vue'
import SearchBox from '../components/SearchBox.vue'
import ContextMenu from '../components/ContextMenu.vue'
import AccurateMatchModal from '../components/AccurateMatchModal.vue'
import { randomNum } from '../utils/index'
import { lyricParse, pickedLyric } from '../utils/lyric'
import { useI18n } from 'vue-i18n'

// load
const localMusicStore = useLocalMusicStore()
const { localTracks, playlists, sortBy } = storeToRefs(localMusicStore)

const { newPlaylistModal, modalOpen } = storeToRefs(useNormalStateStore())
const { addTrackToPlayNext } = usePlayerStore()

// ref
const currentTab = ref('localTracks')
const localSearchBoxRef = ref<InstanceType<typeof SearchBox>>()
const playlistTabMenu = ref<InstanceType<typeof ContextMenu>>()
const trackListRef = shallowRef<InstanceType<typeof TrackList>>()
const tabsRowRef = ref()
const randomID = ref<number>(1)
const randomLyric = ref<{ content: string }[]>([])
const randomTrack = ref<Track>()
const isBatchOp = ref(false)

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))

const isMac = computed(() => window.env?.isMac)

const tabStyle = computed(() => {
  const marginTop = hasCustomTitleBar.value ? 20 : 0
  return { marginTop: `${marginTop}px` }
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

const pickedLyricLines = computed(() => {
  const randomLines = pickedLyric(randomLyric.value)
  return randomLines
})

watch(modalOpen, (value) => {
  if (!value) {
    isBatchOp.value = false
  }
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

const keyword = computed(() => localSearchBoxRef.value?.keywords || '')

const sortedLocalTracks = computed(() => {
  return filterLocalTracks.value.slice().sort((a, b) => {
    if (sortBy.value === 'default') {
      return a.index - b.index
    } else if (sortBy.value === 'ascend') {
      const timeA = new Date(a.createTime).getTime()
      const timeB = new Date(b.createTime).getTime()
      return timeA - timeB
    } else if (sortBy.value === 'descend') {
      const timeA = new Date(a.createTime).getTime()
      const timeB = new Date(b.createTime).getTime()
      return timeB - timeA
    } else return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
  })
})

const defaultTracks = computed(() => {
  return localTracks.value.map((track, index) => ({
    ...track,
    index
  }))
})

const filterLocalTracks = computed(() => {
  return defaultTracks.value.filter(
    (track) =>
      (track.name && track.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      track.alias.find((al) => al.toLowerCase().includes(keyword.value?.toLowerCase())) ||
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
    type: 'local',
    afterCreateAddTrackID: [],
    show: true
  }
}

// provide
provide('isBatchOp', isBatchOp)

const { t } = useI18n()
const placeHolderMap = (tab: string) => {
  const pMap = {
    localTracks: t('localMusic.songs'),
    album: t('localMusic.albums'),
    artist: t('localMusic.artists')
  }
  return pMap[tab]
}

const navBarRef = inject('navBarRef', ref())
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
        if (isMac.value) {
          const paddingLeft = maxPadding * (1 - intersectionRatio)
          tabsRowRef.value.style.paddingLeft = `${paddingLeft}px`
        }
        const paddingRight = maxPaddingRight * (1 - intersectionRatio)
        tabsRowRef.value.style.width = `calc(100% - ${paddingRight}px)`
        if (navBarRef.value) navBarRef.value.searchBoxRef.$el.style.display = ''
      } else {
        if (isMac.value) {
          tabsRowRef.value.style.paddingLeft = `${maxPadding}px`
        }
        tabsRowRef.value.style.width = `calc(100% - ${maxPaddingRight}px)`
        if (navBarRef.value) navBarRef.value.searchBoxRef.$el.style.display = 'none'
      }
    })
  },
  {
    root: null,
    rootMargin: `-${hasCustomTitleBar.value ? 84 : 64}px 0px 0px 0px`,
    threshold: Array.from({ length: 101 }, (v, i) => i / 100)
  }
)

const handleResize = () => {
  observeTab.unobserve(tabsRowRef.value)
  observeTab.disconnect()
  if (tabsRowRef.value) observeTab.observe(tabsRowRef.value)
}

const getRandomTrack = async () => {
  const ids = defaultTracks.value.map((t) => t.id)
  let i = 0
  let data: any
  let randomId: number
  while (i < ids.length - 1) {
    randomId = ids[randomNum(0, ids.length - 1)]
    data = await fetch(`atom://get-lyric/${randomId}`).then((res) => res.json())
    if (data.lrc.lyric.length > 0) {
      const { lyric } = lyricParse(data)
      const isInstrumental = lyric.filter((l) => l.content?.includes('纯音乐，请欣赏'))
      if (!isInstrumental.length) {
        randomLyric.value = lyric
        randomID.value = randomId
        break
      }
    }
    i++
  }
  randomTrack.value = defaultTracks.value.find((t) => t.id === randomId)!
}

const updatePadding = inject('updatePadding') as (padding: number) => void

watch(currentTab, () => {
  nextTick(() => {
    updatePadding(0)
  })
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
  setTimeout(() => {
    updatePadding(0)
    if (tabsRowRef.value) observeTab.observe(tabsRowRef.value)
  }, 100)
  getRandomTrack()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  updatePadding(96)
  navBarRef.value.searchBoxRef.$el.style.display = ''
  observeTab.disconnect()
})
</script>

<style scoped lang="scss">
.section-one {
  margin: 20px 0 0 0;
  box-sizing: border-box;
  background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
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
      .content-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-gap: 20px 40px;
        align-items: center;
      }
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
    color: var(--color-primary);
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
}

.section-two {
  position: relative;
  margin-top: 20px;
  padding-top: 64px;

  .tabs-row {
    position: absolute;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    z-index: 10;

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
</style>
