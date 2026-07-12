/**
 * 原生 TouchBar 插件 — 歌词渲染 + 控制按钮
 * 对应 C++ TouchBarItem 类（N-API 包装）
 * 仅在 macOS 上可用。
 */

export interface NativeTouchBarItem {
  /** 设置歌词数据（含逐字时间戳） */
  setLyric(
    text: string,
    words: Array<{ word: string; start: number; end: number }>,
    lineStart: number,
    lineEnd: number,
    hasWordTiming?: boolean,
    lyricWidth?: number,
    offset?: number
  ): void

  /** 播放/暂停 + 进度同步 */
  setPlaying(playing: boolean, progress?: number): void

  /** 播放倍率 */
  setPlaybackRate(rate: number): void

  /** 喜欢状态 */
  setLikeState(liked: boolean): void

  /** FM 模式（切换第一个按钮为踩/上一首） */
  setFMMode(isFM: boolean): void

  /** 逐字高亮开关 */
  setWordByWord(wBYw: boolean): void

  /** 已播放高亮颜色 */
  setPlayedColor(hex: string): void

  /** 亮色模式下的已播放颜色 */
  setPlayedColorLight(hex: string): void

  /** 注册按钮点击回调 */
  onButtonClick(callback: (index: number) => void): void

  /** 将 TouchBar 安装到当前窗口（传入 Electron BrowserWindow.getNativeWindowHandle()） */
  install(handle?: Buffer): void

  /** 销毁 */
  destroy(): void
}

/** 原生 TouchBar 插件模块 */
export interface NativeTouchBarAddon {
  createTouchBarItem(options?: object): NativeTouchBarItem
}
