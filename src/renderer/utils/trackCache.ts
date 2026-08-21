import { db } from './db'
import { lyricLine } from '@/types/music'

const LYRIC_PREFIX = 'track:lyric:'
const PIC_PREFIX = 'track:pic:'

type CacheIdentity = number | string

/**
 * Local tracks can receive a new online id after matching.  Their file path is
 * stable across that operation, so use it as the cache identity instead of the
 * mutable track id.
 */
function lyricCacheIdentity(trackId: number, filePath?: string): CacheIdentity {
  return filePath ? `local:${filePath}` : trackId
}

function lyricCacheKey(identity: CacheIdentity) {
  return LYRIC_PREFIX + identity
}

async function cacheLyric(identity: CacheIdentity, data: lyricLine[]) {
  if (!data || data.length === 0) return
  await db.localData.put({
    id: lyricCacheKey(identity),
    data,
    updatedAt: Date.now()
  })
}

async function getCachedLyric(identity: CacheIdentity): Promise<lyricLine[] | null> {
  const entry = await db.localData.get(lyricCacheKey(identity))
  return entry ? entry.data : null
}

async function deleteCachedLyric(identity: CacheIdentity) {
  await db.localData.delete(lyricCacheKey(identity))
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
  lyricCacheIdentity,
  cacheLyric,
  getCachedLyric,
  deleteCachedLyric,
  cachePic,
  getCachedPic,
  fetchUrlAsDataUrl,
  cachePicFromUrl,
  extractCoverFromFile,
  extractAndCacheCover
}
