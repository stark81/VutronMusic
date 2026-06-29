import { db } from './db'

const EXCLUDED_PATHS = ['/login/account', '/settings', '/next']

async function recordVisit(path: string) {
  if (EXCLUDED_PATHS.some((p) => path.startsWith(p))) return

  const existing = await db.pageVisit.get(path)
  await db.pageVisit.put({
    pathAndQuery: path,
    visitCount: existing ? existing.visitCount + 1 : 1,
    timestamp: Date.now()
  })
}

async function isRouteVisited(path: string) {
  if (EXCLUDED_PATHS.some((p) => path.startsWith(p))) return true
  const entry = await db.pageVisit.get(path)
  return entry !== undefined
}

async function getVisitCount(path: string) {
  const entry = await db.pageVisit.get(path)
  return entry ? entry.visitCount : 0
}

function makeCacheKey(url: string, params?: Record<string, any>): string {
  const sorted = params
    ? JSON.stringify(params, Object.keys(params || {}).sort())
    : ''
  return `${url}|${sorted}`
}

// Cache any successful API response immediately (no visit threshold)
async function cacheApiResponse(url: string, params: Record<string, any> | undefined, data: any) {
  if (!data) return
  const key = makeCacheKey(url, params)
  await db.pageCache.put({ key, data, timestamp: Date.now() })
}

// Exact match lookup
async function getCachedApiResponse(url: string, params?: Record<string, any>) {
  const key = makeCacheKey(url, params)
  const entry = await db.pageCache.get(key)
  return entry ? entry.data : null
}

// Fallback: find the most recent cache entry for a given URL prefix (ignore params)
// Used when exact match fails and we're offline
async function getAnyCachedForUrl(url: string) {
  const all = await db.pageCache
    .where('key')
    .startsWith(url + '|')
    .reverse()
    .sortBy('timestamp')
  if (all.length > 0) return all[0].data
  return null
}

export const pageCache = {
  recordVisit,
  isRouteVisited,
  getVisitCount,
  cacheApiResponse,
  getCachedApiResponse,
  getAnyCachedForUrl
}
