<template>
  <div class="local-music">
    <div class="section-one">
      <div class="left" style="width: 100%">
        <InfoBG />
        <div class="content">
          <label class="left-title">本地歌曲</label>
          <div class="content-info">
            <div>
              <div class="subtitle">全部歌曲</div>
              <div class="text">{{ rawTracks.length }}首</div>
            </div>
            <div>
              <div class="subtitle">歌曲总时长</div>
              <div class="text">{{ formatedTime }}</div>
            </div>
            <div>
              <div class="subtitle">离线歌单</div>
              <div class="text">{{ playlists['local']?.data?.length || 0 }}个</div>
            </div>
            <div>
              <div class="subtitle">歌曲占用</div>
              <div class="text">{{ formatedMemory }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="right-top" @click="hasLikedLocalTracks ? goToLikedSongsList() : playThisTrack()">
        <div v-if="hasLikedLocalTracks" class="title"
          >我喜欢的音乐 - {{ filterLikedTracks.length }}首</div
        >
        <div>
          <div
            v-for="(line, index) in pickedLyricLines"
            v-show="line !== ''"
            :key="`${line}${index}`"
            class="lyric-p"
          >
            {{ line }}</div
          >
        </div>
      </div>
      <div class="right-bottom"
        >{{ randomTrack?.artists?.[0]?.name }} - {{ randomTrack?.name }}</div
      >
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
          <div class="tab dropdown" :class="{ active: idx === 0 }" @click="updateTab(0)">
            <span class="text">{{ $t('localMusic.songs') }}</span>
            <span class="icon" @click.stop="(e) => openLocalTracksTabMenu('playlist', e)"
              ><svg-icon icon-class="dropdown"
            /></span>
          </div>
          <div v-if="isBatchOp" class="tab" @click="selectAll">{{
            $t('contextMenu.selectAll')
          }}</div>
          <div v-if="isBatchOp" class="tab" @click="addToPlaylist">{{
            $t('localMusic.playlist.addToPlaylist')
          }}</div>
          <div v-else class="tab" :class="{ active: idx === 1 }" @click="updateTab(1)">
            {{ $t('localMusic.playlist.text') }}
          </div>
          <div v-if="isBatchOp" class="tab" @click="addTracksToQueue">{{
            $t('contextMenu.addToQueue')
          }}</div>
          <div v-else class="tab dropdown" :class="{ active: idx === 2 }" @click="updateTab(2)">
            <span class="text">{{
              `${albumTab === 'default' ? '全部' : '收藏'} - ${$t('localMusic.albums')}`
            }}</span>
            <span class="icon" @click.stop="(e) => openLocalTracksTabMenu('album', e)"
              ><svg-icon icon-class="dropdown"
            /></span>
          </div>
          <div v-if="isBatchOp" class="tab" @click="finishBatchOp">{{
            $t('contextMenu.finish')
          }}</div>
          <div v-else class="tab dropdown" :class="{ active: idx === 3 }" @click="updateTab(3)">
            <span class="text">{{
              `${artistTab === 'default' ? '全部' : '收藏'} - ${$t(tool.artistBy === 'artists' ? 'localMusic.artists' : 'localMusic.albumArtist')}`
            }}</span>
            <span class="icon" @click.stop="(e) => openLocalTracksTabMenu('artist', e)"
              ><svg-icon icon-class="dropdown"
            /></span>
          </div>
          <div v-if="!isBatchOp" class="tab" :class="{ active: idx === 4 }" @click="updateTab(4)">{{
            $t('localMusic.dirName')
          }}</div>
        </div>
        <div v-if="idx !== 1" class="search-box">
          <SearchBox
            ref="localSearchBoxRef"
            :placeholder="`搜索${placeHolderMap(idx === 3 ? tool.artistBy : (tabs[idx] as string))}`"
          />
        </div>
        <button v-show="idx === 1" class="tab-button" @click="openAddPlaylistModal"
          ><svg-icon icon-class="plus" />{{ $t('library.playlist.newPlaylist') }}
        </button>
      </div>
      <div class="section-two-content" :style="tabStyle">
        <div v-show="idx === 0">
          <TrackList
            ref="trackListRef"
            :items="sortedLocalTracks"
            :type="'Track'"
            :plugin="plugin"
            :source-context="{}"
            :colunm-number="1"
            :is-end="true"
            :extra-context-menu-item="['showInFolder', 'removeLocalTrack', 'addToLocalList']"
          ></TrackList>
        </div>

        <div v-show="idx === 1">
          <CoverRow
            v-if="true"
            :items="filterPlaylists"
            type="Playlist"
            :colunm-number="5"
            :is-end="true"
            :style="{ paddingBottom: '0px' }"
          />
        </div>

        <div v-show="idx === 2">
          <AlbumList v-if="albumTab === 'default'" :tracks="sortedLocalTracks" :plugin="plugin" />
          <CoverRow
            v-else
            :items="filterAlbums"
            type="Album"
            sub-text="artist"
            :colunm-number="5"
            :is-end="true"
          />
        </div>

        <div v-show="idx === 3">
          <ArtistList
            v-if="artistTab === 'default'"
            :tracks="sortedLocalTracks"
            :type="tool.artistBy"
          />
          <CoverRow
            v-else
            :items="filterArtists"
            type="Artist"
            sub-text="artist"
            :colunm-number="5"
            :is-end="true"
          />
        </div>

        <div v-show="idx === 4">
          <DirList :tracks="sortedLocalTracks" />
        </div>
      </div>
    </div>

    <AccurateMatchModal />

    <ContextMenu ref="playlistTabMenu">
      <div
        v-for="sortOption in sortOptions"
        :key="sortOption.value"
        class="item"
        :class="{ active: tool.sortBy === sortOption.value }"
        @click="tools.local.sortBy = sortOption.value"
        >{{ sortOption.name }}</div
      >
      <hr v-show="!isBatchOp" />
      <div
        v-for="option in orderOptions"
        :key="option.value"
        class="item"
        :class="{ active: option.value === tool.orderBy }"
        @click="tools.local.orderBy = option.value"
        >{{ option.name }}</div
      >
      <hr v-show="!isBatchOp" />
      <div v-show="!isBatchOp" class="item" @click="scanLocalMusic">{{
        $t('contextMenu.reScan')
      }}</div>
      <div v-show="!isBatchOp" class="item" @click="isBatchOp = true">{{
        $t('contextMenu.batchOperation')
      }}</div>
    </ContextMenu>

    <ContextMenu ref="albumTabMenu">
      <div class="item" :class="{ active: albumTab === 'default' }" @click="albumTab = 'default'"
        >全部专辑</div
      >
      <div class="item" :class="{ active: albumTab === 'liked' }" @click="albumTab = 'liked'"
        >收藏专辑</div
      >
    </ContextMenu>

    <ContextMenu ref="artistTabMenu">
      <div
        class="item"
        :class="{ active: tool.artistBy === 'artists' }"
        @click="tools.local.artistBy = 'artists'"
        >{{ $t('localMusic.artists') }}</div
      >
      <div
        class="item"
        :class="{ active: tool.artistBy === 'albumArtists' }"
        @click="tools.local.artistBy = 'albumArtists'"
        >{{ $t('localMusic.albumArtist') }}</div
      >
      <br />
      <div class="item" :class="{ active: artistTab === 'default' }" @click="artistTab = 'default'"
        >全部</div
      >
      <div class="item" :class="{ active: artistTab === 'liked' }" @click="artistTab = 'liked'"
        >关注</div
      >
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import {
  onMounted,
  onBeforeUnmount,
  computed,
  watch,
  inject,
  ref,
  provide,
  shallowRef,
  nextTick,
  toRefs
} from 'vue'
import { storeToRefs } from 'pinia'
import { usePluginMusic } from '../store/pluginMusic'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import TrackList from '../components/VirtualTrackList.vue'
import InfoBG from '../components/InfoBG.vue'
import AlbumList from '../components/AlbumList.vue'
import ArtistList from '../components/ArtistList.vue'
import DirList from '../components/DirList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import SvgIcon from '../components/SvgIcon.vue'
import SearchBox from '../components/SearchBox.vue'
import ContextMenu from '../components/ContextMenu.vue'
import AccurateMatchModal from '../components/ModalAccurateMatch.vue'
import { pickedLyric, randomNum } from '../utils'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { PluginId } from '@/types/schemas'
import type { Track, sortType, orderType } from '@/types/plugin'
import { lyricLine } from '@/types/music.d'

const { newPlaylistModal, modalOpen } = storeToRefs(useNormalStateStore())

const pluginStore = usePluginMusic()
const playerStore = usePlayerStore()
const { tracks, playlists, tools, services, likedTracks, albums, artists } =
  storeToRefs(pluginStore)
const {
  scanLocalMusic,
  pluginMethodCall,
  fetchLikedPlaylists,
  fetchLikedArtists,
  fetchLikedSongsWithDetails,
  handleStatusChange
} = pluginStore
const router = useRouter()

const localService = computed(() => services.value.find((s) => s.type === 'local'))
const plugin = computed((): PluginId => localService.value?.code || ('local' as PluginId))
const tool = computed(() => tools.value.local)

const { scanDir } = toRefs(pluginStore)

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))
const isMac = computed(() => window.env?.isMac)

const checkLocalStatus = async () => {
  const localSrv = services.value.find((s) => s.type === 'local')
  if (!localSrv) return

  try {
    const res = await pluginMethodCall(localSrv.code, 'systemPing')
    handleStatusChange(localSrv.code, res.status)
    if (res.status === 'login' && res.scanDir) {
      const newDirs = res.scanDir as string[]
      const curDirs = scanDir.value
      if (newDirs.length !== curDirs.length || newDirs.some((d, i) => d !== curDirs[i])) {
        scanDir.value = newDirs
      }
    }
  } catch {
    handleStatusChange(localSrv.code, 'logout')
  }
}

// ref
const idx = ref(0)
const isBatchOp = ref(false)
const localSearchBoxRef = ref<InstanceType<typeof SearchBox>>()
const trackListRef = shallowRef<InstanceType<typeof TrackList>>()
const tabsRowRef = ref()
const playlistTabMenu = ref<InstanceType<typeof ContextMenu>>()
const albumTabMenu = ref<InstanceType<typeof ContextMenu>>()
const artistTabMenu = ref<InstanceType<typeof ContextMenu>>()
const randomLyric = ref<{ content: string }[]>([])
const randomTrack = ref<Track>()

const albumTab = ref<'default' | 'liked'>('default')
const artistTab = ref<'default' | 'liked'>('default')

const tabs = [
  'localTracks',
  'localPlaylist',
  'album',
  ['artists', 'albumArtists'],
  'dirName'
] as const

const { t } = useI18n()
const sortOptions: { name: string; value: sortType }[] = [
  { name: t('contextMenu.name'), value: 'name' },
  { name: t('contextMenu.createTime'), value: 'createTime' },
  { name: t('contextMenu.playCount'), value: 'playCount' }
]
const orderOptions: { name: string; value: orderType }[] = [
  { name: t('contextMenu.ascOrder'), value: 'ASC' },
  { name: t('contextMenu.descOrder'), value: 'DESC' }
]
const tabStyle = computed(() => {
  const marginTop = hasCustomTitleBar.value ? 20 : 0
  return { marginTop: `${marginTop}px` }
})

// ---- data ----

const rawTracks = computed(() => tracks.value[plugin.value]?.data || [])

const defaultTracks = computed(() => {
  return rawTracks.value
    .filter((track) =>
      scanDir.value.some((baseDir) =>
        normalizePath(track.filePath ?? '').startsWith(normalizePath(baseDir) + '/')
      )
    )
    .map((track, index) => ({
      ...track,
      index,
      dirName: getFirstDirName(scanDir.value, track.filePath ?? '')
    }))
})

const keyword = computed(() => localSearchBoxRef.value?.keywords || '')

const filterTracks = computed(() => {
  return defaultTracks.value.filter(
    (track) =>
      (track.name && track.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      track.alias?.find((al) => al.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      (track.album?.name &&
        track.album.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      track.artists.find(
        (ar) => ar.name && ar.name.toLowerCase().includes(keyword.value?.toLowerCase())
      ) ||
      track.albumArtists.find(
        (ar) => ar.name && ar.name.toLowerCase().includes(keyword.value?.toLowerCase())
      ) ||
      track.dirName?.toLowerCase().includes(keyword.value?.toLowerCase())
  )
})

const sortedLocalTracks = computed(() => {
  return filterTracks.value.slice().sort((a, b) => {
    const first = a[tool.value.sortBy]
    const second = b[tool.value.sortBy]

    if (tool.value.orderBy === 'ASC') {
      if (typeof first === 'number' && typeof second === 'number') {
        return first - second
      }
      return String(first).localeCompare(String(second), 'zh-CN', { numeric: true })
    } else {
      if (typeof first === 'number' && typeof second === 'number') {
        return second - first
      }
      return String(second).localeCompare(String(first), 'zh-CN', { numeric: true })
    }
  })
})

const filterLikedTracks = computed(() => likedTracks.value[plugin.value]?.data || [])

const hasLikedLocalTracks = computed(() => filterLikedTracks.value.length > 0)

const filterAlbums = computed(() => {
  return albums.value[plugin.value]?.data || []
})

const filterArtists = computed(() => {
  return artists.value[plugin.value]?.data || []
})

const filterPlaylists = computed(() => {
  return playlists.value[plugin.value]?.data || []
})

// ---- hero stats ----

const formatedTime = computed(() => {
  const dt =
    defaultTracks.value
      .map((track) => track.duration)
      .filter((dt) => dt && !isNaN(Number(dt)))
      .reduce((acc, cur) => acc + cur, 0) / 1000
  const hours = Math.floor(dt / 3600)
  const minutes = Math.floor((dt % 3600) / 60)
  const seconds = Math.floor(dt % 60)
  return `${hours}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`
})

const formatedMemory = computed(() => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let memory = defaultTracks.value
    .map((track) => track.size!)
    .filter((size) => size && !isNaN(Number(size)))
    .reduce((acc, cur) => acc + cur, 0) as number
  let i = 0
  while (memory >= 1024 && i < units.length - 1) {
    memory /= 1024
    i++
  }
  return `${memory.toFixed(2)} ${units[i]}`
})

const pickedLyricLines = computed(() => {
  const randomLines = pickedLyric(randomLyric.value)
  return randomLines
})

const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')

const getFirstDirName = (baseDirs: string[], filePath: string) => {
  const path = normalizePath(filePath)
  for (const baseDir of baseDirs) {
    const base = normalizePath(baseDir)
    if (path === base) continue
    if (path.startsWith(base + '/')) {
      const relative = path.slice(base.length + 1)
      return relative.split('/')[0]
    }
  }
  return ''
}

const placeHolderMap = (tab: string) => {
  const pMap: Record<string, string> = {
    localTracks: t('localMusic.songs'),
    localPlaylist: t('localMusic.playlist.text'),
    album: t('localMusic.albums'),
    artists: t('localMusic.artists'),
    albumArtists: t('localMusic.albumArtist'),
    dirName: t('localMusic.dirName')
  }
  return pMap[tab] || ''
}

// ---- actions ----

const updateTab = (index: number) => {
  idx.value = index
  observeTab.disconnect()
  observeTab.observe(tabsRowRef.value!)
}

const selectAll = () => {
  trackListRef.value?.selectAll()
}

const finishBatchOp = () => {
  isBatchOp.value = false
  trackListRef.value?.doFinish()
}

const addToPlaylist = () => {
  trackListRef.value?.addTrackToPlaylist()
}

const addTracksToQueue = () => {
  trackListRef.value?.addToQueue([])
}

const goToLikedSongsList = () => {
  router.push({ path: `/liked-songs/${plugin.value}` })
}

const playThisTrack = () => {
  if (!randomTrack.value) return
  playerStore.addTrackToPlayNext(
    [[plugin.value, randomTrack.value.sourceContext]],
    true, // playNow
    true // addToHead
  )
}

const openLocalTracksTabMenu = (ref: 'playlist' | 'album' | 'artist', e: MouseEvent): void => {
  const map = {
    playlist: playlistTabMenu.value,
    album: albumTabMenu.value,
    artist: artistTabMenu.value
  }
  map[ref]?.openMenu(e)
}

const openAddPlaylistModal = () => {
  newPlaylistModal.value = {
    plugin: 'local' as PluginId,
    afterCreateAddTrackID: [],
    show: true
  }
}

const getRandomTrack = async () => {
  const sourceTracks =
    filterLikedTracks.value.length > 0 ? filterLikedTracks.value : rawTracks.value
  if (!sourceTracks.length) return
  let i = 0
  let data: lyricLine[]
  while (i < sourceTracks.length) {
    const track = sourceTracks[randomNum(0, sourceTracks.length - 1)]
    data = await pluginMethodCall(plugin.value, 'getLyric', track.sourceContext).then(
      (result: any) => {
        if (result.code === 200) return result.data
        return []
      }
    )
    const isInstrumental = data.some((l) => l.lyric.text.includes('纯音乐，请欣赏'))
    if (data.length && !isInstrumental) {
      randomLyric.value = data.map((l) => ({ content: l.lyric.text }))
      randomTrack.value = track
      break
    }
    i++
  }
}

// provide
provide('isBatchOp', isBatchOp)

// ---- lifecycle ----

const navBarRef = inject('navBarRef', ref())

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
    threshold: Array.from({ length: 100 }, (v, i) => i / 100)
  }
)

const handleResize = () => {
  observeTab.unobserve(tabsRowRef.value)
  observeTab.disconnect()
  if (tabsRowRef.value) observeTab.observe(tabsRowRef.value)
}

const updatePadding = inject('updatePadding') as (padding: number) => void

watch(idx, () => {
  nextTick(() => {
    updatePadding(0)
  })
})

watch(modalOpen, (value) => {
  if (!value) {
    isBatchOp.value = false
  }
})

watch(
  [filterLikedTracks, rawTracks],
  () => {
    getRandomTrack()
  },
  { immediate: true }
)

onMounted(async () => {
  await checkLocalStatus()

  window.addEventListener('resize', handleResize)
  setTimeout(() => {
    updatePadding(0)
    if (tabsRowRef.value) observeTab.observe(tabsRowRef.value)
  }, 100)
  fetchLikedPlaylists(plugin.value)
  fetchLikedSongsWithDetails(plugin.value)
  fetchLikedArtists(plugin.value)
})

onBeforeUnmount(() => {
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
  width: 100%;
  transition: all 0.4s;
  position: relative;

  .left {
    position: absolute;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;

    .content {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: absolute;
      top: 0;
      left: 0;
      width: 410px;
      height: 100%;
      padding: 36px 80px;
      box-sizing: border-box;

      .left-title {
        font-size: 26px;
        font-weight: bold;
      }

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
    max-width: 270px;
    font-size: 18px;
    line-height: 30px;
    color: var(--color-primary);
    display: flex;
    justify-content: center;
    flex-direction: column;
    cursor: pointer;

    .title {
      font-size: 20px;
      font-weight: 700;
      margin: 24px 0 10px 0;
      color: var(--color-primary);
    }

    .lyric-p {
      height: 30px;
      line-clamp: 1;
      -webkit-line-clamp: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }
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
    height: 64px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    box-sizing: border-box;
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
