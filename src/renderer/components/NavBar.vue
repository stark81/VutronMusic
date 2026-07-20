<template>
  <div>
    <nav :class="{ 'has-custom-titlebar': useCustomBar || isWin }" :style="navStyle">
      <LinuxTitleBar v-if="useCustomBar" />
      <Win32TitleBar v-if="isWin" />

      <div class="navigation-buttons">
        <button-icon @click.stop="router.go(-1)">
          <svg-icon icon-class="arrow-left" />
        </button-icon>
        <button-icon @click.stop="router.go(1)">
          <svg-icon icon-class="arrow-right" />
        </button-icon>
      </div>
      <div v-if="route.name === 'search'" class="search-tabs">
        <div
          :class="{ active: searchTab === 'tracks' }"
          class="item"
          @click="searchTab = 'tracks'"
          >{{ $t('nav.track') }}</div
        >
        <div
          :class="{ active: searchTab === 'albums' }"
          class="item"
          @click="searchTab = 'albums'"
          >{{ $t('nav.album') }}</div
        >
        <div
          :class="{ active: searchTab === 'artists' }"
          class="item"
          @click="searchTab = 'artists'"
          >{{ $t('nav.artist') }}</div
        >
        <div
          :class="{ active: searchTab === 'playlists' }"
          class="item"
          @click="searchTab = 'playlists'"
          >{{ $t('nav.playlist') }}</div
        >
        <div :class="{ active: searchTab === 'mvs' }" class="item" @click="searchTab = 'mvs'">{{
          $t('nav.mv')
        }}</div>
      </div>
      <div v-if="route.name === 'explore'" class="search-tabs">
        <div
          class="item"
          :class="{ active: exploreTab === 'playlist' }"
          @click="toExplore('playlist')"
          >{{ $t('nav.playlist') }}</div
        >
        <div class="item" :class="{ active: exploreTab === 'chart' }" @click="toExplore('chart')">{{
          $t('nav.chart')
        }}</div>
        <div
          class="item"
          :class="{ active: exploreTab === 'newTrack' }"
          @click="toExplore('newTrack')"
          >{{ $t('nav.newTrack') }}</div
        >
        <div
          class="item"
          :class="{ active: exploreTab === 'newAlbum' }"
          @click="toExplore('newAlbum')"
          >{{ $t('nav.newAlbum') }}</div
        >
        <div
          class="item"
          :class="{ active: exploreTab === 'artist' }"
          @click="toExplore('artist')"
          >{{ $t('nav.artist') }}</div
        >
      </div>
      <div class="right-part">
        <SearchBox
          ref="searchBoxRef"
          :services="general.searchOrder"
          :clear-keywords="true"
          @keydown-enter="doSearch"
        />
        <img class="avatar" :src="avatarUrl" loading="lazy" @click="showUserProfileMenu" />
      </div>
    </nav>
    <ContextMenu ref="userProfileMenu">
      <div v-if="!isLooseLoggedIn" class="item" @click="toLogin">
        <svg-icon icon-class="login" />
        {{ $t('login.login') }}
      </div>
      <div v-if="isLooseLoggedIn" class="item" @click="logout">
        <svg-icon icon-class="logout" />
        {{ $t('library.userProfileMenu.logout') }}
      </div>
      <div class="item" @click="toGitHub">
        <svg-icon icon-class="github" />
        {{ $t('nav.github') }}
      </div>
      <div class="item" @click="openLogFile">
        <svg-icon icon-class="log" />
        {{ $t('nav.log') }}
      </div>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, onMounted } from 'vue'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import SearchBox from './SearchBox.vue'
import ContextMenu from './ContextMenu.vue'
import LinuxTitleBar from './LinuxTitleBar.vue'
import Win32TitleBar from './Win32TitleBar.vue'
import { useRouter, useRoute } from 'vue-router'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import { usePluginMusic } from '../store/pluginMusic'
import { storeToRefs } from 'pinia'
import { openExternal } from '../utils'
import { PluginId } from '@/types/schemas'
import { ExploreTab } from '@/types/plugin.js'

const { searchTab, exploreTab } = storeToRefs(useNormalStateStore())
const { general } = storeToRefs(useSettingsStore())
const { useCustomTitlebar } = toRefs(general.value)

const pluginStore = usePluginMusic()
const { services, users } = toRefs(pluginStore)
const { pluginMethodCall, handleStatusChange } = pluginStore

const router = useRouter()
const route = useRoute()

const searchBoxRef = ref<InstanceType<typeof SearchBox>>()
const keywords = ref('')
const useCustomBar = ref(false)

const activeUser = computed(() => {
  const active = services.value.find((item) => item.active)
  return active ? users.value[active.code] : null
})

const isLooseLoggedIn = computed(() => {
  return activeUser.value ? !!activeUser.value.userId : false
})
const isLinux = computed(() => window.env?.isLinux || false)
const isWin = computed(() => window.env?.isWindows)
const navStyle = computed(() => {
  return {
    paddingLeft: isLinux.value || isWin.value ? '20px' : '6vw'
  }
})

defineExpose({ searchBoxRef })

const toLogin = (): void => {
  const active = services.value.find((item) => item.active)
  if (!active) return
  router.push(`/login/${active.code}/QrCode`)
}

const toGitHub = (): void => {
  openExternal('https://github.com/stark81/VutronMusic')
}

const openLogFile = () => {
  window.mainApi?.send('openLogFile')
}

const toExplore = (Category: ExploreTab) => {
  exploreTab.value = Category
}

const logout = async () => {
  const { showConfirm } = useNormalStateStore()
  if (!(await showConfirm('确定要退出登录吗？'))) return

  const plugin = services.value.find((item) => item.active)!

  if (await showConfirm(`确定登出${plugin.name}吗？`)) {
    pluginMethodCall(plugin.code, 'doLogout').then(({ code }) => {
      if (code === 200) {
        handleStatusChange(plugin.code, 'logout')
      }
    })
  }
}

const avatarUrl = computed(() => {
  return `${activeUser.value?.avatarUrl || 'https://s4.music.126.net/style/web2/img/default/default_avatar.jpg?param=60y60'}`
})

const userProfileMenu = ref<InstanceType<typeof ContextMenu>>()

const showUserProfileMenu = (e: MouseEvent): void => {
  userProfileMenu.value?.openMenu(e)
}

const doSearch = (keyword: string, plugin: PluginId) => {
  keywords.value = keyword
  if (!keyword) return
  // 持久化最后选择的搜索插件
  general.value.searchPlugin = plugin
  router.push({
    name: 'search',
    query: { keywords: keyword, plugin }
  })
}

onMounted(() => {
  useCustomBar.value = useCustomTitlebar.value && isLinux.value
})
</script>

<style lang="scss" scoped>
nav {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  padding: 0 30px 0 0;
  box-sizing: content-box;
  backdrop-filter: saturate(180%) blur(20px);
  background-color: var(--color-navbar-bg);
  z-index: 10;
  -webkit-app-region: drag;
}

nav.has-custom-titlebar {
  padding-top: 20px;
  -webkit-app-region: no-drag;
}

.navigation-buttons {
  display: flex;
  align-items: center;
  .svg-icon {
    height: 24px;
    width: 24px;
  }
  button {
    -webkit-app-region: no-drag;
  }
}

.search-tabs {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 40px;
  .item {
    cursor: pointer;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 600;
    -webkit-app-region: no-drag;
    &:hover {
      color: var(--color-primary);
    }
  }
  .active {
    color: var(--color-primary);
  }
}

.right-part {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  -webkit-user-drag: none;
  .avatar {
    user-select: none;
    height: 30px;
    margin-left: 12px;
    vertical-align: -7px;
    border-radius: 50%;
    cursor: pointer;
    -webkit-app-region: no-drag;
    -webkit-user-drag: none;
    &:hover {
      filter: brightness(80%);
    }
  }
}
</style>
