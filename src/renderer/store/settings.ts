import { defineStore } from 'pinia'
import { ref, reactive, watch, onMounted, toRaw } from 'vue'
import DefaultShortcuts from '../utils/shortcuts'
import { playlistCategories } from '../utils/common'

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const enabledPlaylistCategories = playlistCategories.filter((c) => c.enable).map((c) => c.name)
    const theme = ref({
      appearance: 'auto', // auto | dark | light
      colors: {}
    })
    const localMusic = reactive({
      scanDir: '',
      replayGain: true,
      useInnerInfoFirst: false,
      scanning: false
    })
    const general = reactive({
      language: 'zh',
      showTimeOrID: 'time',
      subTitleDefault: true,
      showTrackTimeOrID: 'time',
      musicQuality: 320000,
      musicLanguage: 'all',
      enabledPlaylistCategories
    })

    const tray = reactive({
      showLyric: true,
      showControl: true,
      lyricWidth: 192,
      scrollRate: 34
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

    const shortcuts = ref<any[]>(DefaultShortcuts)

    watch(
      () => localMusic.useInnerInfoFirst,
      (newValue) => {
        window.mainApi.send('setStoreSettings', { innerFirst: newValue })
      }
    )

    watch(
      () => !tray.showControl && !tray.showLyric,
      (newValue) => {
        window.mainApi.send('setStoreSettings', { enableTrayMenu: newValue })
      }
    )

    watch(
      () => shortcuts.value,
      (newValue) => {
        window.mainApi.send('setStoreSettings', { shortcuts: toRaw(newValue) })
      }
    )

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

    onMounted(() => {
      const trayMenu = !tray.showControl && !tray.showLyric
      window.mainApi.send('setStoreSettings', {
        lang: general.language,
        shortcuts: toRaw(shortcuts.value),
        enableTrayMenu: trayMenu,
        innerFirst: localMusic.useInnerInfoFirst,
        musicQuality: general.musicQuality
      })
    })
    return { theme, general, localMusic, tray, shortcuts, osdLyric, togglePlaylistCategory }
  },
  { persist: true }
)
