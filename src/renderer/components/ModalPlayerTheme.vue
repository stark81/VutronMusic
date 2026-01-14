<template>
  <Modal
    :show="setThemeModal"
    :title="$t('settings.playerTheme.title')"
    :close-fn="closeFn"
    :show-footer="false"
  >
    <template #default>
      <div class="theme-container">
        <div v-for="(theme, type) in themes" :key="type" class="type-group">
          <template v-if="theme.length">
            <div class="title">{{ $t(`settings.playerTheme.${type}`) }}</div>
            <div class="theme-list">
              <div
                v-for="(item, index) in theme"
                :key="item.name"
                class="theme-item"
                :class="{ selected: currentPath.mode === type && currentPath.index === index }"
                :title="type === 'Customize' ? '单击选择，右击删除' : ''"
                @click="selectTheme(type, index)"
                @click.right="deleteTheme(type, item.name)"
              >
                <div class="theme-img">
                  <img :src="getThemeImg(type, item.img)" loading="lazy" />
                </div>
                <div class="name">{{ item.name }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import { usePlayerThemeStore } from '../store/playerTheme'
import Modal from './BaseModal.vue'

const stateStore = useNormalStateStore()
const { setThemeModal } = storeToRefs(stateStore)
const { showToast } = stateStore

const playerTheme = usePlayerThemeStore()
const { themes, currentPath } = storeToRefs(playerTheme)

const getThemeImg = (type: 'Classic' | 'Creative' | 'Customize', name: string) => {
  if (type === 'Customize') {
    return `atom://local-resource/${encodeURIComponent(name)}`
  }
  return new URL(`../assets/images/${name}.png`, import.meta.url).href
}

const selectTheme = (type: 'Classic' | 'Creative' | 'Customize', index: number) => {
  currentPath.value.mode = type
  currentPath.value.index = index
}

const deleteTheme = (type: 'Classic' | 'Creative' | 'Customize', name: string) => {
  if (type !== 'Customize') return
  const cThemes = themes.value.Customize
  const idx = cThemes.findIndex((t) => t.name === name)
  if (idx === -1) return
  if (currentPath.value.mode === 'Customize' && currentPath.value.index === idx) {
    if (idx === 0) {
      currentPath.value.mode = 'Classic'
      currentPath.value.index = 0
    } else {
      currentPath.value.index = 0
    }
  }
  const image = cThemes[idx].img
  window.mainApi?.send('delete-screenshot', image)
  cThemes.splice(idx, 1)
  showToast('自定义主题删除成功')
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
  font-weight: 600;
  margin-bottom: 8px;
}

.theme-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.theme-item {
  border-radius: 8px;
  padding: 4px;
  box-sizing: border-box;

  &:last-child {
    margin-right: 0;
  }

  .theme-img {
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
