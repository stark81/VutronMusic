import { usePlayerStore } from '../store/player'

import type { AmuseInfo } from '../../main/amuseServer'

export function initAmuseQueryChannel() {
  const player = usePlayerStore()

  const emptyInfo = {
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

  const transformRepeatMode = (mode: string) => {
    return { on: 'ALL', one: 'ONE' }[mode] ?? 'NONE'
  }

  const toDurationHuman = (duration: number) => {
    const minutes = Math.floor(duration / 60)
    const seconds = Math.floor(duration % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const queryAmuseInfo = async (): Promise<AmuseInfo> => {
    if (!player.enabled) return emptyInfo
    // console.log(JSON.stringify(player.currentTrack, null, 2))
    const track = player.currentTrack
    return {
      player: {
        hasSong: !!track,
        isPaused: !player.playing,
        volumePercent: player.volume * 100,
        seekbarCurrentPosition: player.progress,
        seekbarCurrentPositionHuman: toDurationHuman(player.progress),
        statePercent: player.progress / player.currentTrackDuration,
        likeStatus: player.isLiked ? 'LIKED' : 'INDIFFERENT',
        repeatType: transformRepeatMode(player.repeatMode)
      },
      track: {
        author: track ? (track.artists ?? track.ar).map((x) => x.name).join(', ') : '',
        title: track
          ? `${track.name}${(track.alias ?? track.al).length ? ` (${(track.alias ?? track.al)[0]})` : ''}`
          : '',
        album: (track?.album ?? track?.al)?.name ?? '',
        cover: (track?.album ?? track?.al)?.picUrl ?? '',
        duration: player.currentTrackDuration,
        durationHuman: toDurationHuman(player.currentTrackDuration),
        url: track ? `https://music.163.com/song?id=${track.id}` : '',
        id: track ? `${track.id}` : '',
        isVideo: false,
        isAdvertisement: false,
        inLibrary: false
      }
    }
  }

  window.mainApi!.on('queryAmuseInfo', async (_event, echo: string) => {
    window.mainApi!.send('queryAmuseInfoReturn', JSON.stringify(await queryAmuseInfo()), echo)
  })
}
