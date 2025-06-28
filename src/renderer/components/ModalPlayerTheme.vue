<template>
  <Modal
    :show="setThemeModal"
    :title="$t('settings.playerTheme.title')"
    :close-fn="closeFn"
    :show-footer="false"
  >
    <template #default>
      <div class="theme-container">
        <div v-for="(theme, type) in playerTheme" :key="type" class="type-group">
          <div class="title">{{ $t(`settings.playerTheme.${type}`) }}</div>
          <div class="theme-list">
            <div
              v-for="item in theme"
              :key="item.name"
              class="theme-item"
              :class="{ selected: item.selected }"
              @click="selectTheme(item)"
            >
              <div class="theme-img">
                <img :src="getThemeImg(item)" loading="lazy" />
              </div>
              <div class="name">{{ item.name }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import Modal from './BaseModal.vue'

const stateStore = useNormalStateStore()
const { setThemeModal } = storeToRefs(stateStore)

const settingsStore = useSettingsStore()
const { playerTheme } = storeToRefs(settingsStore)

const selectTheme = (theme: any) => {
  Object.entries(playerTheme.value).forEach(([, themes]) => {
    themes.forEach((item: any) => {
      item.selected = item.name === theme.name
    })
  })
}

const getThemeImg = (theme: { img: string }) => {
  return new URL(`../assets/images/${theme.img}.png`, import.meta.url).href
}

const closeFn = () => {
  setThemeModal.value = false
}
</script>

<style scoped lang="scss">
.type-group {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}

.theme-list {
  display: flex;
}

.theme-item {
  border-radius: 8px;
  padding: 4px;
  margin-right: 16px;

  &:last-child {
    margin-right: 0;
  }

  .theme-img {
    width: 224px;
    height: 132px;

    img {
      height: 100%;
      width: 100%;
      border-radius: 8px;
    }
  }

  .name {
    line-height: 30px;
    text-align: center;
    font-size: 16px;
    letter-spacing: 2px;
  }
}

.selected {
  background-color: var(--color-primary);
  color: white;
}
</style>
