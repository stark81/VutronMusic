import { db } from './db'
import { lyricLine } from '@/types/music'

const LYRIC_PREFIX = 'track:lyric:'
const PIC_PREFIX = 'track:pic:'

async function cacheLyric(trackId: number, data: lyricLine[]) {
  if (!data || data.length === 0) return
  await db.localData.put({
    id: LYRIC_PREFIX + trackId,
    data,
    updatedAt: Date.now()
  })
}

async function getCachedLyric(trackId: number): Promise<lyricLine[] | null> {
  const entry = await db.localData.get(LYRIC_PREFIX + trackId)
  return entry ? entry.data : null
}

async function cachePic(trackId: number, dataUrl: string) {
  if (!dataUrl) return
  await db.localData.put({
    id: PIC_PREFIX + trackId,
    data: dataUrl,
    updatedAt: Date.now()
  })
}

async function getCachedPic(trackId: number): Promise<string | null> {
  const entry = await db.localData.get(PIC_PREFIX + trackId)
  return entry ? entry.data : null
}

async function fetchUrlAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function cachePicFromUrl(trackId: number, url: string) {
  const dataUrl = await fetchUrlAsDataUrl(url)
  if (dataUrl) {
    await cachePic(trackId, dataUrl)
  }
}

async function extractCoverFromFile(filePath: string): Promise<string | null> {
  try {
    return await window.mainApi?.invoke('get-cover-from-file', filePath)
  } catch {
    return null
  }
}

async function extractAndCacheCover(trackId: number, filePath: string): Promise<string | null> {
  const dataUrl = await extractCoverFromFile(filePath)
  if (dataUrl) {
    await cachePic(trackId, dataUrl)
  }
  return dataUrl
}

export const trackCache = {
  cacheLyric,
  getCachedLyric,
  cachePic,
  getCachedPic,
  fetchUrlAsDataUrl,
  cachePicFromUrl,
  extractCoverFromFile,
  extractAndCacheCover
}
