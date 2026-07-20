import { statusMap } from '@/types/music'
import { app, BrowserWindow } from 'electron'

const repeatModeList = ['off', 'on', 'one']
let idx = 0
let shuffleMode = false
let isPersonalFM = false

export interface MprisImpl {
  setMetadata(meta: any): void
  updateInfo(data: Partial<statusMap>): void
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

  // ───── MprisImpl 接口实现 ─────

  setMetadata(meta: any) {
    this._player.metadata = {
      // UUID 含短横线，替换掉以符合 D-Bus object path 规范
      'mpris:trackid': this._player.objectPath('track/' + String(meta.trackId).replace(/-/g, '')),
      'mpris:artUrl': meta.artwork?.[0]?.src,
      'mpris:length': meta.length * 1000 * 1000,
      'xesam:title': meta.title,
      'xesam:artist': meta.artist?.split(',') || [],
      'xesam:album': meta.album,
      'xesam:url': meta.url,
      'xesam:asText': meta.asText,
      'xesam:lyricOffset': meta.lyricOffset
    }
    this._player.rate = meta.rate
    this._player.seeked(meta.progress * 1000 * 1000)
    this._player.getPosition = () => meta.progress * 1000 * 1000
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
