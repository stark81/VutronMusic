import { net } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { IAudioMetadata, parseFile } from 'music-metadata'
import request from '../appServer/request'
import { CacheAPIs } from './CacheApis'
import Cache from '../cache'
import store from '../store'

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
        ? common.lyrics[0].syncText[0].text
        : (common.lyrics[0].text ?? '')
    }
    // lyrics = common.lyrics.length
    //   ? ((common.lyrics[0].text ??
    //       (common.lyrics[0].syncText || common.lyrics[0].syncText[0]?.text) ??
    //       common.lyrics[0]) as string)
    //   : ''
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

export const getLyricFromLocalTrack = async (metadata: IAudioMetadata) => {
  let result = {
    lrc: { lyric: [] },
    tlyric: { lyric: [] },
    romalrc: { lyric: [] }
  }

  const lyrics = getLyricFromMetadata(metadata)

  if (lyrics) {
    const splitLines = (str: string) => {
      if (str.includes('\r\n')) {
        return str.split('\r\n')
      } else if (str.includes('\r')) {
        return str.split('\r')
      } else {
        return str.split('\n')
      }
    }
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

    if (lyricArray.length) {
      result = {
        lrc: { lyric: lyricArray[0] || [] },
        tlyric: { lyric: lyricArray[1] || [] },
        romalrc: { lyric: lyricArray[2] || [] }
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

export const getLyricFromApi = (
  id: number
): Promise<{
  lrc: {
    lyric: any[]
  }
  tlyric: {
    lyric: any[]
  }
  romalrc: {
    lyric: any[]
  }
}> => {
  return request({
    url: '/lyric',
    method: 'get',
    params: {
      id
    }
  }).catch(() => ({
    lrc: {
      lyric: []
    },
    tlyric: {
      lyric: []
    },
    romalrc: {
      lyric: []
    }
  }))
}

export const getLyric = async (
  id: number,
  matched: boolean,
  paramForLocal: IAudioMetadata | string | null
): Promise<{
  lrc: {
    lyric: any[]
  }
  tlyric: {
    lyric: any[]
  }
  romalrc: {
    lyric: any[]
  }
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
    t.isLocal = false
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

const getAudioSourceFromNetease = (track: any): Promise<string> => {
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
      if (!result.data[0]) return null
      if (!result.data[0].url) return null
      if (result.data[0].freeTrialInfo !== null) return null
      const source = result.data[0].url.replace(/^http:/, 'https:')
      return source
    })
    .catch(() => {
      return `https://music.163.com/song/media/outer/url?id=${track.id}`
    })
}

export const getAudioSource = async (track: any) => {
  let source = 'netease'
  // 先从缓存里取

  // 缓存里没有，从网易云里获取
  let url = await getAudioSourceFromNetease(track)

  // 网易云里没有，从unblock里获取
  if (!url) {
    const res = await getAudioSourceFromUnblock(track)
    url = res.url
    source = res.source
  }
  return { url, source }
}

export const getTrackDetail = (ids: string) => {
  return request({
    url: '/song/detail',
    method: 'get',
    params: { ids }
  })
}

// export const getAudioSourceFromUnblock = async (track: any) => {
//   const UNM = require('@unblockneteasemusic/rust-napi')
//   const unmExecutor = new UNM.Executor()
//   const ar = track.ar || track.artists
//   const song = {
//     id: track.id.toString(),
//     name: track.name,
//     duration: track.dt || track.duration,
//     album: track.al && {
//       id: track.al.id && track.al.id.toString(),
//       name: track.al.name
//     },
//     artists: ar ? ar.map(({ id, name }) => ({ id: id && id.toString(), name })) : []
//   }
//   // console.log('unmExecutor: ', unmExecutor)
//   // console.log('song: ', song)
//   const sourceList = ['qq', 'kugou', 'kuwo', 'bilibili', 'pyncm']
//   const context = {
//     enableFlac: true,
//     proxyUri: null,
//     searchMode: 1,
//     config: {
//       'joox:cookie': null,
//       'qq:cookie':
//         'uin=849966181;qm_keyst=Q_H_L_5cNaoPJ68-8t2eXh5tdKyzM-x9CYUYWuuw43ERacPEP0RnSTgxCZoKg;',
//       'ytdl:exe': '/Users/stark81/Environment/anaconda3/bin/yt-dlp'
//     }
//   }
//   const matchedAudio = await unmExecutor.search(sourceList, song, context)
//   console.log('matchedAudio: ', matchedAudio)
//   const retrevedSong = await unmExecutor.retrieve(matchedAudio, context)

//   console.log('retrevedSong: ', retrevedSong)
// }

export const getAudioSourceFromUnblock = async (track: any) => {
  const match = require('@unblockneteasemusic/server')
  return match(track.id, ['kuwo', 'qq', 'kugou', 'bilibili', 'pyncmd', 'migu'])
}
