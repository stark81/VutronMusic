import { autoUpdater } from 'electron-updater'
import { parse } from 'node-html-parser'
import { BrowserWindow, app, dialog, shell } from 'electron'
import Constants from './utils/Constants'
import { resolveUpdateChannel } from './utils/updateChannel'

const isMac = Constants.IS_MAC

// Windows/macOS 的 arm64 走独立更新通道（详见 utils/updateChannel.ts 与 issue #374）
const updateChannel = resolveUpdateChannel(process.platform, process.arch)

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'stark81',
  repo: 'VutronMusic',
  private: false,
  ...(updateChannel ? { channel: updateChannel } : {})
})

autoUpdater.autoDownload = false

export const downloadUpdate = () => {
  autoUpdater.downloadUpdate()
}

const handleUpdateAvailable = (win: BrowserWindow, info: any) => {
  const plainNode = info.releaseNotes
    ? parse(info.releaseNotes as string).text.trim()
    : '无更新说明'

  dialog
    .showMessageBox(win, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version} \n是否立即下载？`,
      detail: isMac ? '' : plainNode,
      buttons: [isMac ? '前往下载' : '立即下载', '稍后下载']
    })
    .then((result) => {
      if (result.response === 0) {
        if (isMac) {
          shell.openExternal('https://github.com/stark81/VutronMusic/releases/')
        } else {
          downloadUpdate()
        }
      }
    })
}

export const initAutoUpdater = (win: BrowserWindow) => {
  if (!app.isPackaged) return

  autoUpdater.on('update-available', (info) => {
    handleUpdateAvailable(win, info)
  })

  autoUpdater.on('update-not-available', (info) => {
    win.webContents.send('update-not-available', info)
  })

  autoUpdater.on('download-progress', (info) => {
    win.webContents.send('download-progress', info)
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

  autoUpdater.on('error', () => {
    win.webContents.send('update-error')
  })
}

export const checkUpdate = async () => {
  const info = await autoUpdater.checkForUpdates()
  return info
}
