import { defineStore } from 'pinia'
import { ref, reactive, watch, toRaw, onMounted } from 'vue'
import DefaultShortcuts from '../utils/shortcuts'
import { playlistCategories } from '../utils/common'
import cloneDeep from 'lodash/cloneDeep'
import { useLocalMusicStore } from './localMusic'
import { TrackInfoOrder, Appearance } from '@/types/music'

type BackgroundEffect = 'none' | 'true' | 'blur' | 'dynamic' | 'customize'
type StandardBackgroundEffect = Exclude<BackgroundEffect, 'customize'>
export type bgType = 'image' | 'video' | 'folder' | 'api'

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const localMusicStore = useLocalMusicStore()
    const { scanLocalMusic } = localMusicStore

    const enabledPlaylistCategories = playlistCategories.filter((c) => c.enable).map((c) => c.name)
    const theme = reactive({
      appearance: 'auto' as Appearance,
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
      embedCoverArt: 0, // 0: 不嵌入, 1: 内嵌, 2: 歌曲路径下, 3: 两者都嵌入
      embedStyle: 0, // 0: 跳过，1：覆盖
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
      savedBackground: 'true' as StandardBackgroundEffect,
      enabledPlaylistCategories,
      fadeDuration: 0.2, // 音频淡入淡出时长（秒）
      showBanner: true,
      autoUpdate: true,
      jumpToLyricBegin: true,
      trayColor: 0 // 0: 彩色, 1: 白色, 2: 黑色, 3: 跟随系统
    })

    const tray = reactive({
      showLyric: true,
      showControl: true,
      lyricWidth: 192,
      scrollRate: 34,
      enableExtension: true,
      showTray: true
    })

    const unblockNeteaseMusic = reactive({
      enable: true,
      source: 'bodian, kuwo, kugou, ytdlp, qq, bilibili, pyncmd, migu',
      enableFlac: true,
      orderFirst: true,
      jooxCookie: '',
      qqCookie: ''
    })

    const autoCacheTrack = reactive({
      enable: false,
      path: '',
      sizeLimit: 512 as boolean | number,
      number: 0
    })

    const enableGlobalShortcut = ref(false)

    const shortcuts =
      ref<{ id: string; name: string; shortcut: string; globalShortcut: string }[]>(
        DefaultShortcuts
      )

    const misc = reactive({
      enableAmuseServer: true,
      enableDiscordRichPresence: false,
      lastfm: { enable: false, name: '' },
      proxy: { type: 0, address: '', port: '' },
      realIp: { enable: false, ip: '' }
    })

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
      () => localMusic.scanDir,
      () => {
        scanLocalMusic()
      }
    )

    watch(
      () => localMusic.embedCoverArt,
      (value) => {
        window.mainApi?.send('setStoreSettings', { embedCoverArt: value })
      }
    )

    watch(
      () => localMusic.embedStyle,
      (value) => {
        window.mainApi?.send('setStoreSettings', { embedStyle: value })
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
      async (value) => {
        if (!value.path) {
          await window.mainApi?.invoke('get-cache-path').then((result: string) => {
            value.path = result
          })
        }
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
      () => misc.proxy,
      (value) => {
        window.mainApi?.send('setStoreSettings', { proxy: toRaw(value) })
      },
      {
        deep: true
      }
    )

    watch(
      () => !(tray.showControl || tray.showLyric),
      (newValue) => {
        window.mainApi?.send('setStoreSettings', { enableTrayMenu: newValue })
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
      () => general.lyricBackground,
      (value, oldValue) => {
        if (oldValue !== 'customize') {
          general.savedBackground = oldValue
        }
      }
    )

    watch(
      () => general.language,
      (newValue) => {
        window.mainApi?.send('setStoreSettings', { lang: newValue })
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

    watch(
      () => general.trayColor,
      (val) => {
        window.mainApi?.send('setStoreSettings', { trayColor: val })
      }
    )

    watch(
      () => misc.enableAmuseServer,
      (val) => {
        window.mainApi?.send('setStoreSettings', { enableAmuseServer: val })
      }
    )

    const lastfmConnect = () => {
      if (misc.lastfm.enable) return
      window.mainApi?.invoke('lastfm-auth').then((result: { name: string }) => {
        misc.lastfm.enable = result.name !== ''
        misc.lastfm.name = result.name
      })
    }

    const lastfmDisconnect = () => {
      if (!misc.lastfm.enable) return
      misc.lastfm.enable = false
      misc.lastfm.name = ''
      window.mainApi?.send('disconnect-lastfm')
    }

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

    const deleteCacheTracks = async (clearAll: boolean = false): Promise<boolean> => {
      return await window.mainApi?.invoke('clearCacheTracks', clearAll)
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
      window.mainApi?.invoke('get-lastfm-session').then((result: { name: string }) => {
        misc.lastfm.name = result.name
        misc.lastfm.enable = result.name !== ''
      })
      if (!autoCacheTrack.path) {
        window.mainApi?.invoke('get-cache-path').then((result: string) => {
          autoCacheTrack.path = result
        })
      }
      deleteCacheTracks(false)
    })

    return {
      theme,
      general,
      localMusic,
      tray,
      enableGlobalShortcut,
      shortcuts,
      misc,
      autoCacheTrack,
      unblockNeteaseMusic,
      updateShortcut,
      deleteCacheTracks,
      togglePlaylistCategory,
      restoreDefaultShortcuts,
      lastfmConnect,
      lastfmDisconnect
    }
  },
  {
    persist: true
  }
)
