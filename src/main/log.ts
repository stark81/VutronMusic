/**  By default, it writes logs to the following locations:
 * on Linux: ~/.config/R3PLAY/logs/main.log
 * on macOS: ~/Library/Logs/r3playx/main.log
 * on Windows: %USERPROFILE%\AppData\Roaming\r3play\logs\main.log
 * @see https://www.npmjs.com/package/electron-log
 */

import Constants from './utils/Constants'

let log = null

if (!log) {
  log = require('electron-log')
  const pc = require('picocolors')

  Object.assign(console, log.functions)
  log.variables.process = 'main'
  if (log.transports.ipc) log.transports.ipc.level = false
  log.transports.console.format = `${Constants.IS_DEV_ENV ? '' : pc.dim('{h}:{i}:{s}{scope} ')}{level} › {text}`
  log.transports.file.level = 'info'
}

export default log
