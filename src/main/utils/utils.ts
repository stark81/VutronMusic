import { app, net } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { IAudioMetadata, parseFile } from 'music-metadata'
import request from '../appServer/request'
import { CacheAPIs } from './CacheApis'
import Cache from '../cache'
import store from '../store'
import navidrome from '../streaming/navidrome'
import emby from '../streaming/emby'

import { Readable } from 'stream'
import { db, Tables } from '../db'

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
  } else {
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
  }
  return lyrics
}

const splitLines = (str: string) => {
  if (str.includes('\r\n')) {
    return str.split('\r\n')
  } else if (str.includes('\r')) {
    return str.split('\r')
  } else {
    return str.split('\n')
  }
}

export const parseLyricString = (lyrics: string) => {
  const lyricsLines = splitLines(lyrics)
  const groupedResult: Array<string>[] = lyricsLines.reduce(
    (acc: string[][], curr) => {
      if (curr === '') {
        acc.push([])
        acc[acc.length - 1].push(curr)
      } else {
        acc[acc.length - 1].push(curr)
      }
      return acc
    },
    [[]]
  )
  const lyricArray = groupedResult.filter((item) => item.length > 1)
  return lyricArray
}

export const getLyricFromLocalTrack = async (metadata: IAudioMetadata) => {
  let result = {
    lrc: { lyric: [] },
    tlyric: { lyric: [] },
    romalrc: { lyric: [] },
    yrc: { lyric: [] },
    ytlrc: { lyric: [] },
    yromalrc: { lyric: [] }
  }

  const lyrics = getLyricFromMetadata(metadata)

  if (lyrics) {
    const lyricArray = parseLyricString(lyrics)

    if (lyricArray.length) {
      result = {
        lrc: { lyric: lyricArray[0] || [] },
        tlyric: { lyric: lyricArray[1] || [] },
        romalrc: { lyric: lyricArray[2] || [] },
        yrc: { lyric: [] },
        ytlrc: { lyric: [] },
        yromalrc: { lyric: [] }
      }
    }
  }
  return result
}

export const getColorFromMetadata = async (metadata: IAudioMetadata) => {
  const { pic } = await getPicFromMetadata(metadata)
  const Vibrant = require('node-vibrant')
  const Color = require('color')
  const palette = await Vibrant.from(pic, {
    colorCount: 1
  }).getPalette()
  const originColor = Color.rgb(palette.DarkMuted._rgb)
  const color = originColor.darken(0.1).rgb().string()
  const color2 = originColor.lighten(0.28).rotate(-30).rgb().string()
  return { color, color2 }
}

export const getReplayGainFromMetadata = (metadata: IAudioMetadata) => {
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

export const createMD5 = (filePath: string) => {
  const hash = crypto.createHash('md5')
  const data = fs.readFileSync(filePath)
  hash.update(data)
  return hash.digest('hex')
}

export const splitArtist = (artist: string | undefined) => {
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

// new
const getPicOnline = async (url: string) => {
  let pic: Buffer | null = null
  let format: string = ''
  if (!url.includes('?param=')) {
    url = `${url}?param=512y512`
  }
  pic = await net
    .fetch(url)
    .then((res) => {
      format = res.headers.get('Content-Type')
      return res.arrayBuffer()
    })
    .then((res) => Buffer.from(res))
  return { pic, format }
}

const getPicFromMetadata = async (metadata: IAudioMetadata) => {
  let pic: Buffer
  let format: string
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    pic = Buffer.from(metadata.common.picture[0].data)
    format = metadata.common.picture[0].format
  }
  return { pic, format }
}

export const getPic = async (
  url: string,
  matched: boolean,
  metadata: IAudioMetadata | null
): Promise<{ pic: Buffer; format: string }> => {
  if (!metadata) {
    const res = await getPicOnline(url)
    return res
  } else {
    const methodPools: any[][] = [[getPicFromMetadata, metadata]]
    // const useInnerFirst = store.get('settings.innerFirst') as boolean

    if (matched) {
      methodPools.unshift([getPicOnline, url])
    } else {
      methodPools.push([getPicOnline, url])
    }

    let [fn, params] = methodPools.shift()
    let result = await fn(params)

    if (!result.pic && methodPools.length > 0) {
      ;[fn, params] = methodPools.shift()
      result = await fn(params)
    }
    return result
  }
}

export const getPicColor = async (pic: Buffer) => {
  const Vibrant = require('node-vibrant')
  const Color = require('color')
  try {
    const palette = await Vibrant.from(pic, {
      colorCount: 1
    }).getPalette()
    const originColor = Color.rgb(palette.DarkMuted._rgb)
    const color = originColor.darken(0.1).rgb().string()
    const color2 = originColor.lighten(0.28).rotate(-30).rgb().string()
    return { color, color2 }
  } catch (error) {
    return { color: null, color2: null }
  }
}

export const getLyricFromApi = async (
  id: number
): Promise<{
  lrc: { lyric: any[] }
  tlyric: { lyric: any[] }
  romalrc: { lyric: any[] }
  yrc: { lyric: any[] }
  ytlrc: { lyric: any[] }
  yromalrc: { lyric: any[] }
}> => {
  try {
    return await request({
      url: '/lyric/new',
      method: 'get',
      params: {
        id
      }
    })
  } catch {
    return {
      lrc: { lyric: [] },
      tlyric: { lyric: [] },
      romalrc: { lyric: [] },
      yrc: { lyric: [] },
      ytlrc: { lyric: [] },
      yromalrc: { lyric: [] }
    }
  }
}

export const getLyric = async (
  id: number,
  matched: boolean,
  paramForLocal: IAudioMetadata | string | null
): Promise<{
  lrc: { lyric: any[] }
  tlyric: { lyric: any[] }
  romalrc: { lyric: any[] }
  yrc: { lyric: any[] }
  ytlrc: { lyric: any[] }
  yromalrc: { lyric: any[] }
}> => {
  const methodPools = []
  if (matched) methodPools.push([getLyricFromApi, id])
  if (paramForLocal !== null) methodPools.push([getLyricFromLocalTrack, paramForLocal])

  let [getlyricFn, param] = methodPools.shift()
  if (typeof param === 'string') {
    param = await parseFile(decodeURI(param))
  }
  let lyrics = await getlyricFn(param)
  if (!lyrics.lrc?.lyric && methodPools.length > 0) {
    ;[getlyricFn, param] = methodPools.shift()
    if (typeof param === 'string') {
      param = await parseFile(decodeURI(param))
    }
    lyrics = await getlyricFn(param)
  }
  return lyrics
}

export const handleNeteaseResult = (name: string, result: any) => {
  switch (name) {
    case CacheAPIs.Playlist: {
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
    default:
      return result
  }
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

const getAudioSourceFromNetease = async (track: any): Promise<{ [key: string]: any }> => {
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
    : ['kuwo', 'kugou', 'ytdlp', 'qq', 'bilibili', 'pyncmd', 'migu']

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
  return match(track.id, sourceList)
}

export const cacheOnlineTrack = async (track: any) => {
  return new Promise<{ filePath: string; size: string }>((resolve) => {
    fetch(track.url).then((response) => {
      const typeMap = {
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/flac': 'flac',
        'audio/x-m4a': 'm4a',
        'audio/m4a': 'm4a',
        'audio/aac': 'aac',
        'audio/mp4': 'mp4'
      }

      const contentType = response.headers.get('Content-Type')
      const size = response.headers.get('Content-Length')
      const audioCachePath = app.getPath('userData') + '/audioCache'
      if (!fs.existsSync(audioCachePath)) {
        fs.mkdirSync(audioCachePath)
      }

      const filePath = `${audioCachePath}/${track.id}-${track.br}-${track.name}.${typeMap[contentType!] || 'mp3'}`
      resolve({ filePath, size })

      const writeStream = fs.createWriteStream(filePath)
      const readableStream = response.body

      const nodeReadable = Readable.fromWeb(readableStream)
      nodeReadable.pipe(writeStream)

      writeStream.on('finish', () => {
        // 检测缓存文件的占用是否大于缓存尺寸，是则清理最开始的数据
        deleteExcessCache()
      })
    })
  })
}

export const deleteExcessCache = (deleteAll = false) => {
  const tracks = Cache.get(CacheAPIs.LocalMusic, { sql: "type = 'online'" })
  if (deleteAll) {
    try {
      const ids = tracks.songs.map((s: any) => s.id)
      if (ids.length > 0) db.deleteMany(Tables.Track, ids)
      const audioCachePath = app.getPath('userData') + '/audioCache'
      if (fs.existsSync(audioCachePath)) {
        fs.rmSync(audioCachePath, { recursive: true })
      }
      return true
    } catch {
      return false
    }
  }
  const sizeLimit = store.get('settings.autoCacheTrack.sizeLimit') as boolean | number
  if (sizeLimit === false) return
  const songs = tracks.songs.sort((a: any, b: any) => a.insertTime - b.insertTime) as any[]
  const urls = songs.map((s: any) => s.url) as string[]
  const size = songs
    .map((s: any) => s.size)
    .reduce((acc: any, cur: any) => Number(acc) + Number(cur), 0)
  if (size > (sizeLimit as number) * 1000 * 1000) {
    fs.unlink(urls[0], () => {
      db.deleteMany(Tables.Track, [songs[0].id])
    })
  }
}

const getNavidromeLyric = async (url: string) => {
  const result = {
    lrc: { lyric: [] },
    tlyric: { lyric: [] },
    romalrc: { lyric: [] },
    yrc: { lyric: [] },
    ytlrc: { lyric: [] },
    yromalrc: { lyric: [] }
  }
  const lyricRaw: any[] = await fetch(url)
    .then((res) => {
      if (res.ok) {
        return res.json()
      }
    })
    .then((data) => {
      const lyricArray = data['subsonic-response'].lyricsList.structuredLyrics
      return lyricArray ? lyricArray[0].line : []
    })

  if (lyricRaw.length) {
    const map = new Map()
    lyricRaw.forEach(({ start, value }) => {
      if (!map.has(start)) {
        map.set(start, [])
      }
      map.get(start).push(value)
    })

    const sortedStarts = Array.from(map.keys()).sort((a, b) => a - b)
    sortedStarts.forEach((start) => {
      const values = map.get(start)
      // 生成时间前缀
      const timeStr = formatTime(start)
      // 根据规则：第一个放 lrc，第二个放 tlyric，第三个放 rlyric
      if (values[0]) result.lrc.lyric.push(`${timeStr}${values[0]}`)
      if (values[1]) result.tlyric.lyric.push(`${timeStr}${values[1]}`)
      if (values[2]) result.romalrc.lyric.push(`${timeStr}${values[2]}`)
    })
  }
  return result
}

const formatTime = (ms: number) => {
  const totalSeconds = ms / 1000 // 将毫秒转换为秒
  const minutes = Math.floor(totalSeconds / 60) // 计算分钟
  const seconds = totalSeconds - minutes * 60 // 计算剩余的秒数（含小数部分）
  // 保留一位小数，并确保秒数部分总是两位（比如 "05.0"）
  let secondsStr = seconds.toFixed(1)
  if (seconds < 10 && secondsStr.length < 4) {
    secondsStr = '0' + secondsStr
  }
  // 格式化分钟，确保两位
  const minutesStr = String(minutes).padStart(2, '0')
  return `[${minutesStr}:${secondsStr}]`
}

export const getStreamPic = (ids: string) => {
  const service =
    (store.get('accounts.selected') as ['navidrome', 'emby', 'jellyfin'][number]) || 'navidrome'
  if (service === 'navidrome') {
    const [id, size] = ids.split('/')
    return fetch(navidrome.getPic(id, size ? Number(size) : null))
  } else if (service === 'emby') {
    const [id, primary, size] = ids.split('/')
    const url = emby.getPic(Number(id), primary, Number(size))
    return fetch(url)
  }
}

export const getStreamMusic = (id: string, headers?: any) => {
  const service =
    (store.get('accounts.selected') as ['navidrome', 'emby', 'jellyfin'][number]) || 'navidrome'

  if (service === 'navidrome') {
    return fetch(navidrome.getStream(id), { headers })
  } else if (service === 'emby') {
    return fetch(emby.getStrem(id), { headers })
  }
}

export const getStreamLyric = async (id: string) => {
  const service =
    (store.get('accounts.selected') as ['navidrome', 'emby', 'jellyfin'][number]) || 'navidrome'

  if (service === 'navidrome') {
    const url = navidrome.getLyricByID(id)
    const lyrics = await getNavidromeLyric(url)
    return lyrics
  } else if (service === 'emby') {
    const [idx, ,] = id.split('/')
    const lyrics = await emby.getLyric(Number(idx))
    return lyrics
  }
}
