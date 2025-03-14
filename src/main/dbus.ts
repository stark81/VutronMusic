export type DBusNativeImport = typeof import('@httptoolkit/dbus-native')

declare module '@httptoolkit/dbus-native' {
  export let sessionBus: DBusNativeImport['createClient']

  export interface DBusClient {
    requestName(name: string, flags: number): Promise<number>
    exportInterface(obj: any, path: string, iface: any): void
    getInterface(path: string, objname: string, name: string): Promise<any>
  }

  export interface DBusService {}
}
