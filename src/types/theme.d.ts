import { TranslationMode } from './music'

export type LayoutMode = 'Classic' | 'Creative' | 'Letter'

export type ColorOption = 'light' | 'dark' | 'auto'

export type TextAlign = 'left' | 'right' | 'center'

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
      /**
       * 封面类型，0为经典，1为圆形，2为圆形旋转
       */
      cover: 0 | 1 | 2
      align: TextAlign
      lyric: {
        font: string
        fontSize: number
        gap: number
        mask: boolean
        wbw: boolean
        zoom: boolean
        translation: TranslationMode
      }
    }
    Creative: {
      /**
       * 当前歌词的布局
       */
      align: TextAlign
      /**
       * fontSize的单位为cqw, gap的单位为px
       */
      lyric: {
        font: string
        fontSize: number
        gap: number
        align: {
          left: AniName
          center: AniName
          right: AniName
        }
        pos: TextAlign
      }
      region: { top: number; bottom: number; left: number; right: number; titleTop: number }
    }
    Letter: {
      align: 'center'
      /**
       * fontSize的单位为cqw, gap的单位为px
       */
      lyric: {
        font: string
        fontSize: number
        gap: number
        align: {
          center: AniName
        }
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
