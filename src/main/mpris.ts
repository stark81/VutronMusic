// import { app, BrowserWindow } from 'electron'
// import Constants from './utils/Constants'
// // import Player from 'mpris-service'

// const handleEvent = (player: any, win: BrowserWindow) => {
//   const renderer = win.webContents
//   player.on('next', () => renderer.send('next'))
//   player.on('previous', () => renderer.send('previous'))
//   player.on('playpause', () => renderer.send('play'))
//   player.on('play', () => renderer.send('play'))
//   player.on('pause', () => renderer.send('play'))
//   player.on('quit', () => app.exit())
//   player.on('position', (args) => renderer.send('setPosition', args.position / 1000 / 1000))
//   player.on('loopStatus', () => renderer.send('repeat'))
//   player.on('shuffle', () => renderer.send('shuffle'))
// }

// export interface MprisImpl {}

// export function createMpris(win: BrowserWindow) {
//   if (Constants.IS_LINUX) return null
//   const player = Player({
//     name: 'yesplaymusic',
//     identity: 'YesPlayMusic'
//   })
//   handleEvent(player, win)
//   return player
// }
