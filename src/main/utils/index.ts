import { app, net } from 'electron'
import fs from 'fs'
import path from 'path'
import jschardet from 'jschardet'
import iconv from 'iconv-lite'
import { fileTypeFromBuffer } from 'file-type'
import { IAudioMetadata, parseFile } from 'music-metadata'
import { db, Tables } from '../db'
import { deleteCacheFromDB } from '../dbHelpers'
import store from '../store'

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

// Vorbis Comment 歌词字段（FLAC/OGG），按优先级排列
const VORBIS_LYRIC_IDS = ['LYRICS', 'UNSYNCEDLYRICS', 'SYNCEDLYRICS']
// ID3v2 歌词帧（MP3）
const ID3_LYRIC_IDS = ['USLT', 'SYLT']
// APEv2 歌词字段（APE/WV），大小写不敏感匹配
const APE_LYRIC_IDS = ['LYRICS', 'UNSYNCEDLYRICS']

/**
 * 从音频元数据中提取歌词文本
 * 优先从原生标签提取（Vorbis/ID3v2/APEv2），兜底使用 common.lyrics（覆盖 iTunes/MP4、ASF 等格式）
 */
export const getLyricFromMetadata = (metadata: IAudioMetadata) => {
  const { common, format, native } = metadata

  // 1. 优先从原生标签提取
  for (const tagType of format.tagTypes ?? []) {
    let lyricIds: string[]
    let extractValue: (value: any) => string

    switch (tagType) {
      case 'vorbis':
        lyricIds = VORBIS_LYRIC_IDS
        // Vorbis Comment 的值直接是字符串
        extractValue = (v) => v
        break
      case 'ID3v2.3':
      case 'ID3v2.4':
        lyricIds = ID3_LYRIC_IDS
        // USLT: { language, descriptor, text } → 取 text
        // SYLT: { syncText: [{ text, timestamp }] } → 拼接所有文本行
        extractValue = (v) =>
          v?.text ??
          (Array.isArray(v?.syncText) ? v.syncText.map((s: any) => s.text).join('\n') : '')
        break
      case 'APEv2':
        lyricIds = APE_LYRIC_IDS
        // APEv2 的值直接是字符串
        extractValue = (v) => v
        break
      default:
        // 其他标签格式（iTunes/ASF 等）交给兜底逻辑处理
        continue
    }

    // 按 lyricIds 优先级查找，大小写不敏感匹配
    const tags = native[tagType] ?? []
    for (const id of lyricIds) {
      const tag = tags.find((t) => t.id.toUpperCase() === id)
      if (tag) {
        const lyrics = extractValue(tag.value)
        if (lyrics) return lyrics
      }
    }
  }

  // 2. 兜底：从 common.lyrics 提取（覆盖 iTunes/MP4、ASF 等格式）
  if (common.lyrics) {
    if (typeof common.lyrics[0] === 'string') {
      return common.lyrics[0]
    } else if (typeof common.lyrics[0] === 'object') {
      const lyrics = common.lyrics[0].syncText
        ? common.lyrics[0].syncText.map((s: any) => s.text).join('\n')
        : (common.lyrics[0].text ?? '')
      if (lyrics) return lyrics
    }
  }

  return ''
}

export const parseLyricString = (lyrics: string): lyricLine[] => {
  if (!lyrics) return []

  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const chineseRegex = /[\u4E00-\u9FFF]/
  const result: lyricLine[] = []
  const lyricMap = new Map<number, lyricLine[]>()
  const lrcResult: lyricLine[] = []

  for (const line of lyrics.trim().matchAll(extractLrcRegex)) {
    const { content } = line.groups as { content: string }
    if (/\(\d+,\d+,\d+\)/.test(content)) {
      const lyric = _parseYrcLine(line)!
      if (!lyricMap.has(lyric.start)) {
        lyricMap.set(lyric.start, [])
      }
      lyricMap.get(lyric.start)!.push(lyric)
    } else if (/\[\d{2}:\d{2}\.\d{3}\]/.test(content)) {
      const lyric = _parseWrcLine(line)!
      if (!lyricMap.has(lyric.start)) {
        lyricMap.set(lyric.start, [])
      }
      lyricMap.get(lyric.start)?.push(lyric)
    } else if (/^<[\d:.]+>/.test(content)) {
      const lyric = _parseEnhancedLrcLine(line)
      if (!lyric) continue
      if (!lyricMap.has(lyric.start)) lyricMap.set(lyric.start, [])
      lyricMap.get(lyric.start)!.push(lyric)
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
    lyricMap.get(line.start)?.push(line)
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

export const getLyricFromEmbedded = async (filePath: string) => {
  let result: lyricLine[] = []

  const metadata = await parseFile(decodeURI(filePath))

  const lyrics = getLyricFromMetadata(metadata)

  if (lyrics) {
    result = parseLyricString(lyrics)
  }
  return result
}

export const getLyricFromPath = async (filePath: string) => {
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
      format = res.headers.get('Content-Type')!
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
  let pic: Buffer | null = null
  let format: string = ''
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
  const type = (await fileTypeFromBuffer(pic))!
  format = type.mime
  return { pic, format }
}

export const getPic = async (track: any): Promise<{ pic: Buffer; format: string }> => {
  const trackInfoOrder = (store.get(
    'settings.sourcePriority.trackInfoOrder'
  ) as TrackInfoOrder[]) || ['path', 'online', 'embedded']

  let res: { pic: Buffer<ArrayBufferLike> | null; format: string } = { pic: null, format: '' }
  const url = track.album?.picUrl || track.al?.picUrl

  for (const order of trackInfoOrder) {
    if (order === 'online') {
      res = (await getPicFromApi(url)) as { pic: Buffer; format: string }
    } else if (order === 'path' && track.filePath) {
      const prefixs = ['.jpg', '.png', '.jpeg', '.webp']
      for (const prefix of prefixs) {
        const filePath = track.filePath.replace(/\.[^/.]+$/, prefix)
        res = await fs.promises
          .access(filePath, fs.constants.F_OK)
          .then(async () => {
            return await getPicFromPath(filePath)
          })
          .catch(() => ({ pic: null, format: '' }))
        if (res?.pic) break
      }
    } else if (order === 'embedded' && track.filePath) {
      res = (await getPicFromEmbedded(track.filePath)) as { pic: Buffer; format: string }
    }
    if (res.pic) return res as { pic: Buffer; format: string }
  }
  res = (await getPicFromApi(url)) as { pic: Buffer; format: string }
  return res as { pic: Buffer; format: string }
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

const _parseYrcLine = (line: RegExpExecArray) => {
  const timestampRegex = /\[(\d+),(\d+)\]/g
  const extractTimestampRegex = /\((\d+),(\d+),\d+\)([^(]+)/g

  const { lyricTimestamps, content } = line.groups!
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

  const { lyricTimestamps, content } = line.groups!
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

  const { lyricTimestamps, content } = line.groups!
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

const _parseEnhancedLrcLine = (line: RegExpExecArray) => {
  const { lyricTimestamps, content } = line.groups!
  const converted = content
    .replace(/^<[\d:.]+>/, '') // 去掉开头与行时间戳重复的那个
    .replace(/<([\d:.]+)>/g, '[$1]')
  const fakeMatch = Object.assign([lyricTimestamps + converted] as unknown as RegExpExecArray, {
    index: 0,
    input: lyricTimestamps + converted,
    groups: { lyricTimestamps, content: converted }
  })
  const result = _parseWrcLine(fakeMatch)
  if (result?.lyric?.info) {
    result.lyric.info = result.lyric.info.filter((item) => item.word.trim() !== '')
    result.lyric.text = result.lyric.info.map((item) => item.word).join('')
  }
  return result
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
    const lyric = _parseYrcLine(line)!
    result.splice(binarySearch(lyric), 0, lyric)
  }

  const lrcList = ['ytlrc', 'yromalrc'] as const
  const lrcMap = { ytlrc: ['tlyric', ''], yromalrc: ['rlyric', ' '] } as const
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
          ? matchedLyric.lyric.info.at(-1)!.end
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

  const lrcList = ['tlyric', 'romalrc'] as const
  const lrcMap = { tlyric: ['tlyric', ''], romalrc: ['rlyric', ' '] } as const

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

export const deleteExcessCache = async (deleteAll = false): Promise<boolean> => {
  const audioCachePath =
    (store.get('settings.autoCacheTrack.path') as string) ||
    path.join(app.getPath('userData'), 'audioCache')

  const rows = db.sqlite
    .prepare(`SELECT rowid, * FROM ${Tables.Audio} WHERE filePath LIKE ?  ORDER BY rowid ASC`)
    .all(`${audioCachePath}%`) as Record<string, any>[]

  if (deleteAll) {
    try {
      // 先删磁盘文件，文件删除失败不阻塞 DB 操作
      for (const r of rows) {
        fs.promises.unlink(r.filePath).catch(() => {})
      }
      const ids = rows.map((r) => r.id)
      const trackIds = [...new Set(rows.map((r) => r.trackId))]
      deleteCacheFromDB(ids, trackIds)
      log.info(`全量清理完成，共删除 ${ids.length} 首缓存歌曲`)
      return true
    } catch (error) {
      log.error('清理全量缓存失败:', error)
      return false
    }
  }

  const sizeLimit = store.get('settings.autoCacheTrack.sizeLimit') as boolean | number
  if (sizeLimit === false) return true

  let currentTotalSize = rows.reduce((acc: number, cur: any) => acc + Number(cur.size), 0)
  const limitInBytes = (sizeLimit as number) * 1024 * 1024

  try {
    const deletedIds: string[] = []

    for (const row of rows) {
      if (currentTotalSize <= limitInBytes) break
      deletedIds.push(row.id)
      currentTotalSize -= Number(row.size)
    }

    if (deletedIds.length > 0) {
      const deletedIdSet = new Set(deletedIds)
      // 先删磁盘文件
      for (const row of rows) {
        if (deletedIdSet.has(row.id)) {
          fs.promises.unlink(row.filePath).catch(() => {})
        }
      }
      // 再删 DB 记录
      const deletedAudios = rows.filter((r) => deletedIdSet.has(r.id))
      const trackIds = [...new Set(deletedAudios.map((r) => r.trackId))]
      deleteCacheFromDB(deletedIds, trackIds)
      log.info(`自动清理完成，共删除 ${deletedIds.length} 首缓存歌曲`)
    }

    return true
  } catch (error) {
    log.error('清理超额缓存失败:', error)
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
