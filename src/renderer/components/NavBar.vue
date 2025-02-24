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
        <div :class="{ active: searchTab === 'track' }" class="item" @click="searchTab = 'track'">{{
          $t('nav.track')
        }}</div>
        <div :class="{ active: searchTab === 'album' }" class="item" @click="searchTab = 'album'">{{
          $t('nav.album')
        }}</div>
        <div
          :class="{ active: searchTab === 'artist' }"
          class="item"
          @click="searchTab = 'artist'"
          >{{ $t('nav.artist') }}</div
        >
        <div
          :class="{ active: searchTab === 'playlist' }"
          class="item"
          @click="searchTab = 'playlist'"
          >{{ $t('nav.playlist') }}</div
        >
        <div :class="{ active: searchTab === 'user' }" class="item" @click="searchTab = 'user'">{{
          $t('nav.user')
        }}</div>
        <div :class="{ active: searchTab === 'lyric' }" class="item" @click="searchTab = 'lyric'">{{
          $t('nav.lyric')
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
        <SearchBox ref="searchBoxRef" :clear-keywords="true" @keydown-enter="doSearch($event)" />
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
import { useDataStore } from '../store/data'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import { storeToRefs } from 'pinia'
import { doLogout } from '../utils/auth'
import { openExternal } from '../utils'

const { searchTab, exploreTab } = storeToRefs(useNormalStateStore())
const { general } = storeToRefs(useSettingsStore())
const { useCustomTitlebar } = toRefs(general.value)

const router = useRouter()
const route = useRoute()

const searchBoxRef = ref()
const keywords = ref('')
const useCustomBar = ref(false)

const isLooseLoggedIn = computed(() => data.user.value.userId !== null)
const isLinux = computed(() => window.env?.isLinux || false)
const isWin = computed(() => window.env?.isWindows)
const navStyle = computed(() => {
  return {
    paddingLeft: isLinux.value || isWin.value ? '20px' : '6vw'
  }
})

defineExpose({ searchBoxRef })

const toLogin = (): void => {
  handleRoute('/login/account')
}

const toGitHub = (): void => {
  openExternal('https://github.com/stark81/VutronMusic')
}

const handleRoute = (path: string): void => {
  router.push(path)
}

const categoryMap = {
  chart: '排行榜',
  artist: '歌手'
}

const toExplore = (Category: string) => {
  exploreTab.value = Category
  const cat = ['chart', 'artist'].includes(Category) ? categoryMap[Category] : '全部'
  router.push({ name: 'explore', query: { category: cat, tab: Category } })
}

const logout = () => {
  if (!confirm('确定要退出登录吗？')) return
  doLogout()
  router.push({ name: 'HomePage' })
}

const data = storeToRefs(useDataStore())

const avatarUrl = computed(() => {
  return `atom://online-pic/${data.user.value.avatarUrl}`
})

const userProfileMenu = ref<InstanceType<typeof ContextMenu>>()

const showUserProfileMenu = (e: MouseEvent): void => {
  userProfileMenu.value?.openMenu(e)
}

const doSearch = (keyword: string, tab: string | null = null) => {
  keywords.value = keyword
  if (!keyword) return
  router.push({
    name: 'search',
    query: { keywords: keyword }
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
  flex: 0.8;
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
  flex: 2;
  justify-content: center;
  align-items: center;
  .item {
    padding: 8px 14px;
    cursor: pointer;
    margin: 0 10px;
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
  flex: 1;
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
