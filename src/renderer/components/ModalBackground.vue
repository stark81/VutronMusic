<template>
  <BaseModal title="主题设置" :show="show" :show-footer="false" :close-fn="close" width="60vw">
    <template #default>
      <div class="item">
        <div class="left">
          <div class="title">播放页背景设置</div>
        </div>
        <div class="right">
          <CustomSelect v-model="updateColor" :options="colorOptions" />
        </div>
      </div>
      <br />
      <div class="item">{{ activeBG }}</div>
      <br />
      <div>背景设置 - 自定义路径等</div>
      <div>如果是经典布局，则设置封面类型、是否旋转等</div>
      <div
        >如果是创意布局，则设置行数、歌词位置、是否启用封面颜色为底色(视频透明度后会显示这个底色)</div
      >
      <div>字体设置</div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from './BaseModal.vue'
import CustomSelect from './CustomSelect.vue'
import { useNormalStateStore } from '../store/state'
import { usePlayerThemeStore } from '../store/playerTheme'
import { BgSource, ColorOption } from '@/types/theme'

const stateStore = useNormalStateStore()
const { backgroundModal } = storeToRefs(stateStore)
const playerThemeStore = usePlayerThemeStore()
const { activeBG } = storeToRefs(playerThemeStore)

const colorOptionByType: Record<BgSource['type'], { label: ColorOption; value: ColorOption }[]> = {
  gradient: [{ label: 'dark', value: 'dark' }],
  'blur-image': [
    { label: 'light', value: 'light' },
    { label: 'dark', value: 'dark' },
    { label: 'auto', value: 'auto' }
  ],
  'dynamic-image': [
    { label: 'light', value: 'light' },
    { label: 'dark', value: 'dark' },
    { label: 'auto', value: 'auto' }
  ],
  'letter-image': [
    { label: 'light', value: 'light' },
    { label: 'dark', value: 'dark' },
    { label: 'auto', value: 'auto' }
  ],
  'custom-image': [
    { label: 'light', value: 'light' },
    { label: 'dark', value: 'dark' },
    { label: 'auto', value: 'auto' }
  ],
  lottie: [
    { label: 'light', value: 'light' },
    { label: 'dark', value: 'dark' }
  ],
  'custom-video': [
    { label: 'light', value: 'light' },
    { label: 'dark', value: 'dark' },
    { label: 'auto', value: 'auto' }
  ],
  api: [
    { label: 'light', value: 'light' },
    { label: 'dark', value: 'dark' },
    { label: 'auto', value: 'auto' }
  ],
  'random-folder': [
    { label: 'light', value: 'light' },
    { label: 'dark', value: 'dark' },
    { label: 'auto', value: 'auto' }
  ]
}

const colorOptions = computed(() => {
  return colorOptionByType[activeBG.value.type]
})

const show = computed({
  get: () => backgroundModal.value.show,
  set: (value) => {
    backgroundModal.value.show = value
  }
})

const type = computed({
  get: () => backgroundModal.value.type,
  set: (value) => {
    backgroundModal.value.type = value
  }
})

const updateColor = computed({
  get: () => activeBG.value.color,
  set: (value) => {
    activeBG.value.color = value
  }
})

const close = () => {
  show.value = false
  type.value = 'Classic'
}
</script>

<style scoped lang="scss">
.item {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text);
  padding-bottom: 10px;

  .left {
    padding-right: 6vw;

    .title {
      font-size: 16px;
      font-weight: 500;
      opacity: 0.78;
    }
  }
}
</style>
