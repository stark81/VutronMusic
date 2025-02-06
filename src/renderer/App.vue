<template>
  <div id="app">
    <SideNav />
    <NavBar ref="navBarRef" />
    <div id="main" ref="mainRef" :style="mainStyle">
      <router-view v-slot="{ Component }">
        <keep-alive
          :include="[
            'HomePage',
            'ExplorePage',
            'LibraryMusic',
            'SearchPage',
            'ArtistPage'
            // 'LocalMusic'
          ]"
        >
          <component :is="Component"></component>
        </keep-alive>
      </router-view>
    </div>
    <PlayerBar v-if="enabled" v-show="showPlayerBar" />
    <ShowToast />
    <AddTrackToPlaylistModal />
    <newPlaylistModal />
    <PlayPage v-if="enabled" />
  </div>
</template>

<script setup lang="tsx">
import { onMounted, ref, provide, toRefs, watch, computed } from 'vue'
// import ScrollBar from './components/ScrollBar.vue'
import PlayerBar from './components/PlayerBar.vue'
import NavBar from './components/NavBar.vue'
import SideNav from './components/SideNav.vue'
import ShowToast from './components/ShowToast.vue'
import AddTrackToPlaylistModal from './components/AddTrackToPlaylistModal.vue'
import newPlaylistModal from './components/NewPlaylistModal.vue'
import PlayPage from './views/PlayPage.vue'
import { useDataStore } from './store/data'
import { useLocalMusicStore } from './store/localMusic'
import { useOsdLyricStore } from './store/osdLyric'
import { usePlayerStore } from './store/player'
import { useSettingsStore } from './store/settings'
import { useNormalStateStore } from './store/state'
import { storeToRefs } from 'pinia'
import Utils from './utils'
import { initAmuseQueryChannel } from './utils/amuse'
import { useRoute } from 'vue-router'

const localMusicStore = useLocalMusicStore()
const { localTracks } = storeToRefs(localMusicStore)
const { fetchLocalMusic, deleteLocalTracks } = localMusicStore

const playerStore = usePlayerStore()
const { enabled } = storeToRefs(playerStore)

const osdLyricStore = useOsdLyricStore()
const { show, type, isLock } = storeToRefs(osdLyricStore)

const stateStore = useNormalStateStore()
const { enableScrolling, extensionCheckResult } = storeToRefs(stateStore)
// const { showLyrics, enableScrolling, extensionCheckResult } = storeToRefs(stateStore)
const { showToast } = stateStore

const {
  fetchLikedPlaylist,
  fetchLikedSongs,
  fetchLikedSongsWithDetails,
  fetchLikedAlbums,
  fetchLikedArtists,
  fetchLikedMVs,
  fetchCloudDisk
} = useDataStore()

const fetchData = () => {
  fetchLikedSongs()
  fetchLikedSongsWithDetails()
  fetchLikedPlaylist()
  fetchLikedAlbums()
  fetchLikedArtists()
  fetchLikedMVs()
  fetchCloudDisk()
}
const fetchLocalData = () => {
  window.mainApi.send('clearDeletedMusic')
  fetchLocalMusic()
  scanLocalMusic()
}

const padding = ref(96)
const settingsStore = useSettingsStore()
const { theme, localMusic, general } = storeToRefs(settingsStore)
const appearance = ref(theme.value.appearance)
const { scanDir, scanning } = toRefs(localMusic.value)
Utils.changeAppearance(appearance.value)

watch(scanDir, () => {
  scanLocalMusic()
})

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (appearance.value === 'auto') {
    Utils.changeAppearance(appearance.value)
  }
})

const route = useRoute()

const scrollBarRef = ref()

const hasCustomTitleBar = ref(false)

const mainStyle = computed(() => {
  return {
    overflow: enableScrolling ? 'auto' : 'hidden',
    paddingTop: (hasCustomTitleBar.value ? 84 : 64) + 'px',
    paddingBottom: padding.value + 'px'
  }
})

const showPlayerBar = computed(() => {
  return ['mv', 'loginAccount'].includes(route.name as string) === false
})

const isMac = computed(() => window.env?.isMac)
const isLinux = computed(() => window.env?.isLinux)

const restorePosition = () => {
  scrollBarRef.value.restorePosition()
}

const scrollTo = (top: number) => {
  mainRef.value.scrollTo({ top, behavior: 'smooth' })
}

const watchOsdEvent = () => {
  watch(show, (value) => {
    window.mainApi.send('updateOsdState', { show: value })
  })
  watch(type, (value) => {
    window.mainApi.send('updateOsdState', { type: value })
  })
  watch(isLock, (value) => {
    window.mainApi.send('updateOsdState', { isLock: value })
  })
}

const mainRef = ref()
const navBarRef = ref()

provide('restorePosition', restorePosition)

provide('scrollTo', scrollTo)

provide('mainRef', mainRef)
provide('navBarRef', navBarRef)

provide('appearance', appearance)
provide('hasCustomTitleBar', hasCustomTitleBar)

provide('updatePadding', (value: number) => {
  padding.value = value
})

const scanLocalMusic = async () => {
  const filePath = scanDir.value

  if (!filePath) return
  const isExist = await window.mainApi.invoke('msgCheckFileExist', filePath)
  if (!isExist) return
  scanning.value = true
  window.mainApi.send('msgScanLocalMusic', filePath)
}

provide('scanLocalMusic', scanLocalMusic)

const handleChanelEvent = () => {
  window.mainApi.send('updateOsdState', { show: show.value })
  window.mainApi.on('msgHandleScanLocalMusic', (_: any, data: { track: any }) => {
    localTracks.value.push(data.track)
  })
  window.mainApi.on('scanLocalMusicDone', (_: any) => {
    scanning.value = false
  })
  window.mainApi.on('msgDeletedTracks', (_: any, trackIDs: number[]) => {
    deleteLocalTracks(trackIDs)
  })
  window.mainApi.on('rememberCloseAppOption', (_: any, result: string) => {
    general.value.closeAppOption = result
  })
  window.mainApi.on('msgExtensionCheckResult', (_: any, result: boolean) => {
    extensionCheckResult.value = result
  })
  window.mainApi.on('updateOSDSetting', (_: any, data: { [key: string]: any }) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'show') {
      show.value = value
    } else if (key === 'lock') {
      if (!show.value) {
        showToast('桌面歌词锁定/解锁功能仅在桌面歌词开启状态下可用')
        return
      }
      isLock.value = value
    }
  })
}

watchOsdEvent()

onMounted(async () => {
  hasCustomTitleBar.value =
    (window.env?.isLinux && general.value.useCustomTitlebar) || window.env?.isWindows || false
  if (isMac.value) {
    import('./utils/trayLyrics').then((module) => {
      const buildTrays = module.buildTrays
      buildTrays()

      const buildTouchBars = module.buildTouchBars
      buildTouchBars()
    })
  }
  if (isLinux.value) {
    window.mainApi.invoke('askExtensionStatus').then((result: boolean) => {
      extensionCheckResult.value = result
    })
  }
  fetchData()
  fetchLocalData()
  handleChanelEvent()

  initAmuseQueryChannel()
})
</script>

<style lang="scss">
#app {
  width: 100%;
  color: var(--color-text);
  transition: all 0.4s;
}

#main {
  padding: 0px 30px 0px 130px;
  box-sizing: border-box;
  scrollbar-width: none;
  color: var(--color-text);
  overflow: auto;
}

main::-webkit-scrollbar {
  width: 0px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.4s;
}
.slide-up-enter,
.slide-up-leave-to {
  transform: translateY(100%);
}
.contextMenu {
  width: 0;
}
</style>
./store/player_bak ./store/player_audio
