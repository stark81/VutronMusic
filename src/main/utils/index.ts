import { net } from 'electron'
import fs from 'fs'
import path from 'path'
import jschardet from 'jschardet'
import iconv from 'iconv-lite'
import { fileTypeFromBuffer } from 'file-type'
import { IAudioMetadata, parseFile } from 'music-metadata'
import request from '../appServer/request'
import { CacheAPIs } from './CacheApis'
import Cache from '../cache'
import store from '../store'

import { db, Tables } from '../db'
import log from '../log'
import { Worker } from 'worker_threads'
import { TrackInfoOrder, lyricLine } from '@/types/music'

export const isFileExist = (file: string) => {
  return fs.existsSync(file)
}

export const createDirIfNotExist = (dir: string) => {
  if (!isFileExist(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export const createFileIfNotExist = (file: string) => {
  createDirIfNotExist(path.dirname(file))
  if (!isFileExist(file)) {
    fs.writeFileSync(file, '')
  }
}

export const getLyricFromMetadata = (metadata: IAudioMetadata) => {
  const { common, format, native } = metadata
  let lyrics: string = ''
  if (common.lyrics) {
    // 这种一般是iTunes的歌词
    if (typeof common.lyrics[0] === 'string') {
      lyrics = common.lyrics[0]
    } else if (typeof common.lyrics[0] === 'object') {
      lyrics = common.lyrics[0].syncText
        ? common.lyrics[0].syncText[0]?.text
        : (common.lyrics[0].text ?? '')
    }
  }
  if (lyrics || lyrics !== undefined) return lyrics
  for (const tag of format.tagTypes ?? []) {
    if (tag === 'vorbis') {
      // flac
      lyrics = (native.vorbis?.find((item) => item.id === 'LYRICS')?.value ?? '') as string
    } else if (tag === 'ID3v2.3') {
      lyrics = (native['ID3v2.3'].find((item) => item.id === 'USLT')?.value as any)?.text ?? ''
    } else if (tag === 'ID3v2.4') {
      lyrics = (native['ID3v2.4'].find((item) => item.id === 'USLT')?.value as any)?.text ?? ''
    } else if (tag === 'APEv2') {
      // APEv2好像并没有固定的歌词标签，todo...
    }
  }
  return lyrics
}

export const parseLyricString = (lyrics: string): lyricLine[] => {
  if (!lyrics) return []

  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const chineseRegex = /[\u4E00-\u9FFF]/
  const result: lyricLine[] = []
  const lyricMap = new Map<number, lyricLine[]>()
  const lrcResult: lyricLine[] = []

  for (const line of lyrics.trim().matchAll(extractLrcRegex)) {
    const { content } = line.groups
    if (/\(\d+,\d+,\d+\)/.test(content)) {
      const lyric = _parseYrcLine(line)
      if (!lyricMap.has(lyric.start)) {
        lyricMap.set(lyric.start, [])
      }
      lyricMap.get(lyric.start).push(lyric)
    } else if (/\[\d{2}:\d{2}\.\d{3}\]/.test(content)) {
      const lyric = _parseWrcLine(line)
      if (!lyricMap.has(lyric.start)) {
        lyricMap.set(lyric.start, [])
      }
      lyricMap.get(lyric.start).push(lyric)
    } else {
      const _line = _parseLrcLine(line)
      const lyric = { start: _line.start, end: 0, lyric: { text: _line.cInfo } }
      lrcResult.push(lyric)
    }
  }

  lrcResult.forEach((line, index) => {
    const nextLine = lrcResult[index + 1]
    if (nextLine) line.end = nextLine.start

    if (!lyricMap.has(line.start)) {
      lyricMap.set(line.start, [])
    }
    lyricMap.get(line.start).push(line)
  })

  for (const lyricArray of lyricMap.values()) {
    for (let i = 0; i < lyricArray.length; i++) {
      if (i === 0) {
        result.push(lyricArray[0])
      } else {
        const line = result.find((item) => item.start === lyricArray[i].start)
        if (line) {
          if (chineseRegex.test(lyricArray[i].lyric.text)) {
            line.tlyric = line.tlyric ?? lyricArray[i].lyric
          } else {
            line.rlyric = lyricArray[i].lyric
          }
        }
      }
    }
  }
  return result
}

const getLyricFromEmbedded = async (filePath: string) => {
  let result: lyricLine[] = []

  const metadata = await parseFile(decodeURI(filePath))

  const lyrics = getLyricFromMetadata(metadata)

  if (lyrics) {
    result = parseLyricString(lyrics)
  }
  return result
}

const getLyricFromPath = async (filePath: string) => {
  let result: lyricLine[] = []
  const buffer = await fs.promises.readFile(filePath)
  const detected = jschardet.detect(buffer)
  const lyrics = iconv.decode(buffer, detected.encoding)
  if (lyrics) {
    result = parseLyricString(lyrics)
  }
  return result
}

// new
export const getPicFromApi = async (url: string) => {
  let pic: Buffer | null = null
  let format: string = ''
  if (!url) return { pic, format }
  pic = await net
    .fetch(url)
    .then((res) => {
      format = res.headers.get('Content-Type')
      return res.arrayBuffer()
    })
    .then((res) => Buffer.from(res))
    .catch((err) => {
      console.log('===1===', err)
      return err
    })
  return { pic, format }
}

export const getPicFromEmbedded = async (filePath: string) => {
  let pic: Buffer
  let format: string
  const metadata = await parseFile(decodeURI(filePath))
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    pic = Buffer.from(metadata.common.picture[0].data)
    format = metadata.common.picture[0].format
  }
  return { pic, format }
}

export const getPicFromPath = async (filePath: string) => {
  let pic: Buffer | null = null
  let format: string = ''
  pic = await fs.promises.readFile(filePath)
  const type = await fileTypeFromBuffer(pic)
  format = type.mime
  return { pic, format }
}

export const getPic = async (track: any): Promise<{ pic: Buffer; format: string }> => {
  const trackInfoOrder = (store.get('settings.trackInfoOrder') as TrackInfoOrder[]) || [
    'path',
    'online',
    'embedded'
  ]

  let res: { pic: Buffer<ArrayBufferLike>; format: string }
  const url = track.album?.picUrl || track.al?.picUrl

  for (const order of trackInfoOrder) {
    if (order === 'online' && track.matched) {
      res = await getPicFromApi(url)
    } else if (order === 'path' && track.filePath) {
      const prefixs = ['.jpg', '.png', '.jpeg', '.webp']
      for (const prefix of prefixs) {
        const filePath = track.filePath.replace(/\.[^/.]+$/, prefix)
        res = await fs.promises
          .access(filePath, fs.constants.F_OK)
          .then(async () => {
            return await getPicFromPath(filePath)
          })
          .catch(() => {
            return { pic: null, format: '' }
          })
        if (res?.pic) break
      }
    } else if (order === 'embedded' && track.filePath) {
      res = await getPicFromEmbedded(track.filePath)
    }
    if (res?.pic) return res
  }
  res = await getPicFromApi(url)
  return res
}

export const getPicColor = async (pic: Buffer) => {
  const { Vibrant } = require('node-vibrant/node')
  const Color = require('color')
  try {
    const palette = await Vibrant.from(pic, {
      colorCount: 1
    }).getPalette()
    const originColor = Color.rgb(palette.DarkMuted.rgb)
    const color = originColor.darken(0.1).rgb().string()
    const color2 = originColor.lighten(0.28).rotate(-30).rgb().string()
    return { color, color2 }
  } catch (error) {
    log.error('获取图片颜色失败:', error)
    return { color: null, color2: null }
  }
}

export const getLyricFromApi = async (id: number): Promise<lyricLine[]> => {
  return await request({
    url: '/lyric/new',
    method: 'get',
    params: { id }
  }).catch(() => [])
}

export const getLyric = async (track: {
  id: number
  matched: boolean
  filePath?: string
}): Promise<lyricLine[]> => {
  const trackInfoOrder = (store.get('settings.trackInfoOrder') as TrackInfoOrder[]) || [
    'path',
    'online',
    'embedded'
  ]

  let lyrics: lyricLine[] = null

  for (const order of trackInfoOrder) {
    if (order === 'online') {
      if (track.matched) {
        lyrics = await getLyricFromApi(track.id)
      }
    } else if (order === 'embedded') {
      if (track.filePath) {
        lyrics = await getLyricFromEmbedded(track.filePath)
      }
    } else if (order === 'path') {
      if (track.filePath) {
        const filePath = track.filePath.replace(/\.[^/.]+$/, '.lrc')
        lyrics = await fs.promises
          .access(filePath, fs.constants.F_OK)
          .then(async () => {
            return await getLyricFromPath(filePath)
          })
          .catch(() => [])
      }
    }
    if (lyrics.length) return lyrics
  }
  return lyrics
}

export const handleNeteaseResult = async (name: string, result: any) => {
  switch (name) {
    case CacheAPIs.Playlist: {
      if (!result) return result
      if (result.playlist) {
        result.playlist.tracks = mapTrackPlayableStatus(
          result.playlist.tracks,
          result.privileges || []
        )
      }
      return result
    }
    case CacheAPIs.Track: {
      result.songs = mapTrackPlayableStatus(result.songs, result.privileges)
      return result
    }
    case CacheAPIs.recommendTracks: {
      result.data.dailySongs = mapTrackPlayableStatus(
        result.data.dailySongs,
        result.data.privileges
      )
      return result
    }
    case CacheAPIs.Artist: {
      result.hotSongs = mapTrackPlayableStatus(result.hotSongs)
      return result
    }
    case CacheAPIs.Album: {
      result.songs = mapTrackPlayableStatus(result.songs)
      return result
    }
    case CacheAPIs.ListenedRecords: {
      if (result.weekData) {
        result.weekData = result.weekData.map((item: any) => {
          item.song = { ...item.song, type: 'online', matched: true }
          return item
        })
      }
      if (result.allData) {
        result.allData = result.allData.map((item: any) => {
          item.song = { ...item.song, type: 'online', matched: true }
          return item
        })
      }
      return result
    }
    case CacheAPIs.CloudDisk: {
      result.data = result.data.map((item: any) => {
        item.type = 'online'
        item.matched = true
        if (item.simpleSong) item.simpleSong = { ...item.simpleSong, type: 'online', matched: true }
        return item
      })
      return result
    }
    case CacheAPIs.TopSong: {
      result.data = mapTrackPlayableStatus(result.data)
      return result
    }
    case CacheAPIs.LyricNew: {
      if (result.yrc?.lyric) {
        return yrcLyricParse(result)
      } else if (result.lrc.lyric) {
        return lrcLyricParse(result)
      }
      return []
    }
    default:
      return result
  }
}

const _parseYrcLine = (line: RegExpExecArray) => {
  const timestampRegex = /\[(\d+),(\d+)\]/g
  const extractTimestampRegex = /\((\d+),(\d+),\d+\)([^(]+)/g

  const { lyricTimestamps, content } = line.groups
  const startTime = lyricTimestamps.match(timestampRegex)
  const times = startTime
    ? startTime.flatMap((match) => {
        const [, num1, num2] = match.match(/\[(\d+),(\d+)\]/) || []
        return [Number(num1) / 1000, Number(num2) / 1000]
      })
    : []
  if (times.length === 0) return
  const matched = content.matchAll(extractTimestampRegex)
  const info = [...matched].map((match) => {
    let [, start, duration, word] = match
    start = Math.max(parseInt(start), 100).toString()
    return { start: parseInt(start), end: parseInt(start) + parseInt(duration), word }
  })
  const text = info.map((item) => item.word).join('')
  return { start: times[0], end: times[0] + times[1], lyric: { info, text } }
}

const _parseLrcLine = (line: RegExpExecArray) => {
  const extractTimestampRegex = /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g

  const { lyricTimestamps, content } = line.groups
  let start: number = 0

  const match = extractTimestampRegex.exec(lyricTimestamps)
  if (match?.groups) {
    const { min, sec, ms } = match.groups
    start = Number(min) * 60 + Number(sec) + Number(ms?.padEnd(3, '0') ?? 0) * 0.001
    start = Number(start.toFixed(3))
  }
  const cInfo = content.replace(/\[(\d+):(\d+)(?:\.|:)*(\d+)]/g, '').trim()
  return { start, cInfo }
}

const _switchTime = (str: string, regex: RegExp) => {
  const match = str.matchAll(regex)
  const [, min, sec, ms] = [...match].flat()
  return Number(
    Math.round(
      (Number(min) * 60 + Number(sec) + Number(ms?.padEnd(3, '0') ?? 0) * 0.001) * 1000
    ).toFixed(3)
  )
}

const _parseWrcLine = (line: RegExpExecArray) => {
  const regex = /(\[\d{2}:\d{2}\.\d{1,3}\])([^[]*?)(?=(\[\d{2}:\d{2}\.\d{2,3}\]))/g
  const extractTimestampRegex = /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g

  const { lyricTimestamps, content } = line.groups
  const lineText = lyricTimestamps + content
  const words = lineText.trim().matchAll(regex)
  const ws = [...words]
  if (!ws.length) return
  const info = ws.map((word) => {
    const start = Math.max(50, _switchTime(word[1], extractTimestampRegex))
    const end = _switchTime(word[3], extractTimestampRegex)
    return { start, end, word: word[2] }
  })

  const start = Number((info[0].start / 1000).toFixed(3))
  const end = Number((info.at(-1)!.end / 1000).toFixed(3))
  const text = info.map((item) => item.word).join('')
  return { start, end, lyric: { info, text } }
}

export const yrcLyricParse = (data: {
  yrc: { lyric: string }
  ytlrc: { lyric: string }
  yromalrc: { lyric: string }
}) => {
  if (!data.yrc?.lyric) return
  const result: lyricLine[] = []
  const extractyrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm

  const binarySearch = (lyric: Partial<lyricLine>) => {
    const time = lyric.start!

    let low = 0
    let high = result.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = result[mid].start!

      if (midTime === time) return mid
      else if (midTime < time) low = mid + 1
      else high = mid - 1
    }
    return low
  }

  for (const line of data.yrc.lyric.trim().matchAll(extractyrcRegex)) {
    const lyric = _parseYrcLine(line)
    result.splice(binarySearch(lyric), 0, lyric)
  }

  const lrcList = ['ytlrc', 'yromalrc'] as const
  const lrcMap = { ytlrc: ['tlyric', ''], yromalrc: ['rlyric', ' '] }
  lrcList.forEach((lrc) => {
    if (data[lrc]) {
      for (const line of data[lrc]?.lyric.trim().matchAll(extractyrcRegex)) {
        const { start, cInfo } = _parseLrcLine(line)
        const matchedLyric = result.find((lyric) => lyric.start === start)
        if (!matchedLyric) continue
        const _start = matchedLyric.lyric.info
          ? matchedLyric.lyric.info[0].start
          : matchedLyric.start * 1000
        const end = matchedLyric.lyric.info
          ? matchedLyric.lyric.info.at(-1).end
          : matchedLyric.end * 1000
        const info = [{ start: Math.max(100, _start), end, word: cInfo }]
        matchedLyric[lrcMap[lrc][0]] = { info, text: cInfo }
      }
    }
  })

  return result
}

export const lrcLyricParse = (data: {
  lrc: { lyric: string }
  tlyric: { lyric: string }
  romalrc: { lyric: string }
}) => {
  const result: lyricLine[] = []

  const extractyrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm

  const binarySearch = (lyric: Partial<lyricLine>) => {
    const time = lyric.start!

    let low = 0
    let high = result.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = result[mid].start!

      if (midTime === time) return mid
      else if (midTime < time) low = mid + 1
      else high = mid - 1
    }
    return low
  }

  for (const line of data.lrc.lyric.trim().matchAll(extractyrcRegex)) {
    const _line = _parseLrcLine(line)
    const lyric = { start: _line.start, end: 0, lyric: { text: _line.cInfo } }
    result.splice(binarySearch(lyric), 0, lyric)
  }

  const lrcList = ['tlyric', 'romalrc']
  const lrcMap = { tlyric: ['tlyric', ''], romalrc: ['rlyric', ' '] }

  lrcList.forEach((lrc) => {
    if (data[lrc]) {
      for (const line of data[lrc]?.lyric.trim().matchAll(extractyrcRegex)) {
        const { start, cInfo } = _parseLrcLine(line)
        const matchedLyric = result.find((lyric) => lyric.start === start)
        if (!matchedLyric) continue
        matchedLyric[lrcMap[lrc][0]] = { text: cInfo }
      }
    }
  })

  result.forEach((line, index) => {
    const nextLine = result[index + 1]
    if (nextLine) line.end = nextLine.start
  })

  return result
}

const mapTrackPlayableStatus = (tracks: any[], privileges: any[] = []) => {
  if (tracks?.length === undefined) return tracks
  return tracks.map((t) => {
    const privilege = privileges.find((item) => item.id === t.id) || {}
    if (t.privilege) {
      Object.assign(t.privilege, privilege)
    } else {
      t.privilege = privilege
    }
    const result = isTrackPlayable(t)
    t.playable = result.playable
    t.reason = result.reason
    t.type = 'online'
    t.matched = true
    t.cache = false
    t.source = 'netease'
    return t
  })
}

const isTrackPlayable = (track: any) => {
  const user = Cache.get(CacheAPIs.loginStatus)
  const result = {
    playable: true,
    reason: ''
  }
  if (track?.privilege?.pl > 0) {
    return result
  }
  // cloud storage judgement logic
  if (user.userId !== 0 && track?.privilege?.cs) {
    return result
  }
  if (track.fee === 1 || track.privilege?.fee === 1) {
    if (user.userId !== 0 && user.vipType === 11) {
      result.playable = true
    } else {
      result.playable = false
      result.reason = 'VIP Only'
    }
  } else if (track.fee === 4 || track.privilege?.fee === 4) {
    result.playable = false
    result.reason = '付费专辑'
  } else if (track.noCopyrightRcmd !== null && track.noCopyrightRcmd !== undefined) {
    result.playable = false
    result.reason = '无版权'
  } else if (track.privilege?.st < 0 && user.userId !== 0) {
    result.playable = false
    result.reason = '已下架'
  }
  return result
}

export const getAudioSourceFromNetease = async (track: any): Promise<{ [key: string]: any }> => {
  const getBr = () => {
    const quality = store.get('settings.musicQuality')
    return quality === 'flac' ? 350000 : quality
  }
  const getMP3 = async (id: string) => {
    return request({
      url: '/song/url',
      method: 'get',
      params: {
        id,
        br: getBr()
      }
    })
  }

  return getMP3(track.id)
    .then((result: any) => {
      const br = result.data[0]?.br || 128000
      const gain = result.data[0]?.gain || 0
      const peak = result.data[0]?.peak || 1
      // if (!result.data[0]) return null
      if (!result.data[0] || !result.data[0].url || result.data[0].freeTrialInfo !== null) {
        return { url: null, br, gain, peak }
      }
      const source = result.data[0].url.replace(/^http:/, 'https:')
      return { url: source, br, gain, peak }
    })
    .catch(() => {
      const url = `https://music.163.com/song/media/outer/url?id=${track.id}`
      return { url, br: 128000, gain: 0, peak: 1 }
    })
}

export const getAudioSource = async (track: any) => {
  const enableUNM = (store.get('settings.unblockNeteaseMusic.enable') as boolean) || true
  let source = 'netease'

  // 缓存里没有，从网易云里获取
  const trackInfo = await getAudioSourceFromNetease(track)

  // 网易云里没有，从unblock里获取
  if (!trackInfo.url && enableUNM) {
    const res = await getAudioSourceFromUnblock(track)
    trackInfo.url = res.url
    source = res.source
  }
  trackInfo.source = source
  return trackInfo
}

export const getTrackDetail = (ids: string) => {
  return request({
    url: '/song/detail',
    method: 'get',
    params: { ids }
  })
}

export const getAudioSourceFromUnblock = async (track: any) => {
  const source = (store.get('settings.unblockNeteaseMusic.source') as string) || ''
  const sourceList = source
    ? source.split(',').map((s) => s.trim().toLowerCase())
    : ['bodian', 'kuwo', 'kugou', 'ytdlp', 'qq', 'bilibili', 'pyncmd', 'migu']

  const qqCookie = (store.get('settings.unblockNeteaseMusic.qqCookie') as string) || ''
  const jooxCookie = store.get('settings.unblockNeteaseMusic.jooxCookie') as string
  const enableFlac = store.get('settings.unblockNeteaseMusic.enableFlac') as boolean
  const orderFirst = store.get('settings.unblockNeteaseMusic.orderFirst') as boolean

  process.env.ENABLE_LOCAL_VIP = 'true'
  process.env.QQ_COOKIE = qqCookie || ''
  process.env.JOOX_COOKIE = jooxCookie || ''
  process.env.ENABLE_FLAC = enableFlac ? 'true' : 'false'
  process.env.FOLLOW_SOURCE_ORDER = orderFirst ? 'true' : 'false'

  const match = require('@unblockneteasemusic/server')

  const proxy = store.get('settings.proxy') as { type: 0 | 1 | 2; address: string; port: string }
  const map = { 1: 'http', 2: 'https' }
  const url = `${map[proxy.type]}://${proxy.address}:${proxy.port}`

  global.proxy = proxy && proxy.type !== 0 ? new URL(url) : null

  return match(track.id, sourceList).catch((error) => {
    console.log('=== unblock error ===', global.proxy, error)
    return null
  })
}

export const deleteExcessCache = async (deleteAll = false): Promise<boolean> => {
  const tracks = Cache.get(CacheAPIs.LocalMusic, { sql: "type = 'online'" })

  if (deleteAll) {
    try {
      const ids = tracks.songs.map((s: any) => {
        fs.promises.rm(s.url, { force: true })
        return s.id
      })
      if (ids.length > 0) db.deleteMany(Tables.Track, ids)
      return true
    } catch (error) {
      log.error('清理全量缓存失败:', error)
      return false
    }
  }

  const sizeLimit = store.get('settings.autoCacheTrack.sizeLimit') as boolean | number
  if (sizeLimit === false) return true

  const songs = [...tracks.songs].sort((a: any, b: any) => a.insertTime - b.insertTime)

  let currentTotalSize = songs.reduce((acc: number, cur: any) => acc + Number(cur.size), 0)
  const limitInBytes = (sizeLimit as number) * 1024 * 1024

  try {
    const deletedIds: number[] = []

    while (currentTotalSize > limitInBytes && songs.length > 0) {
      const target = songs.shift()
      if (!target) break

      try {
        await fs.promises.unlink(target.url)
        deletedIds.push(target.id)
        currentTotalSize -= Number(target.size)
      } catch (fileError: any) {
        if (fileError.code === 'ENOENT') {
          deletedIds.push(target.id)
        } else {
          log.error(`文件删除失败: ${target.url}`, fileError)
        }
      }
    }

    if (deletedIds.length > 0) {
      db.deleteMany(Tables.Track, deletedIds)
      log.info(`自动清理完成，共删除 ${deletedIds.length} 首缓存歌曲`)
    }

    return true
  } catch (error) {
    log.error('循环清理超额缓存失败:', error)
    return false
  }
}

export const formatTime = (time: number, rate: number = 1000) => {
  const totalSeconds = time / rate
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  let secondsStr = seconds.toFixed(1)
  if (seconds < 10 && secondsStr.length < 4) {
    secondsStr = '0' + secondsStr
  }

  const minutesStr = String(minutes).padStart(2, '0')
  return `[${minutesStr}:${secondsStr}]`
}

export const cleanFontName = (fontName: string) => {
  return fontName
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\./, '')
}

export const createWorker = (name: string) => {
  const workerPath = path.join(__dirname, `workers/${name}.js`)
  const worker = new Worker(workerPath)

  worker.on('error', (error) => log.error(`[Worker ${name}] error: `, error))
  worker.on('exit', (code) => log.info(`[Worker ${name}] exited with code ${code}`))

  return worker
}
