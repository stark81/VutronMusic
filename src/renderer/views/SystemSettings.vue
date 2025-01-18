<template>
  <div class="system-settings" :style="mainStyle" @click="clickOutside">
    <div v-if="user.userId" class="user-info">
      <div class="left">
        <img class="avatar" :src="user.avatarUrl" loading="lazy" />
        <div class="info">
          <div class="nickname">{{ user.nickname }}</div>
          <div class="extra-info">
            <span v-if="user.vipType !== 0" class="vip"
              ><img class="cvip" :src="imageUrl" loading="lazy" />
              <span class="text">黑胶VIP</span>
            </span>
            <span v-else class="text">{{ user.signature }}</span>
          </div>
        </div>
      </div>
      <div class="right">
        <button @click="doLogout">
          <svg-icon icon-class="logout" />
          {{ $t('settings.general.logout') }}
        </button>
      </div>
    </div>
    <div class="slide-container">
      <div class="slideBar">
        <div class="tab slide" :style="{ top: slideTop + 'px' }"><div class="iconfont"></div></div>
        <div class="tab" :class="{ active: tab === 'general' }" @click="updateTab(0)">{{
          $t('settings.nav.general')
        }}</div>
        <div class="tab" :class="{ active: tab === 'appearance' }" @click="updateTab(1)">{{
          $t('settings.nav.appearance')
        }}</div>
        <div class="tab" :class="{ active: tab === 'lyric' }" @click="updateTab(2)">{{
          $t('settings.nav.lyricSetting')
        }}</div>
        <div
          class="tab"
          :class="{ active: tab === 'localTracks' }"
          @click="updateTab(3)"
          >{{ $t('settings.nav.localMusic') }}</div
        >
        <div
          class="tab"
          :class="{ active: tab === 'shortcut' }"
          @click="updateTab(4)"
          >{{ $t('settings.nav.shortcut') }}</div
        >
      </div>
    </div>
    <div class="main-container">
      <div class="container">
        <div v-show="tab === 'general'" key="general">
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.general.language.text') }}</div>
            </div>
            <div class="right">
              <select v-model="selectLanguage">
                <option value="zh">{{ $t('settings.general.language.zhHans') }}</option>
                <option value="en">{{ $t('settings.general.language.en') }}</option>
              </select>
            </div>
          </div>
          <div v-if="!isMac" class="item">
            <div class="left">
              <div class="title">{{ $t('settings.general.closeAppOption.text') }}</div>
            </div>
            <div class="right">
              <select v-model="selectOptions">
                <option value="ask">{{ $t('settings.general.closeAppOption.ask') }}</option>
                <option value="minimizeToTray">{{
                  $t('settings.general.closeAppOption.minimizeToTray')
                }}</option>
                <option value="exit">{{ $t('settings.general.closeAppOption.exit') }}</option>
              </select>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.general.showTimeOrID.text') }}</div>
            </div>
            <div class="right">
              <select v-model="showTrackInfo">
                <option value="time">{{ $t('settings.general.showTimeOrID.time') }}</option>
                <option value="ID">{{ $t('settings.general.showTimeOrID.ID') }}</option>
              </select>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.general.outputDevice.text') }}</div>
            </div>
            <div class="right">
              <select v-model="selectedOutputDevice">
                <option
                  v-for="device in allOutputDevices"
                  :key="device.deviceId"
                  :value="device.deviceId"
                  :selected="device.deviceId == selectedOutputDevice"
                  >{{ device.label }}</option
                >
              </select>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('player.resetPlayer') }}</div>
            </div>
            <div class="right">
              <button @click="resetPlayer">确定</button>
            </div>
          </div>
          <div v-if="isElectron && isLinux" class="item">
            <div class="left">
              <div class="title">{{ $t('settings.general.useCustomTitlebar') }}</div>
            </div>
            <div class="right">
              <div class="toggle">
                <input
                  id="linux-title-bar"
                  v-model="useLinuxTitleBar"
                  type="checkbox"
                  name="linux-title-bar"
                />
                <label for="linux-title-bar"></label>
              </div>
            </div>
          </div>
          <div class="version-info">
            <p class="author">
              MADE BY
              <a href="https://github.com/stark81" target="_blank">stark81</a>
            </p>
            <p class="version">{{ appVersion }}</p>
          </div>
        </div>
        <div v-show="tab === 'appearance'" key="appearance">
          <div class="item">
            <div
              class="appearance"
              :class="{ selected: appearance === 'light' }"
              @click="updateAppearance('light')"
            >
              <img src="../assets/images/light.jpg" />
              浅色</div
            >
            <div
              class="appearance"
              :class="{ selected: appearance === 'dark' }"
              @click="updateAppearance('dark')"
              ><img src="../assets/images/dark.jpg" /> 深色</div
            >
            <div
              class="appearance"
              :class="{ selected: appearance === 'auto' }"
              @click="updateAppearance('auto')"
              ><img src="../assets/images/auto.png" /> 自动</div
            >
          </div>
        </div>
        <div v-show="tab === 'lyric'" key="lyric">
          <div class="lyric-tab">
            <button
              v-if="isElectron && !isWindows"
              :class="{ 'lyric-button': true, 'lyric-button--selected': lyricTab === 'trayLyric' }"
              @click="lyricTab = 'trayLyric'"
              >{{ $t('settings.nav.trayLyric') }}</button
            >
            <button
              :class="{ 'lyric-button': true, 'lyric-button--selected': lyricTab === 'lyric' }"
              @click="lyricTab = 'lyric'"
              >{{ $t('settings.nav.lyric') }}</button
            >
            <button
              :class="{ 'lyric-button': true, 'lyric-button--selected': lyricTab === 'osdLyric' }"
              @click="lyricTab = 'osdLyric'"
              >{{ $t('settings.nav.osdLyric') }}</button
            >
          </div>
          <div v-show="lyricTab === 'osdLyric'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.isLock') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input id="isLock" v-model="isLock" type="checkbox" name="isLock" />
                  <label for="isLock"></label>
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
                <div class="title"> {{ $t('settings.osdLyric.fontSize') }} </div>
              </div>
              <div class="right">
                <input
                  v-model="inputFontSizeValue"
                  type="number"
                  class="text-input margin-right-0"
                  @input="inputFontSizeDebounce"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.osdLyric.staticTime.text') }} </div>
                <div class="description"> {{ $t('settings.osdLyric.staticTime.desc') }} </div>
              </div>
              <div class="right">
                <input
                  v-model="staticTime"
                  type="number"
                  step="100"
                  class="text-input margin-right-0"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.type.text') }}</div>
              </div>
              <div class="right">
                <select v-model="typeOption">
                  <option value="small">{{ $t('settings.osdLyric.type.small') }}</option>
                  <option value="normal">{{ $t('settings.osdLyric.type.normal') }}</option>
                </select>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.mode.text') }}</div>
                <div class="description">{{ $t('settings.osdLyric.mode.desc') }}</div>
              </div>
              <div class="right">
                <select v-model="modeOption">
                  <option value="oneLine">{{ $t('settings.osdLyric.mode.oneLine') }}</option>
                  <option value="twoLines">{{ $t('settings.osdLyric.mode.twoLines') }}</option>
                </select>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.translationMode.text') }}</div>
              </div>
              <div class="right">
                <select v-model="translationOption">
                  <option value="none">{{ $t('settings.osdLyric.translationMode.none') }}</option>
                  <option value="tlyric">{{
                    $t('settings.osdLyric.translationMode.tlyric')
                  }}</option>
                  <option value="romalrc">{{
                    $t('settings.osdLyric.translationMode.romalrc')
                  }}</option>
                </select>
              </div>
            </div>
            <div class="item">
              <div class="color">
                <pick-colors
                  v-model:value="backgroundColor"
                  :width="100"
                  :height="100"
                  format="rgb"
                  show-alpha
                />
                <div class="text">背景色</div>
              </div>
              <div class="color">
                <pick-colors
                  v-model:value="playedLrcColor"
                  :width="100"
                  :height="100"
                  format="rgb"
                  show-alpha
                />
                <div class="text">已播放颜色</div>
              </div>
              <div class="color">
                <pick-colors
                  v-model:value="unplayLrcColor"
                  :width="100"
                  :height="100"
                  format="rgb"
                  show-alpha
                />
                <div class="text">未播放颜色</div>
              </div>
              <div class="color">
                <pick-colors
                  v-model:value="textShadow"
                  :width="100"
                  :height="100"
                  format="rgb"
                  show-alpha
                />
                <div class="text">阴影颜色</div>
              </div>
            </div>
          </div>
          <div v-show="lyricTab === 'lyric'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.isWordByWord') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="isNWordByWord"
                    v-model="isNWordByWord"
                    type="checkbox"
                    name="isNWordByWord"
                  />
                  <label for="isNWordByWord"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.osdLyric.fontSize') }} </div>
              </div>
              <div class="right">
                <input
                  v-model="inputNFontSizeValue"
                  type="number"
                  class="text-input margin-right-0"
                  @input="inputNValue"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.translationMode.text') }}</div>
              </div>
              <div class="right">
                <select v-model="nTranslationOption">
                  <option value="none">{{ $t('settings.osdLyric.translationMode.none') }}</option>
                  <option value="tlyric">{{
                    $t('settings.osdLyric.translationMode.tlyric')
                  }}</option>
                  <option value="rlyric">{{
                    $t('settings.osdLyric.translationMode.romalrc')
                  }}</option>
                </select>
              </div>
            </div>
          </div>
          <div v-if="!isWindows" v-show="lyricTab === 'trayLyric'">
            <div v-if="isMac">
              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.tray.showLyric') }}
                  </div>
                </div>
                <div class="right">
                  <div class="toggle">
                    <input id="show-lyric" v-model="showLyric" type="checkbox" name="show-lyric" />
                    <label for="show-lyric"></label>
                  </div>
                </div>
              </div>
              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.tray.showControl') }}
                  </div>
                </div>
                <div class="right">
                  <div class="toggle">
                    <input
                      id="show-control"
                      v-model="showControl"
                      type="checkbox"
                      name="show-control"
                    />
                    <label for="show-control"></label>
                  </div>
                </div>
              </div>
              <div class="item">
                <div class="left">
                  <div class="title"> {{ $t('settings.tray.lyricFrameWidth') }} </div>
                </div>
                <div class="right">
                  <input
                    v-model="inputValue"
                    type="number"
                    class="text-input margin-right-0"
                    @input="inputDebounce()"
                  />
                </div>
              </div>
              <div class="item">
                <div class="left">
                  <div class="title"> {{ $t('settings.tray.lyricScrollFrameRate.text') }} </div>
                  <div class="description">
                    {{ $t('settings.tray.lyricScrollFrameRate.desc') }}</div
                  >
                </div>
                <div class="right">
                  <input
                    v-model="inputRateValue"
                    type="number"
                    class="text-input margin-right-0"
                    @input="inputRateDebounce()"
                  />
                </div>
              </div>
            </div>
            <div v-else-if="isLinux">
              <div class="item">
                <div class="left">
                  <div class="title"
                    >{{ $t('settings.extension.status') }}：{{
                      extensionCheckResult ? '已开启' : '已停用'
                    }}</div
                  >
                  <div class="description"
                    >如果未安装插件，可点击 <a @click="openOnBrowser">此处</a> 下载</div
                  >
                </div>
              </div>
              <div class="item">
                <div class="left">
                  <div class="title">{{ $t('settings.extension.showLyric.text') }}</div>
                  <div class="description">{{ $t('settings.extension.showLyric.desc') }}</div>
                </div>
                <div class="right">
                  <div class="toggle">
                    <input
                      id="enable-extension"
                      v-model="enableExtension"
                      type="checkbox"
                      name="enable-extension"
                    />
                    <label for="enable-extension"></label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="isElectron" v-show="tab === 'localTracks'" key="localTracks">
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('localMusic.localMusicFolderPath') }}: {{ scanDir }}</div>
            </div>
            <div class="right">
              <button @click="chooseDir">{{ scanDir ? '更改' : '选择' }}</button>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('localMusic.clearLocalMusic.text') }}</div>
              <div class="description">{{ $t('localMusic.clearLocalMusic.desc') }}</div>
            </div>
            <div class="right">
              <button @click="deleteLocalMusic">确定</button>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">
                {{ $t('localMusic.embeddedInformation') }}
              </div>
            </div>
            <div class="right">
              <div class="toggle">
                <input
                  id="inner-info"
                  v-model="useInnerInfoFirst"
                  type="checkbox"
                  name="inner-info"
                />
                <label for="inner-info"></label>
              </div>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">
                {{ $t('localMusic.replayGain.text') }}
              </div>
              <div class="description">
                {{ $t('localMusic.replayGain.desc') }}
              </div>
            </div>
            <div class="right">
              <div class="toggle">
                <input id="replay-gain" v-model="replayGain" type="checkbox" name="replay-gain" />
                <label for="replay-gain"></label>
              </div>
            </div>
          </div>
        </div>
        <div v-if="isElectron" v-show="tab === 'shortcut'" key="shortcut">
          <div class="item">
            <div class="left">
              <div class="title"> {{ $t('settings.shortcut.enableGlobalShortcut') }} </div>
            </div>
            <div class="right">
              <div class="toggle">
                <input
                  id="enable-global-shortcut"
                  v-model="enableGlobalShortcut"
                  type="checkbox"
                  name="enable-global-shortcut"
                />
                <label for="enable-global-shortcut"></label>
              </div>
            </div>
          </div>
          <div
            id="shortcut-table"
            :class="{ 'global-disabled': !enableGlobalShortcut }"
            tabindex="0"
            @keydown="handleShortcutKeydown"
          >
            <div class="row row-head">
              <div class="col">{{ $t('settings.shortcut.function') }}</div>
              <div class="col">{{ $t('settings.shortcut.shortcut') }}</div>
              <div class="col">{{ $t('settings.shortcut.globalShortcut') }}</div>
            </div>
            <div v-for="shortcut in shortcuts" :key="shortcut.id" class="row">
              <div class="col">{{ shortcut.name }}</div>
              <div class="col">
                <div
                  class="keyboard-input"
                  :class="{
                    active: shortcutInput.id === shortcut.id && shortcutInput.type === 'shortcut'
                  }"
                  @click.stop="readyToRecordShortcut(shortcut.id, 'shortcut')"
                  >{{
                    shortcutInput.id === shortcut.id &&
                    shortcutInput.type === 'shortcut' &&
                    recordedShortcutComputed !== ''
                      ? formatShortcut(recordedShortcutComputed)
                      : formatShortcut(shortcut.shortcut)
                  }}</div
                >
              </div>
              <div class="col">
                <div
                  class="keyboard-input"
                  :class="{
                    active:
                      shortcutInput.id === shortcut.id && shortcutInput.type === 'globalShortcut'
                  }"
                  @click.stop="readyToRecordShortcut(shortcut.id, 'globalShortcut')"
                  >{{
                    shortcutInput.id === shortcut.id &&
                    shortcutInput.type === 'globalShortcut' &&
                    recordedShortcutComputed !== ''
                      ? formatShortcut(recordedShortcutComputed)
                      : formatShortcut(shortcut.globalShortcut)
                  }}</div
                >
              </div>
            </div>
          </div>
          <button class="restore-default-shortcut" @click="restoreDefaultShortcuts">{{
            $t('settings.shortcut.resetShortcut')
          }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, computed, inject, onMounted, onBeforeUnmount } from 'vue'
import pickColors from 'vue-pick-colors'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../store/settings'
import { usePlayerStore } from '../store/player'
import { useLocalMusicStore } from '../store/localMusic'
import { useNormalStateStore } from '../store/state'
import { useOsdLyricStore } from '../store/osdLyric'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'
import { doLogout } from '../utils/auth'
import SvgIcon from '../components/SvgIcon.vue'
import Utils from '../utils'
// @ts-ignore
import imageUrl from '../utils/settingImg.dataurl?raw'

const settingsStore = useSettingsStore()
const { localMusic, general, tray, theme, shortcuts, enableGlobalShortcut, normalLyric } =
  storeToRefs(settingsStore)
const { scanDir, replayGain, useInnerInfoFirst } = toRefs(localMusic.value)
const { showTrackTimeOrID, useCustomTitlebar, language, closeAppOption } = toRefs(general.value)
const { appearance } = toRefs(theme.value)
const { showLyric, showControl, lyricWidth, scrollRate, enableExtension } = toRefs(tray.value)
const { nFontSize, isNWordByWord, nTranslationMode } = toRefs(normalLyric.value)
const { extensionCheckResult } = toRefs(useNormalStateStore())

const dataStore = useDataStore()
const { user } = storeToRefs(dataStore)

const osdLyric = useOsdLyricStore()
const {
  // alwaysOnTop,
  isLock,
  type,
  mode,
  isWordByWord,
  translationMode,
  fontSize,
  backgroundColor,
  playedLrcColor,
  unplayLrcColor,
  textShadow,
  staticTime
} = storeToRefs(osdLyric)

const playerStore = usePlayerStore()
const { resetPlayer } = playerStore
const { outputDevice } = storeToRefs(playerStore)

const localMusicStore = useLocalMusicStore()
const { resetLocalMusic } = localMusicStore

const { restoreDefaultShortcuts, updateShortcut } = useSettingsStore()

const isElectron = window.env?.isElectron || false
const isMac = window.env?.isMac
const isLinux = window.env?.isLinux
const isWindows = window.env?.isWindows

const showTrackInfo = computed({
  get: () => showTrackTimeOrID.value,
  set: (value) => {
    showTrackTimeOrID.value = value
  }
})

const typeOption = computed({
  get: () => type.value,
  set: (value) => {
    type.value = value
  }
})

const modeOption = computed({
  get: () => mode.value,
  set: (value) => {
    mode.value = value
  }
})

const translationOption = computed({
  get: () => translationMode.value,
  set: (value) => {
    translationMode.value = value
  }
})

const nTranslationOption = computed({
  get: () => nTranslationMode.value,
  set: (value) => {
    nTranslationMode.value = value
  }
})

const useLinuxTitleBar = computed({
  get: () => useCustomTitlebar.value,
  set: (value) => {
    useCustomTitlebar.value = value
  }
})

const shortcutInput = ref({
  id: '',
  type: '',
  recording: false
})

const recordedShortcut = ref<any[]>([])

const mainStyle = ref({})

// const mainStyle = computed(() => {
//   return {
//     marginTop: isMac || !useCustomTitlebar.value ? '20px' : '0'
//   }
// })

// const useReplayGain = computed({
//   get: () => replayGain.value,
//   set: (value) => {
//     replayGain.value = value
//   }
// })

const { locale } = useI18n()
const selectLanguage = computed({
  get: () => language.value,
  set: (value) => {
    language.value = value
    locale.value = value
  }
})

const selectOptions = computed({
  get: () => {
    return closeAppOption.value
  },
  set: (value) => {
    closeAppOption.value = value
  }
})

const selectedOutputDevice = computed({
  get: () => {
    const isValidDevice = allOutputDevices.value.find(
      (device) => device.deviceId === outputDevice.value
    )
    if (outputDevice.value === undefined || isValidDevice === undefined) return ''
    return outputDevice.value
  },
  set: (deviceId) => {
    if (deviceId === outputDevice.value || deviceId === undefined) return
    outputDevice.value = deviceId
  }
})

const allOutputDevices = ref<any[]>([])
const getAllOutputDevices = () => {
  navigator.mediaDevices.enumerateDevices().then((devices: any[]) => {
    allOutputDevices.value = devices.filter(
      (device: any) => device.kind === 'audiooutput' && device.deviceId !== 'default'
    )
    if (allOutputDevices.value.length === 0 || allOutputDevices.value[0].label === '') {
      allOutputDevices.value = []
    }
  })
}

const tab = ref('general')
const lyricTab = ref(isWindows ? 'lyric' : 'trayLyric')
const updateTab = (index: number) => {
  const tabs = ['general', 'appearance', 'lyric', 'localTracks', 'shortcut']
  const tabName = tabs[index]
  tab.value = tabName
  slideTop.value = index * 40
}
const slideTop = ref(0)

const chooseDir = () => {
  window.mainApi.invoke('selecteFolder').then((folderPath: string | null) => {
    if (folderPath) scanDir.value = folderPath
  })
}

const updatePadding = inject('updatePadding') as (value: number) => void

const appVersion = ref('Unknown')
const getVersion = () => {
  window.mainApi?.invoke('msgRequestGetVersion').then((result: string) => {
    appVersion.value = `v${result}`
  })
}

const updateAppearance = (mode: string) => {
  appearance.value = mode
  Utils.changeAppearance(mode)
}

const inputValue = ref<number>(lyricWidth.value)
let debounceTimeout
const inputDebounce = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    if (inputValue.value >= 100) lyricWidth.value = inputValue.value
  }, 500)
}

const inputRateValue = ref<number>(scrollRate.value)
let debounceTimeoutRate
const inputRateDebounce = () => {
  if (debounceTimeoutRate) clearTimeout(debounceTimeoutRate)
  debounceTimeoutRate = setTimeout(() => {
    scrollRate.value = inputRateValue.value
  }, 500)
}

const inputFontSizeValue = ref<number>(fontSize.value)
const inputFontSizeDebounce = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    fontSize.value = inputFontSizeValue.value
  }, 500)
}

const inputNFontSizeValue = ref<number>(nFontSize.value)
const inputNValue = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    nFontSize.value = inputNFontSizeValue.value
  }, 500)
}

const deleteLocalMusic = () => {
  resetPlayer()
  resetLocalMusic()
  scanDir.value = ''
  window.mainApi.send('deleteLocalMusicDB')
}

const openOnBrowser = () => {
  const url = 'https://github.com/stark81/media-controls'
  Utils.openExternal(url)
}

const handleShortcutKeydown = (e: KeyboardEvent) => {
  if (shortcutInput.value.recording === false) return
  e.preventDefault()
  if (recordedShortcut.value.find((s) => s.keyCode === e.keyCode)) return
  recordedShortcut.value.push(e)
  if (
    (e.keyCode >= 65 && e.keyCode <= 90) || // A-Z
    (e.keyCode >= 48 && e.keyCode <= 57) || // 0-9
    (e.keyCode >= 112 && e.keyCode <= 123) || // F1-F12
    e.keyCode === 32 || // Space
    ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key) ||
    ['=', '-', '~', '[', ']', ';', "'", ',', '.', '/'].includes(e.key)
  ) {
    saveShortcut()
  }
}

const recordedShortcutComputed = computed(() => {
  let shortcut: string[] = []
  recordedShortcut.value.map((e) => {
    if (e.keyCode >= 65 && e.keyCode <= 90) {
      shortcut.push(e.code.replace('Key', ''))
    } else if (e.key === 'Meta') {
      shortcut.push('Command')
    } else if (['Alt', 'Control', 'Shift'].includes(e.key)) {
      shortcut.push(e.key)
    } else if (e.keyCode >= 48 && e.keyCode <= 57) {
      shortcut.push(e.code.replace('Digit', ''))
    } else if (e.keyCode >= 112 && e.keyCode <= 123) {
      shortcut.push(e.code)
    } else if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      shortcut.push(e.code.replace('Arrow', ''))
    } else if (e.keyCode === 32) {
      shortcut.push('Space')
    } else if (['=', '-', '~', '[', ']', ';', "'", ',', '.', '/'].includes(e.key)) {
      shortcut.push(e.key)
    }
  })
  const sortTable = {
    Control: 1,
    Shift: 2,
    Alt: 3,
    Command: 4
  }
  shortcut = shortcut.sort((a, b) => {
    if (!sortTable[a] || !sortTable[b]) return 0
    if (sortTable[a] - sortTable[b] <= -1) {
      return -1
    } else if (sortTable[a] - sortTable[b] >= 1) {
      return 1
    } else {
      return 0
    }
  })
  return shortcut.join('+')
})

const clickOutside = () => {
  exitRecordShortcut()
}

const exitRecordShortcut = () => {
  if (shortcutInput.value.recording === false) return
  shortcutInput.value = { id: '', type: '', recording: false }
  recordedShortcut.value = []
}

const saveShortcut = () => {
  const { id, type } = shortcutInput.value
  const payload = {
    id,
    type,
    shortcut: recordedShortcutComputed.value
  }
  updateShortcut(payload)
}

const readyToRecordShortcut = (id: string, type: string) => {
  if (type === 'globalShortcut' && !enableGlobalShortcut.value) return
  shortcutInput.value = {
    id,
    type,
    recording: true
  }
  recordedShortcut.value = []
}

const formatShortcut = (shortcut: string) => {
  shortcut = shortcut
    .replaceAll('+', ' + ')
    .replace('Up', '↑')
    .replace('Down', '↓')
    .replace('Left', '←')
    .replace('Right', '→')
  if (language.value === 'zh') {
    shortcut = shortcut.replace('Space', '空格')
  }
  if (isMac) {
    return shortcut
      .replace('CommandOrControl', '⌘')
      .replace('Command', '⌘')
      .replace('Alt', '⌥')
      .replace('Shift', '⇧')
      .replace('Control', '⌃')
  }
  return shortcut.replace('CommandOrControl', 'Ctrl')
}

onMounted(() => {
  mainStyle.value = {
    marginTop: isMac || !useCustomTitlebar.value ? '20px' : '0'
  }
  updatePadding(64)
  getAllOutputDevices()
  getVersion()
})
onBeforeUnmount(() => {
  updatePadding(96)
})
</script>

<style scoped lang="scss">
.system-settings {
  width: 100%;
}
.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-secondary-bg);
  color: var(--color-text);
  padding: 16px 20px;
  border-radius: 16px;
  margin-top: 20px;
  img.avatar {
    border-radius: 50%;
    height: 64px;
    width: 64px;
  }
  img.cvip {
    height: 13px;
    margin-right: 4px;
  }
  .left {
    display: flex;
    align-items: center;
    .info {
      margin-left: 24px;
    }
    .nickname {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .extra-info {
      font-size: 13px;
      .text {
        opacity: 0.68;
      }
      .vip {
        display: flex;
        align-items: center;
      }
    }
  }
  .right {
    .svg-icon {
      height: 18px;
      width: 18px;
      margin-right: 4px;
    }
    button {
      display: flex;
      align-items: center;
      font-size: 18px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 10px;
      padding: 8px 12px;
      opacity: 0.68;
      color: var(--color-text);
      transition: 0.2s;
      margin: {
        right: 12px;
        left: 12px;
      }
      &:hover {
        opacity: 1;
        background: #eaeffd;
        color: #335eea;
      }
      &:active {
        opacity: 1;
        transform: scale(0.92);
        transition: 0.2s;
      }
    }
  }
}
.slide-container {
  position: relative;
  z-index: 1;
}
.main-container {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0 30px 0 180px;
  transition: all 0.3s;
  margin-bottom: 32px;
  .container {
    width: 100%;
    padding-top: 30px;
    min-height: 200px;
    height: 100%;

    .appearance {
      height: 100px;
      width: 150px;
      border-radius: 14px;
      text-align: center;
      img {
        width: 100%;
        height: 100%;
        border-radius: 14px;
        border: 2px solid var(--color-secondary-bg);
      }
    }

    .selected {
      img {
        border: 2px solid var(--color-primary);
      }
    }

    .lyric-tab {
      margin-bottom: 10px;
    }
  }
}
.iconfont {
  width: 100%;
  height: 16px;
  background-color: var(--color-primary);
}
.slideBar {
  width: 100px;
  position: absolute;
  left: 30px;
  top: 30px;
  font-size: 16px;
  font-weight: 600;
  .tab {
    height: 40px;
    display: flex;
    align-items: center;
    margin-left: 0px;
    transition: all, 0.3s;
    // font-size: 14px;
    opacity: 0.7;
    cursor: pointer;
    &:hover {
      opacity: 1;
      color: var(--color-primary);
    }
  }
  .slide {
    position: absolute;
    width: 4px;
    border-radius: 1px;
    transition: all 0.3s;
  }
  .active {
    opacity: 1;
    color: var(--color-primary);
    margin-left: 10px;
    transition: margin 0.3s;
  }
}
#shortcut-table {
  font-size: 14px;
  /* border: 1px solid black; */
  user-select: none;
  color: var(--color-text);
  margin-bottom: 20px;
  .row {
    display: flex;
  }
  .row.row-head {
    opacity: 0.58;
    font-size: 13px;
    font-weight: 500;
  }
  .col {
    min-width: 192px;
    padding: 8px;
    display: flex;
    align-items: center;
    /* border: 1px solid red; */
    &:first-of-type {
      padding-left: 0;
      min-width: 128px;
    }
  }
  .keyboard-input {
    font-weight: 600;
    background-color: var(--color-secondary-bg);
    padding: 8px 12px 8px 12px;
    border-radius: 0.5rem;
    min-width: 146px;
    min-height: 34px;
    box-sizing: border-box;
    &.active {
      color: var(--color-primary);
      background-color: var(--color-primary-bg);
    }
  }
  .restore-default-shortcut {
    margin-top: 12px;
  }
  &.global-disabled {
    .row .col:last-child {
      opacity: 0.48;
    }
    .row.row-head .col:last-child {
      opacity: 1;
    }
  }
  &:focus {
    outline: none;
  }
}
.item {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text);
  padding-bottom: 10px;
  .left {
    padding-right: 6vw;
  }
  .title {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.78;
  }
  .description {
    font-size: 14px;
    opacity: 0.7;
  }
  .color {
    margin-top: 10px;
    text-align: center;
    .text {
      margin-top: 6px;
    }
  }
}
button {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  padding: 8px 12px 8px 12px;
  font-weight: 600;
  border-radius: 8px;
  transition: 0.2;
}
button.lyric-button {
  color: var(--color-text);
  background: unset;
  border-radius: 8px;
  padding: 6px 8px;
  margin-bottom: 12px;
  margin-right: 10px;
  transition: 0.2s;
  opacity: 0.68;
  font-weight: 500;
  cursor: pointer;
  &:hover {
    opacity: 1;
    background: var(--color-secondary-bg);
  }
}
button.lyric-button--selected {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  opacity: 1;
  font-weight: 700;
}
select {
  font-weight: 600;
  border: none;
  min-width: 150px;
  text-align: center;
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  background-color: var(--color-secondary-bg);
  appearance: none;
  color: var(--color-text);
  outline: none;
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

.toggle input:disabled + label:before {
  background-color: var(--color-secondary-bg-disabled);
  cursor: not-allowed;
}
.toggle input:disabled:checked + label:before {
  background-color: var(--color-primary-disabled);
  cursor: not-allowed;
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

input.text-input.margin-right-0 {
  margin-right: 0;
}

input.text-input {
  background: var(--color-secondary-bg);
  border: none;
  margin-right: 22px;
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  color: var(--color-text);
  font-weight: 600;
  font-size: 16px;
  width: 150px;
  text-align: center;
}

.version-info {
  text-align: center;
  color: var(--color-text);
  font-weight: 600;
  .author {
    font-size: 0.9rem;
  }
  .version {
    font-size: 0.88rem;
    opacity: 0.58;
  }
}
</style>
