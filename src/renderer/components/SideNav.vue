<template>
  <div class="side-nav">
    <button-icon
      :class="{ active: isCurrentRoute('/') }"
      :data-tip="`${$t('nav.home')}`"
      @click="handleRoute('/')"
    >
      <svg-icon class="icon" icon-class="logo" />
    </button-icon>
    <button-icon
      :class="{ active: isCurrentRoute('/explore') }"
      :data-tip="`${$t('nav.explore')}`"
      @click="handleRoute('/explore')"
    >
      <svg-icon class="icon" icon-class="explore" style="transform: scale(1.4)" />
    </button-icon>
    <button-icon
      :class="{ active: isCurrentRoute('/library') }"
      :data-tip="`${$t('nav.library')}`"
      @click="handleRoute('/library')"
    >
      <svg-icon class="icon" icon-class="library" />
    </button-icon>
    <button-icon
      v-if="enable"
      :class="{ active: isCurrentRoute('/stream') }"
      :data-tip="`${$t('nav.stream')}`"
      @click="handleRoute('/stream')"
    >
      <svg-icon class="icon" icon-class="stream-icon" style="transform: scale(0.9)"></svg-icon>
    </button-icon>
    <button-icon
      v-if="isElectron && localMusic.enble"
      :class="{ active: isCurrentRoute('/localMusic') }"
      :data-tip="`${$t('nav.localMusic')}`"
      @click="handleRoute('/localMusic')"
    >
      <svg-icon class="icon" icon-class="local-music" />
    </button-icon>
    <button-icon
      :class="{ active: isCurrentRoute('/settings') }"
      :data-tip="`${$t('nav.settings')}`"
      @click="handleRoute('/settings')"
    >
      <svg-icon class="icon" icon-class="settings" style="transform: scale(0.9)" />
    </button-icon>
  </div>
</template>

<script setup lang="ts">
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '../store/settings'
import { useStreamMusicStore } from '../store/streamingMusic'
import { storeToRefs } from 'pinia'

const settingsStore = useSettingsStore()
const { localMusic } = storeToRefs(settingsStore)

const streamStore = useStreamMusicStore()
const { enable } = storeToRefs(streamStore)

const router = useRouter()
const route: any = useRoute()

const handleRoute = (path: string): void => {
  router.push(path)
}

const isElectron = window.env?.isElectron || false

const isCurrentRoute = (path: string): boolean => {
  return path === route.path
}
</script>

<style scoped lang="scss">
.side-nav {
  position: fixed;
  top: 50%;
  left: 20px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-transform: uppercase;
  user-select: none;
  -webkit-app-region: drag;
  z-index: 15;
  background-color: var(--color-secondary-bg);
  border-radius: 12px;
  transform: translate(0, -50%);
  button {
    height: 40px;
    width: 60px;
    padding: 0;
    margin: 15px 0;
    -webkit-app-region: no-drag;
    font-weight: 700;
    text-decoration: none;
    border-radius: 8px;
    background-color: var(--color-secondary-bg);
    transition: all 0.3s ease-in;
    -webkit-user-drag: none;
    position: relative;
    .svg-icon {
      width: 100px;
      height: 40px;
      transition: color 0.2s ease-in;
    }
    .icon {
      width: 26px;
      height: 26px;
    }
    &:hover {
      background: var(--color-primary);
      .icon {
        color: white;
      }
    }
    &:active {
      transform: scale(0.92);
      transition: 0.2s;
    }
  }
  button::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    border: 8px solid transparent;
    border-right-color: rgb(from var(--color-primary) r g b / 60%);
    transform: translate(60px, -50%);
    z-index: 1;
  }
  button::after {
    content: attr(data-tip);
    background-color: rgb(from var(--color-primary) r g b / 60%);
    color: white;
    position: absolute;
    top: 50%;
    left: 0;
    width: auto;
    height: 40px;
    padding: 0 16px;
    border-radius: 6px;
    white-space: nowrap;
    line-height: 40px;
    font-size: 16px;
    transform: translate(76px, -50%);
  }
  button::after,
  button::before {
    display: none;
  }
  button:hover:after,
  button:hover::before {
    display: block;
  }
  button.active {
    background: var(--color-primary);
    color: white;
    transition: background 0.2s ease-in;
    .icon {
      color: white;
    }
  }
}
</style>
