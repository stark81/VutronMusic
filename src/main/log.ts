/**  By default, it writes logs to the following locations:
 * on Linux: ~/.config/R3PLAY/logs/main.log
 * on macOS: ~/Library/Logs/r3playx/main.log
 * on Windows: %USERPROFILE%\AppData\Roaming\r3play\logs\main.log
 * @see https://www.npmjs.com/package/electron-log
 */

import log from 'electron-log'
import pc from 'picocolors'
import Constants from './utils/Constants'

Object.assign(console, log.functions)
log.variables.process = 'main'
if (log.transports.ipc) log.transports.ipc.level = false
log.transports.console.format = `${Constants.IS_DEV_ENV ? '' : pc.dim('{h}:{i}:{s}{scope} ')}{level} › {text}`
log.transports.file.level = 'info'

log.info(
  `\n\n   _  __   __     _     ____                    __  ___                    _
  | |/ /  / /_   (_)   / __/   __  __          /  |/  /  __  __   _____   (_)  _____
  |   /  / __/  / /   / /_    / / / /         / /|_/ /  / / / /  / ___/  / /  / ___/
 /   |  / /_   / /   / __/   / /_/ /         / /  / /  / /_/ /  (__  )  / /  / /__
/_/|_|  \\__/  /_/   /_/      \\__, /         /_/  /_/   \\__,_/  /____/  /_/   \\___/
                            /____/\n`
)

export default log

log.info(`[logger] logger initialized`)
