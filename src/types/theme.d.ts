export type LayoutMode = 'Classic' | 'Creative' | 'Letter'

export type ColorOption = 'light' | 'dark' | 'auto'

export type AniName =
  | 'hingeFlyIn'
  | 'focusRise'
  | 'scatterThrow'
  | 'flipReveal'
  | 'waveDrift'
  | 'splitAndMerge'

export type BgType =
  | 'none'
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
  | {
      type: 'none'
      src: string
      blur: number
      opacity: number
      color: 'auto'
      useExtractedColor: boolean
    }
  | {
      type: 'gradient'
      src: string
      blur: number
      opacity: number
      color: 'dark'
      useExtractedColor: boolean
    }
  | {
      type: 'lottie'
      src: string
      blur: number
      opacity: number
      color: 'light' | 'dark'
      useExtractedColor: boolean
    }
  | {
      type:
        | 'blur-image'
        | 'dynamic-image'
        | 'letter-image'
        | 'custom-image'
        | 'custom-video'
        | 'random-folder'
      src: string
      blur: number
      opacity: number
      color: 'light' | 'dark' | 'auto'
      useExtractedColor: boolean
    }
  | {
      type: 'api'
      src: string
      blur: number
      opacity: number
      color: 'light' | 'dark' | 'auto'
      useExtractedColor: boolean
      switchMode: 'track' | 'time'
      timer: number
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
      region: { top: string; bottom: string; left: string; right: string; titleTop: string }
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
