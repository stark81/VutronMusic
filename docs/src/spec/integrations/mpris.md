---
last-updated: 2026-07-26
title: Linux MPRIS 媒体键集成
order: 14
---

# Linux MPRIS 媒体键集成

通过 MPRIS（Media Player Remote Interfacing Specification）协议，让 Linux 桌面环境的媒体控制键和系统媒体播放器界面能控制 VutronMusic。

**核心文件**: `src/main/mpris.ts`（136 行） **依赖**: `@jellybrick/mpris-service` **平台限制**: 仅 Linux（`Constants.IS_LINUX`）

## 实现方式

基于 `@jellybrick/mpris-service` 创建 D-Bus 服务，注册为 MPRIS2 播放器：

```typescript
const player = new Player({
  name: 'VutronMusic',
  identity: 'VutronMusic'
})
```

## 暴露的 D-Bus 属性

### PlaybackStatus

| MPRIS 状态 | VutronMusic 状态    |
| ---------- | ------------------- |
| `PLAYING`  | `playing === true`  |
| `PAUSED`   | `playing === false` |

### Metadata

| MPRIS 字段          | 来源                          |
| ------------------- | ----------------------------- |
| `mpris:trackid`     | `trackId`（去除 UUID 短横线） |
| `mpris:artUrl`      | 封面图 URL                    |
| `mpris:length`      | 歌曲时长（微秒）              |
| `xesam:title`       | 歌曲标题                      |
| `xesam:artist`      | 艺术家（逗号分隔转数组）      |
| `xesam:album`       | 专辑名                        |
| `xesam:url`         | 歌曲 URL                      |
| `xesam:asText`      | LRC 格式歌词                  |
| `xesam:lyricOffset` | 歌词偏移量                    |

### LoopStatus

| MPRIS 状态             | VutronMusic 状态       |
| ---------------------- | ---------------------- |
| `LOOP_STATUS_NONE`     | `repeatMode === 'off'` |
| `LOOP_STATUS_PLAYLIST` | `repeatMode === 'on'`  |
| `LOOP_STATUS_TRACK`    | `repeatMode === 'one'` |

### Shuffle

`shuffle` 属性映射到 `isShuffle` 状态。

## 事件映射

| MPRIS 事件 | 转发到渲染进程 |
| --- | --- |
| `next` | `send('next')` |
| `previous` | `send('previous')` 或 `send('fm-trash')`（FM 模式） |
| `playpause` / `play` / `pause` | `send('play')` |
| `quit` | `app.exit()` |
| `position` | `send('setPosition', position)`（position 值以微秒传入，内部除以 1000/1000 转为秒） |
| `loopStatus` | `send('repeat', mode)` |
| `shuffle` | `send('repeat-shuffle', shuffle)` |

## 初始化流程

MPRIS 不再通过独立的 `initMprisIpcMain` 初始化，而是整合到统一的 `initSynchronizeIpcMain` 中央分发通道中：

```
BackGround.handleAppEvents()
  → createMpris(win)   // 仅 Linux，在 app.whenReady() 中调用
  → IPCs.initialize(win, tray, touchBar, mpris, lrc)
    → initSynchronizeIpcMain(win, tray, touchBar, mpris, lrc)
      → 收到 synchronize-player-info → mpris.updateInfo(data)
      → 收到 metadata → mpris.setMetadata(metadata)
```

## 接口定义

```typescript
interface MprisImpl {
  setMetadata: (metadata: any) => void
  updateInfo: (data: Partial<statusMap>) => void
}
```

渲染进程通过 `synchronize-player-info` 通道推送状态变化，主进程收到后调用 `mpris.updateInfo(data)` 更新播放状态。`mpris.setMetadata(metadata)` 通过独立的 `metadata` 通道触发。
