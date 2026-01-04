<template>
  <BaseModal
    class="save-theme-modal"
    :show="setSaveThemeModal"
    title="保存播放器主题"
    :close-fn="close"
    width="25vw"
  >
    <template #default>
      <input v-model="name" type="text" placeholder="填写播放器主题名称" />
    </template>
    <template #footer>
      <button class="primary block" @click="save">创建</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useNormalStateStore } from '../store/state'
import { usePlayerThemeStore } from '../store/playerTheme'
import BaseModal from './BaseModal.vue'
import { storeToRefs } from 'pinia'
import { nextTick, ref, computed } from 'vue'

const stateStore = useNormalStateStore()
const { setSaveThemeModal } = storeToRefs(stateStore)
const { showToast } = stateStore

const playerTheme = usePlayerThemeStore()
const { themes } = storeToRefs(playerTheme)
const { saveToCustomize } = playerTheme

const name = ref('')

const nameList = computed(() => {
  const customeThemes = themes.value.Customize
  return customeThemes.map((th) => th.name)
})

const close = () => {
  name.value = ''
  setSaveThemeModal.value = false
}

const save = async () => {
  if (nameList.value.includes(name.value)) {
    showToast('主题名称重复')
    return
  }

  setSaveThemeModal.value = false
  await nextTick()
  const path = await window.mainApi?.invoke('get-screenshot', name.value)
  if (!path) return
  saveToCustomize(name.value, path)
}
</script>

<style scoped lang="scss">
.save-theme-modal {
  .content {
    display: flex;
    flex-direction: column;

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
