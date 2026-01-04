<template>
  <div ref="lineRef" class="lyric-line">
    <span>{{ item.lyric.text }}</span>
  </div>
  <div v-if="translation" ref="translationRef" class="translation">
    <span>{{ translation.text }}</span>
  </div>
</template>

<script setup lang="ts">
import { lyricLine, TranslationMode, word } from '@/types/music.d'
import { computed, toRefs, onBeforeUnmount, ref, nextTick } from 'vue'

type lyricType = 'lyric' | 'translation'
type AnimationStatus = 'play' | 'pause' | 'finish' | 'reset'

const props = withDefaults(
  defineProps<{
    item: lyricLine
    idx: number
    currentIndex: number
    translationMode: TranslationMode
    playing: boolean
    playbackRate?: number
    isWordByWord: boolean
    isMini?: boolean
  }>(),
  {
    playbackRate: 1.0,
    isMini: false
  }
)

const { translationMode, item } = toRefs(props)

const lyricMap: Record<TranslationMode, TranslationMode> = {
  tlyric: 'tlyric',
  rlyric: 'rlyric',
  none: 'none'
}

const animationActionMap: Record<AnimationStatus, (an: Animation) => void> = {
  play: (an) => an.play(),
  pause: (an) => an.pause(),
  finish: (an) => an.finish(),
  reset: (an) => {
    an.pause()
    an.currentTime = 0
  }
}

const lineRef = ref<HTMLElement | null>(null)
const translationRef = ref<HTMLElement | null>()

const animations = {
  lyric: null as Animation | null,
  translation: null as Animation | null
}

const scrollAnimations = {
  lyric: null as Animation | null,
  translation: null as Animation | null
}

const translation = computed(() => {
  const modeKey = lyricMap[translationMode.value] as keyof lyricLine
  return props.item[modeKey] as { text: string; info?: word[] } | null
})

/**
 * 创建测量用的 dom、获取所有字的offsetWidth、销毁 dom
 * @param dom 待测量的 div dom 元素
 * @param info 逐字歌词信息
 * @returns 返回每个字的宽度信息
 */
const measureDom = async (dom: HTMLElement, info: word[]) => {
  const spanC = document.createElement('span')
  spanC.classList.add('measure-span')
  info.forEach((font) => {
    const span = document.createElement('span')
    span.textContent = font.word
    spanC.appendChild(span)
  })

  await nextTick()
  dom.appendChild(spanC)

  const spans = spanC.querySelectorAll('span')
  const result = Array.from(spans).map((span) => span.offsetWidth)
  dom.removeChild(spanC)
  return result
}

const buildWordKeyFrame = (info: word[], spanWidths: number[]) => {
  const start = info[0].start || props.item.start * 1000
  const end = Math.min(info.at(-1)?.end || 0, props.item.end * 1000) || props.item.end * 1000
  const duration = Math.max(end - start, 1)
  let curWidth = 0
  const totalWidth = spanWidths.reduce((acc, cur) => acc + cur, 0)

  const keyframes = info.map((font, index) => {
    const _start = font.start
    const offset = Math.min(Math.max(0, (_start - start) / duration), 1)
    const result = { backgroundPosition: `${100 - (100 * curWidth) / totalWidth}% 0%`, offset }
    curWidth += spanWidths.length ? spanWidths[index] || 0 : 0
    return result
  })

  for (let i = 1; i < keyframes.length; i++) {
    if (keyframes[i].offset < keyframes[i - 1].offset) {
      keyframes[i].offset = keyframes[i - 1].offset
    }
  }
  keyframes.push({ backgroundPosition: '0% 0%', offset: 1 })
  return { duration, keyframes, start }
}

/**
 * 创建逐字歌词动画
 * @param dom 歌词 dom，即歌词 div 或者翻译 div 的元素
 * @param info 逐字歌词信息
 * @param offsetWidths 逐字歌词每个字的宽度信息
 * @returns 返回歌词动画
 */
const buildWordAnimation = (dom: HTMLElement, info: word[], offsetWidths: number[]) => {
  const result = buildWordKeyFrame(info, offsetWidths)

  const span = dom.querySelector('span')
  const effect = new KeyframeEffect(span, result.keyframes, {
    duration: result.duration,
    easing: 'linear',
    fill: 'forwards'
  })
  const an = new Animation(effect, document.timeline)
  an.playbackRate = props.playbackRate
  return an
}

const buildScrollKeyFrame = (dom: HTMLElement, info: word[] | undefined, spanWidths: number[]) => {
  const span = dom.querySelector('span')!
  const totalWidth = span.offsetWidth
  const containerWidth = dom.offsetWidth
  const scrollWidth = totalWidth - containerWidth
  if (scrollWidth <= 0) return null

  const keyframes = [{ transform: `translateX(0)`, offset: 0 }]

  const start = props.item.start * 1000
  const end = props.item.end * 1000
  const duration = end - start
  let curWidth = 0

  if (info) {
    // 滚动逻辑是：行宽度的前面 1/2 不滚动，滚动超出长度的部分，行宽度的后面 1/2 不滚动
    for (let i = 0; i < info.length; i++) {
      curWidth += spanWidths[i]
      if (curWidth <= containerWidth / 2) {
        continue
      } else {
        const sWidth = Math.min(curWidth - containerWidth / 2, scrollWidth)
        const offset = Math.max(Math.min((info[i].end - start) / duration, 1), 0)
        keyframes.push({
          transform: `translateX(${-sWidth}px)`,
          offset
        })
        if (curWidth - containerWidth / 2 > scrollWidth) break
      }
    }
    keyframes.push({
      transform: `translateX(${-scrollWidth}px)`,
      offset: 1
    })
  } else {
    const p1 = containerWidth / 2 / totalWidth
    const p2 = scrollWidth / totalWidth
    const _key = [
      { transform: `translateX(0)`, offset: p1 },
      { transform: `translateX(${-scrollWidth}px)`, offset: p1 + p2 },
      { transform: `translateX(${-scrollWidth}px)`, offset: 1 }
    ]
    keyframes.push(..._key)
  }

  return { keyframes, duration }
}

/**
 * 创建桌面歌词 mini 模式下的歌词滚动动画
 * @param dom 歌词 dom，即歌词 div 或者翻译 div 的元素
 * @param info 逐字歌词信息，如果为undefined，则平滑滚动，反之则将当前进度对应的字置于中间
 * @param offsetWidths 逐字歌词每个字的宽度信息，与 info 的长度相同且一一对应
 * @returns 返回对应的滚动动画，若无需滚动则为 null
 */
const buildScrollAnimation = (
  dom: HTMLElement,
  info: word[] | undefined,
  offsetWidths: number[]
) => {
  const result = buildScrollKeyFrame(dom, info, offsetWidths)
  if (!result) return null
  const effect = new KeyframeEffect(dom, result.keyframes, {
    duration: result.duration,
    easing: 'linear',
    fill: 'forwards'
  })
  const an = new Animation(effect, document.timeline)
  an.playbackRate = props.playbackRate
  return an
}

/**
 * 创建歌词动画，包括：逐字歌词动画、桌面歌词mini模式下的滚动动画
 * @param type all在全新创建时使用，translation在切换翻译模式时使用
 */
const createAnimations = async (type: 'all' | 'translation' = 'all') => {
  const lst: lyricType[] = []
  if (type === 'all') {
    lst.push('lyric')
  }
  if (translation.value) lst.push('translation')

  const map = {
    lyric: { dom: lineRef.value, info: props.item.lyric.info },
    translation: { dom: translationRef.value, info: translation.value?.info }
  }

  for (const l of lst) {
    const item = map[l]
    if (!item.dom) continue
    let spanWidths: number[] = []

    if (item.info) {
      spanWidths = await measureDom(item.dom, item.info)
      animations[l] = buildWordAnimation(item.dom, item.info, spanWidths)
    }

    if (props.isMini) {
      const an = buildScrollAnimation(item.dom, item.info, spanWidths)
      scrollAnimations[l] = an
    }
    await new Promise(requestAnimationFrame)
  }
}

/**
 * 由父组件调用，用于修改当前动画的 currentTime。
 * @param timeMs 已经包含 offset 修正的歌曲绝对播放进度 (毫秒)。
 */
const updateCurrentTime = (timeMs: number) => {
  if (props.idx !== props.currentIndex) return

  const anList = [
    animations.lyric,
    animations.translation,
    scrollAnimations.lyric,
    scrollAnimations.translation
  ]

  const lineStartMs = props.item.start * 1000
  const timeOffset = timeMs - lineStartMs

  anList.forEach((an) => {
    if (an) an.currentTime = timeOffset
  })
}

/**
 * 相对调整 currentTime：由父组件调用，用于处理歌词 offset 变化时的动画进度
 * @param deltaMs offset的新旧差值(毫秒)
 */
const adjustCurrentTimeByDelta = (deltaMs: number) => {
  if (props.idx !== props.currentIndex) return

  const anList = [
    animations.lyric,
    animations.translation,
    scrollAnimations.lyric,
    scrollAnimations.translation
  ]

  anList.forEach((an) => {
    if (an) an.currentTime = Number(an.currentTime) + deltaMs
  })
}

const clearAnimation = (clearAll = true) => {
  animations.translation?.cancel()
  animations.translation = null
  scrollAnimations.translation?.cancel()
  scrollAnimations.translation = null

  if (clearAll) {
    animations.lyric?.cancel()
    animations.lyric = null
    scrollAnimations.lyric?.cancel()
    scrollAnimations.lyric = null
  }
}

/**
 * 动画状态更新方法：由父组件调用，用于修改动画的状态。
 * @param state 待修改的动画状态
 */
const updatePlayStatus = (state: AnimationStatus) => {
  const anList = [
    animations.lyric,
    animations.translation,
    scrollAnimations.lyric,
    scrollAnimations.translation
  ]

  const action = animationActionMap[state]

  for (const an of anList) {
    if (an) action(an)
  }
}

const updatePlaybackRate = (rate: number) => {
  const anList = [
    animations.lyric,
    animations.translation,
    scrollAnimations.lyric,
    scrollAnimations.translation
  ]

  for (const an of anList) {
    if (an) an.playbackRate = rate
  }
}

onBeforeUnmount(() => {
  clearAnimation()
})

defineExpose({
  createAnimations,
  clearAnimation,
  updateCurrentTime,
  updatePlayStatus,
  updatePlaybackRate,
  adjustCurrentTimeByDelta
})
</script>
