<template>
  <div v-show="show" class="library">
    <div class="section-one">
      <div class="liked-songs" @click="goToLikedSongsList">
        <div class="title"
          >{{ $t('library.likedSongs') }} - {{ filterLikedTracks.length
          }}{{ $t('common.songs') }}</div
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
            <div v-show="randomtrack?.artists[0].name" class="title">{{
              `${randomtrack?.artists[0].name} -- ${randomtrack?.name}`
            }}</div>
          </div>
        </div>
      </div>
      <div class="songs">
        <TrackList
          :items="filterLikedTracks.slice(0, 8)"
          :plugin="tool.groundBy"
          type="TrackList"
          :source-context="{ pluginType: 'library', id: 'library' }"
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
            type="Playlist"
            sub-text="creator"
            :colunm-number="5"
            :is-end="true"
            :padding-bottom="96"
          />
        </div>

        <div v-show="currentTab === 'album'">
          <CoverRow
            :items="filterLikedAlbums"
            type="Album"
            sub-text="artist"
            :colunm-number="5"
            :is-end="true"
            :padding-bottom="96"
          />
        </div>

        <div v-show="currentTab === 'mvs'">
          <Mvrow :mvs="filterLikedMVs" :is-end="true" :column-number="4" />
        </div>

        <div v-show="currentTab === 'artist'">
          <CoverRow
            :items="filterLikedArtists"
            type="Artist"
            sub-text="artist"
            :item-height="230"
            :colunm-number="5"
            :is-end="true"
            :padding-bottom="96"
          />
        </div>

        <div v-show="currentTab === 'cloudDisk'">
          <TrackList
            :items="filterCloudDisk"
            :colunm-number="1"
            :plugin="tool.groundBy"
            :source-context="{ pluginType: 'library', id: 'cloudDisk' }"
            :show-service="true"
            type="CloudDisk"
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
            :plugin="tool.groundBy"
            :source-context="{ pluginType: 'library', id: 'playHistory' }"
            :colunm-number="1"
            :show-service="true"
            :show-play-count="true"
            :height="historyHeight"
            :item-height="60"
            type="History"
            :is-end="true"
          />
        </div>
      </div>
    </div>

    <ContextMenu ref="playlistTabMenu">
      <div class="item" :class="{ active: tool.groundBy === 'all' }" @click="tool.groundBy = 'all'"
        >聚合</div
      >
      <div
        v-for="ser in services"
        :key="ser.code"
        class="item"
        :class="{ active: tool.groundBy === ser.code }"
        @click="tool.groundBy = ser.code"
        >{{ ser.name }}</div
      >
      <hr />
      <div
        class="item"
        :class="{ active: libraryPlaylistFilter === 'all' }"
        @click="changePlaylistFilter('all')"
        >{{ $t('contextMenu.allPlaylists') }}</div
      >
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
import { usePluginMusic } from '../store/pluginMusic'
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue'
import { randomNum, pickedLyric } from '../utils'
import { tricklingProgress } from '../utils/tricklingProgress'
import SvgIcon from '../components/SvgIcon.vue'
import TrackList from '../components/VirtualTrackList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import Mvrow from '../components/MvRow.vue'
import ContextMenu from '../components/ContextMenu.vue'
import { useRouter } from 'vue-router'
import { lyricLine } from '@/types/music'
import type { PluginId, Track, service } from '@/types/plugin'

const dataStore = useDataStore()
const { libraryPlaylistFilter } = storeToRefs(dataStore)

const stateStore = useNormalStateStore()
const { newPlaylistModal } = storeToRefs(stateStore)
const { showToast } = stateStore

const pluginStore = usePluginMusic()
const { playlists, likedTracks, albums, artists, mvs, cloudDisks, playHistory } =
  storeToRefs(pluginStore)
const {
  fetchPlayHistory,
  fetchLikedPlaylists,
  fetchLikedSongsWithDetails,
  fetchLikedArtists,
  fetchLikedMVs,
  fetchCloudDisk,
  fetchLyric
} = pluginStore

const show = ref(false)
const playHistoryMode = ref('week')
const router = useRouter()

const lyric = ref<{ content: string }[]>([])
const randomtrack = ref<Track>()
const currentTab = ref('playlist')
const playlistTabMenu = ref<InstanceType<typeof ContextMenu>>()
const tabsRowRef = ref()

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))

const isMac = computed(() => window.env?.isMac)
const services = computed(() =>
  pluginStore.loggedInServices.filter((item) => item.type === 'library')
)
const tool = computed(() => pluginStore.tools.library)

const sers = computed(() => services.value.map((item) => item.code))

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
  const height = winHeight.value - 42 - (hasCustomTitleBar.value ? 84 : 64)
  return height
})

const playlistFilter = computed(() => {
  return libraryPlaylistFilter.value || 'all'
})

const filterPlaylists = computed(() => {
  const onlineServices = services.value.filter((item) => item.type === 'library')
  const onlineTool = pluginStore.tools.library

  const onlinePlaylists = onlineServices
    .map((item) => (playlists.value[item.code]?.data ?? []).flat())
    .flat()
  const plists =
    onlineTool.groundBy === 'all' ? onlinePlaylists : playlists.value[onlineTool.groundBy].data

  if (libraryPlaylistFilter.value === 'mine') {
    return plists.filter((item) => item.isMine)
  } else if (libraryPlaylistFilter.value === 'liked') {
    return plists.filter((item) => !item.isMine)
  } else {
    return plists
  }
})

const filterLikedTracks = computed(() => {
  const tracks =
    tool.value.groundBy === 'all'
      ? Object.entries(likedTracks.value)
          .filter(([plugin]) => sers.value.includes(plugin as PluginId))
          .map(([, item]) => item.data)
          .flat()
      : likedTracks.value[tool.value.groundBy]?.data || []
  return tracks
})

const filterLikedAlbums = computed(() => {
  const servs = services.value.filter((item) => item.type === 'library')

  const albs =
    tool.value.groundBy === 'all'
      ? servs.map((item) => albums.value[item.code]?.data ?? []).flat()
      : albums.value[tool.value.groundBy].data
  return albs
})

const filterLikedArtists = computed(() => {
  const servs = services.value.filter((item) => item.type === 'library')

  const ars =
    tool.value.groundBy === 'all'
      ? servs.map((item) => artists.value[item.code]?.data ?? []).flat()
      : artists.value[tool.value.groundBy].data
  return ars
})

const filterLikedMVs = computed(() => {
  const res =
    tool.value.groundBy === 'all'
      ? Object.values(mvs.value)
          .map((item) => item.data)
          .flat()
      : mvs.value[tool.value.groundBy].data
  return res
})

const filterCloudDisk = computed(() => {
  const res =
    tool.value.groundBy === 'all'
      ? Object.values(cloudDisks.value)
          .map((item) => item.data)
          .flat()
      : cloudDisks.value[tool.value.groundBy].data
  return res
})

const playHistoryList = computed(() => {
  if (show.value && playHistoryMode.value === 'week') {
    const res =
      tool.value.groundBy === 'all'
        ? Object.values(playHistory.value)
            .map((item) => item.week)
            .flat()
        : playHistory.value[tool.value.groundBy].week
    return res
  } else if (show.value && playHistoryMode.value === 'all') {
    const res =
      tool.value.groundBy === 'all'
        ? Object.values(playHistory.value)
            .map((item) => item.all)
            .flat()
        : playHistory.value[tool.value.groundBy].all
    return res
  }
  return []
})

const loadData = async (ser: service) => {
  await nextTick()
  if (likedTracks.value[ser.code]?.data.length) {
    tricklingProgress.done()
    show.value = true
    getRandomLyric()
    fetchLikedSongsWithDetails(ser.code)
    fetchLikedPlaylists(ser.code)
  } else {
    await fetchLikedPlaylists(ser.code)
    await fetchLikedSongsWithDetails(ser.code)
    getRandomLyric()
    tricklingProgress.done()
    show.value = true
  }
  fetchLikedArtists(ser.code)
  fetchLikedMVs(ser.code)
  fetchPlayHistory(ser.code)
  fetchCloudDisk(ser.code)
}

const getRandomLyric = async () => {
  if (filterLikedTracks.value.length === 0) return

  let i = 0
  let data: lyricLine[]
  while (i < filterLikedTracks.value.length) {
    const track = filterLikedTracks.value[randomNum(0, filterLikedTracks.value.length - 1)]
    data = await fetchLyric(track)
    const isInstrumental = data.map((l) => l.lyric.text).filter((l) => l.includes('纯音乐，请欣赏'))
    if (data.length && !isInstrumental.length) {
      lyric.value = data.map((l) => ({ content: l.lyric.text }))
      randomtrack.value = track
      break
    }
    i++
  }
}

const goToLikedSongsList = () => {
  if (tool.value.groundBy === 'all') {
    const plugins = services.value.map((it) => it.code).join('/')
    router.push({ path: `/liked-songs/${plugins}` })
  } else {
    router.push({ path: `/liked-songs/${tool.value.groundBy}` })
  }
}

const updatePadding = inject('updatePadding') as (padding: number) => void

const openAddPlaylistModal = () => {
  if (tool.value.groundBy === 'all' && services.value.length > 1) {
    showToast('在聚合视图下无法进行操作，请先选择具体的音源服务')
    return
  }

  newPlaylistModal.value = {
    plugin: tool.value.groundBy === 'all' ? services.value[0].code : tool.value.groundBy,
    afterCreateAddTrackID: [],
    show: true
  }
}

const updateCurrentTab = (tab: string) => {
  currentTab.value = tab
  nextTick(() => {
    updatePadding(0)
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

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  if (tabsRowRef.value) {
    observeTab.observe(tabsRowRef.value)
  }
  await nextTick()

  services.value.forEach((ser) => {
    loadData(ser)
  })

  setTimeout(() => {
    updatePadding(0)
    show.value = true
  }, 100)
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
      align-items: center;
      justify-content: space-between;
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
