import { join, dirname } from 'path'
import { name, version } from '../../../package.json'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default class Constants {
  // Display app name (uppercase first letter)
  static APP_NAME = name.charAt(0).toUpperCase() + name.slice(1)

  static APP_VERSION = version

  static IS_DEV_ENV = process.env.NODE_ENV === 'development'

  static IS_MAC = process.platform === 'darwin'

  static IS_WINDOWS = process.platform === 'win32'

  static IS_LINUX = process.platform === 'linux'

  static DEFAULT_WEB_PREFERENCES = {
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    preload: join(__dirname, '../preload/index.js')
  }

  static DEFAULT_OSD_PREFERENCES = {
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    preload: join(__dirname, '../preload/osdWin.js')
  }

  static ELECTRON_WEB_SERVER_PORT = 41830
  static ELECTRON_DEV_NETEASE_API_PORT = 40001

  static APP_INDEX_URL_DEV = 'http://localhost:41830/index.html'
  static APP_INDEX_URL_PROD = 'http://localhost:41830/#/index.html'
  // static APP_OSD_URL_PROD = join(__dirname, '../../osdlyric.html')
  static APP_OSD_URL = 'http://localhost:41830/osdlyric.html'
  // static APP_OSD_URL_PROD = join(__dirname, '../index.html')
}
