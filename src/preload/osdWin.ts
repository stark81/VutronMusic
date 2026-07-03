import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const mainAvailChannels: string[] = [
  'mouseleave',
  'from-osd',
  'osd-resize',
  'osd-start-resize',
  'osd-stop-resize'
]

const rendererAvailChannels: string[] = [
  'set-isLock',
  'update-osd-playing-status',
  'updateLyricInfo'
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
  let hideButtonTimeout: any = null
  let lastTrackedPos: { x: number; y: number } | null = null
  let wasInside: boolean | null = null

  const root = document.querySelector('#main') as HTMLElement
  const lockEl = document.querySelector('#osd-lock') as HTMLElement

  let osdLyricConfig: Record<string, any> = JSON.parse(localStorage.getItem('osdLyric') || '{}')
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'osdLyric') {
      osdLyricConfig = JSON.parse(e.newValue || '{}')
    }
  })

  lockEl?.addEventListener('mouseenter', () => {
    ipcRenderer.send('set-ignore-mouse', false)
  })

  lockEl?.addEventListener('mouseleave', () => {
    ipcRenderer.send('mouseleave')
  })

  ipcRenderer.on(
    'osd-lock-mouse-state',
    (_event, data: { inside: boolean; x: number; y: number }) => {
      const { inside } = data

      if (!root.classList.contains('is-lock')) {
        // 未锁定状态：仅当 enter/leave 状态真正变化时才通知 Vue，防止每 50ms 触发重渲染
        if (inside !== wasInside) {
          wasInside = inside
          root.dispatchEvent(new CustomEvent('osd-mouse-enter-leave', { detail: { inside } }))
        }
        return
      }

      const { x, y } = data

      if (!inside) {
        // 光标确实已经离开窗口（基于真实坐标判断，不存在漏检）：
        // 100ms 后隐藏解锁按钮、恢复窗口不透明。注意不能在这里 clearTimeout(hideButtonTimeout)：
        // 轮询间隔 50ms 会不断重置定时器导致永远无法触发。
        lastTrackedPos = null
        clearTimeout(timeoutId)
        if (!hideButtonTimeout) {
          hideButtonTimeout = setTimeout(() => {
            if (lockEl) lockEl.style.opacity = '0'
            root.style.opacity = '1'
            hideButtonTimeout = null
          }, 100)
        }
        return
      }

      // 光标在窗口内：取消”即将隐藏”的计时、确保按钮可见
      clearTimeout(hideButtonTimeout)
      hideButtonTimeout = null
      if (lockEl) lockEl.style.opacity = '1'

      const moved = !lastTrackedPos || lastTrackedPos.x !== x || lastTrackedPos.y !== y
      lastTrackedPos = { x, y }

      if (!moved) return // 光标静止在窗口内，不重置 idle 计时，保留原有的“空闲后淡出”行为

      // 光标确实移动了：立即恢复可见（修复之前重新移入后无法恢复不透明的问题），
      // 并重新走一遍“空闲 staticTime 后淡出”的计时。
      clearTimeout(timeoutId)
      root.style.opacity = '1'
      if (osdLyricConfig?.staticTime === 0) return

      lastMoveTime = Date.now()
      timeoutId = setTimeout(() => {
        if (
          root?.classList?.contains('is-lock') &&
          Date.now() - lastMoveTime >= (osdLyricConfig.staticTime ?? 1500)
        ) {
          root.style.opacity = '0.02'
        }
      }, osdLyricConfig.staticTime ?? 1500)
    }
  )
})
