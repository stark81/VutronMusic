import fastify, { FastifyInstance } from 'fastify'

export enum LikeStatus {
  INDIFFERENT = 'INDEFFERENT',
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE'
}

export enum RepeatType {
  NONE = 'NONE',
  ALL = 'ALL',
  ONE = 'ONE'
}

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

export interface Query {
  player: PlayerInfo
  track: TrackInfo
}

export const port = 9863

export const amuseSetup = async (fastify: FastifyInstance) => {}

export const initAmuseServer = async () => {
  const server = fastify({
    ignoreTrailingSlash: true
  })
  server.register(amuseSetup)

  await server.listen({ port })
  console.log(`AmuseServer is running at http://localhost:${port}`)
  return server
}

export default initAmuseServer
