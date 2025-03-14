import { app, BrowserWindow } from 'electron'

const repeatModeList = ['off', 'on', 'one']
let idx = 0
let shuffleMode = false
let isPersonalFM = false

export interface MprisImpl {
  setPlayState: (isPlaying: boolean) => void
  setRepeatMode: (repeat: string) => void
  setShuffleMode: (isShuffle: boolean) => void
  setMetadata: (metadata: any) => void
  setPosition: (position: number) => void
  setPersonalFM: (value: boolean) => void
}

class Mpris implements MprisImpl {
  private _player: any
  private _win: BrowserWindow
  private Player: any
  constructor(win: BrowserWindow) {
    this.Player = require('@jellybrick/mpris-service')
    this._player = this.Player({
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
    this._player.on('position', (args) => renderer.send('setPosition', args.position / 1000 / 1000))
    this._player.on('loopStatus', () => {
      idx = idx === 2 ? 0 : idx + 1
      renderer.send('repeat', repeatModeList[idx])
    })
    this._player.on('shuffle', () => {
      shuffleMode = !shuffleMode
      renderer.send('repeat-shuffle', shuffleMode)
    })
  }

  setPlayState(isPlaying: boolean) {
    this._player.playbackStatus = isPlaying
      ? this.Player.PLAYBACK_STATUS_PLAYING
      : this.Player.PLAYBACK_STATUS_PAUSED
  }

  setRepeatMode(repeat: 'on' | 'one' | 'off') {
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

  setShuffleMode(isShuffle: boolean) {
    shuffleMode = isShuffle
    this._player.shuffle = isShuffle
  }

  setMetadata(metadata: any) {
    this._player.metadata = {
      'mpris:trackid': this._player.objectPath('track/' + metadata.trackId),
      'mpris:artUrl': metadata.artwork[0].src,
      'mpris:length': metadata.length * 1000 * 1000,
      'xesam:title': metadata.title,
      'xesam:artist': metadata.artist.split(','),
      'xesam:album': metadata.album,
      'xesam:url': metadata.url
    }
  }

  setPersonalFM(value: boolean) {
    isPersonalFM = value
  }

  setPosition(position: number) {
    this._player.getPosition = () => position * 1000 * 1000
  }
}

export function createMpris(win: BrowserWindow) {
  return new Mpris(win)
}
