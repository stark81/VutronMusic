import { BrowserWindow } from 'electron'
import type { DBusClient } from '@httptoolkit/dbus-native'
import type { DBusNativeImport } from './dbus'
import log from './log'

export interface Iface {
  UpdateLyric: (lrcObj: string) => void
  LikeThisTrack: (liked: boolean) => void
}

class ServiceMonitor {
  private sessionBus: DBusClient
  private interfaceName: string = 'org.freedesktop.DBus'
  private objectPath: string = '/org/freedesktop/DBus'
  private dbus: DBusNativeImport = require('@httptoolkit/dbus-native')
  private win: BrowserWindow
  serviceName: string
  iface: Iface | null
  status: boolean

  constructor(serviceName: string, win: BrowserWindow) {
    this.sessionBus = this.dbus.sessionBus({})
    this.serviceName = serviceName
    this.status = false
    this.win = win
    this.iface = null

    this.watchName()
  }

  // 监听 NameOwnerChanged 信号
  private watchName() {
    // 创建代理接口监听 org.freedesktop.DBus
    this.sessionBus
      .getInterface(this.interfaceName, this.objectPath, this.interfaceName)
      .then((iface) => {
        // 监听 NameOwnerChanged 信号
        iface.on('NameOwnerChanged', (name: string, oldOwner: string, newOwner: string) => {
          if (name === this.serviceName) {
            const isRunning = newOwner !== ''

            // 如果提供了回调，调用回调函数
            if (isRunning) {
              this.onOwnerName(newOwner)
            } else {
              this.onLostOwnerName()
            }
          }
        })

        // 初始检查服务状态
        iface.GetNameOwner(this.serviceName, (err: any, owner: string) => {
          if (err) {
            this.onLostOwnerName()
          } else {
            this.onOwnerName(owner)
          }
        })
      })
      .catch((err) => {
        log.error('Failed to get D-Bus interface:', err)
      })
  }

  private onOwnerName(owner: string) {
    const path = `/${this.serviceName.replace(/\./g, '/')}`
    this.sessionBus
      .getService(this.serviceName)
      .getInterface(path, this.serviceName)
      .then((iface: any) => {
        this.iface = iface
        this.status = true
        this.win.webContents.send('msgExtensionCheckResult', true)
      })
      .catch((err) => {
        log.error('Failed to get D-Bus interface:', err)
        this.status = false
        this.win.webContents.send('msgExtensionCheckResult', false)
      })
  }

  private onLostOwnerName() {
    this.status = false
    this.win.webContents.send('msgExtensionCheckResult', false)
  }
}

export const createDBus = (busName: string, win: BrowserWindow) => {
  return new ServiceMonitor(busName, win)
}
