import { db } from './db'

// Known cache keys for type-safe access
const Keys = {
  homeBanner: 'home:banner',
  homeRecommendPlaylist: 'home:recommendPlaylist',
  homeRecommendArtists: 'home:recommendArtists',
  homeNewAlbums: 'home:newAlbums',
  homeToplists: 'home:toplists',
  librarySongs: 'library:songs',
  libraryPlaylists: 'library:playlists',
  librarySongsWithDetails: 'library:songsWithDetails',
  libraryAlbums: 'library:albums',
  libraryArtists: 'library:artists',
  libraryMVs: 'library:mvs',
  libraryCloudDisk: 'library:cloudDisk',
  libraryPlayHistory: 'library:playHistory'
} as const

const ONE_DAY = 24 * 60 * 60 * 1000

async function saveData<T>(id: string, data: T) {
  if (!data) return
  await db.localData.put({ id, data, updatedAt: Date.now() })
}

async function loadData<T>(id: string): Promise<T | null> {
  const entry = await db.localData.get(id)
  if (!entry) return null
  return entry.data as T
}

function isStale(id: string, maxAge: number = ONE_DAY): Promise<boolean> {
  return db.localData.get(id).then((entry) => {
    if (!entry) return true
    return Date.now() - entry.updatedAt > maxAge
  })
}

async function clearAll() {
  await db.localData.clear()
}

export const localDataCache = { Keys, saveData, loadData, isStale, clearAll }
