/**
 * 原生 Tray 插件菜单项（传递到 popupNativeMenu 的序列化格式）
 */
export interface NativeTrayMenuItem {
  id: number
  label: string
  type?: 'normal' | 'separator' | 'checkbox' | 'radio'
  enabled?: boolean
  checked?: boolean
  submenu?: NativeTrayMenuItem[]
}

/**
 * 原生 TrayItem 接口，对应 C++ TrayItem 类（N-API 包装）。
 * 仅在 macOS 上可用。
 */
export interface NativeTrayItem {
  setLyric(
    text: string,
    words: Array<{ word: string; start: number; end: number }>,
    lineStart: number,
    lineEnd: number,
    hasWordTiming?: boolean,
    lyricWidth?: number,
    offset?: number
  ): void

  setPlaying(playing: boolean, progress?: number): void
  setPlaybackRate(rate: number): void
  setLikeState(liked: boolean): void
  setWidth(width: number): void
  setButtonType(index: number, type: number): void
  setIconImage(buffer: Buffer): void
  setVisibility(opts: { lyric?: boolean; buttons?: boolean; icon?: boolean }): void
  setWordByWord(wBYw: boolean): void
  setPlayedColor(hex: string): void
  setPlayedColorLight(hex: string): void

  onButtonClick(callback: (index: number) => void): void
  onRightClick(callback: () => void): void
  onTrayClick(callback: () => void): void

  destroy(): void
  getClickPosition(): { x: number; y: number }
  popupNativeMenu(items: NativeTrayMenuItem[], callback: (clickedId: number) => void): void
}

/**
 * 原生 Tray 插件模块（node addon），导出一个 createTrayItem 工厂函数。
 */
export interface NativeTrayAddon {
  createTrayItem(options?: object): NativeTrayItem
}
