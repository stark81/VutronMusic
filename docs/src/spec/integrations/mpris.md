---
title: Linux MPRIS 媒体键集成
order: 14
---

# Linux MPRIS 媒体键集成

通过 MPRIS（Media Player Remote Interfacing Specification）协议，让 Linux 桌面环境的媒体控制键和系统媒体播放器界面能控制 VutronMusic。

**核心文件**: `src/main/mpris.ts`（119 行） **依赖**: `@jellybrick/mpris-service` **平台限制**: 仅 Linux（`Constants.IS_LINUX`）

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

| MPRIS 事件                     | 转发到渲染进程                                      |
| ------------------------------ | --------------------------------------------------- |
| `next`                         | `send('next')`                                      |
| `previous`                     | `send('previous')` 或 `send('fm-trash')`（FM 模式） |
| `playpause` / `play` / `pause` | `send('play')`                                      |
| `quit`                         | `app.exit()`                                        |
| `position`                     | `send('setPosition', position)`                     |
| `loopStatus`                   | `send('repeat', mode)`                              |
| `shuffle`                      | `send('repeat-shuffle', shuffle)`                   |

## 初始化流程

```
BackGround.createWindow()
  → createMpris(win)   // 仅 Linux
  → IPCs.initialize(win, tray, mpris, lrc)
    → initMprisIpcMain(win, mpris)
      → 监听 renderer 状态变更 → mpris.setMetadata() / setPlayState() / ...
```

## 接口定义

```typescript
interface MprisImpl {
  setPlayState: (isPlaying: boolean) => void
  setRepeatMode: (repeat: 'on' | 'one' | 'off') => void
  setShuffleMode: (isShuffle: boolean) => void
  setMetadata: (metadata: any) => void
  setPosition: (data: { progress: number }) => void
  setRate: (data: { rate: number }) => void
  setPersonalFM: (value: boolean) => void
}
```
