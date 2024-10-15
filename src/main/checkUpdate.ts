import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
// import Constants from './utils/Constants'

export const checkUpdate = (win: BrowserWindow) => {
  // if (Constants.IS_DEV_ENV) return

  // autoUpdater.setFeedURL({
  //   provider: 'github',
  //   owner: 'stark81',
  //   repo: 'VutronMusic',
  // })
  autoUpdater
    .checkForUpdates()
    .then((data) => {
      console.log('checkUpdate data = ', data)
    })
    .catch((err) => {
      console.log('err = ', err)
    })
}
