<template>
  <div :class="{ 'creative-container': activeTheme.theme.activeLayout === 'Creative' }">
    <Modal
      :show="setFontModal"
      title="歌词设置"
      width="60vw"
      :show-footer="false"
      :close-fn="close"
    >
      <template #default>
        <div class="lyric-setting">
          <template v-if="activeTheme.theme.activeLayout === 'Classic'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.useMask.text') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input id="mask" v-model="useMask" type="checkbox" name="mask" />
                  <label for="mask"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.isWordByWord') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="isWordByWord"
                    v-model="isWordByWord"
                    type="checkbox"
                    name="isWordByWord"
                  />
                  <label for="isWordByWord"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.lyricZoom') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input id="zoom" v-model="isZoom" type="checkbox" name="zoom" />
                  <label for="zoom"></label>
                </div>
              </div>
            </div>
          </template>
          <div v-if="activeTheme.theme.activeLayout !== 'Classic'" class="item">
            <div class="left">
              <div class="title">{{ $t('settings.osdLyric.lyricBold') }}</div>
            </div>
            <div class="right">
              <div class="toggle">
                <input id="bold" v-model="isBold" type="checkbox" name="bold" />
                <label for="bold"></label>
              </div>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.osdLyric.font') }}</div>
            </div>
            <div class="right">
              <CustomSelect
                v-model="selectedFonts"
                class="input-select"
                direction="down"
                :searchable="true"
                :options="fontList"
              >
                <template #option="{ option }">
                  <div :style="{ fontFamily: option.value as string }">
                    {{ option.label }}
                  </div>
                </template>
              </CustomSelect>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">
                {{
                  $t('settings.osdLyric.fontSize', {
                    dw: activeTheme.theme.activeLayout === 'Classic' ? 'px' : 'cqw'
                  })
                }}
              </div>
            </div>
            <div class="right">
              <input v-model="fontSize" type="number" class="text-input" />
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">
                {{ $t('settings.osdLyric.textAlign.text') }}
              </div>
            </div>
            <div class="right">
              <CustomSelect v-model="align" class="input-select" :options="alignOption" />
            </div>
          </div>
          <div v-if="activeTheme.theme.activeLayout === 'Creative'" class="item">
            <div class="left">
              <div class="title">
                {{ $t('settings.osdLyric.position.text') }}
              </div>
            </div>
            <div class="right">
              <CustomSelect v-model="position" class="input-select" :options="posOption" />
            </div>
          </div>
          <div v-if="activeTheme.theme.activeLayout === 'Classic'" class="item">
            <div class="left">
              <div class="title">{{ $t('settings.osdLyric.translationMode.text') }}</div>
            </div>
            <div class="right">
              <CustomSelect
                v-model="translationMode"
                class="input-select"
                :options="translateOptions"
              />
            </div>
          </div>
          <div v-if="activeTheme.theme.activeLayout !== 'Classic'" class="item">
            <div class="left">
              <div class="title">
                {{ $t('settings.osdLyric.lineGap', { dw: 'px' }) }}
              </div>
            </div>
            <div class="right">
              <input v-model="gap" type="number" class="text-input" />
            </div>
          </div>
        </div>
        <div v-if="activeTheme.theme.activeLayout === 'Creative'" class="region-setting">
          <div class="title">
            <span :style="{ fontWeight: 600 }">区域设置</span>
            <span class="reset button" style="margin: 0" @click="reset">{{
              $t('player.frequad.reset')
            }}</span>
          </div>
          <div class="list-container">
            <div v-for="list in settingList" :key="list.name" class="settings-list">
              <span>{{ list.name }}</span>
              <template v-if="list.type === 'slide' && region">
                <div class="slider">
                  <VueSlider
                    v-model="region[list.key]"
                    :min="list.min"
                    :max="list.max"
                    :interval="0.5"
                    :use-keyboard="false"
                    :drag-on-click="false"
                    :process-style="{ background: 'var(--color-primary)' }"
                    :duration="0.1"
                    tooltip="none"
                    :dot-size="12"
                    :dot-style="{ display: 'none' }"
                    :height="2"
                    :silent="true"
                  />
                </div>
                <input v-model="region[list.key]" type="number" :min="list.min" :max="list.max" />
                <span class="dw">{{ list.dw }}</span>
              </template>
              <template v-else-if="list.type === 'check'">
                <div class="toggle">
                  <input id="lyricAlign" v-model="align" type="checkbox" name="lyricAlign" />
                  <label for="lyricAlign"></label>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </Modal>
    <div v-if="setFontModal" class="pre-region">
      <div class="title" :style="titleStyle"></div>
      <div class="content" :style="contentStyle"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import Modal from './BaseModal.vue'
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import { usePlayerThemeStore } from '../store/playerTheme'
import VueSlider from 'vue-3-slider-component'
import CustomSelect from './CustomSelect.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const stateStore = useNormalStateStore()
const { setFontModal, fontList } = storeToRefs(stateStore)
const { getFontList } = stateStore

const playerThemeStore = usePlayerThemeStore()
const { activeTheme, senses } = storeToRefs(playerThemeStore)

const currentTheme = computed(() => {
  const theme = activeTheme.value.theme
  const result = theme.senses[theme.activeLayout]
  return result
})

const useMask = computed({
  get: () => {
    const theme = activeTheme.value.theme
    if (theme.activeLayout === 'Classic') {
      return theme.senses[theme.activeLayout].lyric.mask
    }
    return false
  },
  set: (value) => {
    const theme = activeTheme.value.theme
    if (theme.activeLayout === 'Classic') {
      theme.senses[theme.activeLayout].lyric.mask = value
    }
  }
})

const isWordByWord = computed({
  get: () => {
    const theme = activeTheme.value.theme
    if (theme.activeLayout === 'Classic') {
      return theme.senses[theme.activeLayout].lyric.wbw
    }
    return true
  },
  set: (value) => {
    const theme = activeTheme.value.theme
    if (theme.activeLayout === 'Classic') {
      theme.senses[theme.activeLayout].lyric.wbw = value
    }
  }
})

const isZoom = computed({
  get: () => {
    const theme = activeTheme.value.theme
    if (theme.activeLayout === 'Classic') {
      return theme.senses[theme.activeLayout].lyric.zoom
    }
    return true
  },
  set: (value) => {
    const theme = activeTheme.value.theme
    if (theme.activeLayout === 'Classic') {
      theme.senses[theme.activeLayout].lyric.zoom = value
    }
  }
})

const isBold = computed({
  get: () => {
    const theme = activeTheme.value.theme
    return theme.senses[theme.activeLayout].lyric.fontBold
  },
  set: (value) => {
    const theme = activeTheme.value.theme
    theme.senses[theme.activeLayout].lyric.fontBold = value
  }
})

const selectedFonts = computed({
  get: () => currentTheme.value.lyric.font || 'system-ui',
  set: (value) => (currentTheme.value.lyric.font = value)
})

const fontSize = computed({
  get: () => currentTheme.value.lyric.fontSize,
  set: (value: number) => {
    currentTheme.value.lyric.fontSize = value
  }
})

const gap = computed({
  get: () => currentTheme.value.lyric.gap,
  set: (value) => {
    if (activeTheme.value.theme.activeLayout === 'Classic') return
    currentTheme.value.lyric.gap = value
  }
})

const titleStyle = computed(() => {
  const type = activeTheme.value.theme.activeLayout
  if (type !== 'Creative') return {}
  const sense = senses.value[type]
  const pos = sense.region
  const result: Record<string, any> = {
    left: pos.left + 'vw',
    right: pos.right + 'vw',
    top: pos.titleTop + 'vh'
  }
  result.height = '50px'
  result.position = 'fixed'
  result.background = 'var(--color-primary)'
  result.opacity = 0.5
  return result
})

const translationMode = computed({
  get: () => {
    const theme = activeTheme.value.theme
    if (theme.activeLayout === 'Classic') {
      return theme.senses[theme.activeLayout].lyric.translation
    }
    return 'tlyric'
  },
  set: (value) => {
    const theme = activeTheme.value.theme
    if (theme.activeLayout === 'Classic') {
      theme.senses[theme.activeLayout].lyric.translation = value
    }
  }
})

const translateOptions = [
  { label: t('settings.osdLyric.translationMode.none'), value: 'none' },
  { label: t('settings.osdLyric.translationMode.tlyric'), value: 'tlyric' },
  { label: t('settings.osdLyric.translationMode.romalrc'), value: 'rlyric' }
]

const alignOption = [
  { label: t('settings.osdLyric.textAlign.start'), value: 'left' },
  { label: t('settings.osdLyric.textAlign.center'), value: 'center' },
  { label: t('settings.osdLyric.textAlign.end'), value: 'right' }
]

const align = computed({
  get: () => {
    const theme = activeTheme.value.theme
    const layout = theme.activeLayout
    return theme.senses[layout].align
  },
  set: (value) => {
    const theme = activeTheme.value.theme
    const layout = theme.activeLayout
    if (layout === 'Letter') return
    theme.senses[layout].align = value
  }
})

const posOption = [
  { label: t('settings.osdLyric.position.top'), value: 'left' },
  { label: t('settings.osdLyric.position.center'), value: 'center' },
  { label: t('settings.osdLyric.position.bottom'), value: 'right' }
]

const position = computed({
  get: () => {
    const theme = activeTheme.value.theme
    const layout = theme.activeLayout
    return layout === 'Creative' ? theme.senses[layout].lyric.pos : 'left'
  },
  set: (value) => {
    const theme = activeTheme.value.theme
    const layout = theme.activeLayout
    if (layout === 'Creative') {
      theme.senses[layout].lyric.pos = value
    }
  }
})

const region = computed(() => {
  const theme = activeTheme.value.theme
  const layout = theme.activeLayout
  if (layout === 'Creative') {
    const reg = theme.senses[layout].region
    return reg
  }
  return null
})

const settingList = [
  { name: '歌名(上):', key: 'titleTop', type: 'slide', dw: 'vh', min: 0, max: 110 },
  { name: '', key: '', type: '', dw: '', min: 0, max: 0 },
  { name: '歌词(上):', key: 'top', type: 'slide', dw: 'vh', min: 0, max: 100 },
  { name: '歌词(下):', key: 'bottom', type: 'slide', dw: 'vh', min: 0, max: 100 },
  { name: '歌词(左):', key: 'left', type: 'slide', dw: 'vw', min: 0, max: 50 },
  { name: '歌词(右):', key: 'right', type: 'slide', dw: 'vw', min: 0, max: 50 }
]

const contentStyle = computed(() => {
  const type = activeTheme.value.theme.activeLayout
  if (type !== 'Creative') return {}
  const sense = senses.value[type]
  const pos = sense.region
  const result: Record<string, any> = {
    left: pos.left + 'vw',
    right: pos.right + 'vw',
    top: pos.top + 'vh',
    bottom: pos.bottom + 'vh'
  }
  result.position = 'fixed'
  result.background = 'var(--color-primary)'
  result.opacity = 0.5
  return result
})

const reset = () => {
  if (!region.value) return
  region.value.titleTop = 3.9
  region.value.top = 15
  region.value.bottom = 15
  region.value.left = 15
  region.value.right = 15
  if (activeTheme.value.theme.activeLayout === 'Creative') {
    align.value = 'left'
  }
}

const close = () => {
  setFontModal.value = false
}

onMounted(() => {
  getFontList()
})
</script>

<style scoped lang="scss">
.creative-container :deep(.modal) {
  opacity: 0.7;
}

.pre-region {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  height: 100vh;
  overflow: hidden;
  z-index: 21;
}

.region-setting {
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  margin-top: 10px;
  padding-top: 14px;

  .title {
    font-size: 20px;
    margin-bottom: 16px;
  }

  .button {
    display: inline-block;
    background: var(--color-secondary-bg-for-transparent);
    padding: 4px 10px;
    margin: 0 10px 10px 0;
    font-size: 13px;
    border-radius: 4px;
    &:hover {
      cursor: pointer;
    }
    .input {
      background: none !important;
      border: none !important;
      width: 60px;
      color: var(--color-text);
    }
  }

  .reset {
    float: right;
  }

  .list-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px 20px;

    .settings-list {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 0;

      .slider {
        width: 55%;
        padding: 0 10px;
        transition: all 0.3s ease;
        box-sizing: border-box;
      }
      input[type='number'] {
        width: 50px;
        box-sizing: border-box;
        background: var(--color-secondary-bg-for-transparent);
        background-color: transparent;
        color: var(--color-text);
        font-size: 16px;
        border: none;
        border-radius: 4px;
        text-align: right;
      }
      span {
        font-size: 15px;
        opacity: 0.78;
        width: 70px;
        text-align: center;

        &.dw {
          width: unset;
          margin-left: -20px;
        }
      }
    }
  }
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  .left .title {
    font-size: 16px;
    font-weight: 600;
  }

  input[type='number'] {
    width: 160px;
    box-sizing: border-box;
    background: var(--color-secondary-bg-for-transparent);
    color: var(--color-text);
    font-size: 16px;
    border: none;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 4px;
    text-align: center;
  }
}

.input-select {
  width: 160px !important;
  :deep(.custom-select) {
    background: var(--color-secondary-bg-for-transparent);
    border-radius: 4px;
    height: 36px;
  }
}

.toggle {
  display: flex;
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
  height: 30px;
  width: 52px;
  background: var(--color-secondary-bg-for-transparent);
  border-radius: 8px;
}
.toggle input + label:before {
  content: '';
  position: absolute;
  display: block;
  -webkit-transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  height: 30px;
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
  height: 18px;
  width: 18px;
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

:deep(.content) {
  overflow: unset;
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
