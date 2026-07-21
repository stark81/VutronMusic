/** 单次扫描的去重快照 - 来自 db.loadScanDedupData() */
export interface ScanDedupData {
  existingArtists: { id: string; name: string }[]
  existingAlbums: { id: string; name: string }[]
  existingTracks: {
    id: string
    name: string
    albumId: string
    duration: number
    musicBrainzTrackId?: string
  }[]
  existingAudios: {
    id: string
    trackId: string
    filePath: string
    cueOffset?: number
  }[]
  existingTrackArtists: { trackId: string; artistId: string }[]
  existingArtistAlbums: { artistId: string; albumId: string }[]
  existingTrackSources: { trackId: string; pluginId: string }[]
}

/** Worker 解析单文件后返回的曲目元数据 */
export interface ParsedTrackItem {
  name: string
  duration: number
  filePath: string
  md5: string
  createTime: number
  size: number
  album: string
  albumArtist: string[]
  artists: string[]
  musicBrainzTrackId: string | null
  gain: number
  peak: number
  br: number
  cueOffset: number
  cueDuration: number
  no: number
  alias: string[]
}

/** 批量入库数据类型（key = 表名，value = 行数组） */
export interface ScanBatchData {
  Artist: {
    id: string
    name: string
    picUrl: string
    description: string
    followed: number
    createTime: number
    updateTime: number
  }[]
  Album: {
    id: string
    name: string
    picUrl: string
    type: string
    company: string
    description: string
    subscribed: number
    isExplicit: number
    publishTime: number
    createTime: number
    updateTime: number
  }[]
  Track: {
    id: string
    name: string
    duration: number
    albumId: string
    no: number
    alias: string
    picUrl: string
    playCount: number
    musicBrainzTrackId: string | null
    createTime: number
    updateTime: number
  }[]
  Audio: {
    id: string
    trackId: string
    filePath: string
    md5: string
    bitrate: number
    gain: number
    peak: number
    size: number
    cueOffset: number
    cueDuration: number
  }[]
  TrackArtist: { trackId: string; artistId: string }[]
  ArtistAlbum: { artistId: string; albumId: string }[]
  TrackSource: {
    trackId: string
    pluginId: string
    sourceContext: string
    matched: number
    createTime: number
    updateTime: number
  }[]
}

export interface ScanProgress {
  newTracks: number
  processed: number
  total: number
}

export interface ScanResult {
  hasNewData: boolean
}
