<template>
  <BaseModal title="主题设置" :show="show" :show-footer="false" :close-fn="close" width="60vw">
    <template #default>
      <div class="layout">{{ activeTheme }}</div>
      <br />
      <div class="background">{{ activeBG }} - {{ senses }}</div>
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
import { useNormalStateStore } from '../store/state'
import { usePlayerThemeStore } from '../store/playerTheme'

const stateStore = useNormalStateStore()
const { backgroundModal } = storeToRefs(stateStore)
const playerThemeStore = usePlayerThemeStore()
const { activeBG, activeTheme } = storeToRefs(playerThemeStore)

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

const senses = computed(() => {
  if (activeTheme.value.theme.activeLayout === 'Classic') {
    return [
      { name: '默认', img: 'common' },
      { name: '圆形封面', img: 'circle' },
      { name: '旋转封面', img: 'rotate' }
    ]
  }
  return [
    { name: '纯净雪域', img: 'creative_snow' },
    { name: '落日余晖', img: 'sunshine' }
  ]
})

const close = () => {
  show.value = false
  type.value = 'Classic'
}
</script>

<style scoped lang="scss"></style>
