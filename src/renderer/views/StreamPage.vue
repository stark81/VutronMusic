<template>
  <div class="streaming-music">
    <div class="section-one">
      <div class="left" style="width: 100%">
        <InfoBG />
        <div class="content">
          <label class="left-title"
            >流媒体歌曲 - {{ tool.groundBy === 'all' ? '聚合' : tool.groundBy }}</label
          >
          <div class="content-info">
            <div>
              <div class="subtitle">全部歌曲</div>
              <div class="text">{{ tracksCount }}首</div>
            </div>
            <div>
              <div class="subtitle">歌曲总时长</div>
              <div class="text">{{ '' }}</div>
            </div>
            <div>
              <div class="subtitle">流媒体歌单</div>
              <div class="text">{{ filterPlaylists.length }}个</div>
            </div>
            <div>
              <div class="subtitle">歌曲占用</div>
              <div class="text">{{ '' }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="right-top" @click="goToLikedSongsList">
        <div class="title"
          >{{ $t('library.likedSongs') }} - {{ filterLikedTracks.length
          }}{{ $t('common.songs') }}</div
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
        >{{ randomtrack?.artists?.[0]?.name }} - {{ randomtrack?.name }}</div
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
          <div class="tab dropdown" :class="{ active: idx === 0 }" @click="idx = 0">
            <span class="text">{{ $t('streamMusic.track') }}</span>
            <span class="icon" @click.stop="(e) => openTabMenu('track', e)"
              ><svg-icon icon-class="dropdown"
            /></span>
          </div>
          <div v-if="isBatchOp" class="tab" @click="selectAll">{{
            $t('contextMenu.selectAll')
          }}</div>
          <div v-if="isBatchOp" class="tab" @click="addToPlaylist">{{
            $t('streamMusic.playlist.addToPlaylist')
          }}</div>
          <div v-else class="tab" :class="{ active: idx === 1 }" @click="idx = 1">
            {{ $t('streamMusic.playlist.text') }}
          </div>
          <div v-if="isBatchOp" class="tab" @click="addTracksToQueue">{{
            $t('contextMenu.addToQueue')
          }}</div>
          <div v-else class="tab dropdown" :class="{ active: idx === 2 }" @click="idx = 2">
            <span class="text">{{
              `${albumTab === 'default' ? '全部' : '收藏'} - ${$t('streamMusic.album')}`
            }}</span>
            <span class="icon" @click.stop="(e) => openTabMenu('album', e)"
              ><svg-icon icon-class="dropdown"
            /></span>
          </div>
          <div v-if="isBatchOp" class="tab" @click="finishBatchOp">{{
            $t('contextMenu.finish')
          }}</div>
          <div v-else class="tab dropdown" :class="{ active: idx === 3 }" @click="idx = 3">
            <span class="text">{{
              `${artistTab === 'default' ? '全部' : '收藏'} - ${$t(tool.artistBy === 'artists' ? 'streamMusic.artist' : 'localMusic.albumArtist')}`
            }}</span>
            <span class="icon" @click.stop="(e) => openTabMenu('artist', e)"
              ><svg-icon icon-class="dropdown"
            /></span>
          </div>
        </div>
        <div v-show="idx !== 1" class="search-box">
          <SearchBox
            ref="streamSearchBoxRef"
            :placeholder="`搜索${placeHolderMap(idx === 3 ? tool.artistBy : String(tabs[idx]))}`"
          />
        </div>
        <button v-show="idx === 1" class="tab-button" @click="openAddPlaylistModal"
          ><svg-icon icon-class="plus" />{{ $t('library.playlist.newPlaylist') }}</button
        >
      </div>
      <div v-if="!loginService.length" class="errorInfo">{{ 'streamMessage' }}</div>
      <div v-if="show" class="section-two-content" :style="tabStyle">
        <div v-show="idx === 0">
          <TrackList
            ref="streamListRef"
            :items="filterTracks"
            :type="'Track'"
            :plugin="tool.groundBy"
            :source-context="{ pluginType: 'stream' }"
            :show-service="tool.groundBy === 'all'"
            :colunm-number="1"
            :is-end="true"
          />
        </div>
        <div v-show="idx === 1">
          <CoverRow
            :items="filterPlaylists"
            type="Playlist"
            sub-text="creator"
            :colunm-number="5"
            :is-end="true"
          />
        </div>
        <div v-show="idx === 2">
          <AlbumList v-if="albumTab === 'default'" :tracks="filterTracks" />
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
          <ArtistList v-if="artistTab === 'default'" :tracks="filterTracks" :type="tool.artistBy" />
          <CoverRow
            v-else
            :items="filterArtists"
            type="Artist"
            sub-text="artist"
            :colunm-number="5"
            :is-end="true"
          />
        </div>
      </div>
    </div>

    <ContextMenu ref="streamTabMenu">
      <div class="item" :class="{ active: tool.groundBy === 'all' }" @click="tool.groundBy = 'all'"
        >聚合</div
      >
      <div
        v-for="se in loginService"
        :key="se.code"
        class="item"
        :class="{ active: tool.groundBy === se.code }"
        @click="tool.groundBy = se.code"
      >
        {{ se.name }}
      </div>
      <hr />
      <div
        v-for="sortOption in sortOptions"
        :key="sortOption.value"
        class="item"
        :class="{ active: sortOption.value === tool.sortBy }"
        @click="tool.sortBy = sortOption.value"
        >{{ sortOption.name }}</div
      >
      <hr v-show="!isBatchOp" />
      <div
        v-for="option in orderOptions"
        :key="option.value"
        class="item"
        :class="{ active: option.value === tool.orderBy }"
        @click="tool.orderBy = option.value"
        >{{ option.name }}</div
      >
      <hr v-show="!isBatchOp" />
      <div v-show="!isBatchOp" class="item" @click="isBatchOp = true">{{
        $t('contextMenu.batchOperation')
      }}</div>
    </ContextMenu>

    <ContextMenu ref="albumTabMenu">
      <div class="item" :class="{ active: albumTab === 'default' }" @click="albumTab = 'default'"
        >全部</div
      >
      <div class="item" :class="{ active: albumTab === 'liked' }" @click="albumTab = 'liked'"
        >收藏</div
      >
    </ContextMenu>

    <ContextMenu ref="artistTabMenu">
      <div
        class="item"
        :class="{ active: tool.artistBy === 'artists' }"
        @click="tool.artistBy = 'artists'"
        >{{ $t('localMusic.artists') }}</div
      >
      <div
        class="item"
        :class="{ active: tool.artistBy === 'albumArtists' }"
        @click="tool.artistBy = 'albumArtists'"
        >{{ $t('localMusic.albumArtist') }}</div
      >
      <br />
      <div class="item" :class="{ active: artistTab === 'default' }" @click="artistTab = 'default'"
        >全部</div
      >
      <div class="item" :class="{ active: artistTab === 'liked' }" @click="artistTab = 'liked'"
        >收藏</div
      >
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, watch, inject, ref, provide, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { usePluginMusic } from '../store/pluginMusic'
import { useNormalStateStore } from '../store/state'
import { useRouter } from 'vue-router'
import InfoBG from '../components/InfoBG.vue'
import SvgIcon from '../components/SvgIcon.vue'
import SearchBox from '../components/SearchBox.vue'
import TrackList from '../components/VirtualTrackList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import ContextMenu from '../components/ContextMenu.vue'
import AlbumList from '../components/AlbumList.vue'
import ArtistList from '../components/ArtistList.vue'
import { useI18n } from 'vue-i18n'
import { randomNum, pickedLyric } from '../utils'
import { lyricLine } from '@/types/music.d'
import type { Track, LoginType, sortType, orderType } from '@/types/plugin'
// import _ from 'lodash'
import { PluginId } from '@/types/schemas'

const stateStore = useNormalStateStore()
const { newPlaylistModal, modalOpen } = storeToRefs(stateStore)
const { showToast } = stateStore

const pluginStore = usePluginMusic()
const { playlists, tools, likedTracks, services, albums, artists, tracks } =
  storeToRefs(pluginStore)
const {
  fetchLikedPlaylists,
  fetchLikedSongsWithDetails,
  // fetchLyric,
  pluginMethodCall,
  fetchLikedArtists,
  fetchAllTracks
} = pluginStore

const streamService = computed(() => services.value.filter((item) => item.type === 'stream'))
const loginService = computed(() => streamService.value.filter((item) => item.status === 'login'))
const tool = computed(() => tools.value.stream)
const router = useRouter()

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))
const streamTabMenu = ref<InstanceType<typeof ContextMenu>>()
const albumTabMenu = ref<InstanceType<typeof ContextMenu>>()
const artistTabMenu = ref<InstanceType<typeof ContextMenu>>()
const streamSearchBoxRef = ref<InstanceType<typeof SearchBox>>()
const streamListRef = shallowRef<InstanceType<typeof TrackList>>()
const tabsRowRef = ref()
const isBatchOp = ref(false)
const show = ref(false)
const lyric = ref<{ content: string }[]>([])
const randomtrack = ref<Track>()
const idx = ref(0)

const albumTab = ref<'default' | 'liked'>('default')
const artistTab = ref<'default' | 'liked'>('default')

const tabs = ['track', 'playlist', 'album', ['artist', 'albumArtist']] as const

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

const sers = computed(() => loginService.value.map((it) => it.code))

const filterLikedTracks = computed(() => {
  const tracks =
    tool.value.groundBy === 'all'
      ? Object.entries(likedTracks.value)
          .filter(([plugin]) => sers.value.includes(plugin as PluginId))
          .map(([, item]) => item.data)
          .flat()
      : likedTracks.value?.[tool.value.groundBy]?.data || []
  return tracks
})

const defaultTracks = computed(() => {
  const _tracks =
    tool.value.groundBy === 'all'
      ? Object.entries(tracks.value)
          .filter(([plugin]) => sers.value.includes(plugin as PluginId))
          .map(([, item]) => item.data)
          .flat()
      : tracks.value[tool.value.groundBy]?.data || []
  return _tracks
})

const tracksCount = computed(() => {
  const groundByCount = Object.entries(tracks.value)
    .filter(([plugin]) => sers.value.includes(plugin as PluginId))
    .map(([, item]) => item.count)
    .reduce((acc, cur) => acc + cur, 0)
  return tool.value.groundBy === 'all'
    ? groundByCount
    : tracks.value[tool.value.groundBy]?.count || defaultTracks.value.length
})

const filterPlaylists = computed(() => {
  const streamTool = pluginStore.tools.stream

  const onlinePlaylists = streamService.value
    .map((item) => (playlists.value[item.code]?.data ?? []).flat())
    .flat()

  const plists =
    streamTool.groundBy === 'all'
      ? onlinePlaylists
      : playlists.value?.[streamTool.groundBy]?.data || []
  return plists
})

const filterAlbums = computed(() => {
  const streamTool = pluginStore.tools.stream

  const al = streamService.value.map((item) => (albums.value[item.code]?.data ?? []).flat()).flat()
  const plists = streamTool.groundBy === 'all' ? al : albums.value[streamTool.groundBy].data
  return plists
})

const filterArtists = computed(() => {
  const streamTool = pluginStore.tools.stream

  const ar = streamService.value.map((item) => (artists.value[item.code]?.data ?? []).flat()).flat()
  const plists = streamTool.groundBy === 'all' ? ar : artists.value[streamTool.groundBy].data
  return plists
})

// const streamMessage = computed(() => {
//   return loginedServices.value.length === 0 ? message.value : '当前服务离线，请稍后再试'
// })

const pickedLyricLines = computed(() => {
  const randomLines = pickedLyric(lyric.value)
  return randomLines
})

const keyword = computed(() => streamSearchBoxRef.value?.keywords || '')

const filterTracks = computed(() => {
  return sortedLocalTracks.value.filter(
    (track) =>
      (track.name && track.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      (track.album?.name &&
        track.album.name.toLowerCase().includes(keyword.value?.toLowerCase())) ||
      track.artists.find(
        (ar) => ar.name && ar.name.toLowerCase().includes(keyword.value?.toLowerCase())
      )
    // ||
    // track.albumArtist.find(
    //   (ar) => ar.name && ar.name.toLowerCase().includes(keyword.value?.toLowerCase())
    // )
  )
})

const sortedLocalTracks = computed(() => {
  return defaultTracks.value.slice().sort((a, b) => {
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

watch(keyword, (value) => {
  const count =
    tool.value.groundBy === 'all'
      ? Object.entries(tracks.value)
          .filter(([plugin]) => sers.value.includes(plugin as PluginId))
          .map(([, item]) => item.count)
          .flat()
          .reduce((acc, cur) => acc + cur, 0)
      : tracks.value[tool.value.groundBy].count
  if (count === defaultTracks.value.length) return

  // 当两者数量不一致时，说明尚未歌曲并没有完全加载，需要对流媒体歌曲进行搜索
  console.log('=2=2=22', value, count, defaultTracks.value.length)
})

// const formatedTime = computed(() => {
//   const dt =
//     defaultTracks.value
//       .map((track) => track.dt)
//       .filter((dt) => dt && !isNaN(Number(dt)))
//       .reduce((acc, cur) => acc + cur, 0) / 1000
//   const hourse = Math.floor(dt / 3600)
//   const minutes = Math.floor((dt % 3600) / 60)
//   const seconds = Math.floor(dt % 60)
//   return `${hourse}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`
// })

// const formatedMemory = computed(() => {
//   const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
//   let memory = defaultTracks.value
//     .map((track) => track.size!)
//     .reduce((acc, cur) => acc + cur, 0) as number
//   let i = 0
//   while (memory >= 1024 && i < units.length - 1) {
//     memory /= 1024
//     i++
//   }
//   return `${memory.toFixed(2)} ${units[i]}`
// })

const selectAll = () => {
  streamListRef.value?.selectAll()
}

const addToPlaylist = () => {
  streamListRef.value?.addTrackToPlaylist()
}

const addTracksToQueue = () => {
  // streamListRef.value?.addToQueue()
}

const finishBatchOp = () => {
  isBatchOp.value = false
  streamListRef.value?.doFinish()
}

const openTabMenu = (ref: 'track' | 'album' | 'artist', e: MouseEvent): void => {
  const map = {
    track: streamTabMenu.value,
    album: albumTabMenu.value,
    artist: artistTabMenu.value
  }
  map[ref]?.openMenu(e)
}

const placeHolderMap = (tab: string) => {
  const pMap = {
    track: t('streamMusic.song'),
    album: t('streamMusic.album'),
    artist: t('streamMusic.artist')
  }
  return pMap[tab]
}

const goToLikedSongsList = () => {
  if (tool.value.groundBy === 'all') {
    const plugins = loginService.value.map((it) => it.code).join('/')
    router.push({ path: `/liked-songs/${plugins}` })
  } else {
    router.push({ path: `/liked-songs/${tool.value.groundBy}` })
  }
}

const openAddPlaylistModal = () => {
  if (tool.value.groundBy === 'all' && loginService.value.length > 1) {
    showToast('在聚合视图下无法进行操作，请先选择具体的流媒体服务')
    return
  }
  newPlaylistModal.value = {
    plugin: tool.value.groundBy === 'all' ? loginService.value[0].code : tool.value.groundBy,
    afterCreateAddTrackID: [],
    show: true
  }
}

const getRandomTrack = async () => {
  if (filterLikedTracks.value.length === 0) return

  let i = 0
  let data: lyricLine[]
  while (i < filterLikedTracks.value.length) {
    const track = filterLikedTracks.value[randomNum(0, filterLikedTracks.value.length - 1)]
    // data = await fetchLyric(track.pluginId, track.sourceContext)
    data = await pluginMethodCall(track.pluginId, 'getLyric', track.sourceContext).then(
      (result) => {
        if (result.code === 200) return result.data
        return []
      }
    )
    const isInstrumental = data.some((l) => l.lyric.text.includes('纯音乐，请欣赏'))
    if (data.length && !isInstrumental) {
      lyric.value = data.map((l) => ({ content: l.lyric.text }))
      randomtrack.value = track
      break
    }
    i++
  }
}

watch(modalOpen, (value) => {
  if (!value) {
    isBatchOp.value = false
  }
})

provide('isBatchOp', isBatchOp)

const navBarRef = inject('navBarRef', ref())
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

const checkLoginStatus = async () => {
  await Promise.all(
    streamService.value
      .filter((item) => item.status !== 'logout')
      .map(async (item) => {
        const res = await pluginMethodCall(item.code, 'systemPing')
        item.status = res.status
      })
  )
  if (!services.value.length) {
    const groundBy = tool.value.groundBy
    router.push(`/login/${groundBy === 'all' ? streamService.value[0].code : groundBy}/Username`)
  }
}

const loadData = async (ser: PluginId) => {
  if (filterTracks.value.length) {
    show.value = true
    await fetchLikedPlaylists(ser)
    fetchLikedSongsWithDetails(ser)
    fetchLikedArtists(ser)
    fetchAllTracks(ser)
  } else {
    await fetchLikedPlaylists(ser)
    await fetchLikedSongsWithDetails(ser)
    fetchLikedArtists(ser)
    fetchAllTracks(ser)
    show.value = true
  }
}

watch(loginService, (value, oldValue) => {
  if (!value.length) {
    const groupBy = tool.value.groundBy
    const service = groupBy === 'all' ? streamService.value[0].code : groupBy
    const loginTpye: LoginType = 'Username'
    router.push(`/login/${service}/${loginTpye}`)
    return
  }
  value.forEach((item) => {
    if (!oldValue?.length) {
      loadData(item.code)
    } else {
      const idx = oldValue.findIndex((it) => it.code === item.code)
      if (idx === -1) {
        loadData(item.code)
      }
    }
  })
})

watch(
  filterLikedTracks,
  () => {
    getRandomTrack()
  },
  { deep: true, immediate: true }
)

onMounted(async () => {
  await checkLoginStatus()
  loginService.value.forEach((item) => loadData(item.code))
  window.addEventListener('resize', handleResize)
  setTimeout(() => {
    if (tabsRowRef.value) observeTab.observe(tabsRowRef.value)
  }, 100)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  navBarRef.value.searchBoxRef.$el.style.display = ''
  observeTab.unobserve(tabsRowRef.value)
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
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: absolute;
      top: 0;
      left: 0;
      width: 410px;
      height: 100%;
      padding: 36px 60px;
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

  .title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 20px;
    color: var(--color-primary);
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
