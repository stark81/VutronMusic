const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')!

const cache = new Map<string, number>()

export function measureWords(
  words: string[],
  font: string,
  fontSize: number,
  fontWeight: number = 600
): number[] {
  ctx.font = `${fontWeight} ${fontSize}px ${font}`
  return words.map((word) => {
    const key = `${font}|${fontSize}|${fontWeight}|${word}`
    let w = cache.get(key)
    if (w === undefined) {
      w = ctx.measureText(word).width
      cache.set(key, w)
    }
    return w
  })
}

export function clearMeasureCache() {
  cache.clear()
}
