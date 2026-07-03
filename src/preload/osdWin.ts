import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const mainAvailChannels: string[] = ['mouseleave', 'from-osd', 'osd-resize', 'windowMouseleave']

const rendererAvailChannels: string[] = [
  'set-isLock',
  'update-osd-playing-status',
  'updateLyricInfo',
  'mouseInWindow'
]

let messagePort: MessagePort | null = null

ipcRenderer.on('port-connect', (event: any) => {
  if (messagePort) {
    messagePort.close()
  }
  messagePort = event.ports[0]
  messagePort?.start()

  messagePort!.onmessage = (event) => {
    window.postMessage(event.data, '*')
  }
})

window.addEventListener('unload', () => {
  if (messagePort) {
    messagePort.close()
  }
})

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
  },
  sendMessage: (message: any) => {
    if (messagePort) {
      messagePort.postMessage(message)
    } else {
      throw new Error('Message port is not available')
    }
  },
  closeMessagePort: () => {
    if (messagePort) {
      messagePort.close()
      messagePort = null
    }
  }
})

contextBridge.exposeInMainWorld('env', {
  isElectron: true,
  isEnableTitlebar: process.platform === 'win32' || process.platform === 'linux',
  isLinux: process.platform === 'linux',
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32'
})

document.addEventListener('DOMContentLoaded', () => {
  let timeoutId: any = null
  let lastMoveTime: number = 0

  const root = document.querySelector('#main') as HTMLElement
  const lockEl = document.querySelector('#osd-lock') as HTMLElement

  lockEl?.addEventListener('mouseenter', () => {
    ipcRenderer.send('set-ignore-mouse', false)
  })

  lockEl?.addEventListener('mouseleave', () => {
    ipcRenderer.send('mouseleave')
  })

  root.addEventListener('mouseenter', () => {
    if (!lockEl) return
    lockEl.style.opacity = '1'
  })

  root.addEventListener('mouseleave', () => {
    clearTimeout(timeoutId)
    if (lockEl) lockEl.style.opacity = '0'
    root.style.opacity = '1'
  })

  root.addEventListener('mousemove', () => {
    if (!root.classList.contains('is-lock')) return
    clearTimeout(timeoutId)

    const osdLyric = JSON.parse(localStorage.getItem('osdLyric') || '{}')
    if (osdLyric?.staticTime === 0) return // || !osdLyric.showButtonWhenLock

    lastMoveTime = Date.now()
    timeoutId = setTimeout(() => {
      const now = Date.now()
      if (
        root?.classList?.contains('is-lock') &&
        now - lastMoveTime >= (osdLyric.staticTime ?? 1500)
      ) {
        root.style.opacity = '0.02'
        clearTimeout(timeoutId)
      }
    }, osdLyric.staticTime ?? 1500)
  })
})
