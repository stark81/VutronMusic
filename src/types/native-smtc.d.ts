/**
 * Windows SMTC 原生插件
 * 对应 C++ SMTCSession 类（N-API 包装）
 * 仅在 Windows 上可用。
 */

export interface NativeSMTCSession {
  /** 设置媒体信息 */
  setMetadata(meta: {
    title?: string
    artist?: string
    album?: string
    thumbnail?: string // 本地图片路径
    duration?: number
  }): void

  /** 更新播放状态 */
  setPlaybackState(playing: boolean, position: number, duration: number, rate: number): void

  /** 清除媒体信息 */
  clearMetadata(): void

  /** 注册按钮回调 */
  onButtonClick(callback: (command: string) => void): void

  /** 销毁 */
  destroy(): void
}

export interface NativeSMTCAddon {
  createSMTCSession(): NativeSMTCSession
}
