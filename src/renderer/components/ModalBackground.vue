<template>
  <BaseModal title="歌词背景选择" :show="show" :show-footer="false" :close-fn="close">
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
          <!-- @vue-ignore -->
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
      </template>
      <br />
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from './BaseModal.vue'
import CustomSelect from './CustomSelect.vue'
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
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text);

  .left {
    padding-right: 6vw;

    .title {
      font-size: 16px;
      font-weight: 500;
      opacity: 0.78;
    }
  }

  .right :deep(.custom-select) {
    background-color: transparent;
    backdrop-filter: blur(12px) opacity(0.6);
  }

  button {
    position: relative;
    color: var(--color-text);
    background-color: transparent;
    backdrop-filter: blur(12px) opacity(0.6);
    padding: 8px 12px;
    font-weight: 600;
    border-radius: 8px;
    transition: 0.2s;
  }
}

.item.lyric-source {
  input.text-input {
    background-color: transparent;
    backdrop-filter: blur(12px) opacity(0.6);
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
  grid-gap: 20px;
  margin: 10px 0;

  .bg-select {
    padding: 12px 0;
    border: 2px solid var(--color-primary);
    color: var(--color-primary);
    border-radius: 8px;
    text-align: center;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .bg-select.active {
    background-color: var(--color-primary);
    color: white;
  }
}
</style>
