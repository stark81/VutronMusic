import Dexie, { Table } from 'dexie'
import { serviceName } from '@/types/music'

interface StreamInfo {
  name: serviceName
  stream: {
    url: string
    username: string
    password: string
    clientID?: string
    authorization?: string
    userId?: string
    accessToken?: string
  }
  updateTime: number
}

export interface ApiCacheEntry {
  key: string
  data: any
  timestamp: number
}

export interface PageVisitEntry {
  pathAndQuery: string
  visitCount: number
  timestamp: number
}

export interface LocalDataEntry {
  id: string
  data: any
  updatedAt: number
}

class VutronMusicDB extends Dexie {
  stream!: Table<StreamInfo, string>
  pageCache!: Table<ApiCacheEntry, string>
  pageVisit!: Table<PageVisitEntry, string>
  localData!: Table<LocalDataEntry, string>

  constructor() {
    super('VutronMusic')

    this.version(1).stores({
      stream: '&name, updateTime'
    })

    this.version(2).stores({
      stream: '&name, updateTime',
      pageCache: '&key, timestamp',
      pageVisit: '&pathAndQuery, visitCount'
    })

    this.version(3).stores({
      stream: '&name, updateTime',
      pageCache: '&key, timestamp',
      pageVisit: '&pathAndQuery, visitCount',
      localData: '&id, updatedAt'
    })
  }
}

export const db = new VutronMusicDB()

// If the database was corrupted by a schema change during development,
// delete it and reopen with a clean schema.
db.open().catch(async (err) => {
  console.warn('VutronMusic database schema mismatch, recreating...', err)
  await db.delete()
  const fresh = new VutronMusicDB()
  await fresh.open()
  // Patch methods to use the fresh instance
  const proto = Object.getPrototypeOf(db)
  const freshProto = Object.getPrototypeOf(fresh)
  Object.getOwnPropertyNames(freshProto).forEach((key) => {
    if (key !== 'constructor') {
      ;(proto as any)[key] = (freshProto as any)[key]
    }
  })
})

export const setStreamInfo = (name: serviceName, stream: StreamInfo['stream']) => {
  return db.stream.put({
    name,
    stream,
    updateTime: Date.now()
  })
}

export const getStreamInfo = async (name: serviceName) => {
  const result = await db.stream.get(name)
  if (!result) return null
  return result.stream
}

export const updateStreamInfo = async (
  name: serviceName,
  partialStream: Partial<StreamInfo['stream']>
) => {
  const existing = await db.stream.get(name)
  if (!existing) return

  await db.stream.put({
    name,
    stream: {
      ...existing.stream,
      ...partialStream
    },
    updateTime: Date.now()
  })
}
