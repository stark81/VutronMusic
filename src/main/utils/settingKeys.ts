/**
 * 允许渲染进程通过 `setStoreSettings` 写入的设置项白名单（issue #416）。
 *
 * 原实现是 `Object.entries(data).forEach(([key, value]) => store.set(\`settings.${key}\`, value))`，
 * key 完全由渲染进程控制，攻击者页面（或任何渲染层漏洞）可以：
 *   - 写入 main 侧会读取的任意设置项，例如 `settings.scanDir`、`settings.proxy`；
 *   - 用带点的 key（如 `background.src`）走 dot-path 覆盖嵌套字段，例如把
 *     `settings.sourcePriority.lyric` 改成任意值；
 *   - 触碰 `__proto__` 之类的危险键名。
 *
 * 维护方式：新增设置项时，先把 key 加到这里，再在渲染层发送。
 * 与本文件对应的调用点只有 `src/renderer/store/settings.ts`。
 */
const ALLOWED_SETTING_KEYS = new Set<string>([
  'autoCacheTrack',
  'closeAppOption',
  'embedCoverArt',
  'embedStyle',
  'enableAmuseServer',
  'enableGlobalShortcut',
  'enableTrayMenu',
  'forceFactor',
  'innerFirst',
  'isWordByWord',
  'lang',
  'lyricWidth',
  'musicQuality',
  'playedColor',
  'playedColorLight',
  'proxy',
  'shortcuts',
  'showControl',
  'showHttpLog',
  'showIcon',
  'showLyric',
  'showTray',
  'trayColor',
  'uiScale',
  'unblockNeteaseMusic',
  'useCustomTitlebar'
])

export function isAllowedSettingKey(key: unknown): key is string {
  return typeof key === 'string' && ALLOWED_SETTING_KEYS.has(key)
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
