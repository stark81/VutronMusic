import cors from '@fastify/cors'
import { BrowserWindow } from 'electron'
import fastify from 'fastify'

// #region
export type LikeStatus = 'INDIFFERENT' | 'LIKE' | 'DISLIKE'

export type RepeatType = 'NONE' | 'ALL' | 'ONE'

export interface PlayerInfo {
  hasSong: boolean
  isPaused: boolean
  volumePercent: number
  seekbarCurrentPosition: number
  seekbarCurrentPositionHuman: string
  statePercent: number
  likeStatus: string
  repeatType: string
}

export interface TrackInfo {
  author: string
  title: string
  album: string
  cover: string
  duration: number
  durationHuman: string
  url: string
  id: string
  isVideo: boolean
  isAdvertisement: boolean
  inLibrary: boolean
}

export interface AmuseInfo {
  player: PlayerInfo
  track: TrackInfo
}
// #endregion

// #region
export interface Album {
  id: number
  name: string
  picUrl: string
  tns: string[]
}

export interface Artist {
  id: number
  name: string
  tns: string[]
  alias: string[]
}

export interface Track {
  name: string
  id: number
  ar: Artist[]
  al: Album
  dt: number // milliseconds
  alia: string[]
  tns?: string[]
}

export interface Lyric {
  lrc: string
  tlyric: string
  romalrc: string
}

export interface GlobalVutronMusic {
  progress: number // seconds
  playing: boolean
  volume: number
  currentTrack: Track | {}
  isLiked: boolean
  repeatMode: 'on' | 'one' | 'off'
  lyric: Lyric
}
// #endregion

const emptyAmuse = {
  player: {
    hasSong: false,
    isPaused: true,
    volumePercent: 0,
    seekbarCurrentPosition: 0,
    seekbarCurrentPositionHuman: '0:00',
    statePercent: 0,
    likeStatus: 'INDIFFERENT',
    repeatType: 'NONE'
  },
  track: {
    author: '',
    title: '',
    album: '',
    cover: '',
    duration: 0,
    durationHuman: '0:00',
    url: '',
    id: '',
    isVideo: false,
    isAdvertisement: false,
    inLibrary: false
  }
} satisfies AmuseInfo

export function toDurationHuman(duration: number): string {
  const minutes = Math.floor(duration / 60)
  const seconds = Math.floor(duration % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function transformRepeatMode(mode: string): RepeatType {
  return ({ on: 'ALL', one: 'ONE' } as const)[mode] ?? 'NONE'
}

export async function getAmuseInfo(win: BrowserWindow): Promise<AmuseInfo> {
  const info: GlobalVutronMusic | null | undefined =
    await win.webContents.executeJavaScript(`window.vutronmusic`)

  if (!info || !('id' in info.currentTrack)) {
    return emptyAmuse
  }

  const { playing, volume, progress, isLiked, repeatMode, currentTrack: track } = info
  const trackDurationSeconds = track.dt / 1000
  const thumbnailUrl = new URL(track.al.picUrl)
  thumbnailUrl.searchParams.set('param', '256y256')
  return {
    player: {
      hasSong: true,
      isPaused: !playing,
      volumePercent: volume * 100,
      seekbarCurrentPosition: progress,
      seekbarCurrentPositionHuman: toDurationHuman(progress),
      statePercent: progress / trackDurationSeconds,
      likeStatus: isLiked ? 'LIKED' : 'INDIFFERENT',
      repeatType: transformRepeatMode(repeatMode)
    },
    track: {
      author: track.ar.map((x) => x.name).join(', '),
      title: `${track.name}${track.tns?.length ? ` (${track.tns[0]})` : ''}`,
      album: track.al.name,
      cover: thumbnailUrl.toString(),
      duration: trackDurationSeconds,
      durationHuman: toDurationHuman(trackDurationSeconds),
      url: `https://music.163.com/song?id=${track.id}`,
      id: `${track.id}`,
      isVideo: false,
      isAdvertisement: false,
      inLibrary: false
    }
  }
}

export const amuseDefaultPort = 9863

export async function startInstance(win: BrowserWindow) {
  const instance = fastify({
    ignoreTrailingSlash: true
  })
    .register(cors, { origin: '*' })
    .register(async (fastify) => {
      fastify.get('/query', async () => {
        return await getAmuseInfo(win)
      })
    })

  await instance.listen({ port: amuseDefaultPort })
  console.log(`AmuseServer is running at http://localhost:${amuseDefaultPort}`)

  return instance
}
