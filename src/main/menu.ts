import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron'
import defaultShortcuts from './utils/shortcuts'
import Constants from './utils/Constants'
import store from './store'
import { checkUpdate } from './checkUpdate'

let isPlaying = false
let repeatMode = 'off'
let shuffleMode = false
let enableOSD = false
let isLock = (store.get('osdWin.isLock') as boolean) || false

export function createMenu(win: BrowserWindow) {
  let shortcuts = store.get('settings.shortcuts') as
    | {
        id: string
        name: string
        shortcut: string
        globalShortcut: string
      }[]
    | undefined
  if (shortcuts === undefined) {
    shortcuts = defaultShortcuts
  }
  const lang = store.get('settings.lang') as string

  let menu = null
  const updateMenu = (language: string) => {
    const template = {
      en: [
        ...(Constants.IS_MAC
          ? [
              {
                label: app.name,
                submenu: [
                  { role: 'about', label: 'About ' + app.name },
                  { type: 'separator' },
                  { role: 'services', label: 'Services' },
                  { type: 'separator' },
                  {
                    label: 'Preferences...',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                      win.webContents.send('changeRouteTo', '/settings')
                    },
                    role: 'preferences'
                  },
                  {
                    label: 'Check For Updates',
                    accelerator: 'CmdOrCtrl+U',
                    click: checkUpdate,
                    role: 'checkForUpdates'
                  },
                  { type: 'separator' },
                  { role: 'hide', label: 'Hide' },
                  { role: 'hideothers', label: 'Hide Others' },
                  { role: 'unhide', label: 'Show All' },
                  { type: 'separator' },
                  { role: 'quit', label: 'Quit' }
                ]
              }
            ]
          : []),
        {
          label: 'Edit',
          submenu: [
            { role: 'undo', label: 'Undo' },
            { role: 'redo', label: 'Redo' },
            { type: 'separator' },
            { role: 'cut', label: 'Cut' },
            { role: 'copy', label: 'Copy' },
            { role: 'paste', label: 'Paste' },
            ...(Constants.IS_MAC
              ? [
                  { role: 'delete', label: 'Delete' },
                  { role: 'selectAll', label: 'Select All' },
                  { type: 'separator' },
                  {
                    label: 'Speech',
                    submenu: [
                      {
                        role: 'startspeaking',
                        label: 'Start Speaking'
                      },
                      { role: 'stopspeaking', label: 'Stop Speaking' }
                    ]
                  }
                ]
              : [
                  { role: 'delete', label: 'Delete' },
                  { type: 'separator' },
                  { role: 'selectAll', label: 'Select All' }
                ]),
            {
              label: 'Search',
              accelerator: 'CmdOrCtrl+F',
              click: () => {
                win.webContents.send('search')
              }
            }
          ]
        },
        {
          label: 'Control',
          submenu: [
            {
              label: isPlaying ? 'Pause' : 'Play',
              accelerator: shortcuts?.find((s) => s.id === 'play')?.shortcut,
              click: () => {
                win.webContents.send('play')
              }
            },
            {
              label: 'Next',
              accelerator: shortcuts?.find((s) => s.id === 'next')?.shortcut,
              click: () => {
                win.webContents.send('next')
              }
            },
            {
              label: 'Previous',
              accelerator: shortcuts?.find((s) => s.id === 'previous')?.shortcut,
              click: () => {
                win.webContents.send('previous')
              }
            },
            {
              label: 'Increase Volume',
              accelerator: shortcuts?.find((s) => s.id === 'increaseVolume')?.shortcut,
              click: () => {
                win.webContents.send('increaseVolume')
              }
            },
            {
              label: 'Decrease Volume',
              accelerator: shortcuts?.find((s) => s.id === 'decreaseVolume')?.shortcut,
              click: () => {
                win.webContents.send('decreaseVolume')
              }
            },
            {
              label: 'Like',
              accelerator: shortcuts?.find((s) => s.id === 'like')?.shortcut,
              click: () => {
                win.webContents.send('like')
              }
            },
            {
              label: 'Repeat',
              submenu: [
                {
                  label: 'Repeat Off',
                  click: () => win.webContents.send('repeat', 'off'),
                  id: 'off',
                  checked: repeatMode === 'off',
                  type: 'radio'
                },
                {
                  label: 'Repeat On',
                  click: () => win.webContents.send('repeat', 'on'),
                  id: 'on',
                  checked: repeatMode === 'on',
                  type: 'radio'
                },
                {
                  label: 'Repeat One',
                  click: () => win.webContents.send('repeat', 'one'),
                  id: 'one',
                  checked: repeatMode === 'one',
                  type: 'radio'
                }
              ]
            },
            {
              label: 'Shuffle',
              accelerator: 'Alt+S',
              click: () => {
                win.webContents.send('repeat-shuffle', !shuffleMode)
              }
            },
            {
              label: `${enableOSD ? 'Close' : 'Open'} OSD Lyric`,
              click: () => {
                win.webContents.send('updateOSDSetting', { show: !enableOSD })
              }
            },
            {
              label: `${isLock ? 'Unlock' : 'Lock'} OSD Lyric`,
              click: () => {
                win.webContents.send('updateOSDSetting', { lock: !isLock })
              }
            }
          ]
        },
        {
          label: 'Window',
          submenu: [
            { role: 'close', label: 'Close' },
            { role: 'minimize', label: 'Minimize' },
            { role: 'zoom', label: 'Maximize' },
            { role: 'reload', label: 'Reload' },
            { role: 'forcereload', label: 'Force Reload' },
            {
              role: 'toggledevtools',
              label: 'Toggle Developer Tools'
            },
            { type: 'separator' },
            { role: 'togglefullscreen', label: ' Toggle Full Screen' },
            ...(Constants.IS_MAC
              ? [
                  { type: 'separator' },
                  { role: 'front', label: 'Bring All to Front' },
                  { type: 'separator' },
                  {
                    role: 'window',
                    id: 'window',
                    label: app.name,
                    type: 'checkbox',
                    checked: true,
                    click: () => {
                      const current = menu.getMenuItemById('window')
                      if (current.checked === false) {
                        win.hide()
                      } else {
                        win.show()
                      }
                    }
                  }
                ]
              : [{ role: 'close' }])
          ]
        },
        {
          label: 'Help',
          submenu: [
            {
              label: 'GitHub',
              click: async () => {
                await shell.openExternal('https://github.com/stark81/VutronMusic/')
              }
            },
            {
              label: 'Electron',
              click: async () => {
                await shell.openExternal('https://electronjs.org')
              }
            },
            {
              label: 'Developer Tools',
              accelerator: 'F12',
              click: () => {
                win.webContents.openDevTools()
              }
            }
          ]
        }
      ],
      zh: [
        ...(Constants.IS_MAC
          ? [
              {
                label: app.name,
                submenu: [
                  { role: 'about', label: '关于 ' + app.name },
                  { type: 'separator' },
                  { role: 'services', label: '服务' },
                  { type: 'separator' },
                  {
                    label: '偏好设置...',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                      win.webContents.send('changeRouteTo', '/settings')
                    },
                    role: 'preferences'
                  },
                  {
                    label: '检查更新',
                    accelerator: 'CmdOrCtrl+U',
                    click: checkUpdate,
                    role: 'checkForUpdates'
                  },
                  { type: 'separator' },
                  { role: 'hide', label: '隐藏' },
                  { role: 'hideothers', label: '隐藏其他' },
                  { role: 'unhide', label: '显示所有' },
                  { type: 'separator' },
                  { role: 'quit', label: '退出' }
                ]
              }
            ]
          : []),
        {
          label: '编辑',
          submenu: [
            { role: 'undo', label: '撤销' },
            { role: 'redo', label: '恢复' },
            { type: 'separator' },
            { role: 'cut', label: '剪切' },
            { role: 'copy', label: '复制' },
            { role: 'paste', label: '粘贴' },
            ...(Constants.IS_MAC
              ? [
                  { role: 'delete', label: '删除' },
                  { role: 'selectAll', label: '选择所有' },
                  { type: 'separator' },
                  {
                    label: '听写',
                    submenu: [
                      {
                        role: 'startspeaking',
                        label: '开始听写'
                      },
                      { role: 'stopspeaking', label: '停止听写' }
                    ]
                  }
                ]
              : [
                  { role: 'delete', label: '删除' },
                  { type: 'separator' },
                  { role: 'selectAll', label: '选择所有' }
                ]),
            {
              label: '搜索',
              accelerator: 'CmdOrCtrl+F',
              click: () => {
                win.webContents.send('search')
              }
            }
          ]
        },
        {
          label: '控制',
          submenu: [
            {
              label: isPlaying ? '暂停' : '播放',
              accelerator: shortcuts?.find((s) => s.id === 'play')?.shortcut,
              click: () => {
                win.webContents.send('play')
              }
            },
            {
              label: '下一曲',
              accelerator: shortcuts?.find((s) => s.id === 'next')?.shortcut,
              click: () => {
                win.webContents.send('next')
              }
            },
            {
              label: '上一曲',
              accelerator: shortcuts?.find((s) => s.id === 'previous')?.shortcut,
              click: () => {
                win.webContents.send('previous')
              }
            },
            {
              label: '增加音量',
              accelerator: shortcuts?.find((s) => s.id === 'increaseVolume')?.shortcut,
              click: () => {
                win.webContents.send('increaseVolume')
              }
            },
            {
              label: '减少音量',
              accelerator: shortcuts?.find((s) => s.id === 'decreaseVolume')?.shortcut,
              click: () => {
                win.webContents.send('decreaseVolume')
              }
            },
            {
              label: '喜欢',
              accelerator: shortcuts?.find((s) => s.id === 'like')?.shortcut,
              click: () => {
                win.webContents.send('like')
              }
            },
            {
              label: '循环播放',
              submenu: [
                {
                  label: '关闭循环',
                  click: () => win.webContents.send('repeat', 'off'),
                  id: 'off',
                  checked: repeatMode === 'off',
                  type: 'radio'
                },
                {
                  label: '列表循环',
                  click: () => win.webContents.send('repeat', 'on'),
                  id: 'on',
                  checked: repeatMode === 'on',
                  type: 'radio'
                },
                {
                  label: '单曲循环',
                  click: () => win.webContents.send('repeat', 'one'),
                  id: 'one',
                  checked: repeatMode === 'one',
                  type: 'radio'
                }
              ]
            },
            {
              label: '随机播放',
              accelerator: 'Alt+S',
              click: () => {
                win.webContents.send('repeat-shuffle', !shuffleMode)
              }
            },
            {
              label: `${enableOSD ? '关闭' : '开启'}桌面歌词`,
              click: () => {
                win.webContents.send('updateOSDSetting', { show: !enableOSD })
              }
            },
            {
              label: `${isLock ? '解锁' : '锁定'}桌面歌词`,
              click: () => {
                win.webContents.send('updateOSDSetting', { lock: !isLock })
              }
            }
          ]
        },
        {
          label: '窗口',
          submenu: [
            { role: 'close', label: '关闭' },
            { role: 'minimize', label: '最小化' },
            { role: 'zoom', label: '最大化' },
            { role: 'reload', label: '重新加载' },
            { role: 'forcereload', label: '强制重新加载' },
            {
              role: 'toggledevtools',
              label: '切换开发者工具'
            },
            { type: 'separator' },
            { role: 'togglefullscreen', label: '切换全屏' },
            ...(Constants.IS_MAC
              ? [
                  { type: 'separator' },
                  { role: 'front', label: '全部置于顶层' },
                  { type: 'separator' },
                  {
                    role: 'window',
                    id: 'window',
                    label: app.name,
                    type: 'checkbox',
                    checked: true,
                    click: () => {
                      const current = menu.getMenuItemById('window')
                      if (current.checked === false) {
                        win.hide()
                      } else {
                        win.show()
                      }
                    }
                  }
                ]
              : [{ role: 'close' }])
          ]
        },
        {
          label: '帮助',
          submenu: [
            {
              label: 'GitHub',
              click: async () => {
                await shell.openExternal('https://github.com/stark81/VutronMusic/')
              }
            },
            {
              label: 'Electron',
              click: async () => {
                await shell.openExternal('https://electronjs.org')
              }
            },
            {
              label: '开发者工具',
              accelerator: 'F12',
              click: () => {
                win.webContents.openDevTools()
              }
            }
          ]
        }
      ],
      zht: [
        // 新增繁体中文配置
        ...(Constants.IS_MAC
          ? [
              {
                label: app.name,
                submenu: [
                  { role: 'about', label: '關於 ' + app.name },
                  { type: 'separator' },
                  { role: 'services', label: '服務' },
                  { type: 'separator' },
                  {
                    label: '偏好設定...',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                      win.webContents.send('changeRouteTo', '/settings')
                    },
                    role: 'preferences'
                  },
                  {
                    label: '檢查更新',
                    accelerator: 'CmdOrCtrl+U',
                    click: checkUpdate,
                    role: 'checkForUpdates'
                  },
                  { type: 'separator' },
                  { role: 'hide', label: '隱藏' },
                  { role: 'hideothers', label: '隱藏其他' },
                  { role: 'unhide', label: '顯示所有' },
                  { type: 'separator' },
                  { role: 'quit', label: '退出' }
                ]
              }
            ]
          : []),
        {
          label: '編輯',
          submenu: [
            { role: 'undo', label: '復原' },
            { role: 'redo', label: '重做' },
            { type: 'separator' },
            { role: 'cut', label: '剪下' },
            { role: 'copy', label: '複製' },
            { role: 'paste', label: '貼上' },
            ...(Constants.IS_MAC
              ? [
                  { role: 'delete', label: '刪除' },
                  { role: 'selectAll', label: '選取全部' },
                  { type: 'separator' },
                  {
                    label: '聽寫',
                    submenu: [
                      {
                        role: 'startspeaking',
                        label: '開始聽寫'
                      },
                      { role: 'stopspeaking', label: '停止聽寫' }
                    ]
                  }
                ]
              : [
                  { role: 'delete', label: '刪除' },
                  { type: 'separator' },
                  { role: 'selectAll', label: '選取全部' }
                ]),
            {
              label: '搜尋',
              accelerator: 'CmdOrCtrl+F',
              click: () => {
                win.webContents.send('search')
              }
            }
          ]
        },
        {
          label: '控制',
          submenu: [
            {
              label: isPlaying ? '暫停' : '播放',
              accelerator: shortcuts?.find((s) => s.id === 'play')?.shortcut,
              click: () => {
                win.webContents.send('play')
              }
            },
            {
              label: '下一首',
              accelerator: shortcuts?.find((s) => s.id === 'next')?.shortcut,
              click: () => {
                win.webContents.send('next')
              }
            },
            {
              label: '上一首',
              accelerator: shortcuts?.find((s) => s.id === 'previous')?.shortcut,
              click: () => {
                win.webContents.send('previous')
              }
            },
            {
              label: '提高音量',
              accelerator: shortcuts?.find((s) => s.id === 'increaseVolume')?.shortcut,
              click: () => {
                win.webContents.send('increaseVolume')
              }
            },
            {
              label: '降低音量',
              accelerator: shortcuts?.find((s) => s.id === 'decreaseVolume')?.shortcut,
              click: () => {
                win.webContents.send('decreaseVolume')
              }
            },
            {
              label: '喜歡',
              accelerator: shortcuts?.find((s) => s.id === 'like')?.shortcut,
              click: () => {
                win.webContents.send('like')
              }
            },
            {
              label: '循環播放',
              submenu: [
                {
                  label: '關閉循環',
                  click: () => win.webContents.send('repeat', 'off'),
                  id: 'off',
                  checked: repeatMode === 'off',
                  type: 'radio'
                },
                {
                  label: '列表循環',
                  click: () => win.webContents.send('repeat', 'on'),
                  id: 'on',
                  checked: repeatMode === 'on',
                  type: 'radio'
                },
                {
                  label: '單曲循環',
                  click: () => win.webContents.send('repeat', 'one'),
                  id: 'one',
                  checked: repeatMode === 'one',
                  type: 'radio'
                }
              ]
            },
            {
              label: '隨機播放',
              accelerator: 'Alt+S',
              click: () => {
                win.webContents.send('repeat-shuffle', !shuffleMode)
              }
            },
            {
              label: `${enableOSD ? '關閉' : '開啟'}桌面歌詞`,
              click: () => {
                win.webContents.send('updateOSDSetting', { show: !enableOSD })
              }
            },
            {
              label: `${isLock ? '解鎖' : '鎖定'}桌面歌詞`,
              click: () => {
                win.webContents.send('updateOSDSetting', { lock: !isLock })
              }
            }
          ]
        },
        {
          label: '視窗',
          submenu: [
            { role: 'close', label: '關閉' },
            { role: 'minimize', label: '最小化' },
            { role: 'zoom', label: '最大化' },
            { role: 'reload', label: '重新載入' },
            { role: 'forcereload', label: '強制重新載入' },
            {
              role: 'toggledevtools',
              label: '切換開發者工具'
            },
            { type: 'separator' },
            { role: 'togglefullscreen', label: '切換全螢幕' },
            ...(Constants.IS_MAC
              ? [
                  { type: 'separator' },
                  { role: 'front', label: '全部置頂' },
                  { type: 'separator' },
                  {
                    role: 'window',
                    id: 'window',
                    label: app.name,
                    type: 'checkbox',
                    checked: true,
                    click: () => {
                      const current = menu.getMenuItemById('window')
                      if (current.checked === false) {
                        win.hide()
                      } else {
                        win.show()
                      }
                    }
                  }
                ]
              : [{ role: 'close' }])
          ]
        },
        {
          label: '說明',
          submenu: [
            {
              label: 'GitHub',
              click: async () => {
                await shell.openExternal('https://github.com/stark81/VutronMusic/')
              }
            },
            {
              label: 'Electron',
              click: async () => {
                await shell.openExternal('https://electronjs.org')
              }
            },
            {
              label: '開發者工具',
              accelerator: 'F12',
              click: () => {
                win.webContents.openDevTools()
              }
            }
          ]
        }
      ]
    }
    menu = Menu.buildFromTemplate(template[language])
    Menu.setApplicationMenu(menu)
  }
  updateMenu(lang)

  ipcMain.on('updatePlayerState', (_, data: any) => {
    for (const [key, value] of Object.entries(data) as [string, any]) {
      const lang = store.get('settings.lang') as string
      if (key === 'playing') {
        isPlaying = value
        updateMenu(lang)
      } else if (key === 'repeatMode') {
        repeatMode = value
        updateMenu(lang)
      } else if (key === 'shuffle') {
        shuffleMode = value
      }
    }
  })

  ipcMain.on('updateOsdState', (event, data) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'show') {
      enableOSD = value
      updateMenu(lang)
    } else if (key === 'isLock') {
      isLock = value
      updateMenu(lang)
    }
  })

  ipcMain.on('setStoreSettings', (_, data: any) => {
    const [key, value] = Object.entries(data)[0] as [string, any]
    if (key === 'lang') {
      updateMenu(value)
    }
  })
}
