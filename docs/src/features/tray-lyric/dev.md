---
title: Tray 歌词 — 实现记录
last-updated: 2026-07-21
order: 9
related: [index.md, design.md]
---

# Tray 歌词 — 实现记录

> 产品需求见 [index.md](./index.md)，技术设计见 [design.md](./design.md)。

## 涉及文件

### macOS 原生实现

| 文件                            | 职责                      |
| ------------------------------- | ------------------------- |
| `src/main/tray.ts`              | Tray 管理，加载原生 addon |
| `src/native/tray/tray_addon.mm` | N-API 桥接层              |
| `src/native/tray/tray_view.mm`  | Core Animation 渲染引擎   |

### Linux DBus

| 文件                      | 职责                              |
| ------------------------- | --------------------------------- |
| `src/main/dbusClient.ts`  | DBus 客户端，监听外部扩展         |
| `src/main/dbusService.ts` | DBus 服务端，导出接口供第三方订阅 |

### 状态管理

| 文件                                | 职责                            |
| ----------------------------------- | ------------------------------- |
| `src/renderer/store/settings.ts`    | Tray 设置（settingsStore.tray） |
| `src/renderer/store/lyric.ts`       | 歌词索引（仅在需要时运行）      |
| `src/renderer/utils/synchronize.ts` | 主窗口→主进程数据同步           |

## IPC 通道

### 渲染进程 → 主进程

| 通道                      | 说明                             |
| ------------------------- | -------------------------------- |
| `synchronize-player-info` | 中央分发：歌词、播放状态、进度等 |
| `initTrayState`           | 初始化 Tray 状态                 |
| `updateTrayVisibility`    | 更新歌词/按钮/图标可见性         |
| `setStoreSettings`        | 持久化 Tray 设置                 |

### 主进程 → 渲染进程

| 通道                      | 说明                    |
| ------------------------- | ----------------------- |
| `msgExtensionCheckResult` | Linux DBus 扩展连接状态 |

## Tray 设置项

| 字段               | 默认值      | 说明             |
| ------------------ | ----------- | ---------------- |
| `showLyric`        | `true`      | 显示歌词         |
| `showControl`      | `true`      | 显示控制按钮     |
| `showIcon`         | `true`      | 显示图标         |
| `lyricWidth`       | `192`       | 歌词区域宽度     |
| `isWordByWord`     | `true`      | 逐字高亮         |
| `playedColor`      | `'#ffff00'` | 深色模式高亮颜色 |
| `playedColorLight` | `'#ffff00'` | 浅色模式高亮颜色 |
| `enableExtension`  | `true`      | Linux DBus 扩展  |
| `showTray`         | `true`      | 显示整个 Tray    |

## 歌词索引优化

`lyricStore` 的 `shouldGetLrcIndex` 只在以下情况运行歌词索引计时器：

- 主窗口显示歌词页面
- OSD 歌词窗口可见
- macOS Tray 歌词开启
- Linux DBus 扩展启用

避免在不需要歌词显示时浪费 CPU。
