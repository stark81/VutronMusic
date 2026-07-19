import { statusMap } from '@/types/music'
import { app, BrowserWindow } from 'electron'

const repeatModeList = ['off', 'on', 'one']
let idx = 0
let shuffleMode = false
let isPersonalFM = false

export interface MprisImpl {
  setMetadata: (metadata: any) => void
  updateInfo: (data: Partial<statusMap>) => void
}

class Mpris implements MprisImpl {
  private _player: any
  private _win: BrowserWindow
  private Player: any
  constructor(win: BrowserWindow) {
    this.Player = require('@jellybrick/mpris-service')
    this._player = new this.Player({
      name: 'VutronMusic',
      identity: 'VutronMusic'
    })
    this._win = win
    this._handleEvent()
  }

  private _handleEvent() {
    const renderer = this._win.webContents
    this._player.on('next', () => renderer.send('next'))
    this._player.on('previous', () => renderer.send(isPersonalFM ? 'fm-trash' : 'previous'))
    this._player.on('playpause', () => renderer.send('play'))
    this._player.on('play', () => renderer.send('play'))
    this._player.on('pause', () => renderer.send('play'))
    this._player.on('quit', () => app.exit())
    this._player.on('position', (args: { position: number }) =>
      renderer.send('setPosition', args.position / 1000 / 1000)
    )
    this._player.on('loopStatus', () => {
      idx = idx === 2 ? 0 : idx + 1
      renderer.send('repeat', repeatModeList[idx])
    })
    this._player.on('shuffle', () => {
      shuffleMode = !shuffleMode
      renderer.send('repeat-shuffle', shuffleMode)
    })
  }

  private _setPlayState(isPlaying: boolean) {
    this._player.playbackStatus = isPlaying
      ? this.Player.PLAYBACK_STATUS_PLAYING
      : this.Player.PLAYBACK_STATUS_PAUSED
  }

  private _setRepeatMode(repeat: 'on' | 'one' | 'off') {
    idx = repeatModeList.indexOf(repeat)
    switch (repeat) {
      case 'on':
        this._player.loopStatus = this.Player.LOOP_STATUS_PLAYLIST
        break
      case 'one':
        this._player.loopStatus = this.Player.LOOP_STATUS_TRACK
        break
      case 'off':
        this._player.loopStatus = this.Player.LOOP_STATUS_NONE
        break
    }
  }

  private _setShuffleMode(isShuffle: boolean) {
    shuffleMode = isShuffle
    this._player.shuffle = isShuffle
  }

  private _setPersonalFM(value: boolean) {
    isPersonalFM = value
  }

  private _setRate(rate: number) {
    this._player.rate = rate
  }

  private _setPosition(progress: number) {
    this._player.seeked(progress * 1000 * 1000)
    this._player.getPosition = () => progress * 1000 * 1000
    this._player.position = progress * 1000 * 1000
  }

  setMetadata(metadata: any) {
    this._player.metadata = {
      // UUID 含短横线，替换掉以符合 D-Bus object path 规范
      'mpris:trackid': this._player.objectPath(
        'track/' + String(metadata.trackId).replace(/-/g, '')
      ),
      'mpris:artUrl': metadata.artwork[0].src,
      'mpris:length': metadata.length * 1000 * 1000,
      'xesam:title': metadata.title,
      'xesam:artist': metadata.artist.split(','),
      'xesam:album': metadata.album,
      'xesam:url': metadata.url,
      'xesam:asText': metadata.asText,
      'xesam:lyricOffset': metadata.lyricOffset
    }
    this._player.rate = metadata.rate
    this._player.seeked(metadata.progress * 1000 * 1000)
    this._player.getPosition = () => metadata.progress * 1000 * 1000
  }

  updateInfo(data: Partial<statusMap>) {
    if (data.rate !== undefined) {
      this._setRate(data.rate)
    }
    if (data.playing !== undefined) {
      this._setPlayState(data.playing)
    }
    if (data.seek !== undefined) {
      this._setPosition(data.seek)
    }
    if (data.isFM !== undefined) {
      this._setPersonalFM(data.isFM)
    }
    if (data.repeatMode !== undefined) {
      this._setRepeatMode(data.repeatMode)
    }
    if (data.shuffle !== undefined) {
      this._setShuffleMode(data.shuffle)
    }
  }
}

export async function createMpris(win: BrowserWindow): Promise<MprisImpl> {
  const mprisInstance = new Mpris(win)
  await new Promise((resolve) => setImmediate(resolve))

  return mprisInstance
}
