<template>
  <div class="line" :class="{ active: isActive }">
    <div class="lyric-line">
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
  </div>
</template>

<script setup lang="ts">
import { lyricLine, TranslationMode, word } from '@/types/music.d'
import {
  computed,
  onMounted,
  toRefs,
  watch,
  reactive,
  onBeforeUnmount,
  nextTick,
  useTemplateRef
} from 'vue'

interface WordAnimation {
  dom: HTMLElement
  start: number
  end: number
  animation: Animation
}

const props = withDefaults(
  defineProps<{
    item: lyricLine
    translationMode: TranslationMode
    playing: boolean
    fontSize: number
    unplayedColor: string
    playingColor: string
    playbackRate?: number
    fontIndex: number
    tFontIndex?: number
    isActive: boolean
    fadeDuration: number
  }>(),
  {
    fontIndex: 0,
    tFontIndex: -1,
    offset: 0,
    playbackRate: 1.0
  }
)

const { translationMode, playbackRate, playing } = toRefs(props)

const font = useTemplateRef('font')
const tFont = useTemplateRef('tFont')

const lyricMap: Record<TranslationMode, string> = {
  tlyric: 'tlyric',
  rlyric: 'rlyric',
  none: 'none'
}

const allAnimations = reactive<{
  lyric: WordAnimation[]
  translation: WordAnimation[] | null
}>({
  lyric: [],
  translation: null
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

const initAnimations = (type: 'lyric' | 'translation') => {
  const isLyric = type === 'lyric'
  const info = isLyric ? props.item.lyric.info : translationInfo.value

  // 这里 的音译如果不按照 data.index 来排序的话，会出现首行顺序错误的问题；
  const spans =
    (isLyric
      ? font.value?.slice().sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
      : tFont.value?.slice().sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))) ||
    []

  allAnimations[type]?.forEach((an) => an.animation.finish())

  if (!info || spans.length === 0) {
    // @ts-ignore
    allAnimations[type] = isLyric ? [] : null
    return
  }

  allAnimations[type] = spans.map((span, index) => {
    const font = info![index]
    const duration = font.end - font.start
    const an = createAnimation(span, duration)
    return { dom: span, start: font.start, end: font.end, animation: an }
  })
}

watch(translationMode, async () => {
  allAnimations.translation?.forEach((an) => an.animation.finish())
  allAnimations.translation = null
  await nextTick()
  initAnimations('translation')
  await nextTick()
  updateFontStatus('translation', props.tFontIndex)
})

watch(
  () => props.fontIndex,
  (value) => {
    nextTick(() => {
      updateFontStatus('lyric', value)
    })
  }
)

watch(
  () => props.tFontIndex,
  (value) => {
    if (props.translationMode === 'rlyric') {
      console.log('====1====', value)
    }
    nextTick(() => {
      updateFontStatus('translation', value)
    })
  }
)

watch(playing, (value) => {
  if (value) {
    allAnimations.lyric[props.fontIndex]?.animation.play()
    if (allAnimations.translation) {
      allAnimations.translation[props.tFontIndex]?.animation.play()
    }
  } else {
    allAnimations.lyric?.forEach((an) => an.animation.pause())
    allAnimations.translation?.forEach((an) => an.animation.pause())
  }
})

const updateFontStatus = (type: 'lyric' | 'translation', index: number) => {
  const ans = allAnimations[type]
  if (!ans || !Array.isArray(ans)) return

  for (let i = 0; i < ans.length; i++) {
    const font = ans[i]
    if (!font) continue

    if (i < index) {
      if (font.dom.style.backgroundSize !== '100% 100%') {
        font.dom.style.backgroundSize = '100% 100%'
      }
      font.animation.finish()
    } else if (i > index) {
      if (font.dom.style.backgroundSize !== '0% 100%') {
        font.dom.style.backgroundSize = '0% 100%'
      }
      font.animation.cancel()
    } else if (i === index) {
      const driftTime = 0

      font.animation.currentTime = driftTime

      if (playing.value && font.animation.playState !== 'running') {
        font.animation.play()
      }
    }
  }
}

onMounted(() => {
  initAnimations('lyric')
  initAnimations('translation')
  nextTick(() => {
    updateFontStatus('lyric', props.fontIndex)
    updateFontStatus('translation', props.tFontIndex)
  })
})

onBeforeUnmount(() => {
  allAnimations.lyric.forEach((an) => an.animation.finish())
  allAnimations.translation?.forEach((an) => an.animation.finish())

  allAnimations.lyric = []
  allAnimations.translation = null
})
</script>

<style scoped lang="scss">
.line {
  border-radius: 12px;
  margin: 2px 0;
  user-select: none;
  padding: 12px;
  font-weight: 600;

  .lyric-line {
    transform: scale(0.95);
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    span {
      font-size: v-bind('`${fontSize}px`');
      background-repeat: no-repeat;
      background-color: v-bind('`${unplayedColor}`');
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-image: -webkit-linear-gradient(
        top,
        var(--color-wbw-text-played),
        var(--color-wbw-text-played)
      );
      background-size: 0% 100%;
      will-change: background-size;
      overflow-wrap: break-word;
    }
  }
  .translation {
    transform: scale(0.95);
    span {
      font-size: v-bind('`${fontSize - 2}px`');
      background-repeat: no-repeat;
      background-color: v-bind('`${unplayedColor}`');
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-image: -webkit-linear-gradient(
        top,
        var(--color-wbw-text-played),
        var(--color-wbw-text-played)
      );
      background-size: 0% 100%;
      will-change: background-size;
      overflow-wrap: break-word;
    }
  }

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
  }
}

.line.active .lyric-line {
  transform: scale(1);
}
</style>
