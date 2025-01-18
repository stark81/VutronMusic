import { app, Menu, BrowserWindow, ipcMain } from 'electron'
import store from './store'

let isPlaying = false
let enableOSD = false
let isLock = false

export function createDockMenu(win: BrowserWindow) {
  const lang = store.get('settings.lang') as string

  const updateDockMenu = (language: string) => {
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
          label: enableOSD ? '关闭桌面歌词' : '启用桌面歌词',
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
        {
          label: enableOSD ? 'Close OSD Lyric' : 'Open OSD Lyric',
          click() {
            win.webContents.send('updateOSDSetting', { show: !enableOSD })
          }
        },
        {
          label: isLock ? 'Unlock OSD Lyric' : 'Lock OSD Lyric',
          click() {
            win.webContents.send('updateOSDSetting', { isLock: !isLock })
          }
        },
        { type: 'separator' }
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

  ipcMain.on('updateOsdState', (event, data) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'show') {
      enableOSD = value
      updateDockMenu(lang)
    } else if (key === 'isLock') {
      isLock = value
      updateDockMenu(lang)
    }
  })

  ipcMain.on('setStoreSettings', (_, data: any) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'lang') {
      updateDockMenu(value)
    }
  })
}
