import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
// import store from '../main/store'

const mainAvailChannels: string[] = ['mouseleave', 'from-osd', 'osd-resize', 'windowMouseleave']

const rendererAvailChannels: string[] = [
  'set-isLock',
  'update-osd-playing-status',
  'updateLyricInfo',
  'mouseleave-completely'
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

const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean

  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const titleBar = document.getElementById('titleBar')
  let isDragging = false
  let timeoutId: any = null
  let lastMoveTime: number = 0

  const root = document.querySelector('#main') as HTMLElement
  const lockEl = document.querySelector('#osd-lock') as HTMLElement

  // 监控鼠标按下事件，用来处理窗口移动，以避免设置元素的drag导致无法相应鼠标hover
  titleBar?.addEventListener('mousedown', (e: MouseEvent) => {
    // @ts-ignore
    if (!e.target?.classList.contains('header')) return

    e.preventDefault()
    isDragging = true

    const startX = e.clientX
    const startY = e.clientY

    const onMouseMove = throttle((e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      ipcRenderer.send('window-drag', { dx, dy })
    }, 16)

    const onMouseUp = () => {
      isDragging = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

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

    const osdLyric = JSON.parse(localStorage.getItem('osdLyric'))

    lastMoveTime = Date.now()
    timeoutId = setTimeout(() => {
      const now = Date.now()
      if (now - lastMoveTime >= (osdLyric.staticTime ?? 1500)) {
        root.style.opacity = '0.02'
      }
    }, osdLyric.staticTime ?? 1500)
  })
})
