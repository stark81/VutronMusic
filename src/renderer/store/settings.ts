import { defineStore } from 'pinia'
import { ref, reactive, watch, onMounted, toRaw } from 'vue'
import DefaultShortcuts from '../utils/shortcuts'
import { playlistCategories } from '../utils/common'
import cloneDeep from 'lodash/cloneDeep'

export type TranslationMode = 'none' | 'tlyric' | 'rlyric'
export type StreamStatus = 'logout' | 'login' | 'offline'

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const enabledPlaylistCategories = playlistCategories.filter((c) => c.enable).map((c) => c.name)
    const theme = reactive({
      appearance: 'auto', // auto | dark | light
      colors: [
        { name: 'blue', color: 'rgba(51, 94, 234, 1)', selected: true },
        { name: 'purple', color: 'rgba(136, 84, 208, 1)', selected: false },
        { name: 'orange', color: 'rgba(234, 136, 51, 1)', selected: false },
        { name: 'cyan', color: 'rgba(29, 185, 181, 1)', selected: false },
        { name: 'Customize', color: 'rgba(0, 0, 0, 0)', selected: false }
      ]
    })
    const localMusic = reactive({
      enble: true,
      scanDir: '',
      replayGain: true,
      useInnerInfoFirst: false,
      scanning: false
    })
    const general = reactive({
      language: 'zh',
      subTitleDefault: true,
      showTrackTimeOrID: 'time',
      musicQuality: 320000,
      musicLanguage: 'all',
      closeAppOption: 'ask',
      useCustomTitlebar: false,
      enabledPlaylistCategories
    })

    const tray = reactive({
      showLyric: true,
      showControl: true,
      lyricWidth: 192,
      scrollRate: 34,
      enableExtension: true,
      showTray: true
    })

    const normalLyric = reactive<{
      nFontSize: number
      isNWordByWord: boolean
      nTranslationMode: TranslationMode
    }>({
      nFontSize: 28,
      isNWordByWord: true,
      nTranslationMode: 'tlyric'
    })

    const osdLyric = reactive({
      show: false,
      opacity: 0.2,
      fontSize: 24,
      playedColor: 'rgba(57, 203, 255, 1)',
      unplayedColor: 'rgba(255, 255, 255, 0.8)',
      alwaysOnTop: false,
      lock: false
    })

    const unblockNeteaseMusic = reactive({
      enable: true,
      source: '',
      enableFlac: true,
      orderFirst: true,
      jooxCookie: '',
      qqCookie: ''
    })

    const autoCacheTrack = reactive({
      enable: false,
      sizeLimit: 512 as boolean | number,
      number: 0
    })

    const enableGlobalShortcut = ref(false)

    const shortcuts =
      ref<{ id: string; name: string; shortcut: string; globalShortcut: string }[]>(
        DefaultShortcuts
      )

    watch(
      () => theme.colors,
      (newValue) => {
        const selectedColor = newValue.find((c) => c.selected)
        document.documentElement.style.setProperty(
          '--color-primary',
          selectedColor ? selectedColor.color : 'rgba(51, 94, 234, 1)'
        )
      },
      {
        deep: true
      }
    )

    watch(
      unblockNeteaseMusic,
      (value) => {
        window.mainApi.send('setStoreSettings', { unblockNeteaseMusic: cloneDeep(toRaw(value)) })
      },
      {
        deep: true
      }
    )

    watch(
      autoCacheTrack,
      (value) => {
        window.mainApi.send('setStoreSettings', { autoCacheTrack: cloneDeep(toRaw(value)) })
      },
      { deep: true }
    )

    watch(
      () => localMusic.useInnerInfoFirst,
      (newValue) => {
        window.mainApi.send('setStoreSettings', { innerFirst: newValue })
      }
    )

    watch(
      () => tray.showControl || tray.showLyric,
      (newValue) => {
        window.mainApi.send('setStoreSettings', { enableTrayMenu: !newValue })
      }
    )

    watch(
      () => tray.showTray,
      (value) => {
        window.mainApi.send('setStoreSettings', { showTray: value })
      }
    )

    watch(enableGlobalShortcut, (value) => {
      window.mainApi.send('setStoreSettings', { enableGlobalShortcut: value })
    })

    watch(
      () => general.language,
      (newValue) => {
        window.mainApi.send('setStoreSettings', { lang: newValue })
      }
    )

    watch(
      () => general.musicQuality,
      (newValue) => {
        window.mainApi.send('setStoreSettings', { musicQuality: newValue })
      }
    )

    watch(
      () => general.closeAppOption,
      (newValue) => {
        window.mainApi.send('setStoreSettings', { closeAppOption: newValue })
      }
    )

    watch(
      () => general.useCustomTitlebar,
      (val) => {
        window.mainApi.send('setStoreSettings', { useCustomTitlebar: val })
      }
    )

    const togglePlaylistCategory = (name: string) => {
      const index = general.enabledPlaylistCategories.findIndex((c) => c === name)
      if (index !== -1) {
        general.enabledPlaylistCategories = general.enabledPlaylistCategories.filter(
          (c) => c !== name
        )
      } else {
        general.enabledPlaylistCategories.push(name)
      }
    }

    const updateShortcut = ({ id, type, shortcut }) => {
      const newShortcut = shortcuts.value.find((s) => s.id === id)!
      newShortcut[type] = shortcut
      shortcuts.value = shortcuts.value.map((s) => (s.id === id ? newShortcut : s))
      window.mainApi.send('setStoreSettings', { shortcuts: cloneDeep(toRaw(shortcuts.value)) })
    }

    const restoreDefaultShortcuts = () => {
      shortcuts.value = cloneDeep(DefaultShortcuts)
      window.mainApi.send('setStoreSettings', { shortcuts: cloneDeep(toRaw(shortcuts.value)) })
    }

    onMounted(() => {
      const trayMenu = !(tray.showControl || tray.showLyric)
      window.mainApi.send('setStoreSettings', {
        lang: general.language,
        enableGlobalShortcut: enableGlobalShortcut.value,
        shortcuts: toRaw(shortcuts.value),
        enableTrayMenu: trayMenu,
        innerFirst: localMusic.useInnerInfoFirst,
        musicQuality: general.musicQuality,
        closeAppOption: general.closeAppOption,
        useCustomTitlebar: general.useCustomTitlebar
      })
    })
    return {
      theme,
      general,
      localMusic,
      tray,
      enableGlobalShortcut,
      shortcuts,
      normalLyric,
      osdLyric,
      autoCacheTrack,
      unblockNeteaseMusic,
      updateShortcut,
      togglePlaylistCategory,
      restoreDefaultShortcuts
    }
  },
  { persist: true }
)
