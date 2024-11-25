import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
// import store from '../main/store'

const mainAvailChannels: string[] = [
  'set-osd-window',
  'setWindowPosition',
  'mouseleave',
  'switchOsdWinMode',
  'from-osd',
  'get-playing-status'
]

const rendererAvailChannels: string[] = ['updateLyric', 'updateLyricIndex', 'set-isLock']

contextBridge.exposeInMainWorld('mainApi', {
  send: (channel: string, ...data: any[]): void => {
    if (mainAvailChannels.includes(channel)) {
      ipcRenderer.send.apply(null, [channel, ...data])
    } else {
      throw new Error(`Unknown ipc channel name: ${channel}`)
    }
  },
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void => {
    if (rendererAvailChannels.includes(channel)) {
      ipcRenderer.on(channel, listener)
    } else {
      throw new Error(`Unknown ipc channel name: ${channel}`)
    }
  },
  once: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void => {
    if (rendererAvailChannels.includes(channel)) {
      ipcRenderer.once(channel, listener)
    } else {
      throw new Error(`Unknown ipc channel name: ${channel}`)
    }
  },
  off: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void => {
    if (rendererAvailChannels.includes(channel)) {
      ipcRenderer.off(channel, listener)
    } else {
      throw new Error(`Unknown ipc channel name: ${channel}`)
    }
  },
  invoke: async (channel: string, ...data: any[]): Promise<any> => {
    if (mainAvailChannels.includes(channel)) {
      const result = await ipcRenderer.invoke.apply(null, [channel, ...data])
      return result
    }

    throw new Error(`Unknown ipc channel name: ${channel}`)
  }
})

contextBridge.exposeInMainWorld('env', {
  isElectron: true,
  isEnableTitlebar: process.platform === 'win32' || process.platform === 'linux',
  isLinux: process.platform === 'linux',
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32'
})

window.addEventListener('DOMContentLoaded', () => {
  let timeoutId: any = null
  let lastMoveTime: number = 0

  const root = document.querySelector('#main') as HTMLElement
  const headerEl = document.querySelector('#osd-lock') as HTMLElement

  root.addEventListener('mouseenter', () => {
    headerEl.style.opacity = '1'
  })

  root.addEventListener('mouseleave', () => {
    headerEl.style.opacity = '0'
    clearTimeout(timeoutId)
    root.style.opacity = '1'
  })

  root.addEventListener('mousemove', () => {
    if (!root.classList.contains('is-lock')) return
    clearTimeout(timeoutId)

    lastMoveTime = Date.now()
    timeoutId = setTimeout(() => {
      const now = Date.now()
      if (now - lastMoveTime >= 3000) {
        root.style.opacity = '0.05'
      }
    }, 3000)
  })

  headerEl.addEventListener('mouseenter', () => {
    ipcRenderer.send('set-ignore-mouse', false)
  })

  headerEl.addEventListener('mouseleave', () => {
    ipcRenderer.send('mouseleave')
  })
})
