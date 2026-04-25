---
title: OSD 歌词 — 实现记录
last-updated: 2026-07-21
order: 8
related: [index.md, design.md]
---

# OSD 歌词 — 实现记录

> 产品需求见 [index.md](./index.md)，技术设计见 [design.md](./design.md)。

## 涉及文件

| 文件                                            | 职责                                  |
| ----------------------------------------------- | ------------------------------------- |
| `src/renderer/components/OsdLyricContainer.vue` | OSD 歌词容器，管理歌词显示和动画      |
| `src/renderer/components/LyricLine.vue`         | 歌词行组件（含滚动动画）              |
| `src/preload/osdWin.ts`                         | OSD 窗口预加载脚本（锁定/透明度逻辑） |
| `src/main/IPCs.ts`                              | IPC 通道（OSD resize/lock/mouse）     |
| `src/renderer/utils/synchronize.ts`             | 主窗口→OSD 数据同步                   |
| `src/renderer/store/osdLyric.ts`                | OSD 歌词状态管理                      |
| `src/main/osd.ts`                               | OSD 窗口创建和管理                    |

## IPC 通道

### 主窗口 → 主进程

| 通道                      | 说明                                  |
| ------------------------- | ------------------------------------- |
| `synchronize-player-info` | 同步播放状态到 OSD                    |
| `updateOsdState`          | 更新 OSD 窗口状态（show/type/isLock） |
| `get-seek`                | 请求当前播放进度                      |

### OSD 窗口 → 主进程

| 通道               | 说明                                                      |
| ------------------ | --------------------------------------------------------- |
| `from-osd`         | OSD 窗口操作（showMainWin/playPrev/playNext/playOrPause） |
| `osd-start-resize` | 开始调整窗口大小                                          |
| `osd-stop-resize`  | 停止调整窗口大小                                          |
| `set-ignore-mouse` | 临时允许/禁止鼠标交互                                     |
| `mouseleave`       | 光标移出解锁按钮                                          |
| `get-seek`         | 请求当前播放进度                                          |
| `init-from-osd`    | 初始化时请求完整状态                                      |

### 主进程 → OSD 窗口

| 通道                   | 说明                    |
| ---------------------- | ----------------------- |
| `update-osd-status`    | 更新歌词/播放状态       |
| `osd-lock-mouse-state` | 光标位置和进入/离开状态 |

## 关键代码路径

### 滚动动画

- `LyricLine.vue:122-168` — `buildScrollKeyFrame()` 构建滚动关键帧
- `LyricLine.vue:177-192` — `buildScrollAnimation()` 创建滚动动画对象
- `LyricLine.vue:233-248` — `updateCurrentTime()` 由父组件控制动画进度

### 锁定/透明度

- `osdWin.ts:66-150` — DOMContentLoaded 事件处理
- `osdWin.ts:83-89` — 解锁按钮 mouseenter/mouseleave
- `osdWin.ts:91-149` — `osd-lock-mouse-state` 处理（核心逻辑）

### 分组逻辑

- `OsdLyricContainer.vue:85-126` — `groupLyric` 计算属性
- `OsdLyricContainer.vue:134-147` — `lyricToShow` 计算属性（决定显示哪些行）
