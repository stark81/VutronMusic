<template>
  <BaseModal title="背景设置" :show="show" :show-footer="false" :close-fn="close">
    <template #default>
      <div class="item">
        <div class="left">
          <div class="title">{{ $t('settings.general.lyricBackground.text') }}</div>
        </div>
      </div>
      <div class="item-1">
        <div
          v-for="color in createBG()"
          :key="color.type"
          class="bg-select"
          :class="{ active: color.type === activeTheme.theme.activeBG }"
          @click="activeTheme.theme.activeBG = color.type"
          >{{ bgMap[color.type] }}</div
        >
      </div>
      <template v-if="isCustomize">
        <div class="item">
          <div class="left">
            <div class="title">{{ $t('settings.lyric.backgroundSource') }}：</div>
          </div>
        </div>
        <div class="item lyric-source" :class="{ lottie: activeBG.type === 'lottie' }">
          <input
            v-model="activeBG.src"
            type="text"
            class="text-input"
            :placeholder="bgSourcePlaceholder"
          />
          <div class="right">
            <template v-if="activeBG.type === 'lottie'">
              <button @click="activeBG.src = 'snow'">纯净雪域</button>
              <button @click="activeBG.src = 'sunshine'">落日余晖</button>
            </template>
            <button v-if="activeBG.type !== 'api'" @click="selectSource">{{
              $t('settings.lyric.browse')
            }}</button>
            <button @click="reset">{{ $t('settings.lyric.reset') }}</button>
          </div>
        </div>
        <template v-if="activeBG.type === 'api'">
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.lyric.apiRefreshMode') }}</div>
            </div>
            <div class="right">
              <CustomSelect
                v-model="activeBG.switchMode"
                direction="up"
                :options="apiRefreshModeOptions"
              />
            </div>
          </div>
          <div v-if="activeBG.switchMode === 'time'" class="item">
            <div class="left">
              <div class="title">{{ $t('settings.lyric.apiRefreshInterval') }}</div>
            </div>
            <div class="right">
              <CustomSelect
                v-model="activeBG.timer"
                direction="up"
                :options="apiRefreshIntervalOptions"
              />
            </div>
          </div>
        </template>
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
          <div class="left">
            <div class="title">{{ $t('settings.general.lyricBackground.colorMode') }}</div>
          </div>
          <div class="right">
            <CustomSelect v-model="updateColor" direction="up" :options="colorOptions" />
          </div>
        </div>
        <div class="item">
          <div class="left" :style="{ paddingRight: 0 }">
            <div class="title" :style="{ width: '80px' }">{{
              $t('settings.lyric.backgroundBlur')
            }}</div>
          </div>
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
          <input v-model="activeBG.blur" class="slider-span" type="number" :min="0" :max="100" />
          <span class="dw">px</span>
          <span
            class="button"
            style="margin: 0"
            @click="activeBG.blur = activeBG.type === 'lottie' ? 0 : 50"
            >{{ $t('player.frequad.reset') }}</span
          >
        </div>
        <div class="item">
          <div class="left" :style="{ paddingRight: 0 }">
            <div class="title">{{ $t('settings.lyric.backgroundOpacity') }}</div>
          </div>
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
          <input v-model="activeBG.opacity" class="slider-span" type="number" :min="0" :max="100" />
          <span class="dw">%</span>
          <span
            class="button"
            style="margin: 0"
            @click="activeBG.opacity = activeBG.type === 'lottie' ? 100 : 60"
            >{{ $t('player.frequad.reset') }}</span
          >
        </div>
      </template>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from './BaseModal.vue'
import CustomSelect from './CustomSelect.vue'
import VueSlider from './VueSlider.vue'
import { useNormalStateStore } from '../store/state'
import { usePlayerThemeStore, createBG } from '../store/playerTheme'
import { useI18n } from 'vue-i18n'

const stateStore = useNormalStateStore()
const { backgroundModal } = storeToRefs(stateStore)
const playerThemeStore = usePlayerThemeStore()
const { activeBG, activeTheme } = storeToRefs(playerThemeStore)

const { t } = useI18n()

const bgMap = {
  none: t('settings.general.lyricBackground.close'),
  gradient: t('settings.general.lyricBackground.true'),
  'blur-image': t('settings.general.lyricBackground.blur'),
  'dynamic-image': t('settings.general.lyricBackground.dynamic'),
  'letter-image': '模糊小图',
  'custom-image': t('settings.lyric.bgType.image'),
  'custom-video': t('settings.lyric.bgType.video'),
  lottie: 'lottie动画',
  'random-folder': t('settings.lyric.bgType.folder'),
  api: t('settings.lyric.bgType.api')
}

const isCustomize = computed(() => {
  return ['custom-image', 'custom-video', 'lottie', 'random-folder', 'api'].includes(
    activeBG.value.type
  )
})

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

const bgSourcePlaceholder = computed(() => {
  switch (activeBG.value.type) {
    case 'custom-image':
      return t('settings.lyric.placeholder.image')
    case 'custom-video':
      return t('settings.lyric.placeholder.video')
    case 'lottie':
      return 'lottie路径，默认可选择：snow和sunshine'
    case 'random-folder':
      return t('settings.lyric.placeholder.folder')
    case 'api':
      return t('settings.lyric.placeholder.api')
    default:
      return ''
  }
})

const apiRefreshModeOptions = computed(() => [
  { label: t('settings.lyric.refreshMode.song'), value: 'track' },
  { label: t('settings.lyric.refreshMode.time'), value: 'time' }
])

const apiRefreshIntervalOptions = computed(() => [
  { label: '1 ' + t('settings.lyric.minute'), value: 1 },
  { label: '3 ' + t('settings.lyric.minutes'), value: 3 },
  { label: '5 ' + t('settings.lyric.minutes'), value: 5 },
  { label: '10 ' + t('settings.lyric.minutes'), value: 10 },
  { label: '15 ' + t('settings.lyric.minutes'), value: 15 },
  { label: '30 ' + t('settings.lyric.minutes'), value: 30 }
])

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

const selectSource = async () => {
  const isFolder = activeBG.value.type === 'random-folder'
  const filters =
    activeBG.value.type === 'custom-video'
      ? [{ name: 'Video', extensions: ['mp4', 'webm'] }]
      : [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  const result = await window.mainApi?.invoke('showOpenDialog', {
    properties: isFolder ? ['openDirectory'] : ['openFile'],
    filters: isFolder ? undefined : filters
  })

  if (result && !result.canceled && result.filePaths.length > 0) {
    // @ts-ignore
    activeBG.value.src = result.filePaths[0]
  }
}

const reset = () => {
  if (!isCustomize.value) return
  activeBG.value.src = activeBG.value.type === 'lottie' ? 'snow' : ''
}

const close = () => {
  show.value = false
  type.value = 'Classic'
}
</script>

<style scoped lang="scss">
.item {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text);

  .left {
    padding-right: 6vw;

    .title {
      font-size: 16px;
      font-weight: 600;
      opacity: 0.78;
    }
  }

  .right :deep(.custom-select) {
    background-color: var(--color-secondary-bg-for-transparent);
    border: none;
  }

  button {
    position: relative;
    color: var(--color-text);
    border: none;
    background-color: var(--color-secondary-bg-for-transparent);
    padding: 8px 12px;
    font-weight: 600;
    border-radius: 8px;
    transition: 0.2s;
  }

  .slider {
    width: 60%;
  }

  span.button {
    display: inline-block;
    background: var(--color-secondary-bg-for-transparent);
    padding: 4px 10px;
    font-size: 13px;
    border-radius: 4px;
    &:hover {
      cursor: pointer;
    }
  }

  input[type='number'].slider-span {
    width: 40px;
    box-sizing: border-box;
    background: var(--color-secondary-bg-for-transparent);
    background-color: transparent;
    color: var(--color-text);
    font-size: 16px;
    border: none;
    border-radius: 4px;
    text-align: right;
  }

  span.dw {
    width: unset;
    margin-left: -20px;
  }
}

.item.lyric-source {
  input.text-input {
    background-color: var(--color-secondary-bg-for-transparent);
    border: none;
    margin-right: 22px;
    padding: 0 12px;
    border-radius: 8px;
    color: var(--color-text);
    font-weight: 600;
    font-size: 16px;
    width: 50%;
    height: 36px;
    text-align: center;
    box-sizing: border-box;
  }

  &.lottie input.text-input {
    width: 35%;
  }

  .right button {
    height: 35px;
    margin-left: 8px;
  }
}

.item-1 {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-gap: 12px;
  margin: 10px 0;

  .bg-select {
    padding: 8px 2px;
    border: 2px solid var(--color-border);
    color: var(--color-text);
    border-radius: 8px;
    text-align: center;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .bg-select.active {
    border: 2px solid var(--color-primary);
    color: var(--color-primary);
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
