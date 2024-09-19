import { app, Menu, BrowserWindow, ipcMain } from 'electron'
import store from './store'

let isPlaying = false

export function createDockMenu(win: BrowserWindow) {
  const lang = store.get('settings.lang') as string

  const updateDockMenu = (language: string) => {
    const osdStatus = store.get('osdWindow.show') as boolean
    const template = {
      zh: [
        {
          label: isPlaying ? '暂停' : '播放',
          click() {
            win.webContents.send('play')
          }
        },
        {
          label: '下一首',
          click() {
            win.webContents.send('next')
          }
        },
        {
          label: '上一首',
          click() {
            win.webContents.send('previous')
          }
        },
        { type: 'separator' },
        {
          label: osdStatus ? '关闭桌面歌词' : '启用桌面歌词',
          click() {}
        }
      ],
      en: [
        {
          label: isPlaying ? 'Pause' : 'Play',
          click() {
            win.webContents.send('play')
          }
        },
        {
          label: 'Next',
          click() {
            win.webContents.send('next')
          }
        },
        {
          label: 'Previous',
          click() {
            win.webContents.send('previous')
          }
        },
        { type: 'separator' },
        {
          label: osdStatus ? 'Disable desktop lyric' : 'Enable desktop lyric',
          click() {}
        }
      ]
    }
    const menu = Menu.buildFromTemplate(template[language])
    if (menu && app.dock) app.dock.setMenu(menu)
  }
  updateDockMenu(lang)

  ipcMain.on('updatePlayerState', (_, data: any) => {
    for (const [key, value] of Object.entries(data) as [string, any]) {
      const lang = store.get('settings.lang') as string
      if (key === 'playing') {
        isPlaying = value
        updateDockMenu(lang)
      }
    }
  })

  ipcMain.on('setStoreSettings', (_, data: any) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'lang') {
      updateDockMenu(value)
    }
  })
}
