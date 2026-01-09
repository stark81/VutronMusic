<template>
  <BaseModal
    :show="setBGModal"
    title="当前背景设置"
    :close-fn="() => (setBGModal = false)"
    :show-footer="false"
  >
    <template #default>
      <div class="item">
        <div class="left">
          <div class="title">{{ $t('settings.general.lyricBackground.colorMode') }}</div>
        </div>
        <div class="right">
          <CustomSelect v-model="updateColor" :options="colorOptions" />
        </div>
      </div>
      <div v-if="activeBG.type === 'custom-video'" class="item">
        <div class="left">
          <div class="title">{{ $t('settings.general.lyricBackground.extractdColor.text') }}</div>
          <div class="description">{{
            $t('settings.general.lyricBackground.extractdColor.desc')
          }}</div>
        </div>
        <div class="right">
          <div class="toggle">
            <input
              id="extractedColor"
              v-model="activeBG.useExtractedColor"
              type="checkbox"
              name="extractedColor"
            />
            <label for="extractedColor"></label>
          </div>
        </div>
      </div>
      <div class="item">
        <span class="title">{{ $t('settings.lyric.backgroundBlur') }}</span>
        <div class="slider">
          <VueSlider
            v-model="activeBG.blur"
            :min="0"
            :max="100"
            :height="2"
            :dot-size="12"
            :process-style="{ background: 'var(--color-primary)' }"
            :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
          />
        </div>
        <span>{{ Math.round(activeBG.blur) }}px</span>
        <span
          class="button"
          style="margin: 0"
          @click="activeBG.blur = activeBG.type === 'lottie' ? 0 : 50"
          >{{ $t('player.frequad.reset') }}</span
        >
      </div>
      <div class="item">
        <span class="title">{{ $t('settings.lyric.backgroundOpacity') }}</span>
        <div class="slider">
          <VueSlider
            v-model="activeBG.opacity"
            :min="0"
            :max="100"
            :height="2"
            :dot-size="12"
            :process-style="{ background: 'var(--color-primary)' }"
            :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
          />
        </div>
        <span>{{ Math.round(activeBG.opacity) }}%</span>
        <span
          class="button"
          style="margin: 0"
          @click="activeBG.opacity = activeBG.type === 'lottie' ? 100 : 60"
          >{{ $t('player.frequad.reset') }}</span
        >
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import BaseModal from './BaseModal.vue'
import CustomSelect from './CustomSelect.vue'
import { useNormalStateStore } from '../store/state'
import { usePlayerThemeStore } from '../store/playerTheme'
import VueSlider from './VueSlider.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const stateStore = useNormalStateStore()
const { setBGModal } = storeToRefs(stateStore)

const playerThemeStore = usePlayerThemeStore()
const { activeBG } = storeToRefs(playerThemeStore)

const updateColor = computed({
  get: () => activeBG.value.color,
  set: (value) => {
    activeBG.value.color = value
  }
})

const colorOptions = computed(() => [
  { label: t('settings.theme.auto'), value: 'auto' },
  { label: t('settings.theme.light'), value: 'light' },
  { label: t('settings.theme.dark'), value: 'dark' }
])
</script>

<style scoped lang="scss">
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 0;

  .title {
    font-size: 15px;
    font-weight: 600;
  }

  .description {
    font-size: 13px;
  }

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

.toggle {
  margin: auto;
}
.toggle input {
  opacity: 0;
  position: absolute;
}
.toggle input + label {
  position: relative;
  display: inline-block;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-transition: 0.4s ease;
  transition: 0.4s ease;
  height: 32px;
  width: 52px;
  background: var(--color-secondary-bg);
  border-radius: 8px;
}
.toggle input + label:before {
  content: '';
  position: absolute;
  display: block;
  -webkit-transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  height: 32px;
  width: 52px;
  top: 0;
  left: 0;
  border-radius: 8px;
}

.toggle input + label:after {
  content: '';
  position: absolute;
  display: block;
  box-shadow:
    0 0 0 1px hsla(0, 0%, 0%, 0.02),
    0 4px 0px 0 hsla(0, 0%, 0%, 0.01),
    0 4px 9px hsla(0, 0%, 0%, 0.08),
    0 3px 3px hsla(0, 0%, 0%, 0.03);
  -webkit-transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
  transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
  background: #fff;
  height: 20px;
  width: 20px;
  top: 6px;
  left: 6px;
  border-radius: 6px;
}
.toggle input:checked + label:before {
  background: var(--color-primary);
  -webkit-transition: width 0.2s cubic-bezier(0, 0, 0, 0.1);
  transition: width 0.2s cubic-bezier(0, 0, 0, 0.1);
}
.toggle input:checked + label:after {
  left: 26px;
}
</style>
