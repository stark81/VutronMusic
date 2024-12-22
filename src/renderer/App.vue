<template>
  <div id="app">
    <ScrollBar v-show="!showLyrics" ref="scrollBarRef" />
    <SideNav />
    <NavBar ref="navBarRef" />
    <div id="main" ref="mainRef" :style="mainStyle" @scroll="handleScroll">
      <router-view v-slot="{ Component }">
        <keep-alive
          :include="['HomePage', 'ExplorePage', 'LibraryMusic', 'SearchPage', 'ArtistPage']"
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
import ScrollBar from './components/ScrollBar.vue'
import PlayerBar from './components/PlayerBar.vue'
import NavBar from './components/NavBar.vue'
import SideNav from './components/SideNav.vue'
import ShowToast from './components/ShowToast.vue'
import AddTrackToPlaylistModal from './components/AddTrackToPlaylistModal.vue'
import newPlaylistModal from './components/NewPlaylistModal.vue'
import PlayPage from './views/PlayPage.vue'
import { useDataStore } from './store/data'
import { useLocalMusicStore } from './store/localMusic'
import { usePlayerStore } from './store/player'
import { useSettingsStore } from './store/settings'
import { useNormalStateStore } from './store/state'
import { storeToRefs } from 'pinia'
import Utils from './utils'
import { useRoute } from 'vue-router'

const localMusicStore = useLocalMusicStore()
const { localTracks } = storeToRefs(localMusicStore)
const { fetchLocalMusic, deleteLocalTracks } = localMusicStore

const playerStore = usePlayerStore()
const { enabled } = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showLyrics, enableScrolling } = storeToRefs(stateStore)

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

const handleScroll = () => {
  scrollBarRef.value.handleScroll()
}

const restorePosition = () => {
  scrollBarRef.value.restorePosition()
}

const scrollTo = (top: number) => {
  mainRef.value.scrollTo({ top, behavior: 'smooth' })
}

const mainRef = ref()
const navBarRef = ref()

provide('restorePosition', restorePosition)

provide('scrollTo', scrollTo)

provide('mainRef', mainRef)
provide('navBarRef', navBarRef)

provide('appearance', appearance)

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
}

// ;(window as any).scanLocalMusic = scanLocalMusic

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
  fetchData()
  fetchLocalData()
  handleChanelEvent()
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
  // height: 720px;
  // height: 100vh;
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
