<template>
  <BaseModal :show="setPitchModal" title="音调调节" width="25vw" :close-fn="close">
    <template #default>
      <div class="progress-bar">
        <div class="slider">
          <vue-slider
            v-model="pitch"
            :min="0.5"
            :max="1.5"
            :interval="0.01"
            :duration="0.5"
            :dot-size="12"
            :height="2"
            :use-keyboard="false"
            :drag-on-click="false"
            :process-style="{ background: 'var(--color-primary)' }"
            :dot-style="{ display: 'none' }"
            tooltip="none"
            :lazy="false"
            :marks="marks"
            :silent="true"
          ></vue-slider>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="playback-footer">
        <span>当前音调: {{ `${pitch.toFixed(2)}x` }}</span>
        <span class="reset button" @click="reset">{{ $t('player.frequad.reset') }}</span>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import VueSlider from 'vue-3-slider-component'
import BaseModal from './BaseModal.vue'
import { useNormalStateStore } from '../store/state'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'

const stateStore = useNormalStateStore()
const { setPitchModal } = storeToRefs(stateStore)

const playerStore = usePlayerStore()
const { pitch } = storeToRefs(playerStore)

const marks = {
  0.5: '0.5x',
  0.75: '0.75x',
  1: '1x',
  1.25: '1.25x',
  1.5: '1.5x'
}

const reset = () => {
  pitch.value = 1
}

const close = () => {
  setPitchModal.value = false
}
</script>

<style lang="scss" scoped>
.progress-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .slider {
    width: 100%;
    height: 50px;
    flex-grow: grow;
    padding: 0 10px;
  }
}

.playback-footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .button {
    display: inline-block;
    background: var(--color-secondary-bg-for-transparent);
    padding: 2px 10px;
    font-size: 13px;
    border-radius: 4px;
    &:hover {
      cursor: pointer;
    }
  }
}
</style>
