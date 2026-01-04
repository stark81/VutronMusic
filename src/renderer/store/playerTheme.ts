import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'
import type { BgSource, Theme, Option } from '@/types/theme'

const createBG = () => {
  const result: BgSource[] = [
    { type: 'gradient', color: 'dark' },
    { type: 'blur-image', blur: 50, bright: 100, color: 'auto', size: 140 },
    { type: 'dynamic-image', blur: 50, bright: 100, color: 'auto', size: 140 },
    { type: 'letter-image', blur: 50, bright: 100, color: 'dark', size: 100 },
    { type: 'custom-image', src: '', blur: 50, bright: 100, color: 'auto', size: 100 },
    {
      type: 'custom-video',
      src: '',
      blur: 50,
      bright: 100,
      color: 'auto',
      useExtractedColor: false
    },
    {
      type: 'lottie',
      src: 'snow',
      preset: ['snow', 'sunshine'],
      blur: 0,
      bright: 100,
      color: 'dark'
    },
    { type: 'random-folder', src: '', color: 'auto' },
    { type: 'api', src: '', switchMode: 'track', timer: 5, color: 'auto' }
  ]

  return result
}

export const createTheme = (name: 'default' | 'snow' | 'letter') => {
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
      Classic: { active: 0, font: 'system-ui' },
      Creative: {
        active: 0,
        font: 'system-ui',
        animation: {
          0: 'hingeFlyIn',
          1: 'focusRise',
          2: 'scatterThrow'
        },
        region: {
          top: '15vh',
          bottom: '15vh',
          left: '15vw',
          right: '15vw'
        }
      },
      Letter: {
        active: 0,
        font: 'system-ui',
        animation: {
          0: 'splitAndMerge'
        }
      }
    },
    backgroundSource: []
  }

  theme.senses[option.layout].active = option.senseIdx
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

    const saveToCustomize = (name: string) => {
      const theme = structuredClone(activeTheme.value.theme)
      const item = { name, theme, img: activeTheme.value.img }
      themes.Customize.push(item)
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
