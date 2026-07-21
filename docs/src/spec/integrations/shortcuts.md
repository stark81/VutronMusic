---
last-updated: 2026-07-26
title: 快捷键系统
order: 13
---

# 快捷键系统

支持窗口内快捷键和系统全局快捷键，用户可自定义。

**核心文件**:

- `src/main/globalShortcut.ts`（34 行）— 全局快捷键注册
- `src/main/utils/shortcuts.ts`（44 行）— 默认快捷键定义
- `src/renderer/store/settings.ts` — 快捷键配置持久化

## 默认快捷键

| ID               | 功能            | 窗口内           | 全局                 |
| ---------------- | --------------- | ---------------- | -------------------- |
| `play`           | 播放/暂停       | `Cmd/Ctrl+P`     | `Alt+Cmd/Ctrl+P`     |
| `next`           | 下一首          | `Cmd/Ctrl+Right` | `Alt+Cmd/Ctrl+Right` |
| `previous`       | 上一首          | `Cmd/Ctrl+Left`  | `Alt+Cmd/Ctrl+Left`  |
| `increaseVolume` | 增加音量        | `Cmd/Ctrl+Up`    | `Alt+Cmd/Ctrl+Up`    |
| `decreaseVolume` | 减少音量        | `Cmd/Ctrl+Down`  | `Alt+Cmd/Ctrl+Down`  |
| `like`           | 喜欢歌曲        | `Cmd/Ctrl+L`     | `Alt+Cmd/Ctrl+L`     |
| `minimize`       | 隐藏/显示播放器 | `Cmd/Ctrl+M`     | `Alt+Cmd/Ctrl+M`     |

## 两层快捷键

### 窗口内快捷键

通过 `window.mainApi.on()` 监听主进程转发的事件，在 `synchronize.ts` 的 `handleIpcRenderer()` 中处理：

```typescript
window.mainApi?.on('play', playOrPause)
window.mainApi?.on('next', () => playNext(isPersonalFM.value))
window.mainApi?.on('previous', () => { ... })
window.mainApi?.on('like', () => likeATrack(currentTrack.value))
```

### 全局快捷键

通过 Electron `globalShortcut.register()` 注册，即使窗口不在前台也能响应：

```typescript
// src/main/globalShortcut.ts
globalShortcut.register(shortcut.globalShortcut, () => {
  win.webContents.send(shortcut.id) // 转发给渲染进程
})
```

全局快捷键开关：`settings.enableGlobalShortcut`，变更时通过 IPC 通知主进程注册/注销。

## 用户自定义

快捷键配置持久化在 `settings.shortcuts`，格式：

```typescript
{
  id: string // 快捷键 ID（play/next/...）
  name: string // 显示名称
  shortcut: string // 窗口内快捷键
  globalShortcut: string // 全局快捷键
}
```

**操作**：

- `updateShortcut({id, type, shortcut})` — 更新单个快捷键
- `restoreDefaultShortcuts()` — 恢复默认配置

## 生命周期

```
应用启动 → registerGlobalShortcuts(win)
  → 读取 settings.shortcuts（或使用默认值）
  → globalShortcut.register() 注册所有全局快捷键

设置变更 → IPC 'setStoreSettings' → 主进程更新快捷键注册

应用退出 → globalShortcut.unregisterAll()
```
