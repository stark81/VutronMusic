<template>
  <Modal :show="setFontModal" title="创意歌词字体设置" :close-fn="close">
    <template #default>
      <Multiselect
        v-model="selectedFonts"
        mode="single"
        :close-on-deselect="false"
        :searchable="true"
        :create-option="true"
        :options="fontList"
      >
        <template #option="{ option }">
          <div :style="{ fontFamily: option.value }">
            {{ option.label }}
          </div>
        </template>
      </Multiselect>
      <div class="preview">
        <div class="title">字体预览</div>
        <div class="text-preview">
          <div v-for="item in preview" :key="item.language" class="text-item">
            <span>{{ item.language }}：</span>
            <span :style="{ fontFamily: selectedFonts, fontSize: '20px' }">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <button class="primary block" @click="setFont">确定</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Modal from './BaseModal.vue'
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import Multiselect from '@vueform/multiselect'
import '@vueform/multiselect/themes/default.css'

const stateStore = useNormalStateStore()
const { setFontModal, fontList } = storeToRefs(stateStore)
const { getFontList } = stateStore

const settingsStore = useSettingsStore()
const { playerTheme } = storeToRefs(settingsStore)

const currentTheme = computed(() => playerTheme.value.creative.find((theme) => theme.selected))

const selectedFonts = ref<string>(currentTheme.value?.font || 'system-ui')

const preview = [
  { language: '简体中文', label: '这是一段词预览文本' },
  { language: '繁體中文', label: '這是一段詞預覽文本' },
  { language: 'english', label: 'This is a lyric preview text' },
  { language: '日本語', label: 'これは歌詞のプレビューです' },
  { language: '한국어', label: '이것은 가사 미리보기입니다' }
]

const setFont = () => {
  if (!currentTheme.value) {
    close()
    return
  }
  if (selectedFonts.value) {
    currentTheme.value.font = selectedFonts.value
    close()
  }
}

const close = () => {
  selectedFonts.value = currentTheme.value?.font || 'system-ui'
  setFontModal.value = false
}

onMounted(() => {
  getFontList()
})
</script>

<style scoped lang="scss">
:deep(.content) {
  overflow: unset;
}

:deep(.multiselect) {
  background: var(--color-secondary-bg-for-transparent);
  border: unset;
}

:deep(.multiselect-search) {
  color: var(--color-text);
  background-color: unset;
}

:deep(.multiselect.is-active) {
  box-shadow: unset;
}

:deep(.multiselect-dropdown) {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px) opacity(1);
  box-shadow: unset;
}

:global([data-theme='dark'] .multiselect-dropdown) {
  background: var(--color-secondary-bg);
}

:deep(.multiselect-option.is-pointed),
:deep(.multiselect-option.is-selected) {
  background: var(--color-primary);
  color: var(--color-text);
}

.preview {
  margin-top: 20px;
  padding: 0 4px;

  .title {
    font-size: 20px;
    font-weight: 500;
    margin-bottom: 20px;
  }

  .text-preview {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    height: 240px;

    &::-webkit-scrollbar {
      width: 0px;
    }
  }

  .text-item {
    font-size: 16px;
    margin-top: 20px;

    &:first-child {
      margin-top: 0;
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
