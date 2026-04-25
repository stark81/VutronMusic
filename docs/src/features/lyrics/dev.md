---
title: 歌词系统 — 实现记录
last-updated: 2026-07-21
order: 7
related: [index.md, design.md]
---

# 歌词系统 — 实现记录

> 产品需求见 [index.md](./index.md)，技术设计见 [design.md](./design.md)。

## 涉及文件

| 文件                                    | 职责                              |
| --------------------------------------- | --------------------------------- |
| `src/renderer/store/lyric.ts`           | setTimeout 调度逻辑、歌词状态管理 |
| `src/renderer/components/LyricLine.vue` | 逐字动画构建与控制                |
| `src/renderer/components/LyricPage.vue` | 歌词页面，协调所有 LyricLine      |
| `src/renderer/utils/lyricMeasure.ts`    | Canvas 离屏文字宽度测量           |
| `src/renderer/store/player.ts`          | 播放进度与歌词联动                |
| `src/main/dbHelpers.ts`                 | 歌词缓存读写                      |

## 关键实现

### setTimeout 调度（lyric.ts）

- `getLyricIndex()` — 从 start 索引线性扫描，找到第一个 start > 当前时间的行
- `refreshLineIdx()` — 更新索引并预约下一次 setTimeout
- `updateIndex()` — 清除旧定时器并重新计算（seek/切歌/偏移变化时调用）

### 逐字动画（LyricLine.vue）

- `buildWordKeyFrame()` — 根据逐字时间戳构建 background-position keyframes
- `buildWordAnimation()` — 创建 KeyframeEffect + Animation 对象
- `updateCurrentTime()` — 父组件调用，设置 animation.currentTime
- `updatePlayStatus()` — 控制 play/pause/finish/reset

### Canvas 测量（lyricMeasure.ts）

- 使用离屏 Canvas 的 `measureText()` 测量文字宽度
- 结果按 `font|fontSize|fontWeight|word` 缓存
- `prewarmMeasureCache()` 在歌词加载时批量预热

### 状态注入

lyric store 通过 `setTimeGetter`、`setPlayingGetter` 等方法注入依赖，不直接 import audioEngine，实现依赖反转。
