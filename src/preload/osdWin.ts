import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
// import store from '../main/store'

const mainAvailChannels: string[] = ['mouseleave', 'from-osd', 'osd-resize', 'get-playing-status']

const rendererAvailChannels: string[] = [
  'set-isLock',
  'update-osd-playing-status',
  'updateLyricInfo'
]

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
  const header = document.querySelector('.header') as HTMLElement
  const lockEl = document.querySelector('#osd-lock') as HTMLElement
  const container = document.querySelector('.container') as HTMLElement

  container.addEventListener('mouseenter', () => {
    header.style.opacity = '1'
  })

  container.addEventListener('mouseleave', () => {
    header.style.opacity = '0'
    root.style.opacity = '1'
  })

  header.addEventListener('mouseenter', () => {
    header.style.opacity = '1'
  })

  header.addEventListener('mouseleave', () => {
    header.style.opacity = '0'
  })

  root.addEventListener('mouseenter', () => {
    if (!lockEl) return
    lockEl.style.opacity = '1'
  })

  root.addEventListener('mouseleave', () => {
    if (lockEl) lockEl.style.opacity = '0'
    clearTimeout(timeoutId)
  })

  root.addEventListener('mousemove', () => {
    if (!root.classList.contains('is-lock')) return
    clearTimeout(timeoutId)

    const osdLyric = JSON.parse(localStorage.getItem('osdLyric'))

    lastMoveTime = Date.now()
    timeoutId = setTimeout(() => {
      const now = Date.now()
      if (now - lastMoveTime >= (osdLyric.staticTime ?? 1500)) {
        root.style.opacity = '0.02'
      }
    }, osdLyric.staticTime ?? 1500)
  })

  lockEl?.addEventListener('mouseenter', () => {
    ipcRenderer.send('set-ignore-mouse', false)
  })

  lockEl?.addEventListener('mouseleave', () => {
    ipcRenderer.send('mouseleave')
  })
})
