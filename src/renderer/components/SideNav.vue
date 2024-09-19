<template>
  <div class="side-nav">
    <button-icon :class="{ active: isCurrentRoute('/') }" @click="handleRoute('/')">
      <div class="mouseOver">
        <div class="toast">{{ $t('nav.home') }}</div>
        <svg-icon icon-class="slide-bar-mouse-over"></svg-icon>
      </div>
      <svg-icon class="icon" icon-class="logo" />
    </button-icon>
    <button-icon :class="{ active: isCurrentRoute('/explore') }" @click="handleRoute('/explore')">
      <div class="mouseOver">
        <div class="toast">{{ $t('nav.search') }}</div>
        <svg-icon icon-class="slide-bar-mouse-over"></svg-icon>
      </div>
      <svg-icon class="icon" icon-class="explore" style="transform: scale(1.4)" />
    </button-icon>
    <button-icon :class="{ active: isCurrentRoute('/library') }" @click="handleRoute('/library')">
      <div class="mouseOver">
        <div class="toast">{{ $t('nav.library') }}</div>
        <svg-icon icon-class="slide-bar-mouse-over"></svg-icon>
      </div>
      <svg-icon class="icon" icon-class="library" />
    </button-icon>
    <button-icon
      v-if="isElectron"
      :class="{ active: isCurrentRoute('/localMusic') }"
      @click="handleRoute('/localMusic')"
    >
      <div class="mouseOver">
        <div class="toast">{{ $t('nav.localMusic') }}</div>
        <svg-icon icon-class="slide-bar-mouse-over"></svg-icon>
      </div>
      <svg-icon class="icon" icon-class="local-music" />
    </button-icon>
    <button-icon :class="{ active: isCurrentRoute('/settings') }" @click="handleRoute('/settings')">
      <div class="mouseOver">
        <div class="toast">{{ $t('nav.settings') }}</div>
        <svg-icon icon-class="slide-bar-mouse-over"></svg-icon>
      </div>
      <svg-icon class="icon" icon-class="settings" style="transform: scale(0.9)" />
    </button-icon>
  </div>
</template>

<script setup lang="ts">
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import { useRoute, useRouter } from 'vue-router'

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
  z-index: 100;
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
    transition: 0.3s;
    -webkit-user-drag: none;
    position: relative;
    .mouseOver {
      position: absolute;
      display: none;
      visibility: hidden;
      left: 60px;
      color: blue;
      font-size: 16px;
      .toast {
        position: absolute;
        width: 100%;
        align-self: center;
        color: white;
      }
      .svg-icon {
        width: 100px;
        height: 40px;
      }
    }
    .icon {
      width: 26px;
      height: 26px;
    }
    &:hover {
      background: blue;
      .mouseOver {
        display: inherit;
        visibility: visible;
      }
      .icon {
        color: white;
      }
    }
    &:active {
      transform: scale(0.92);
      transition: 0.2s;
    }
  }
  button.active {
    background: blue;
    color: white;
  }
}
</style>
