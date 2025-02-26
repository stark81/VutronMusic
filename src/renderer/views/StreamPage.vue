<template>
  <div class="streaming-music">
    <div class="section-one">
      <div class="left" style="width: 100%">
        <InfoBG />
        <div class="content">
          <h2 style="margin-bottom: 20px">流媒体歌曲 - {{ select }}</h2>
          <div class="content-info">
            <div>
              <div class="subtitle">全部歌曲</div>
              <div class="text">{{ streamTracks.length }}首</div>
            </div>
            <div>
              <div class="subtitle">歌曲总时长</div>
              <div class="text">{{ formatedTime }}</div>
            </div>
            <div>
              <div class="subtitle">流媒体歌单</div>
              <div class="text">{{ playlists.length }}个</div>
            </div>
            <div>
              <div class="subtitle">歌曲占用</div>
              <div class="text">{{ formatedMemory }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="right-top" @click="goToLikedSongsList">
        <div class="title"
          >{{ $t('library.likedSongs') }} - {{ streamLikedTracks.length
          }}{{ $t('common.songs') }}</div
        >
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
            :class="{ active: currentTab === 'track' }"
            @click="currentTab = 'track'"
          >
            <span class="text">{{ $t('streamMusic.track') }}</span>
            <span class="icon" @click.stop="openTabMenu"><svg-icon icon-class="dropdown" /></span>
          </div>
          <div v-if="isBatchOp" class="tab" @click="selectAll">{{
            $t('contextMenu.selectAll')
          }}</div>
          <div v-if="isBatchOp" class="tab" @click="addToPlaylist">{{
            $t('streamMusic.playlist.addToPlaylist')
          }}</div>
          <div
            v-else
            class="tab"
            :class="{ active: currentTab === 'playlist' }"
            @click="currentTab = 'playlist'"
          >
            {{ $t('streamMusic.playlist.text') }}
          </div>
          <div v-if="isBatchOp" class="tab" @click="addTracksToQueue">{{
            $t('contextMenu.addToQueue')
          }}</div>
          <div
            v-else
            class="tab"
            :class="{ active: currentTab === 'album' }"
            @click="currentTab = 'album'"
          >
            {{ $t('streamMusic.album') }}
          </div>
          <div v-if="isBatchOp" class="tab" @click="finishBatchOp">{{
            $t('contextMenu.finish')
          }}</div>
          <div
            v-else
            class="tab"
            :class="{ active: currentTab === 'artist' }"
            @click="currentTab = 'artist'"
          >
            {{ $t('streamMusic.artist') }}
          </div>
        </div>
        <div v-show="currentTab !== 'playlist'" class="search-box">
          <SearchBox ref="streamSearchBoxRef" :placeholder="`搜索${placeHolderMap(currentTab)}`" />
        </div>
        <button v-show="currentTab === 'playlist'" class="tab-button" @click="openAddPlaylistModal"
          ><svg-icon icon-class="plus" />{{ $t('library.playlist.newPlaylist') }}</button
        >
      </div>
      <div v-if="status[select] === 'offline'" class="errorInfo">{{ streamMessage }}</div>
      <div v-if="show" class="section-two-content" :style="tabStyle">
        <div v-show="currentTab === 'track'">
          <TrackList
            :id="0"
            ref="streamListRef"
            :items="sortedLocalTracks"
            :type="'streamPlaylist'"
            :colunm-number="1"
            :is-end="true"
            :extra-context-menu-item="['addToStreamList']"
          />
        </div>
        <div v-show="currentTab === 'playlist'">
          <CoverRow
            :items="playlists"
            type="streamPlaylist"
            sub-text="creator"
            :colunm-number="5"
            :is-end="true"
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

    <ContextMenu ref="streamTabMenu">
      <div class="item" @click="sortBy = 'default'">{{ $t('contextMenu.defaultSort') }}</div>
      <div class="item" @click="sortBy = 'byname'">{{ $t('contextMenu.sortByName') }}</div>
      <div class="item" @click="sortBy = 'descend'">{{ $t('contextMenu.descendSort') }}</div>
      <div class="item" @click="sortBy = 'ascend'">{{ $t('contextMenu.ascendSort') }}</div>
      <hr v-show="!isBatchOp" />
      <div v-show="!isBatchOp" class="item" @click="isBatchOp = true">{{
        $t('contextMenu.batchOperation')
      }}</div>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, computed, onUnmounted, provide, watch, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useStreamMusicStore } from '../store/streamingMusic'
import { useNormalStateStore } from '../store/state'
import { useRouter } from 'vue-router'
import InfoBG from '../components/InfoBG.vue'
import SvgIcon from '../components/SvgIcon.vue'
import SearchBox from '../components/SearchBox.vue'
import TrackList from '../components/VirtualTrackList.vue'
import AlbumList from '../components/AlbumList.vue'
import ArtistList from '../components/ArtistList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import ContextMenu from '../components/ContextMenu.vue'
import { useI18n } from 'vue-i18n'
import { randomNum } from '../utils'
import { lyricParse, pickedLyric } from '../utils/lyric'
import { Track } from '../store/localMusic'

const { newPlaylistModal, modalOpen } = storeToRefs(useNormalStateStore())

const streamMusicStore = useStreamMusicStore()
const { select, status, sortBy, streamTracks, playlists, message, streamLikedTracks } =
  storeToRefs(streamMusicStore)
const { fetchStreamMusic } = streamMusicStore

const router = useRouter()

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))
const streamTabMenu = ref<InstanceType<typeof ContextMenu>>()
const streamSearchBoxRef = ref<InstanceType<typeof SearchBox>>()
const streamListRef = shallowRef<InstanceType<typeof TrackList>>()
const tabsRowRef = ref()
const isBatchOp = ref(false)
const show = ref(false)

const currentTab = ref('track')
const randomTrack = ref<Track>()
const randomLyric = ref<{ content: string }[]>([])

const tabStyle = computed(() => {
  const marginTop = hasCustomTitleBar.value ? 20 : 0
  return { marginTop: `${marginTop}px` }
})

const streamMessage = computed(() => {
  return status.value[select.value] === 'offline' ? message.value : ''
})

const pickedLyricLines = computed(() => {
  const randomLines = pickedLyric(randomLyric.value)
  return randomLines
})

const keyword = computed(() => streamSearchBoxRef.value?.keywords || '')

const defaultTracks = computed(() => {
  return streamTracks.value?.map((track, index) => ({ ...track, index }))
})

const filterStreamTracks = computed(() => {
  return defaultTracks.value.filter(
    (track) =>
      (track.name && track.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      (track.album?.name &&
        track.album.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      track.artists.find(
        (ar) => ar.name && ar.name.toLowerCase().includes(keyword.value?.toLowerCase())
      )
  )
})

const sortedLocalTracks = computed(() => {
  return filterStreamTracks.value.slice().sort((a, b) => {
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

const formatedTime = computed(() => {
  const dt = streamTracks.value.map((track) => track.dt).reduce((acc, cur) => acc + cur, 0) / 1000
  const hourse = Math.floor(dt / 3600)
  const minutes = Math.floor((dt % 3600) / 60)
  const seconds = Math.floor(dt % 60)
  return `${hourse}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`
})

const formatedMemory = computed(() => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let memory = streamTracks.value
    .map((track) => track.size)
    .reduce((acc, cur) => acc + cur, 0) as number
  let i = 0
  while (memory >= 1024 && i < units.length - 1) {
    memory /= 1024
    i++
  }
  return `${memory.toFixed(2)} ${units[i]}`
})

const selectAll = () => {
  streamListRef.value?.selectAll()
}

const addToPlaylist = () => {
  streamListRef.value?.addToSteamPlaylist()
}

const addTracksToQueue = () => {
  streamListRef.value?.addToQueue()
}

const finishBatchOp = () => {
  isBatchOp.value = false
  streamListRef.value?.doFinish()
}

const openTabMenu = (e: MouseEvent): void => {
  streamTabMenu.value?.openMenu(e)
}

const { t } = useI18n()
const placeHolderMap = (tab: string) => {
  const pMap = {
    track: t('streamMusic.song'),
    album: t('streamMusic.album'),
    artist: t('streamMusic.artist')
  }
  return pMap[tab]
}

const goToLikedSongsList = () => {
  router.push({ path: '/stream-liked-songs' })
}

const openAddPlaylistModal = () => {
  if (status.value[select.value] !== 'login') return
  newPlaylistModal.value = {
    type: 'stream',
    afterCreateAddTrackID: [],
    show: true
  }
}

const getRandomTrack = async () => {
  const ids = streamLikedTracks.value.map((t) => t.id)
  let i = 0
  let data: any
  let randomID: string | number
  while (i < ids.length - 1) {
    randomID = ids[randomNum(0, ids.length - 1)]
    data = await fetch(`atom://get-stream-lyric/${randomID}`).then((res) => res.json())
    if (data.lrc.lyric.length > 0) {
      const { lyric } = lyricParse(data)
      const isInstrumental = lyric.filter((l) => l.content?.includes('纯音乐，请欣赏'))
      if (!isInstrumental.length) {
        randomLyric.value = lyric
        break
      }
    }
    i++
  }
  randomTrack.value = streamTracks.value.find((t) => t.id === randomID)!
}

watch(modalOpen, (value) => {
  if (!value) {
    isBatchOp.value = false
  }
})

provide('isBatchOp', isBatchOp)

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
        if (window.env?.isMac) {
          const paddingLeft = maxPadding * (1 - intersectionRatio)
          tabsRowRef.value.style.paddingLeft = `${paddingLeft}px`
        }
        const paddingRight = maxPaddingRight * (1 - intersectionRatio)
        tabsRowRef.value.style.width = `calc(100% - ${paddingRight}px)`
        if (navBarRef.value) navBarRef.value.searchBoxRef.$el.style.display = ''
      } else {
        if (window.env?.isMac) {
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

watch(
  () => status.value[select.value],
  (value) => {
    if (value === 'logout') {
      router.push('/streamLogin')
    }
  }
)

onMounted(async () => {
  if (!streamTracks.value.length) {
    await fetchStreamMusic().then(() => {
      if (status.value[select.value] === 'login') {
        show.value = true
        getRandomTrack()
      }
    })
  } else {
    show.value = true
    getRandomTrack()
    fetchStreamMusic()
  }
  if (status.value[select.value] === 'logout') {
    router.push('/streamLogin')
    return
  }
  window.addEventListener('resize', handleResize)
  setTimeout(() => {
    if (tabsRowRef.value) observeTab.observe(tabsRowRef.value)
  }, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
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
      padding: 30px 50px;
      box-sizing: border-box;
      text-align: center;
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
  .title {
    font-size: 22px;
    font-weight: 700;
    margin: 10px 0 10px 0;
    color: var(--color-primary);
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

.errorInfo {
  font-size: 20px;
  font-weight: 600;
  padding-top: 100px;
  text-align: center;
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
