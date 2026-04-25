import { parseFile, IAudioMetadata } from 'music-metadata'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { parseCue, setLastTrackDuration } from '../utils/cueParser'

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

const getReplayGainFromMetadata = (metadata: IAudioMetadata | null) => {
  if (!metadata) return 0
  let gain: number = metadata.format?.trackGain ?? metadata.common?.replaygain_track_gain?.dB ?? 0
  if (gain) return Number(gain)
  metadata.native?.iTunes?.forEach(({ id, value }) => {
    if (id.includes('replaygain_track_gain')) {
      gain = Number(value)
    }
  })
  return gain
}

const findCompanionCue = (filePath: string): string | null => {
  const dir = path.dirname(filePath)
  const ext = path.extname(filePath)
  const base = path.basename(filePath, ext)
  const cuePath = path.join(dir, base + '.cue')
  return fs.existsSync(cuePath) ? cuePath : null
}

const parseMusicFile = async (data: { filePath: string }) => {
  let metadata: IAudioMetadata | null = null

  try {
    metadata = await parseFile(data.filePath)
  } catch (e) {
    console.log(`parse error: ${e}`)
    console.log(`parse error file: ${data.filePath}`)
    // @ts-ignore
    metadata = { common: null, format: null, native: null, quality: null }
  }

  const md5 = await createMD5(data.filePath)
  const stat = await fs.promises.stat(data.filePath)
  const birthDate = new Date(stat.birthtime).getTime()
  // @ts-ignore
  const { common, format } = metadata
  const artists = splitArtist(common?.artist ?? null)
  const albumArtist = splitArtist(common?.albumartist || common?.artist || null)
  const album = common?.album ?? '未知专辑'
  const totalDuration = (format?.duration ?? 0) * 1000

  const baseTrack = {
    gain: getReplayGainFromMetadata(metadata),
    peak: 1,
    br: format?.bitrate ?? 320000,
    filePath: data.filePath,
    md5,
    createTime: birthDate,
    size: stat.size,
    album,
    albumArtist,
    musicBrainzTrackId: common?.musicbrainz?.trackid || null
  }

  // 检查同名 .cue
  const cuePath = findCompanionCue(data.filePath)
  if (cuePath) {
    try {
      const cueText = fs.readFileSync(cuePath, 'utf-8')
      const cue = parseCue(cueText)
      // 计算最后一首时长
      if (cue.tracks.length > 0) {
        setLastTrackDuration(cue, totalDuration)
      }
      // 生成 CUE 分轨
      return cue.tracks.map((track) => ({
        ...baseTrack,
        name: track.title || baseTrack.musicBrainzTrackId || '未知歌曲',
        duration: track.durationMs,
        cueOffset: track.startMs,
        cueDuration: track.durationMs,
        no: track.no,
        artists: track.performer ? splitArtist(track.performer) : artists,
        alias: []
      }))
    } catch (e) {
      console.log(`cue parse error: ${e}, fallback to whole file`)
    }
  }

  // 无 .cue 或解析失败，返回单条
  return [
    {
      ...baseTrack,
      name: common?.title ?? getFileName(data.filePath) ?? '未知歌曲',
      duration: totalDuration,
      cueOffset: 0,
      cueDuration: 0,
      no: 0,
      artists,
      alias: []
    }
  ]
}

module.exports = parseMusicFile
