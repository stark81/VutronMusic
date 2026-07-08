---
title: Preload contextBridge 桥接
order: 12
last-reviewed: 2025-07-07
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

| 分类     | 通道                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 窗口控制 | `minimize`, `maximizeOrUnmaximize`, `close`, `showWindow`                      |
| 播放器   | `metadata`, `updatePlayerState`, `updateOsdState`, `updateTouchBarLyric`       |
| 插件     | `plugin-method-call`, `get-plugins`, `upload-plugin`, `create-plugin-instance` |
| 本地音乐 | `msgScanLocalMusic`, `selecteFolder`, `getFilesInFolder`                       |
| 第三方   | `playDiscordPresence`, `pauseDiscordPresence`, `lastfm-auth`                   |
| 设置     | `setStoreSettings`, `setPluginEnable`, `set-source-priority`                   |
| 歌词     | `updateLyricInfo`, `plugin-lyric`, `get-lyric-offset`, `set-lyric-offset`      |

### 主进程 → 渲染（rendererAvailChannels）

| 分类     | 通道                                                           |
| -------- | -------------------------------------------------------------- |
| 播放控制 | `play`, `previous`, `next`, `repeat`, `repeat-shuffle`, `like` |
| 音量     | `increaseVolume`, `decreaseVolume`                             |
| FM       | `fm-trash`                                                     |
| 扫描     | `scanLocalMusicProgress`, `scanLocalMusicDone`                 |
| 更新     | `update-error`, `download-progress`, `resume`                  |
| 系统     | `handleTrayClick`, `rememberCloseAppOption`, `setPosition`     |
