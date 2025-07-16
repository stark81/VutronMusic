import { defineStore } from 'pinia'
import { ref, reactive, watch, onMounted, toRaw } from 'vue'
import DefaultShortcuts from '../utils/shortcuts'
import { playlistCategories } from '../utils/common'
import cloneDeep from 'lodash/cloneDeep'
// import snow from '../assets/lottie/snow.json'

export type TranslationMode = 'none' | 'tlyric' | 'rlyric'
export type StreamStatus = 'logout' | 'login' | 'offline'
export type TrackInfoOrder = 'path' | 'online' | 'embedded'
type TextAlign = 'start' | 'center' | 'end'
type BackgroundEffect = 'none' | 'true' | 'blur' | 'dynamic'

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const enabledPlaylistCategories = playlistCategories.filter((c) => c.enable).map((c) => c.name)
    const theme = reactive({
      appearance: 'auto', // as 'auto' | 'dark' | 'light',
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
      replayGain: false,
      useInnerInfoFirst: false,
      trackInfoOrder: ['online', 'path', 'embedded'] as TrackInfoOrder[],
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
      preventSuspension: false,
      lyricBackground: 'true' as BackgroundEffect,
      enabledPlaylistCategories,
      fadeDuration: 0.5 // 音频淡入淡出时长（秒）
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
      isTWordByWord: boolean
      nTranslationMode: TranslationMode
      textAlign: TextAlign
      useMask: boolean
    }>({
      nFontSize: 28,
      isNWordByWord: true,
      isTWordByWord: true,
      nTranslationMode: 'tlyric',
      textAlign: 'start',
      useMask: true
    })

    const osdLyric = reactive({
      show: false,
      opacity: 0.2,
      fontSize: 24,
      playedColor: 'rgba(57, 203, 255, 1)',
      unplayedColor: 'rgba(255, 255, 255, 0.8)',
      alwaysOnTop: false,
      lock: false,
      font: '' 
    })

    const unblockNeteaseMusic = reactive({
      enable: true,
      source: 'kuwo, kugou, ytdlp, qq, bilibili, pyncmd, migu',
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

    const playerTheme = reactive({
      common: [
        { name: '默认' as const, selected: true, font: '', img: 'common' },
        { name: '旋转封面' as const, selected: false, font: '', img: 'rotate' }
      ],
      creative: [
        // { name: '信笺歌词' as const, selected: false, font: '' },
        {
          name: '歌词环游' as const,
          selected: false,
          font: '',
          senseIndex: 0,
          img: 'creative_snow'
        }
      ]
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
        window.mainApi?.send('setStoreSettings', { unblockNeteaseMusic: cloneDeep(toRaw(value)) })
      },
      {
        deep: true
      }
    )

    watch(
      autoCacheTrack,
      (value) => {
        window.mainApi?.send('setStoreSettings', { autoCacheTrack: cloneDeep(toRaw(value)) })
      },
      { deep: true }
    )

    watch(
      () => localMusic.useInnerInfoFirst,
      (newValue) => {
        window.mainApi?.send('setStoreSettings', { innerFirst: newValue })
      }
    )

    watch(
      () => localMusic.trackInfoOrder,
      (value) => {
        window.mainApi?.send('setStoreSettings', { trackInfoOrder: toRaw(value) })
      }
    )

    watch(
      () => tray.showControl || tray.showLyric,
      (newValue) => {
        window.mainApi?.send('setStoreSettings', { enableTrayMenu: !newValue })
      }
    )

    watch(
      () => tray.showTray,
      (value) => {
        window.mainApi?.send('setStoreSettings', { showTray: value })
      }
    )

    watch(enableGlobalShortcut, (value) => {
      window.mainApi?.send('setStoreSettings', { enableGlobalShortcut: value })
    })

    watch(
      () => general.language,
      (newValue) => {
        window.mainApi?.send('setStoreSettings', { lang: newValue })
      }
    )

    watch(
      () => general.preventSuspension,
      (value) => {
        if (!value) {
          window.mainApi?.send('update-powersave', false)
        }
      }
    )

    watch(
      () => general.musicQuality,
      (newValue) => {
        window.mainApi?.send('setStoreSettings', { musicQuality: newValue })
      }
    )

    watch(
      () => general.closeAppOption,
      (newValue) => {
        window.mainApi?.send('setStoreSettings', { closeAppOption: newValue })
      }
    )

    watch(
      () => general.useCustomTitlebar,
      (val) => {
        window.mainApi?.send('setStoreSettings', { useCustomTitlebar: val })
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
      window.mainApi?.send('setStoreSettings', { shortcuts: cloneDeep(toRaw(shortcuts.value)) })
    }

    const restoreDefaultShortcuts = () => {
      shortcuts.value = cloneDeep(DefaultShortcuts)
      window.mainApi?.send('setStoreSettings', { shortcuts: cloneDeep(toRaw(shortcuts.value)) })
    }

    window.mainApi?.on('resume', () => {
      setTimeout(() => {
        const trayMenu = !(tray.showControl || tray.showLyric)
        window.mainApi?.send('setStoreSettings', {
          enableTrayMenu: trayMenu
        })
      }, 5000)
    })

    onMounted(() => {
      const trayMenu = !(tray.showControl || tray.showLyric)
      window.mainApi?.send('setStoreSettings', {
        lang: general.language,
        enableGlobalShortcut: enableGlobalShortcut.value,
        shortcuts: toRaw(shortcuts.value),
        enableTrayMenu: trayMenu,
        innerFirst: localMusic.useInnerInfoFirst,
        musicQuality: general.musicQuality,
        closeAppOption: general.closeAppOption,
        useCustomTitlebar: general.useCustomTitlebar,
        trackInfoOrder: toRaw(localMusic.trackInfoOrder)
      })
      if (window.env?.isWindows) return
      setInterval(() => {
        const trayMenu = !(tray.showControl || tray.showLyric)
        window.mainApi?.send('setStoreSettings', {
          enableTrayMenu: trayMenu
        })
      }, 60000)
    })
    return {
      theme,
      general,
      localMusic,
      tray,
      playerTheme,
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
