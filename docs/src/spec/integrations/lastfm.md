---
last-updated: 2026-07-26
title: Last.fm Scrobble 集成
order: 15
---

# Last.fm Scrobble 集成

将播放记录上报到 Last.fm，实现听歌统计和 Scrobble 功能。

**核心文件**: `src/main/utils/lastfm.ts`（193 行） **设置入口**: `src/renderer/store/settings.ts`（`misc.lastfm`） **UI 入口**: `src/renderer/views/SystemSettings.vue`

## 功能

| 功能                     | 说明                                         |
| ------------------------ | -------------------------------------------- |
| `track.scrobble`         | 上报播放记录（曲目播放完成或播放超过一半时） |
| `track.updateNowPlaying` | 上报当前正在播放的曲目                       |
| OAuth 授权               | 浏览器授权流程                               |

## 授权流程

```
1. requestUserAuth()
   → getAuthToken()    // 获取临时 token
   → shell.openExternal(url)  // 打开浏览器授权页
   → dialog.showMessageBox()  // 等待用户确认
   → getSession(token)  // 获取 session key

2. session 持久化
   → store.set('settings.lastfmSession', { name, key, subscriber })

3. 后续请求自动携带 session key
```

## Scrobble 上报

### 触发时机

Scrobble 集成在 `IPCs.ts` 的 `report-playback` IPC handler 中：

```
歌曲开始播放（type === 'start'）→ updateNowPlaying()
歌曲播放完成（type === 'end'）→ 播放进度 >= 总时长一半或 >= 30 秒时 scrobbleTrack()
```

### 上报参数

```typescript
{
  method: 'track.scrobble',
  api_key: API_KEY,
  sk: session.key,
  artist: string,
  track: string,
  album: string,
  timestamp: number,  // 播放开始时间（Unix 时间戳）
  duration: number,   // 歌曲时长（秒）
  trackNumber: number
}
```

### Now Playing 上报

```typescript
{
  method: 'track.updateNowPlaying',
  api_key: API_KEY,
  sk: session.key,
  artist: string,
  track: string,
  album: string,
  duration: number
}
```

## 插件 Scrobble 广播

除了 Last.fm，插件也可以接收 scrobble 事件：

```typescript
// IPCs.ts 中，report-playback handler 内
pluginManager.call(pluginId, 'scrobble', {
  time: position * 1000,
  sourceCtx // 从匹配的 TrackSource 解析的上下文
})
```

支持 scrobble 的插件：`netease`、`kugou`、`navidrome`

## API 签名

Last.fm API 使用 MD5 签名：

```typescript
const sign = (param: Record<string, string>) => {
  const sorted = Object.keys(param)
    .sort()
    .map((k) => k + String(param[k]))
    .join('')
  return crypto
    .createHash('md5')
    .update(sorted + SHARED_SECRET)
    .digest('hex')
}
```

## 设置项

| 字段                 | 类型      | 说明           |
| -------------------- | --------- | -------------- |
| `misc.lastfm.enable` | `boolean` | 是否已授权     |
| `misc.lastfm.name`   | `string`  | Last.fm 用户名 |

**操作**：

- `lastfmConnect()` — 触发授权流程
- `lastfmDisconnect()` — 清除 session，断开连接
