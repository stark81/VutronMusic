export type LayoutMode = 'Classic' | 'Creative' | 'Letter'

export type AniName =
  | 'hingeFlyIn'
  | 'focusRise'
  | 'scatterThrow'
  | 'flipReveal'
  | 'waveDrift'
  | 'splitAndMerge'

export type BgType =
  | 'gradient'
  | 'blur-image'
  | 'dynamic-image'
  | 'letter-image'
  | 'custom-image'
  | 'custom-video'
  | 'lottie'
  | 'random-folder'
  | 'api'

type BgSource =
  | { type: 'gradient'; color: 'dark' }
  | {
      type: 'blur-image' | 'dynamic-image' | 'letter-image'
      blur: number
      bright: number
      color: 'light' | 'dark' | 'auto'
      size: number
    }
  | {
      type: 'custom-image'
      src: string
      blur?: number
      bright?: number
      color?: 'light' | 'dark' | 'auto'
      size: number
    }
  | {
      type: 'lottie'
      src: string
      blur?: number
      bright?: number
      color?: 'light' | 'dark' | 'auto'
      preset?: ['snow', 'sunshine']
    }
  | {
      type: 'custom-video'
      src: string
      blur?: number
      bright?: number
      color?: 'light' | 'dark' | 'auto'
      useExtractedColor: boolean
    }
  | {
      type: 'random-folder'
      src: string
      color?: 'auto'
    }
  | {
      type: 'api'
      src: string
      switchMode: 'time' | 'track'
      timer?: number
      color?: 'light' | 'dark' | 'auto'
    }

export type Theme = {
  activeLayout: LayoutMode
  activeBG: BgType
  senses: {
    Classic: {
      active: 0 | 1 | 2
      font: string
    }
    Creative: {
      active: 0 | 1 | 2
      font: string
      animation: {
        0: AniName
        1: AniName
        2: AniName
      }
      region: { top: string; bottom: string; left: string; right: string }
    }
    Letter: {
      active: 0
      font: string
      animation: {
        0: AniName
      }
    }
  }
  backgroundSource: BgSource[]
}

export type Option = {
  layout: LayoutMode
  bgType: BgType
  senseIdx: 0 | 1 | 2
}
