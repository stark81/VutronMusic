import { autoUpdater } from 'electron-updater'
import { parse } from 'node-html-parser'
import { BrowserWindow, app, dialog } from 'electron'

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'stark81',
  repo: 'VutronMusic',
  private: false
})

autoUpdater.autoDownload = false

export const checkUpdate = (win: BrowserWindow) => {
  if (!app.isPackaged) return

  autoUpdater.checkForUpdates()

  autoUpdater.on('update-available', (info) => {
    const plainNode = info.releaseNotes
      ? parse(info.releaseNotes as string).text.trim()
      : '无更新说明'

    dialog
      .showMessageBox(win, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version} \n是否立即下载？`,
        detail: plainNode,
        buttons: ['立即下载', '稍后下载']
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate()
        }
      })
  })

  autoUpdater.on('update-not-available', (info) => {
    win.webContents.send('update-not-available', info)
  })

  autoUpdater.on('update-downloaded', (info) => {
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: '下载完成',
        message: `新版本 ${info.version} 下载完成，是否立即安装？`,
        buttons: ['立即安装', '稍后安装']
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (err) => {
    win.webContents.send('update-error', err)
  })
}
