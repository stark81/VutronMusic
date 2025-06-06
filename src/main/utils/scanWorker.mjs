import fs from 'fs'
import { parseFile } from 'music-metadata'
import { createMD5, splitArtist, getFileName, getReplayGainFromMetadata } from './utils'

export default async function ({ filePath }) {
  try {
    const stat = await fs.promises.stat(filePath)
    const metadata = await parseFile(filePath)
    const md5 = createMD5(filePath)
    const birthDate = new Date(stat.birthtime).getTime()
    const { common, format } = metadata

    const arIDsResult = []
    const arts = splitArtist(common.albumartist ?? common.artist)

    for (const art of arts) {
      const artist = {
        name: art,
        matched: false,
        picUrl: 'https://p1.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg'
      }
      arIDsResult.push(artist)
    }

    const album = {
      name: common.album ?? '未知专辑',
      matched: false,
      picUrl: 'atom://get-default-pic'
    }

    const track = {
      id: null,
      name: common.title ?? getFileName(filePath) ?? '错误文件',
      dt: (format.duration ?? 0) * 1000,
      source: 'localTrack',
      gain: getReplayGainFromMetadata(metadata),
      peak: 1,
      br: format.bitrate ?? 320000,
      filePath,
      type: 'local',
      matched: false,
      offset: 0,
      md5,
      createTime: birthDate,
      alias: [],
      album,
      artists: arIDsResult,
      picUrl: 'atom://get-default-pic'
    }
    return { track }
  } catch (error) {
    error.file = filePath
    throw error
  }
}
