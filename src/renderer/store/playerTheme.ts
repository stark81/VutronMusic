import { defineStore } from 'pinia'
import { computed, reactive, toRaw } from 'vue'
import type { BgSource, Theme, Option } from '@/types/theme'

export const createBG = () => {
  const result: BgSource[] = [
    {
      type: 'none',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'auto',
      useExtractedColor: false
    },
    {
      type: 'gradient',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'dark',
      useExtractedColor: false
    },
    {
      type: 'blur-image',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'auto',
      useExtractedColor: false
    },
    {
      type: 'dynamic-image',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'auto',
      useExtractedColor: false
    },
    {
      type: 'letter-image',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'dark',
      useExtractedColor: false
    },
    {
      type: 'custom-image',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'auto',
      useExtractedColor: false
    },
    {
      type: 'custom-video',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'auto',
      useExtractedColor: false
    },
    {
      type: 'lottie',
      src: 'snow',
      blur: 0,
      opacity: 100,
      color: 'dark',
      useExtractedColor: false
    },
    {
      type: 'random-folder',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'auto',
      useExtractedColor: false
    },
    {
      type: 'api',
      src: '',
      blur: 50,
      opacity: 60,
      color: 'auto',
      useExtractedColor: false,
      switchMode: 'track',
      timer: 5
    }
  ]

  return result
}

const createTheme = (name: 'default' | 'snow' | 'letter') => {
  let layout: Option['layout'] = 'Creative'
  if (name === 'default') {
    layout = 'Classic'
  } else if (name === 'letter') {
    layout = 'Letter'
  }

  const option: Option = {
    layout,
    bgType: 'gradient',
    senseIdx: 0
  }

  if (name === 'snow') {
    option.bgType = 'lottie'
  } else if (name === 'letter') {
    option.bgType = 'letter-image'
  }

  const theme: Theme = {
    activeLayout: option.layout,
    activeBG: option.bgType,
    senses: {
      Classic: {
        cover: 0,
        align: 'left',
        lyric: {
          font: 'system-ui',
          fontSize: 28,
          gap: 0,
          mask: true,
          wbw: true,
          zoom: true,
          translation: 'tlyric'
        }
      },
      Creative: {
        align: 'left',
        lyric: {
          font: 'system-ui',
          fontSize: 4.5,
          gap: 6,
          align: {
            left: 'hingeFlyIn',
            center: 'splitAndMerge',
            right: 'scatterThrow'
          },
          pos: 'left'
        },
        region: {
          top: 15,
          bottom: 15,
          left: 15,
          right: 15,
          titleTop: 3.9
        }
      },
      Letter: {
        align: 'center',
        lyric: {
          font: 'system-ui',
          fontSize: 4.5,
          gap: 6,
          align: {
            center: 'splitAndMerge'
          }
        }
      }
    },
    backgroundSource: []
  }

  if (option.layout === 'Classic') {
    theme.senses[option.layout].cover = option.senseIdx
  }
  theme.backgroundSource = createBG()

  return theme
}

export const usePlayerThemeStore = defineStore(
  'playerTheme',
  () => {
    const themes = reactive<
      Record<'Classic' | 'Creative' | 'Customize', { name: string; img: string; theme: Theme }[]>
    >({
      Classic: [{ name: '经典布局', img: 'common', theme: createTheme('default') }],
      Creative: [
        { name: '歌词环游', img: 'creative_snow', theme: createTheme('snow') },
        { name: '信笺歌词', img: 'rotate', theme: createTheme('letter') }
      ],
      Customize: []
    })

    const currentPath = reactive({
      mode: 'Classic' as 'Classic' | 'Creative' | 'Customize',
      index: 0
    })

    const activeTheme = computed(() => {
      return themes[currentPath.mode][currentPath.index]
    })

    const activeBG = computed(() => {
      const theme = activeTheme.value.theme
      const bg = theme.backgroundSource.find((b) => b.type === theme.activeBG)!
      return bg
    })

    const senses = computed(() => {
      const theme = activeTheme.value.theme
      return theme.senses
    })

    const resetTheme = () => {
      if (currentPath.mode === 'Customize') return
      const map = { 0: 'default', 1: 'snow', 2: 'letter' } as const
      activeTheme.value.theme = createTheme(map[currentPath.index])
    }

    const saveToCustomize = (name: string, imgPath: string) => {
      const theme = structuredClone(toRaw(activeTheme.value.theme))
      const item = { name, theme, img: imgPath }
      themes.Customize.push(item)
      currentPath.mode = 'Customize'
      currentPath.index = themes.Customize.findIndex((th) => th.name === name)
    }

    return {
      themes,
      currentPath,
      activeTheme,
      activeBG,
      senses,
      resetTheme,
      saveToCustomize
    }
  },
  { persist: false }
)
