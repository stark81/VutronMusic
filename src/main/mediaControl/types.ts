import { statusMap } from '@/types/music'

/** 由 renderer 通过 metadata IPC 发送的曲目信息，各平台取所需字段 */
export interface RawMetadata {
  title: string
  artist: string
  album?: string
  artwork: { src: string; type: string; sizes: string }[]
  length: number
  trackId: string | number
  url?: string
  progress: number
  rate: number
  asText?: string
  lyricOffset?: number
}

export interface MediaController {
  /** 设置曲目元数据（由 renderer 的 metadata IPC 触发） */
  setMetadata(meta: RawMetadata): void
  /** 从 synchronize-player-info IPC 接收状态更新，各平台取自己需要的字段 */
  updateInfo(data: Partial<statusMap>): void
  destroy(): void
}
