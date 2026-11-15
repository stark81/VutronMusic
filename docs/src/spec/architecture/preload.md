---
last-updated: 2026-07-21
title: Preload contextBridge 桥接
order: 12
last-reviewed: 2025-07-21
---

# Preload contextBridge 桥接

通过 Electron 的 `contextBridge` 安全地将主进程能力暴露给渲染进程。

**核心文件**:

- `src/preload/index.ts`（165 行）— 主窗口桥接
- `src/preload/osdWin.ts` — OSD 歌词窗口桥接

## 安全模型

### 白名单机制

所有 IPC 通道通过白名单控制，未列入的通道调用会抛出 `Error`：

```typescript
// 渲染进程 → 主进程（send/invoke）
const mainAvailChannels: string[] = [
  'msgRequestGetVersion', 'msgOpenExternalLink', 'msgScanLocalMusic',
  'plugin-method-call', 'get-song-url', 'get-plugins', ...
]

// 主进程 → 渲染进程（on/once）
const rendererAvailChannels: string[] = [
  'play', 'previous', 'next', 'repeat', 'like',
  'scanLocalMusicProgress', 'scanLocalMusicDone', ...
]
```

### 暴露的 API

#### `window.mainApi`

| 方法                       | 说明                              | 对应 IPC                  |
| -------------------------- | --------------------------------- | ------------------------- |
| `send(channel, ...data)`   | 单向发送消息到主进程              | `ipcRenderer.send`        |
| `on(channel, listener)`    | 监听主进程消息                    | `ipcRenderer.on`          |
| `once(channel, listener)`  | 监听一次                          | `ipcRenderer.once`        |
| `off(channel, listener)`   | 取消监听                          | `ipcRenderer.off`         |
| `invoke(channel, ...data)` | 请求-响应模式（async）            | `ipcRenderer.invoke`      |
| `sendMessage(message)`     | 通过 MessagePort 发送（OSD 窗口） | `MessagePort.postMessage` |
| `closeMessagePort()`       | 关闭 MessagePort                  | `MessagePort.close`       |

#### `window.env`

```typescript
{
  isElectron: true,
  isEnableTitlebar: process.platform === 'win32' || process.platform === 'linux',
  isLinux: process.platform === 'linux',
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isDev: process.env.NODE_ENV === 'development'
}
```

## MessagePort 通道（OSD 歌词窗口）

OSD 歌词窗口通过 `MessagePort` 与主窗口通信，避免走 IPC 中转：

```
主窗口 ←→ MessagePort ←→ OSD 窗口
```

- 主进程通过 `port-connect` 事件建立连接
- 消息格式：`{ type: string, data: any }`
- 常见消息类型：`update-osd-status`、`init-from-osd`、`get-seek`

## 通道分类

### 渲染 → 主进程（mainAvailChannels）

| 分类 | 通道 |
| --- | --- |
| 窗口控制 | `minimize`, `maximizeOrUnmaximize`, `close`, `showWindow` |
| 播放器 | `metadata`, `updatePlayerState`, `updateOsdState`, `synchronize-player-info` |
| 插件 | `plugin-method-call`, `get-plugins`, `upload-plugin`, `create-plugin-instance`, `delete-plugin-instance` |
| 本地音乐 | `msgScanLocalMusic`, `selecteFolder`, `getFilesInFolder`, `deleteLocalMusicDB`, `accurateMatch`, `clearDeletedMusic` |
| 第三方 | `playDiscordPresence`, `pauseDiscordPresence`, `lastfm-auth`, `get-lastfm-session`, `disconnect-lastfm` |
| 设置 | `setStoreSettings`, `setPluginEnable`, `set-source-priority`, `get-source-priority` |
| 歌词 | `updateLyricInfo`, `update-osd-lyric`, `plugin-lyric`, `get-lyric-offset`, `set-lyric-offset` |
| 托盘 | `updateTray`, `updateTrayLyric`, `initTrayState`, `updateTrayVisibility`, `setTrayFMMode` |
| 缓存 | `clearCacheTracks`, `getCacheTracksInfo`, `get-cache-path`, `get-song-url` |
| 更新 | `check-update`, `downloadUpdate`, `update-powersave` |
| 截图 | `get-screenshot`, `delete-screenshot` |
| 其他 | `msgRequestGetVersion`, `msgOpenExternalLink`, `msgOpenFile`, `msgShowInFolder`, `msgCheckFileExist`, `showOpenDialog`, `getFilesInFolder`, `openLogFile`, `getFontList`, `report-playback`, `getStreamMatchCount`, `trackMatch`, `plugin-comment`, `clearStreamMatches` |

### 主进程 → 渲染（rendererAvailChannels）

| 分类     | 通道                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 播放控制 | `play`, `pause`, `previous`, `next`, `repeat`, `repeat-shuffle`, `like`        |
| 音量     | `increaseVolume`, `decreaseVolume`                                             |
| FM       | `fm-trash`                                                                     |
| 进度     | `setPosition`, `resume`                                                        |
| 扫描     | `scanLocalMusicProgress`, `scanLocalMusicDone`, `msgHandleScanLocalMusicError` |
| 更新     | `update-error`, `download-progress`                                            |
| 桌面歌词 | `updateOSDSetting`, `init-from-osd`, `get-seek`                                |
| 系统     | `handleTrayClick`, `rememberCloseAppOption`, `changeRouteTo`                   |
| 扩展     | `msgExtensionCheckResult`, `updateAmuseServerStatus`                           |
| 缓存     | `receiveCacheInfo`                                                             |

## ⚠️ 白名单不是安全边界

通道白名单只校验 **channel 名**，不校验调用方。preload 会在窗口当前承载的任意 origin 上重新执行，因此一旦特权窗口被导航到攻击者站点，攻击者页面就能拿到同一个 `window.mainApi` 并调用任意白名单通道。

真正的安全边界在主进程侧，由两部分组成（详见 [安全边界与不变量](./security)）：

1. `src/main/utils/windowHardening.ts` —— 窗口只能在应用自身 origin 内导航，跨源一律拦截；
2. `src/main/utils/ipcGuard.ts` —— 只接受已登记窗口的**主 frame**、且 origin 等于 `Constants.APP_ORIGIN` 的调用，否则 fail-closed 拒绝并记录日志。

两个 preload 的通道集合是分开维护的：

- `src/preload/index.ts` —— 主窗口
- `src/preload/osdWin.ts` —— 桌面歌词窗口（另有一处直接使用 `ipcRenderer` 发送 `set-ignore-mouse` / `mouseleave`，这些通道同样受主进程守卫约束）

新增通道时请同时更新对应 preload 的白名单，并判断它是否需要加入 `ipcGuard.ts` 的 `OSD_ONLY_CHANNELS` / `MAIN_ONLY_CHANNELS` 分级。
