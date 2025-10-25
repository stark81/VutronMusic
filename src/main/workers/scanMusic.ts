import { parseFile, IAudioMetadata } from 'music-metadata'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'

const createMD5 = (filePath: string) => {
  const hash = crypto.createHash('md5')
  const data = fs.readFileSync(filePath)
  hash.update(data)
  return hash.digest('hex')
}

const splitArtist = (artist: string | undefined) => {
  if (!artist) return ['未知歌手']
  let result: string[]
  if (artist.includes('&')) {
    result = artist.split('&')
  } else if (artist.includes('、')) {
    result = artist.split('、')
  } else if (artist.includes(',')) {
    result = artist.split(',')
  } else if (artist.includes('/')) {
    result = artist.split('/')
  } else {
    result = [artist]
  }
  return result
}

const getFileName = (filePath: string) => {
  const fileExt = path.extname(filePath)
  const fileNameWithExt = path.basename(filePath)
  const fileName = fileNameWithExt.replace(fileExt, '')
  return fileName
}

const getReplayGainFromMetadata = (metadata: IAudioMetadata) => {
  if (!metadata) return 0
  let gain: number = metadata.format.trackGain ?? metadata.common.replaygain_track_gain?.dB ?? 0
  if (gain) return Number(gain)
  metadata.native.iTunes?.forEach(({ id, value }) => {
    if (id.includes('replaygain_track_gain')) {
      gain = Number(value)
    }
  })
  return gain
}

const parseMusicFile = async (data: { filePath: string }) => {
  const md5 = createMD5(data.filePath)
  const metadata = await parseFile(data.filePath)
  const stat = await fs.promises.stat(data.filePath)

  const birthDate = new Date(stat.birthtime).getTime()
  const { common, format } = metadata

  const artists = splitArtist(common.artist ?? common.albumartist)
  const album = common.album

  const track = {
    name: common.title ?? getFileName(data.filePath) ?? '未知',
    dt: (format.duration ?? 0) * 1000,
    source: 'localTrack',
    gain: getReplayGainFromMetadata(metadata),
    peak: 1,
    br: format.bitrate ?? 320000,
    filePath: data.filePath,
    type: 'local',
    offset: 0,
    md5,
    createTime: birthDate,
    alias: [],
    album,
    artists,
    size: stat.size,
    cache: false,
    matched: false
  }

  return track
}

module.exports = parseMusicFile
