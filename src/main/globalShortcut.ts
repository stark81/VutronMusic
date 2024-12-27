import { globalShortcut, BrowserWindow } from 'electron'
import defaultShortcuts from './utils/shortcuts'
import store from './store'

export const registerGlobalShortcuts = (win: BrowserWindow) => {
  let shortcuts = store.get('settings.shortcuts') as
    | { id: string; name: string; shortcut: string; globalShortcut: string }[]
    | undefined
  if (shortcuts === undefined) {
    shortcuts = defaultShortcuts
  }

  globalShortcut.register(shortcuts.find((s) => s.id === 'play').globalShortcut, () => {
    win.webContents.send('play')
  })
  globalShortcut.register(shortcuts.find((s) => s.id === 'next').globalShortcut, () => {
    win.webContents.send('next')
  })
  globalShortcut.register(shortcuts.find((s) => s.id === 'previous').globalShortcut, () => {
    win.webContents.send('previous')
  })
  globalShortcut.register(shortcuts.find((s) => s.id === 'increaseVolume').globalShortcut, () => {
    win.webContents.send('increaseVolume')
  })
  globalShortcut.register(shortcuts.find((s) => s.id === 'decreaseVolume').globalShortcut, () => {
    win.webContents.send('decreaseVolume')
  })
  globalShortcut.register(shortcuts.find((s) => s.id === 'like').globalShortcut, () => {
    win.webContents.send('like')
  })
  globalShortcut.register(shortcuts.find((s) => s.id === 'minimize').globalShortcut, () => {
    win.isVisible() ? win.hide() : win.show()
  })
}
