<template>
  <div class="lyric-line active">
    <span
      v-for="(lWord, index) in item.lyric.info!"
      :key="`${lWord.word}-${index}`"
      ref="font"
      :data-index="index"
      >{{ lWord.word }}</span
    >
  </div>
  <div v-if="translationInfo" class="translation">
    <span
      v-for="(tWord, idx) in translationInfo"
      :key="`${tWord.word}-${idx}`"
      ref="tFont"
      :data-index="idx"
      >{{ tWord.word }}</span
    >
  </div>
</template>

<script setup lang="ts">
import { lyricLine, TranslationMode, word } from '@/types/music.d'
import { computed, onMounted, toRefs, watch, onBeforeUnmount, useTemplateRef } from 'vue'

// interface WordAnimation {
//   dom: HTMLElement
//   start: number
//   end: number
//   animation: Animation
// }

const props = withDefaults(
  defineProps<{
    item: lyricLine
    translationMode: TranslationMode
    playing: boolean
    playbackRate?: number
    seek: number
    isMini?: boolean
  }>(),
  {
    offset: 0,
    playbackRate: 1.0
  }
)

const { translationMode, playing, playbackRate } = toRefs(props)

const fonts = useTemplateRef('font')
const tFonts = useTemplateRef('tFont')

const lyricMap: Record<TranslationMode, string> = {
  tlyric: 'tlyric',
  rlyric: 'rlyric',
  none: 'none'
}

const animations = computed(() => {
  const line = props.item

  const ans = fonts.value?.map((span, index) => {
    const font = line.lyric.info![index]
    const start = font.start
    const end = font.end

    const an = createAnimation(span, end - start)
    return { dom: span, animation: an, start, end }
  })

  const _ans = tFonts.value
    ? tFonts.value.map((span, index) => {
        const font = translationInfo.value![index]
        const start = font.start
        const end = font.end

        const an = createAnimation(span, end - start)
        return { dom: span, animation: an, start, end }
      })
    : null

  return { lyric: ans, translation: _ans }
})

const translationInfo = computed(() => {
  const modeKey = lyricMap[translationMode.value] as keyof lyricLine
  return (props.item[modeKey] as { text: string; info?: word[] })?.info
})

const createAnimation = (dom: HTMLElement, duration: number) => {
  const effect = new KeyframeEffect(
    dom,
    [{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }],
    {
      duration: Math.max(duration / playbackRate.value, 0),
      easing: 'linear',
      fill: 'forwards'
    }
  )
  return new Animation(effect, document.timeline)
}

// watch(
//   () => animations.translation,
//   (value) => {
//     console.log('====1====', value)
//     value?.animation.finish()
//   }
// )

watch(playing, (value) => {
  if (value) {
    //
  } else {
    //
  }
})

onMounted(() => {
  console.log('====1===', animations.value)
})

onBeforeUnmount(() => {
  // animations.lyric?.animation.finish()
  // animations.translation?.animation.finish()
  // animations.lyric = null
  // animations.translation = null
})
</script>
