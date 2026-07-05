import type { lyricLine, word } from '@/types/music.d'

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')!

const cache = new Map<string, number>()

export function collectUniqueWords(lyrics: lyricLine[], translationMode: string): string[] {
  const wordSet = new Set<string>()
  for (const line of lyrics) {
    if (line.lyric?.info) {
      for (const w of line.lyric.info) wordSet.add(w.word)
    }
    if (translationMode !== 'none') {
      const transKey = translationMode as keyof lyricLine
      const trans = line[transKey] as { text: string; info?: word[] } | undefined
      if (trans?.info) {
        for (const w of trans.info) wordSet.add(w.word)
      }
    }
  }
  return Array.from(wordSet)
}

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

export function prewarmMeasureCache(
  words: string[],
  font: string,
  fontSize: number,
  fontWeight: number = 600
): void {
  ctx.font = `${fontWeight} ${fontSize}px ${font}`
  for (const word of words) {
    const key = `${font}|${fontSize}|${fontWeight}|${word}`
    if (!cache.has(key)) {
      cache.set(key, ctx.measureText(word).width)
    }
  }
}

export function clearMeasureCache() {
  cache.clear()
}
