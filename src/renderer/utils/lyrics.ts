import { word } from '@/types/music.d'

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')!

export const measureWithCanvas = (dom: HTMLElement, info: word[]) => {
  const style = window.getComputedStyle(dom)
  const font = `${style.fontSize} ${style.fontFamily} ${style.fontWeight}`

  ctx.font = font
  const result = info.map((font) => {
    const metrics = ctx.measureText(font.word)
    return metrics.width
  })
  return result
}

const buildWordKeyFrame = (info: word[], spanWidths: number[]) => {
  const start = info[0].start
  const end = info.at(-1)!.end
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

const buildScrollKeyFrame = (
  dom: HTMLElement,
  info: word[] | undefined,
  spanWidths: number[],
  start: number,
  end: number
) => {
  const span = dom.querySelector('span')!
  const totalWidth = span.offsetWidth
  const containerWidth = dom.offsetWidth
  const scrollWidth = totalWidth - containerWidth
  if (scrollWidth <= 0) return null

  const keyframes = [{ transform: `translateX(0)`, offset: 0 }]

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

export const buildWordAnimation = (
  span: HTMLElement,
  info: word[],
  offsetWidths: number[],
  playbackRate: number
) => {
  const result = buildWordKeyFrame(info, offsetWidths)

  const effect = new KeyframeEffect(span, result.keyframes, {
    duration: result.duration,
    easing: 'linear',
    fill: 'forwards'
  })
  const an = new Animation(effect, document.timeline)
  an.playbackRate = playbackRate
  return an
}

export const buildScrollAnimation = (
  dom: HTMLElement,
  info: word[] | undefined,
  offsetWidths: number[],
  playbackRate: number,
  start: number,
  end: number
) => {
  const result = buildScrollKeyFrame(dom, info, offsetWidths, start, end)
  if (!result) return null
  const effect = new KeyframeEffect(dom, result.keyframes, {
    duration: result.duration,
    easing: 'linear',
    fill: 'forwards'
  })
  const an = new Animation(effect, document.timeline)
  an.playbackRate = playbackRate
  return an
}

// export const buildLyricAnimation = (type: 'all' | 'translation' = 'all') => {
//   const lst: lyricType[] = []
//   if (type === 'all') {
//     lst.push('lyric')
//   }
//   if (translation.value) lst.push('translation')

//   const map = {
//     lyric: { dom: lineRef.value, span: lineSpanRef.value, info: props.item.lyric.info },
//     translation: {
//       dom: translationRef.value,
//       span: translationSpanRef.value,
//       info: translation.value?.info
//     }
//   }

//   for (const l of lst) {
//     const item = map[l]
//     if (!item.dom || !item.span) continue
//     let spanWidths: number[] = []

//     if (item.info) {
//       spanWidths = measureWithCanvas(item.dom, item.info)
//       animations[l] = buildWordAnimation(item.span, item.info, spanWidths)
//     }

//     if (props.isMini) {
//       const an = buildScrollAnimation(item.dom, item.info, spanWidths)
//       scrollAnimations[l] = an
//     }
//     // await new Promise(requestAnimationFrame)
//   }
// }
