import { BrowserWindow } from 'electron'
import { MediaController } from './types'
import { NullController } from './NullController'
import { LinuxController } from './LinuxController'
import { WinController } from './WinController'
import Constants from '../utils/Constants'

/**
 * 根据当前平台创建对应的 MediaController 实例
 */
export function createMediaController(win: BrowserWindow): MediaController {
  if (Constants.IS_LINUX) return new LinuxController(win)
  if (Constants.IS_WINDOWS) return new WinController(win)
  return new NullController()
}
