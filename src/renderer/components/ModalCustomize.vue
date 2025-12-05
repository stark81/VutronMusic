<template>
  <BaseModal
    :show="setBGModal"
    title="自定义背景设置"
    :close-fn="() => (setBGModal = false)"
    :show-footer="false"
  >
    <template #default>
      <div class="item">
        <span class="title">{{ $t('settings.lyric.backgroundBlur') }}</span>
        <div class="slider">
          <VueSlider
            v-model="normalLyric.backgroundBlur"
            :min="0"
            :max="100"
            :height="2"
            :dot-size="12"
            :process-style="{ background: 'var(--color-primary)' }"
            :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
          />
        </div>
        <span>{{ Math.round(normalLyric.backgroundBlur) }}px</span>
        <span class="button" style="margin: 0" @click="normalLyric.backgroundBlur = 50">{{
          $t('player.frequad.reset')
        }}</span>
      </div>
      <div class="item">
        <span class="title">{{ $t('settings.lyric.backgroundOpacity') }}</span>
        <div class="slider">
          <VueSlider
            v-model="normalLyric.backgroundOpacity"
            :min="0"
            :max="100"
            :height="2"
            :dot-size="12"
            :process-style="{ background: 'var(--color-primary)' }"
            :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
          />
        </div>
        <span>{{ Math.round(normalLyric.backgroundOpacity) }}%</span>
        <span class="button" style="margin: 0" @click="normalLyric.backgroundOpacity = 60">{{
          $t('player.frequad.reset')
        }}</span>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import BaseModal from './BaseModal.vue'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import VueSlider from './VueSlider.vue'

const stateStore = useNormalStateStore()
const { setBGModal } = storeToRefs(stateStore)

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
</script>

<style scoped lang="scss">
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 0;

  .slider {
    width: 60%;
  }

  span {
    font-size: 15px;

    &.title {
      font-weight: 600;
      width: 80px;
    }

    &.button {
      display: inline-block;
      background: var(--color-secondary-bg-for-transparent);
      padding: 4px 10px;
      font-size: 13px;
      border-radius: 4px;
      &:hover {
        cursor: pointer;
      }
    }
  }
}
</style>
