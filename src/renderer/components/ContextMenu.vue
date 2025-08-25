<template>
  <div ref="contextMenuRef" class="context-menu">
    <div
      v-show="showMenu"
      ref="menu"
      class="menu"
      tabindex="-1"
      :style="{ top: topValue, left: leftValue }"
      @blur="closeMenu"
      @click="closeMenu"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'

const state = storeToRefs(useNormalStateStore())
const showMenu = ref(false)
const menu = ref<HTMLElement | null>(null)
const topValue = ref('0px')
const leftValue = ref('0px')
const player = storeToRefs(usePlayerStore())

const $emit = defineEmits(['closeMenu'])

const closeMenu = () => {
  showMenu.value = false
  $emit('closeMenu')
}

const setMenu = (top: number, left: number) => {
  const playerEnabled = player.enabled.value || false
  const heightOffset = playerEnabled ? 64 : 0
  const largestHeight = window.innerHeight - (menu.value?.offsetHeight || 0) - heightOffset
  const largestWidth = window.innerWidth - (menu.value?.offsetWidth || 0) - 25
  if (top > largestHeight) top = largestHeight
  if (left > largestWidth) left = largestWidth
  topValue.value = top + 'px'
  leftValue.value = left + 'px'
}

const openMenu = (e: MouseEvent) => {
  showMenu.value = true
  nextTick(() => {
    menu.value?.focus()
    setMenu(e.y, e.x)
  })
  e.preventDefault()
}

watch(showMenu, (val) => {
  state.enableScrolling.value = !val
})

defineExpose({
  openMenu,
  closeMenu
})
</script>

<style lang="scss">
.context-menu {
  // width: 100%;
  // height: 100%;
  user-select: none;
}

.menu {
  position: fixed;
  min-width: 136px;
  max-width: 240px;
  list-style: none;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 6px 12px -4px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-sizing: border-box;
  padding: 6px;
  -webkit-app-region: no-drag;
  z-index: 110;
  transition:
    background 125ms ease-out,
    opacity 125ms ease-out,
    transform 125ms ease-out;

  &:focus {
    outline: none;
  }
}

.menu .item {
  font-weight: 600;
  font-size: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: default;
  display: flex;
  align-items: center;
  &:hover {
    color: var(--color-primary);
    background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
    transition:
      opacity 125ms ease-out,
      transform 125ms ease-out;
  }

  .svg-icon {
    height: 16px;
    width: 16px;
    margin-right: 5px;
  }
}

.menu .item.active {
  color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
}

[data-theme='dark'] {
  .menu {
    background: rgba(36, 36, 36, 0.78);
    backdrop-filter: blur(16px) contrast(120%) brightness(60%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.08);
  }
  // .menu .item:hover {
  //   color: var(--color-text);
  // }
}

@supports (-moz-appearance: none) {
  .menu {
    background-color: var(--color-body-bg) !important;
  }
}

hr {
  margin: 4px 10px;
  background: rgba(128, 128, 128, 0.18);
  height: 1px !important;
  box-shadow: none;
  border: none;
}

.item-info {
  padding: 10px 10px;
  display: flex;
  align-items: center;
  cursor: default;
  img {
    height: 38px;
    width: 38px;
    border-radius: 4px;
  }
  .info {
    margin-left: 10px;
  }
  .title {
    font-size: 16px;
    font-weight: 600;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    word-break: break-all;
  }
  .subtitle {
    font-size: 12px;
    opacity: 0.68;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    word-break: break-all;
  }
}
</style>
