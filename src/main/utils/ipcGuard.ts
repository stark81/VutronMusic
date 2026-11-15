import {
  ipcMain as rawIpcMain,
  IpcMainEvent,
  IpcMainInvokeEvent,
  WebContents,
  WebFrameMain
} from 'electron'
import Constants from './Constants'
import log from '../log'

/**
 * IPC 调用方校验（issue #416 的核心修复之一）。
 *
 * 背景：`src/preload/index.ts` 的通道白名单**只校验 channel 名，不校验调用方**。
 * preload 会在窗口当前承载的任意 origin 上重新执行，因此一旦特权窗口被导航到
 * 攻击者站点，攻击者页面就能拿到同一个 `window.mainApi`，从而以主进程权限调用
 * 任意白名单通道（任意文件删除/写入、目录枚举……）。
 *
 * 因此在主进程侧建立真正的安全边界：
 *   1. 只有显式登记过的窗口（主窗口 / 桌面歌词窗口）的 webContents 才能调用 IPC；
 *   2. 调用必须来自该窗口的主 frame（子 iframe 一律拒绝）；
 *   3. 主 frame 的 URL origin 必须等于应用自身的 origin（`Constants.APP_ORIGIN`）；
 *   4. 任何异常/信息缺失都按拒绝处理（fail-closed）。
 *
 * 实现方式：`installIpcGuard()` 会给 Electron 的 `ipcMain.on/handle` 打一层包装，
 * 因此 `IPCs.ts` / `menu.ts` / `dock.ts` / `thumBar.ts` 等所有注册点都自动被覆盖，
 * 新增通道也不会漏掉。请勿绕过本模块直接使用原生 `ipcMain`。
 */

export type TrustedWindowKind = 'main' | 'osd'

/** webContents.id → 窗口类别 */
const trustedWindows = new Map<number, TrustedWindowKind>()

/** 桌面歌词窗口专用的通道：只有 OSD 窗口允许调用 */
const OSD_ONLY_CHANNELS = new Set<string>([
  'from-osd',
  'osd-start-resize',
  'osd-stop-resize',
  'set-ignore-mouse',
  'mouseleave',
  'get-seek',
  'init-from-osd'
])

/** 只允许主窗口调用的高危通道（文件系统原语 / 窗口截图） */
const MAIN_ONLY_CHANNELS = new Set<string>([
  'get-screenshot',
  'delete-screenshot',
  'getFilesInFolder',
  'msgCheckFileExist',
  'check-local-resource',
  'msgScanLocalMusic',
  'upload-plugin',
  'setStoreSettings'
])

/**
 * 登记一个可信窗口。必须在窗口创建后、`loadURL` 之前调用。
 * 窗口销毁后自动注销。
 */
export function trustWebContents(contents: WebContents, kind: TrustedWindowKind): void {
  trustedWindows.set(contents.id, kind)
  contents.once('destroyed', () => {
    trustedWindows.delete(contents.id)
  })
}

/** 当前可信窗口 id 列表（仅用于诊断日志） */
export function listTrustedWebContentsIds(): number[] {
  return [...trustedWindows.keys()]
}

function isTrustedOrigin(url: string): boolean {
  try {
    return new URL(url).origin === Constants.APP_ORIGIN
  } catch {
    return false
  }
}

type SenderInfo = { id: number; kind: TrustedWindowKind; url: string }

function resolveSender(event: IpcMainEvent | IpcMainInvokeEvent): SenderInfo | null {
  try {
    const contents = event.sender
    if (!contents || contents.isDestroyed()) return null

    const kind = trustedWindows.get(contents.id)
    if (!kind) return null

    // 只接受主 frame：子 iframe 不应具备特权。
    // 用 parent === null 做结构化判断，避免依赖 WebFrameMain 实例的缓存语义。
    const frame: WebFrameMain | null = event.senderFrame
    if (!frame) return null
    if (frame.parent !== null) return null
    const mainFrame = contents.mainFrame
    if (mainFrame && frame.frameTreeNodeId !== mainFrame.frameTreeNodeId) return null

    const url = frame.url
    if (!url || !isTrustedOrigin(url)) return null

    return { id: contents.id, kind, url }
  } catch {
    return null
  }
}

function checkPolicy(info: SenderInfo, channel: string): boolean {
  if (OSD_ONLY_CHANNELS.has(channel)) return info.kind === 'osd'
  if (MAIN_ONLY_CHANNELS.has(channel)) return info.kind === 'main'
  return true
}

function describeSender(event: IpcMainEvent | IpcMainInvokeEvent): string {
  let id: number | string = 'unknown'
  let url = 'unknown'
  try {
    id = event.sender?.id ?? 'null'
  } catch {
    /* 已销毁 */
  }
  try {
    url = event.senderFrame?.url || 'null'
  } catch {
    /* frame 已销毁 */
  }
  return `senderId=${id} senderFrame=${url}`
}

function authorize(event: IpcMainEvent | IpcMainInvokeEvent, channel: string): SenderInfo | null {
  const info = resolveSender(event)
  if (!info) {
    log.warn(
      `[security] 已拒绝来自不可信上下文的 IPC 调用: channel=${channel} ` +
        `${describeSender(event)} trustedIds=[${listTrustedWebContentsIds().join(',')}]`
    )
    return null
  }
  if (!checkPolicy(info, channel)) {
    log.warn(
      `[security] 已拒绝越权 IPC 调用: channel=${channel} windowKind=${info.kind} url=${info.url}`
    )
    return null
  }
  return info
}

let installed = false

/**
 * 安装 IPC 守卫。必须在任何 IPC 通道注册之前调用（注册本身也会经过包装）。
 * 重复调用是安全的。
 *
 * 实现：Electron 的 `ipcMain` 是普通实例对象、`on`/`handle` 来自原型，
 * 用自有属性覆盖原型方法即可全局生效（已通过单元验证）。
 * 若覆盖失败，只记录 error 而不中断启动 —— 窗口导航锁仍然能阻断 issue #416
 * 描述的「导航出去后滥用 IPC」链路，但日志必须足够显眼。
 */
export function installIpcGuard(): void {
  if (installed) return
  installed = true

  const rawOn = rawIpcMain.on.bind(rawIpcMain)
  const rawHandle = rawIpcMain.handle.bind(rawIpcMain)

  const guardedOn = (
    channel: string,
    listener: (event: IpcMainEvent, ...args: any[]) => void
  ): unknown => {
    return rawOn(channel, (event: IpcMainEvent, ...args: any[]) => {
      if (!authorize(event, channel)) return
      listener(event, ...args)
    })
  }

  const guardedHandle = (
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: any[]) => any
  ): unknown => {
    return rawHandle(channel, (event: IpcMainInvokeEvent, ...args: any[]) => {
      if (!authorize(event, channel)) return null
      return listener(event, ...args)
    })
  }

  try {
    Object.defineProperty(rawIpcMain, 'on', {
      value: guardedOn,
      writable: true,
      configurable: true
    })
    Object.defineProperty(rawIpcMain, 'handle', {
      value: guardedHandle,
      writable: true,
      configurable: true
    })

    if (rawIpcMain.on !== guardedOn || rawIpcMain.handle !== guardedHandle) {
      throw new Error('ipcMain 方法覆盖未生效')
    }
  } catch (error) {
    log.error(
      '[security] 无法安装 IPC 调用方校验，所有 IPC 通道将缺少来源校验！' +
        '（窗口导航锁仍然生效）请检查 Electron 版本兼容性：',
      error
    )
    return
  }

  log.info('[security] IPC 调用方校验已启用')
}
