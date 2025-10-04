<template>
  <div id="app" :class="{ 'user-select-none': userSelectNone }">
    <ScrollBar v-show="!showLyrics" />
    <SideNav />
    <NavBar ref="navBarRef" />
    <div id="main" ref="mainRef" :style="mainStyle" @scroll="scrollEvent">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['HomePage']">
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
import { onMounted, ref, provide, toRefs, watch, computed, onBeforeUnmount } from 'vue'
import ScrollBar from './components/ScrollBar.vue'
import PlayerBar from './components/PlayerBar.vue'
import NavBar from './components/NavBar.vue'
import SideNav from './components/SideNav.vue'
import ShowToast from './components/ShowToast.vue'
import AddTrackToPlaylistModal from './components/ModalAddTrackToPlaylist.vue'
import newPlaylistModal from './components/ModalNewPlaylist.vue'
import PlayPage from './views/PlayPage.vue'
import { useDataStore } from './store/data'
import { useLocalMusicStore } from './store/localMusic'
import { useOsdLyricStore } from './store/osdLyric'
import { usePlayerStore } from './store/player'
import { useSettingsStore } from './store/settings'
import { useNormalStateStore } from './store/state'
import { storeToRefs } from 'pinia'
import Utils from './utils'
import { useRoute } from 'vue-router'
import { type ProgressInfo } from 'electron-updater'
import router from './router'
import eventBus from './utils/eventBus'

const localMusicStore = useLocalMusicStore()
const { localTracks } = storeToRefs(localMusicStore)
const { deleteLocalTracks } = localMusicStore

const playerStore = usePlayerStore()
const { enabled } = storeToRefs(playerStore)

const osdLyricStore = useOsdLyricStore()
const { show, type, isLock } = storeToRefs(osdLyricStore)

const stateStore = useNormalStateStore()
const { extensionCheckResult, showLyrics, isDownloading } = storeToRefs(stateStore)
const { showToast, checkUpdate, registerInstance, unregisterInstance, updateScroll, getFontList } =
  stateStore

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

const scrollEvent = () => {
  const scrollTop = mainRef.value.scrollTop
  const containerHeight = mainRef.value.clientHeight - 64
  const contentHeight = mainRef.value.scrollHeight

  registerInstance(instanceId.value)
  updateScroll(instanceId.value, {
    scrollTop,
    containerHeight,
    listHeight: contentHeight
  })
}

const handleEventBus = () => {
  let updateScrollStart = 0

  eventBus.on('update-start', () => {
    updateScrollStart = mainRef.value.scrollTop
  })

  // @ts-ignore
  eventBus.on('update-scroll-bar', (data: { active: string; offset: number }) => {
    if (data.active !== instanceId.value) return
    if (updateScrollStart === 0) updateScrollStart = mainRef.value?.scrollTop
    const top = Math.min(mainRef.value?.scrollHeight, Math.max(updateScrollStart + data.offset, 0))
    mainRef.value.scrollTo({ top, behavior: 'instant' })
  })

  eventBus.on('update-done', () => {
    updateScrollStart = mainRef.value?.scrollTop || 0
  })
}

const padding = ref(96)
const userSelectNone = ref(false)
const settingsStore = useSettingsStore()
const { theme, localMusic, general } = storeToRefs(settingsStore)
const appearance = ref(theme.value.appearance)
const { scanning } = toRefs(localMusic.value)
Utils.changeAppearance(appearance.value)

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (appearance.value === 'auto') {
    Utils.changeAppearance(appearance.value)
  }
})

const route = useRoute()

const scrollBarRef = ref()
const instanceId = ref('appInstance')
const hasCustomTitleBar = ref(false)

const mainStyle = computed(() => ({
  paddingTop: (hasCustomTitleBar.value ? 84 : 64) + 'px',
  paddingBottom: padding.value + 'px'
}))

const showPlayerBar = computed(() => {
  return ['mv', 'loginAccount'].includes(route.name as string) === false
})

const isMac = computed(() => window.env?.isMac)
const isLinux = computed(() => window.env?.isLinux)

const restorePosition = () => {
  scrollBarRef.value.restorePosition()
}

const watchOsdEvent = () => {
  watch(
    show,
    (value) => {
      window.mainApi?.send('updateOsdState', { show: value })
    },
    { immediate: true }
  )
  watch(type, (value) => {
    window.mainApi?.send('updateOsdState', { type: value })
  })
  watch(isLock, (value) => {
    window.mainApi?.send('updateOsdState', { isLock: value })
  })
}

const mainRef = ref()
const navBarRef = ref()

provide('restorePosition', restorePosition)
provide('updateUserSelect', userSelectNone)
provide('mainRef', mainRef)
provide('navBarRef', navBarRef)

provide('appearance', appearance)
provide('hasCustomTitleBar', hasCustomTitleBar)

provide('updatePadding', (value: number) => {
  padding.value = value
})

provide('scrollMainTo', (top: number, behavior = 'smooth') => {
  mainRef.value.scrollTo({ top, behavior })
})

const handleChanelEvent = () => {
  window.mainApi?.send('updateOsdState', { show: show.value })
  getFontList()
  window.mainApi?.on('msgHandleScanLocalMusic', (_: any, data: { track: any }) => {
    const index = localTracks.value.findIndex((track) => track.filePath === data.track.filePath)
    if (index !== -1) {
      localTracks.value[index] = data.track
    } else {
      localTracks.value.push(data.track)
    }
  })
  window.mainApi?.on(
    'msgHandleScanLocalMusicError',
    (_: any, data: { err: any; filePath: string }) => {
      console.log(`扫描本地歌曲 ${data.filePath} 出错： ${data.err}`)
      showToast(`扫描本地歌曲出错, 详情见：开发者工具-控制台`)
    }
  )
  window.mainApi?.on('scanLocalMusicDone', (_: any) => {
    scanning.value = false
  })
  window.mainApi?.on('msgDeletedTracks', (_: any, trackIDs: number[]) => {
    deleteLocalTracks(trackIDs)
  })
  window.mainApi?.on('rememberCloseAppOption', (_: any, result: string) => {
    general.value.closeAppOption = result
  })
  window.mainApi?.on('msgExtensionCheckResult', (_: any, result: boolean) => {
    extensionCheckResult.value = result
  })
  window.mainApi?.on('updateOSDSetting', (_: any, data: { [key: string]: any }) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'show') {
      show.value = value
    } else if (key === 'lock') {
      isLock.value = value
    }
  })
  window.mainApi?.on('download-progress', (_: any, data: ProgressInfo) => {
    if (!isDownloading.value) isDownloading.value = true
    showToast(`下载更新：${parseFloat(data.percent.toFixed(2))}%`)
    if (data.percent === 100) isDownloading.value = false
  })
  window.mainApi?.on('update-error', (_: any) => {
    isDownloading.value = false
    showToast('下载错误')
  })
  window.mainApi?.on('changeRouteTo', (_: any, route: string) => {
    showLyrics.value = false
    router.push(route)
  })
}

watchOsdEvent()

onMounted(async () => {
  registerInstance(instanceId.value)
  handleEventBus()
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
    window.mainApi?.invoke('askExtensionStatus').then((result: boolean) => {
      extensionCheckResult.value = result
    })
  }
  document.documentElement.style.setProperty(
    '--color-primary',
    theme.value.colors.find((c) => c.selected)?.color || 'rgba(51, 94, 234, 1)'
  )
  fetchData()
  handleChanelEvent()
  checkUpdate()
})

onBeforeUnmount(() => {
  unregisterInstance(instanceId.value)
})
</script>

<style lang="scss">
#app {
  width: 100%;
  color: var(--color-text);
  transition: all 0.4s;
}

.user-select-none {
  user-select: none;
}

#main {
  padding: 0px 30px 0px 130px;
  box-sizing: border-box;
  scrollbar-width: none;
  color: var(--color-text);
  height: 100vh;
}

#main::-webkit-scrollbar {
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
