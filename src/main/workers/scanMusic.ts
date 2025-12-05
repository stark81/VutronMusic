import { parseFile, IAudioMetadata } from 'music-metadata'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'

const createMD5 = (filePath: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(chunk))
    stream.once('end', () => resolve(hash.digest('hex')))
    stream.once('error', (err) => reject(err))
  })

const splitArtist = (artist?: string) =>
  artist
    ? artist
        .split(/\s*[,/&、]\s*/)
        .filter(Boolean)
        .map((s) => s.trim())
    : ['未知歌手']

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
  let metadata: IAudioMetadata | null = null

  try {
    metadata = await parseFile(data.filePath)
  } catch (e) {
    metadata = null
  }

  const md5 = await createMD5(data.filePath)
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
