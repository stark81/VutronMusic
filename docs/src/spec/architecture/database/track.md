---
title: Track 数据模型设计
order: 3
last-reviewed: 2025-07-21
---

# Track 数据模型设计

## 问题

一个用户在本地有一首 FLAC 文件，这首歌在网易云和酷狗上都有对应的在线版本。数据库应该怎么存储这种关系？

## 错误方案：一张表存所有

```sql
-- ❌ 不要这样做
CREATE TABLE Song (
  id, name, artist, album,
  filePath, neteaseId, kugouId, navidromeUrl,
  localLyric, neteaseLyric, ...
)
```

**问题**：每新增一个平台就要加列 → 表结构永不稳定。

## VutronMusic 的方案：三表分离

```
Track 表：一首歌的抽象描述
  ├─ id, name, duration, albumId, musicBrainzTrackId

TrackSource 表：各插件中这首歌的「坐标」
  ├─ (trackId, pluginId) → sourceContext (插件私有 JSON)
  ├─ 网易云: { "id": 12345 }
  ├─ 酷狗:   { "hash": "..." }
  └─ 本地:   { "filePath": "..." }

Audio 表：本地物理音频文件
  └─ filePath, md5, bitrate, gain, cueOffset
```

## 去重策略

| 强度 | 条件                                  | 处理                         |
| ---- | ------------------------------------- | ---------------------------- |
| 强   | MusicBrainz Track ID 完全一致         | 归并为同一 Track，新增 Audio |
| 中   | 归一化标题+专辑+艺术家相同，时长 ≤ 2s | 归并为同一 Track             |
| 弱   | 仅部分匹配                            | 暂不归并，标记「待确认」     |

> **归一化规则**：trim 空格、全角/半角统一、忽略大小写。⚠️ **不去除 `(Live)`、`(Remix)` 等括注** — 因为这些括注反映了歌曲版本差异。

## sourceContext 示例

```json
// 网易云
{ "id": 536099, "albumId": 12345, "artists": [{ "id": 678, "name": "买辣椒也用券" }] }

// 本地
{ "filePath": "/music/起风了.flac", "md5": "abc123" }

// Navidrome
{ "id": "song-001", "streamUrl": "/api/song/001/stream" }
```

**为什么框架层不解析？** 因为每种插件的上下文结构完全不同，强行统一意味着要么丢失信息，要么频繁修改框架层。

## 三表设计的业务价值

| 场景             | 支持方式                                     |
| ---------------- | -------------------------------------------- |
| 用户从网易云播放 | TrackSource 查询 → 调用插件 songUrl          |
| 用户从本地播放   | Audio 表获取 filePath → 直接读文件           |
| 用户切换音源     | 同一 Track 的不同 TrackSource 条目 → 换插件  |
| 本地文件移动     | 只需更新 Audio.filePath                      |
| 去重             | MusicBrainz ID 相同的 Audio 归并为同一 Track |
