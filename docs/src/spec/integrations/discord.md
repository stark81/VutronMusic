---
last-updated: 2026-07-26
title: Discord Rich Presence
order: 16
---

# Discord Rich Presence

在 Discord 中显示当前播放的歌曲信息。

**核心文件**: `src/main/IPCs.ts`（第 365-400 行） **依赖**: `discord-rich-presence` 应用 **App ID**: `1450799847962574868`

## 功能

播放歌曲时在 Discord 个人资料中显示：

- 歌曲名称 + 艺术家
- 专辑
- 播放进度 / 总时长
- 播放 / 暂停状态（动态图标切换）
- 专辑封面图

## 实现

### 主进程

使用 `discord-rich-presence` 的 `updatePresence` 方法设置完整状态对象：

```typescript
// src/main/IPCs.ts
const client = require('discord-rich-presence')('1450799847962574868')

ipcMain.on('playDiscordPresence', (event, track: NewTrack, seekTime = 0) => {
  client.updatePresence({
    details: track.name + ' - ' + track.artists.map(...).join(','),
    state: track.album.name,
    endTimestamp: Date.now() + track.duration,
    largeImageKey: track.album.picUrl + '?param=256y256',
    smallImageKey: 'play',
    smallImageText: '正在播放',
    instance: true
  })
})

ipcMain.on('pauseDiscordPresence', (event, track: NewTrack) => {
  client.updatePresence({
    ...track,
    smallImageKey: 'pause',
    smallImageText: '已暂停'
  })
})
```

暂停时不再调用 `client.pause()`，而是通过 `updatePresence` 更新图标和状态文本。

### 渲染进程

在 `player.ts` / `synchronize.ts` 中：

```typescript
const enableDRP = computed(() => settingsStore.misc.enableDiscordRichPresence)

function playDiscordPresence(track: Track, seekTime = 0) {
  if (!enableDRP.value || !track) return
  const copyTrack = { ...track }
  copyTrack.duration -= seekTime * 1000
  window.mainApi?.send('playDiscordPresence', cloneDeep(copyTrack), seekTime)
}

function pauseDiscordPresence(track: Track) {
  if (!enableDRP.value || !track) return
  window.mainApi?.send('pauseDiscordPresence', cloneDeep(track))
}
```

### 触发时机

| 事件         | 操作                                             |
| ------------ | ------------------------------------------------ |
| 开始播放     | `playDiscordPresence(currentTrack, currentTime)` |
| 暂停         | `pauseDiscordPresence(currentTrack)`             |
| 设置开关变更 | 根据新值启用 / 禁用                              |
| 切歌         | 旧歌 pause → 新歌 play                           |

## 设置项

| 字段                             | 类型      | 默认值  | 说明                  |
| -------------------------------- | --------- | ------- | --------------------- |
| `misc.enableDiscordRichPresence` | `boolean` | `false` | 启用 Discord 状态显示 |

**UI 入口**: `SystemSettings.vue` → 杂项设置 → 启用 Discord Rich Presence
