<template>
  <div v-show="show" class="library">
    <div class="section-one">
      <div class="liked-songs" @click="goToLikedSongsList">
        <div class="title"
          >{{ $t('library.likedSongs') }} - {{ liked.songs.length }}{{ $t('common.songs') }}</div
        >
        <div class="top">
          <p>
            <span
              v-for="(line, index) in pickedLyricLines"
              v-show="line !== ''"
              :key="`${line}${index}`"
              >{{ line }}<br
            /></span>
          </p>
        </div>
        <div class="bottom">
          <div class="titles">
            <div v-show="randomtrack?.ar[0].name" class="title">{{
              `${randomtrack?.ar[0].name} -- ${randomtrack?.name}`
            }}</div>
          </div>
        </div>
      </div>
      <div class="songs">
        <TrackList
          :id="liked.playlists.length > 0 ? liked.playlists[0].id : 0"
          :items="liked.songsWithDetails"
          :type="'tracklist'"
          :show-position="false"
          :item-height="60"
          :height="240"
          :is-end="false"
          :padding-bottom="0"
          :colunm-number="2"
        />
      </div>
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
            :class="{ active: currentTab === 'playlist' }"
            @click="updateCurrentTab('playlist')"
          >
            <span class="text">{{
              {
                all: $t('contextMenu.allPlaylists'),
                mine: $t('contextMenu.minePlaylists'),
                liked: $t('contextMenu.likedPlaylists')
              }[playlistFilter]
            }}</span>
            <span class="icon" @click.stop="openPlaylistTabMenu"
              ><svg-icon icon-class="dropdown"
            /></span>
          </div>
          <div
            class="tab"
            :class="{ active: currentTab === 'album' }"
            @click="updateCurrentTab('album')"
          >
            {{ $t('library.albums') }}
          </div>
          <div
            class="tab"
            :class="{ active: currentTab === 'artist' }"
            @click="updateCurrentTab('artist')"
          >
            {{ $t('library.artists') }}
          </div>
          <div
            class="tab"
            :class="{ active: currentTab === 'mvs' }"
            @click="updateCurrentTab('mvs')"
          >
            {{ $t('library.mvs') }}
          </div>
          <div
            class="tab"
            :class="{ active: currentTab === 'cloudDisk' }"
            @click="updateCurrentTab('cloudDisk')"
          >
            {{ $t('library.cloudDisk') }}
          </div>
          <div
            class="tab"
            :class="{ active: currentTab === 'playHistory' }"
            @click="updateCurrentTab('playHistory')"
          >
            {{ $t('library.playHistory.title') }}
          </div>
        </div>
        <button v-show="currentTab === 'playlist'" class="tab-button" @click="openAddPlaylistModal"
          ><svg-icon icon-class="plus" />{{ $t('library.playlist.newPlaylist') }}
        </button>
      </div>

      <div class="section-two-content" :style="tabStyle">
        <div v-show="currentTab === 'playlist'">
          <CoverRow
            :items="filterPlaylists"
            type="playlist"
            sub-text="creator"
            :colunm-number="5"
            :is-end="true"
          />
        </div>

        <div v-show="currentTab === 'album'">
          <CoverRow
            :items="liked.albums"
            type="album"
            sub-text="artist"
            :colunm-number="5"
            :is-end="true"
          />
        </div>

        <div v-show="currentTab === 'mvs'">
          <Mvrow :mvs="liked.mvs" :is-end="true" />
        </div>

        <div v-show="currentTab === 'artist'">
          <CoverRow
            :items="liked.artists"
            type="artist"
            sub-text="artist"
            :item-height="230"
            :colunm-number="5"
            :is-end="true"
          />
        </div>

        <div v-show="currentTab === 'cloudDisk'">
          <TrackList
            :id="-8"
            :items="liked.cloudDisk"
            :colunm-number="1"
            type="cloudDisk"
            :is-end="true"
          />
        </div>

        <div v-show="currentTab === 'playHistory'">
          <button
            :class="{
              'playHistory-button': true,
              'playHistory-button--selected': playHistoryMode === 'week'
            }"
            @click="playHistoryMode = 'week'"
          >
            {{ $t('library.playHistory.week') }}
          </button>
          <button
            :class="{
              'playHistory-button': true,
              'playHistory-button--selected': playHistoryMode === 'all'
            }"
            @click="playHistoryMode = 'all'"
          >
            {{ $t('library.playHistory.all') }}
          </button>
          <TrackList
            :items="playHistoryList"
            :colunm-number="1"
            :height="historyHeight"
            :item-height="60"
            type="tracklist"
            :is-end="true"
          />
        </div>
      </div>
    </div>

    <ContextMenu ref="playlistTabMenu">
      <div
        class="item"
        :class="{ active: libraryPlaylistFilter === 'all' }"
        @click="changePlaylistFilter('all')"
        >{{ $t('contextMenu.allPlaylists') }}</div
      >
      <hr />
      <div
        class="item"
        :class="{ active: libraryPlaylistFilter === 'mine' }"
        @click="changePlaylistFilter('mine')"
        >{{ $t('contextMenu.minePlaylists') }}</div
      >
      <div
        class="item"
        :class="{ active: libraryPlaylistFilter === 'liked' }"
        @click="changePlaylistFilter('liked')"
        >{{ $t('contextMenu.likedPlaylists') }}</div
      >
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDataStore } from '../store/data'
import { useNormalStateStore } from '../store/state'
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue'
import { dailyTask, randomNum } from '../utils'
import { tricklingProgress } from '../utils/tricklingProgress'
import { getTrackDetail } from '../api/track'
import { lyricParse, pickedLyric } from '../utils/lyric'
import SvgIcon from '../components/SvgIcon.vue'
import TrackList from '../components/VirtualTrackList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import Mvrow from '../components/MvRow.vue'
import ContextMenu from '../components/ContextMenu.vue'
import { useRouter } from 'vue-router'

const dataStore = useDataStore()
const { liked, libraryPlaylistFilter, user } = storeToRefs(dataStore)

const { newPlaylistModal } = storeToRefs(useNormalStateStore())

const show = ref(false)
const playHistoryMode = ref('week')
const router = useRouter()

const lyric = ref<{ content: string }[]>([])
const randomtrack = ref<{ [key: string]: any }>()
const currentTab = ref('playlist')
const playlistTabMenu = ref<InstanceType<typeof ContextMenu>>()
const tabsRowRef = ref()

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))

const isMac = computed(() => window.env?.isMac)

const tabStyle = computed(() => {
  const marginTop = hasCustomTitleBar.value ? 20 : 0
  return {
    marginTop: `${marginTop}px`
  }
})

const pickedLyricLines = computed(() => {
  const randomLines = pickedLyric(lyric.value)
  return randomLines
})

const winHeight = ref(window.innerHeight)

const historyHeight = computed(() => {
  const height = winHeight.value - 72 - (hasCustomTitleBar.value ? 84 : 64)
  return height
})

const playlistFilter = computed(() => {
  return libraryPlaylistFilter.value || 'all'
})

const filterPlaylists = computed(() => {
  const playlists = liked.value.playlists.slice(1)
  const userId = user.value.userId
  if (playlistFilter.value === 'mine') {
    return playlists.filter((p) => p.creator.userId === userId)
  } else if (playlistFilter.value === 'liked') {
    return playlists.filter((p) => p.creator.userId !== userId)
  }
  return playlists
})

const playHistoryList = computed(() => {
  if (show.value && playHistoryMode.value === 'week') {
    return liked.value.playHistory.weekData
  } else if (show.value && playHistoryMode.value === 'all') {
    return liked.value.playHistory.allData
  }
  return []
})

const {
  fetchLikedSongs,
  fetchLikedPlaylist,
  fetchLikedSongsWithDetails,
  fetchLikedAlbums,
  fetchLikedArtists,
  fetchLikedMVs,
  fetchCloudDisk,
  fetchPlayHistory
} = dataStore

const loadData = async () => {
  if (liked.value.songsWithDetails.length > 0) {
    tricklingProgress.done()
    show.value = true
    fetchLikedSongsWithDetails()
    getRandomLyric()
    fetchLikedSongs()
    fetchLikedPlaylist()
  } else {
    await fetchLikedSongs()
    await fetchLikedPlaylist()
    fetchLikedSongsWithDetails().then(() => {
      tricklingProgress.done()
      show.value = true
      getRandomLyric()
    })
  }

  fetchLikedAlbums()
  fetchLikedArtists()
  fetchLikedMVs()
  fetchPlayHistory()
  fetchCloudDisk()
}

const getRandomLyric = () => {
  if (liked.value.songs.length === 0) return
  const id = liked.value.songs[randomNum(0, liked.value.songs.length - 1)]
  fetch(`atom://local-asset?type=lyric&id=${id}`)
    .then((res) => res.json())
    .then((data) => {
      if (data?.lrc?.lyric?.length) {
        const lyricObj = lyricParse(data)
        const isInstrumental = lyricObj.lyric.filter((l) => l.content?.includes('纯音乐，请欣赏'))
        if (isInstrumental.length === 0) {
          lyric.value = lyricObj.lyric
          getTrackDetail(id.toString()).then((data) => {
            randomtrack.value = data.songs[0]
          })
        }
      }
    })
}

const goToLikedSongsList = () => {
  router.push({ path: '/library/liked-songs' })
}

const updatePadding = inject('updatePadding') as (padding: number) => void

const openAddPlaylistModal = () => {
  newPlaylistModal.value = {
    type: 'online',
    afterCreateAddTrackID: [],
    show: true
  }
}

const updateCurrentTab = (tab: string) => {
  currentTab.value = tab
  nextTick(() => {
    updatePadding(32)
  })
}

const openPlaylistTabMenu = (e: MouseEvent) => {
  playlistTabMenu.value?.openMenu(e)
}

const changePlaylistFilter = (type: string) => {
  libraryPlaylistFilter.value = type
}

const observeTab = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const intersectionRatio = entry.intersectionRatio
      const maxPadding = 42
      const maxPaddingRight = 224
      if (intersectionRatio > 0) {
        if (isMac.value) {
          const paddingLeft = maxPadding * (1 - intersectionRatio)
          tabsRowRef.value.style.paddingLeft = `${paddingLeft}px`
        }
        const paddingRight = maxPaddingRight * (1 - intersectionRatio)
        tabsRowRef.value.style.width = `calc(100% - ${paddingRight}px)`
      } else {
        if (isMac.value) {
          tabsRowRef.value.style.paddingLeft = `${maxPadding}px`
        }
        tabsRowRef.value.style.width = `calc(100% - ${maxPaddingRight}px)`
      }
    })
  },
  {
    root: null,
    rootMargin: `-${hasCustomTitleBar.value ? 84 : 64}px 0px 0px 0px`,
    threshold: Array.from({ length: 100 }, (v, i) => i / 100)
  }
)

const handleResize = () => {
  winHeight.value = window.innerHeight
  observeTab.unobserve(tabsRowRef.value)
  observeTab.disconnect()
  if (tabsRowRef.value) observeTab.observe(tabsRowRef.value)
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)
  loadData()
  dailyTask()
  setTimeout(() => {
    updatePadding(32)
  }, 100)
  if (tabsRowRef.value) {
    observeTab.observe(tabsRowRef.value)
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  observeTab.disconnect()
  updatePadding(96)
})
</script>

<style scoped lang="scss">
.section-one {
  display: flex;
  margin-top: 24px;

  .liked-songs {
    flex: 3.2;
    cursor: pointer;
    border-radius: 16px;
    padding: 14px 24px 0 24px;
    display: flex;
    flex-direction: column;
    justify-items: center;
    transition: all 0.4s;
    background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);

    .title {
      font-size: 20px;
      font-weight: 700;
      margin: 24px 0 10px 0;
      color: var(--color-primary);
    }
    .sub-title {
      font-size: 15px;
      margin-top: 2px;
    }

    .bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--color-primary);

      .titles {
        width: 80%;
        .title {
          font-size: 16px;
          font-weight: 700;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    .top {
      display: flex;
      flex-wrap: wrap;
      font-size: 16px;
      opacity: 0.88;
      height: 94px;
      overflow: hidden;
      color: var(--color-primary);
      p {
        margin-top: 2px;
        -webkit-line-clamp: 1;
        line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
  }
  .songs {
    flex: 7;
    margin-left: 20px;
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
    height: 64px;
    width: 100%;
    box-sizing: border-box;
    z-index: 10;

    .tabs {
      display: flex;
      flex-wrap: wrap;
      font-size: 18px;
      color: var(--color-text);
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
button.playHistory-button {
  color: var(--color-text);
  border-radius: 8px;
  padding: 6px 8px;
  margin: 2px 4px 10px 0;
  transition: 0.2s;
  opacity: 0.68;
  font-weight: 500;
  cursor: pointer;
  &:hover {
    opacity: 1;
    background: var(--color-secondary-bg);
  }
  &:active {
    transform: scale(0.95);
  }
}

button.playHistory-button--selected {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  opacity: 1;
  font-weight: 700;
  &:active {
    transform: none;
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
  -webkit-app-region: no-drag;
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
// .section-two-content {
//   height: calc(100vh - 64px);
// }
</style>
