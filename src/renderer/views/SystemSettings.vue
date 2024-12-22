<template>
  <div class="system-settings" :style="mainStyle">
    <div v-if="user.userId" class="user-info">
      <div class="left">
        <img class="avatar" :src="user.avatarUrl" loading="lazy" />
        <div class="info">
          <div class="nickname">{{ user.nickname }}</div>
          <div class="extra-info">
            <span v-if="user.vipType !== 0" class="vip"
              ><img
                class="cvip"
                src="data:image/png;base64,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"
                loading="lazy"
              />
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
        <div v-if="isMac" class="tab" :class="{ active: tab === 'tray' }" @click="updateTab(2)">{{
          $t('settings.nav.tray')
        }}</div>
        <div
          class="tab"
          :class="{ active: tab === 'localTracks' }"
          @click="updateTab(isMac ? 3 : 2)"
          >{{ $t('settings.nav.localMusic') }}</div
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
          <div v-if="isLinux" class="item">
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
        <div v-if="isElectron" v-show="tab === 'tray'" key="tray">
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
              <div class="description"> {{ $t('settings.tray.lyricScrollFrameRate.desc') }}</div>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, computed, inject, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../store/settings'
import { usePlayerStore } from '../store/player'
import { useLocalMusicStore } from '../store/localMusic'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'
import { doLogout } from '../utils/auth'
import SvgIcon from '../components/SvgIcon.vue'
import Utils from '../utils'

const settingsStore = useSettingsStore()
const { localMusic, general, tray, theme } = storeToRefs(settingsStore)
const { scanDir, replayGain, useInnerInfoFirst } = toRefs(localMusic.value)
const { showTrackTimeOrID, useCustomTitlebar, language, closeAppOption } = toRefs(general.value)
const { appearance } = toRefs(theme.value)
const { showLyric, showControl, lyricWidth, scrollRate } = toRefs(tray.value)

const dataStore = useDataStore()
const { user } = storeToRefs(dataStore)

const playerStore = usePlayerStore()
const { resetPlayer } = playerStore
const { outputDevice } = storeToRefs(playerStore)

const localMusicStore = useLocalMusicStore()
const { resetLocalMusic } = localMusicStore

const isElectron = window.env?.isElectron || false
const isMac = window.env?.isMac
const isLinux = window.env?.isLinux

const showTrackInfo = computed({
  get: () => showTrackTimeOrID.value,
  set: (value) => {
    showTrackTimeOrID.value = value
  }
})

const useLinuxTitleBar = computed({
  get: () => useCustomTitlebar.value,
  set: (value) => {
    useCustomTitlebar.value = value
  }
})

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
const updateTab = (index: number) => {
  const tabs = ['general', 'appearance', 'localTracks']
  if (isMac) {
    tabs.splice(2, 0, 'tray')
  }
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

const deleteLocalMusic = () => {
  resetPlayer()
  resetLocalMusic()
  scanDir.value = ''
  window.mainApi.send('deleteLocalMusicDB')
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
  margin: 20px 0;
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
  .container {
    width: 100%;
    padding-top: 30px;
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
}
button {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  padding: 8px 12px 8px 12px;
  font-weight: 600;
  border-radius: 8px;
  transition: 0.2;
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
