export interface Iface {
  UpdateLyric: (lrcObj: string) => void
  LikeThisTrack: (liked: boolean) => void
}

class ServiceMonitor {
  private sessionBus: any
  private interfaceName: string = 'org.freedesktop.DBus'
  private objectPath: string = '/org/freedesktop/DBus'
  private dbus = require('dbus-native')
  serviceName: string
  iface: Iface | null

  constructor(serviceName: string) {
    this.sessionBus = this.dbus.sessionBus()
    this.serviceName = serviceName
    this.iface = null

    this.watchName()
  }

  // 监听 NameOwnerChanged 信号
  private watchName() {
    // 创建代理接口监听 org.freedesktop.DBus
    this.sessionBus.getInterface(
      this.interfaceName,
      this.objectPath,
      this.interfaceName,
      (err, iface) => {
        if (err) {
          console.error('Failed to get D-Bus interface:', err)
          return
        }

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
            console.log('Initial service owner:', owner)
            this.onOwnerName(owner)
          }
        })
      }
    )
  }

  private onOwnerName(owner: string) {
    console.log('Service owner changed:', owner)
    const path = `/${this.serviceName.replace(/\./g, '/')}`
    this.sessionBus
      .getService(this.serviceName)
      .getInterface(path, this.serviceName, (err: any, iface: any) => {
        if (err) {
          console.error('Failed to get D-Bus interface:', err)
          return
        }
        this.iface = iface
      })
  }

  private onLostOwnerName() {
    console.log('Service owner lost')
  }
}

export const createDBus = (busName: string) => {
  return new ServiceMonitor(busName)
}
