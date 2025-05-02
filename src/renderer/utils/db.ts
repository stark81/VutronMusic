import Dexie, { Table } from 'dexie'
import { serviceName } from '../store/streamingMusic'

export interface StreamInfo {
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

class VutronMusicDB extends Dexie {
  stream!: Table<StreamInfo, string> // 表名为 stream，主键类型为 string（name）

  constructor() {
    super('VutronMusic')
    this.version(1).stores({
      stream: '&name, updateTime' // &name 表示 name 是主键
    })
  }
}

const db = new VutronMusicDB()

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
