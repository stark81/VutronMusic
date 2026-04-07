<template>
  <BaseModal
    class="select-filepath"
    :show="selectDirModal"
    :title="$t('localMusic.localMusicFolder.title')"
    :close-fn="() => (selectDirModal = false)"
  >
    <template #default>
      <div class="container">
        <textarea
          v-model="scanDirText"
          class="comment-input"
          :placeholder="$t('localMusic.localMusicFolder.placeholder')"
        />
      </div>
    </template>
    <template #footer>
      <button class="primary block" @click="updateDir">更新</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import BaseModal from './BaseModal.vue'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import { computed, ref } from 'vue'

const stateStore = useNormalStateStore()
const { selectDirModal } = storeToRefs(stateStore)

const settingStore = useSettingsStore()
const { localMusic } = storeToRefs(settingStore)

const scanDir = computed(() =>
  (Array.isArray(localMusic.value.scanDir)
    ? localMusic.value.scanDir
    : localMusic.value.scanDir
      ? [localMusic.value.scanDir]
      : []
  ).join('\n')
)

const _temp = ref('')

const scanDirText = computed({
  get: () => scanDir.value,
  set: (value) => {
    _temp.value = value
  }
})

const updateDir = () => {
  localMusic.value.scanDir = _temp.value
    .split('\n')
    .map((i) => i.trim())
    .filter(Boolean)
  selectDirModal.value = false
  _temp.value = ''
}
</script>

<style scoped lang="scss">
.select-filepath {
  .content {
    display: flex;
    flex-direction: column;
    input {
      margin-bottom: 12px;
    }
    input[type='text'] {
      width: 100%;
      flex: 1;
      background: var(--color-secondary-bg-for-transparent);
      font-size: 16px;
      border: none;
      font-weight: 600;
      padding: 8px 12px;
      border-radius: 8px;
      margin-top: -1px;
      color: var(--color-text);
      box-sizing: border-box;
      &:focus {
        opacity: 1;
      }
      [data-theme='light'] &:focus {
        color: var(--color-primary);
      }
    }

    .container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 100px;

      .comment-input {
        color: var(--text-color);
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        font-size: 14px;
        resize: none;
        border: none;
        outline: none;
        border-radius: 8px;
        padding: 6px 12px;
        scrollbar-width: none;
        background: var(--color-secondary-bg-for-transparent);
      }
      .comment-input::placeholder {
        opacity: 0.6;
        color: var(--text-color);
      }
    }
  }
}
.footer {
  padding-top: 16px;
  margin: 16px 24px 24px 24px;
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  display: flex;
  justify-content: flex-start;
  margin-bottom: -8px;
  button {
    color: var(--color-text);
    background: var(--color-secondary-bg-for-transparent);
    border-radius: 8px;
    padding: 6px 16px;
    font-size: 14px;
    margin-left: 12px;
    transition: 0.2s;
    &:active {
      transform: scale(0.94);
    }
  }
  button.primary {
    color: white;
    background: var(--color-primary);
    font-weight: 500;
  }
  button.block {
    width: 100%;
    margin-left: 0;
    &:active {
      transform: scale(0.98);
    }
  }
}
</style>
