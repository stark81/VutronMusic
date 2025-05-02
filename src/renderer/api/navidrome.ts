import axios from 'axios'
import MD5 from 'crypto-js/md5'
import qs from 'qs'
import { getStreamInfo } from '../utils/db'
// import { useStreamMusicStore } from '../store/streamingMusic'

const apiVersion = '1.16.1'
const client = 'VutronMusic'
// const streamMusicStore = useStreamMusicStore()

const generateToken = (password: string, salt: string) => {
  return MD5(password + salt).toString()
}

const ApiRequest = async (endpoint: string, params?: Record<string, string>) => {
  const result = await getStreamInfo('navidrome')
  if (!result) return
  const headers = {
    'x-nd-authorization': `Bearer ${result.authorization}`,
    'x-nd-client-unique-id': result.clientID,
    timeout: 15000
  }
  const queryString = new URLSearchParams(params).toString()
  const url = `${result.url}/api/${endpoint}?${queryString}`
  return axios
    .get(url, { headers })
    .then((res) => ({ code: 200, message: res.statusText, data: res.data }))
    .catch(() => ({ code: 504, message: '连接navidrom服务器失败', data: undefined }))
}

export const getRestUrl = async (
  endpoint: string,
  params?: Record<string, any>,
  isMetadata = false
) => {
  const result = await getStreamInfo('navidrome')
  if (!result) return
  const array = new Uint8Array(6)
  crypto.getRandomValues(array)
  const salt = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0')) // 转换为两位十六进制
    .join('')
  const token = generateToken(result.password, salt)

  const queryString = qs.stringify(
    {
      u: result.username,
      t: token,
      s: salt,
      v: apiVersion,
      c: client,
      f: 'json',
      ...params
    },
    { arrayFormat: 'repeat' }
  )
  const webURL = `${result.url}/rest/${endpoint}?${queryString}`
  const base64url = encodeURIComponent(webURL) // Buffer.from(webURL).toString('base64')
  const atomUrl = `atom://get-stream/${base64url}`
  return `${window.env?.isElectron && !isMetadata ? atomUrl : webURL}`
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

export const navidromeLogin = async (params: {
  url: string
  username: string
  password: string
}) => {
  const url = `${params.url}/auth/login`
  const data = { username: params.username, password: params.password }
  const headers = { 'content-type': 'application/json' }
  try {
    const result = await axios.post(url, data, { headers })
    return { code: 200, data: result.data }
  } catch (error: any) {
    return { code: 404, message: error.response.data.error }
  }
}

export const getNavidromeTracks = async () => {
  const response = await ApiRequest('song')
  if (response && response.code === 200) {
    const tracks = await Promise.all(
      response?.data.map(async (song: any) => {
        const pic = await getRestUrl('getCoverArt', { id: song.albumId, size: 128 })
        const url = await getRestUrl('stream', { id: song.id })
        const track = {
          id: song.id,
          name: song.title,
          dt: song.duration * 1000,
          starred: song.starred,
          size: song.size,
          source: 'navidrome',
          url,
          gain: song.rgTrackGain,
          peak: song.rgTrackPeak,
          br: song.sampleRate,
          type: 'stream',
          matched: false,
          offset: 0,
          createTime: new Date(song.createdAt).getTime(),
          alias: [],
          album: {
            id: song.albumId,
            name: song.album,
            matched: false,
            picUrl: pic
          },
          artists: [
            {
              id: song.artistId,
              name: song.artist,
              matched: false,
              picUrl: pic
            }
          ],
          picUrl: pic
        }
        return track
      }) || []
    )
    return { code: 200, message: 'ok', data: tracks }
  }
  return response
}

const getPlaylistTracks = async (id: string, params?: Record<string, string>) => {
  const response = await ApiRequest('playlist/' + id + '/tracks', params)
  return response?.data || null
}

export const getNavidromePlaylists = async () => {
  const response = await ApiRequest('playlist')
  if (response && response.code === 200) {
    const playlists = await Promise.all(
      response.data.map(async (p: any) => {
        const tracks = await getPlaylistTracks(p.id)
        const trackIds = tracks?.map((track: any) => track.mediaFileId) || []
        const playlist = {
          id: p.id,
          name: p.name,
          description: p.comment,
          updateTime: new Date(p.updatedAt).getTime(),
          trackCount: p.songCount,
          coverImgUrl: await getRestUrl('getCoverArt', { id: p.id, size: 512 }),
          trackIds,
          creator: { nickname: p.ownerName }
        }
        return playlist
      })
    )
    return { code: 200, massage: 'ok', data: playlists }
  }
  return response
}

export const opTracksFromePlaylist = async (
  op: 'add' | 'del',
  playlistId: string,
  ids: string[]
) => {
  const params =
    op === 'add'
      ? { playlistId, songIdToAdd: ids }
      : op === 'del'
        ? { playlistId, songIndexToRemove: ids }
        : {}
  const url = await getRestUrl('updatePlaylist', params)
  const isSuccess = await fetch(url!)
    .then((res) => res.json())
    .then((res) => res['subsonic-response'].status === 'ok')
  return isSuccess
}

export const navidromeScrobble = async (id: string) => {
  const url = await getRestUrl('scrobble', { id })
  fetch(url!)
}

export const likeANavidromeTrack = async (op: 'star' | 'unstar', id: string) => {
  const url = await getRestUrl(op, { id })
  const result = await fetch(url!)
    .then((res) => res.json())
    .then((res) => res['subsonic-response'].status === 'ok')
  return result
}

export const getNavidromeLyric = async (id: string) => {
  const result = {
    lrc: { lyric: [] as any[] },
    tlyric: { lyric: [] as any[] },
    romalrc: { lyric: [] as any[] },
    yrc: { lyric: [] as any[] },
    ytlrc: { lyric: [] as any[] },
    yromalrc: { lyric: [] as any[] }
  }
  const url = await getRestUrl('getLyricsBySongId.view', { id })
  const lyricRaw = await fetch(url!)
    .then((res) => res.json())
    .then((data) => {
      const lyricArray = data['subsonic-response'].lyricsList.structuredLyrics
      return lyricArray ? (lyricArray[0].line as any[]) : []
    })
    .catch((error) => {
      console.log('0000000', error)
      return error
    })
  if (lyricRaw.length) {
    const map = new Map()
    const chineseRegex = /[\u4E00-\u9FFF]/
    lyricRaw.forEach(({ start, value }) => {
      if (!map.has(start)) {
        map.set(start, [])
      }
      map.get(start).push(value)
    })
    const sortedStarts = Array.from(map.keys()).sort((a, b) => a - b)
    for (const start of sortedStarts) {
      const values = map.get(start)
      const timeStr = formatTime(start)
      for (let i = 0; i < values.length; i++) {
        if (i === 0) {
          result.lrc.lyric.push(`${timeStr}${values[0]}`)
        } else {
          if (chineseRegex.test(values[i])) {
            result.tlyric.lyric.push(`${timeStr}${values[i]}`)
          } else {
            result.romalrc.lyric.push(`${timeStr}${values[i]}`)
          }
        }
      }
    }
  }
  return result
}
