<template>
  <div v-if="show" class="streaming-music">
    <div class="section-one">
      <div class="left" style="width: 100%">
        <InfoBG />
        <div class="content">
          <h2 style="margin-bottom: 20px">流媒体歌曲 - {{ stream.select }}</h2>
          <div class="content-info">
            <div>
              <div class="subtitle">全部歌曲</div>
              <div class="text">{{ tracks.length }}首</div>
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
      <div class="right-top">
        <p>
          <!-- <span v-for="(line, index) in pickedLyric" v-show="line !== ''" :key="`${line}${index}`"
            >{{ line }}<br
          /></span> -->
        </p>
      </div>
      <!-- <div class="right-bottom">{{ artist }} - {{ trackName }}</div> -->
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
          <div
            class="tab"
            :class="{ active: currentTab === 'playlist' }"
            @click="currentTab = 'playlist'"
          >
            {{ $t('streamMusic.playlist') }}
          </div>
          <div
            class="tab"
            :class="{ active: currentTab === 'album' }"
            @click="currentTab = 'album'"
          >
            {{ $t('streamMusic.album') }}
          </div>
          <div
            class="tab"
            :class="{ active: currentTab === 'artist' }"
            @click="currentTab = 'artist'"
          >
            {{ $t('streamMusic.artist') }}
          </div>
        </div>
        <div v-if="currentTab !== 'playlist'" class="search-box">
          <SearchBox ref="streamSearchBoxRef" :placeholder="`搜索${placeHolderMap(currentTab)}`" />
        </div>
      </div>
      <div class="section-two-content" :style="tabStyle">
        <div v-show="currentTab === 'track'">
          <TrackList
            :id="1"
            :items="sortedLocalTracks"
            :type="'streamingPlaylist'"
            :colunm-number="1"
            :is-end="true"
          />
        </div>
        <div v-show="currentTab === 'playlist'">
          <CoverRow
            :items="playlists"
            type="streamingPlaylist"
            sub-text="creator"
            :colunm-number="5"
            :is-end="true"
          />
        </div>
      </div>
    </div>

    <ContextMenu ref="streamTabMenu">
      <div class="item" @click="stream.sortBy = 'default'">{{ $t('contextMenu.defaultSort') }}</div>
      <div class="item" @click="stream.sortBy = 'byname'">{{ $t('contextMenu.sortByName') }}</div>
      <div class="item" @click="stream.sortBy = 'descend'">{{ $t('contextMenu.descendSort') }}</div>
      <div class="item" @click="stream.sortBy = 'ascend'">{{ $t('contextMenu.ascendSort') }}</div>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../store/settings'
import { useRouter } from 'vue-router'
import InfoBG from '../components/InfoBG.vue'
import SvgIcon from '../components/SvgIcon.vue'
import SearchBox from '../components/SearchBox.vue'
import TrackList from '../components/VirtualTrackList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import ContextMenu from '../components/ContextMenu.vue'
import { useI18n } from 'vue-i18n'

const settingsStore = useSettingsStore()
const { stream } = storeToRefs(settingsStore)
const router = useRouter()

const show = ref(false)
const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))
const streamTabMenu = ref<InstanceType<typeof ContextMenu>>()
const streamSearchBoxRef = ref<InstanceType<typeof SearchBox>>()
const tracks = ref<any[]>([])
const playlists = ref<any[]>([])
const currentTab = ref('track')

const tabStyle = computed(() => {
  const marginTop = hasCustomTitleBar.value ? 20 : 0
  return { marginTop: `${marginTop}px` }
})

const keyword = computed(() => streamSearchBoxRef.value?.keywords || '')

const defaultTracks = computed(() => {
  return tracks.value?.map((track, index) => ({ ...track, index }))
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
    if (stream.value.sortBy === 'default') {
      return a.index - b.index
    } else if (stream.value.sortBy === 'ascend') {
      const timeA = new Date(a.createTime).getTime()
      const timeB = new Date(b.createTime).getTime()
      return timeA - timeB
    } else if (stream.value.sortBy === 'descend') {
      const timeA = new Date(a.createTime).getTime()
      const timeB = new Date(b.createTime).getTime()
      return timeB - timeA
    } else return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
  })
})

const formatedTime = computed(() => {
  const dt = tracks.value.map((track) => track.dt).reduce((acc, cur) => acc + cur, 0) / 1000
  const hourse = Math.floor(dt / 3600)
  const minutes = Math.floor((dt % 3600) / 60)
  const seconds = Math.floor(dt % 60)
  return `${hourse}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`
})

const formatedMemory = computed(() => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let memory = tracks.value.map((track) => track.size).reduce((acc, cur) => acc + cur, 0) as number
  let i = 0
  while (memory >= 1024 && i < units.length - 1) {
    memory /= 1024
    i++
  }
  return `${memory.toFixed(2)} ${units[i]}`
})

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

onMounted(() => {
  // stream.value.status = 'logout'
  if (stream.value.status === 'logout') {
    router.push('/streamLogin')
    return
  }
  window.mainApi
    .invoke('get-stream-songs', { platform: stream.value.select })
    .then((songs: any[]) => {
      tracks.value = songs
      show.value = true
    })
  window.mainApi
    .invoke('get-stream-playlists', { platform: stream.value.select })
    .then((p: any[]) => (playlists.value = p))
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
