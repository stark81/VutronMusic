---
title: 产品概览
order: 1
---

# 产品概览

## 核心场景

| 场景 | 用户痛点 | VutronMusic 的解法 |
|------|---------|-------------------|
| **多平台聚合** | 歌曲分散在网易云、酷狗、本地，来回切换 | 一次搜索覆盖全平台，收藏双向同步 |
| **本地音乐库** | 有大量 FLAC，缺歌词和封面 | 扫描 + MusicBrainz 去重 + 自动匹配元数据 |
| **自建媒体库** | 用 Jellyfin/Navidrome 管理，缺好用的客户端 | 插件直连，播放体验与本地一致 |

## 功能全景矩阵

### 听音乐

| 功能 | 涉及模块 | 状态 |
|------|---------|------|
| 全平台搜索 | `SearchPage.vue` → `pluginMusic` | ✅ |
| 播放控制 | `player.ts` + `audioEngine.ts` | ✅ |
| 音效（EQ/混响/变调） | `audioEngine.ts` | ✅ |
| 音量均衡（ReplayGain） | `audioEngine.ts` | ✅ |
| 歌词（LRC/逐字/翻译） | `lyric.ts` + 各消费方 | ✅ |

### 管理音乐库

| 功能 | 涉及模块 | 状态 |
|------|---------|------|
| 本地扫描 + 去重 | `scanMusic Worker` + `dbHelpers.ts` | ✅ |
| CUE 分轨 | `cueParser` | ✅ |
| 元数据匹配 | `autoMatchTrack` | ✅ |
| 歌单/收藏管理 | 各插件 | ✅ |

### 发现与社交

| 功能 | 涉及模块 | 状态 |
|------|---------|------|
| 每日推荐 / 排行榜 / FM | 插件 | ✅ |
| 评论 | `CommentPage.vue` | ✅ |
| Last.fm Scrobble | `lastfm.ts` + 插件 `scrobble` | ✅ |

### 跨平台集成

| 功能 | 涉及模块 | 状态 |
|------|---------|------|
| Linux MPRIS 媒体键 | `mpris.ts` | ✅ |
| 桌面歌词 OSD | `osdLyric.ts` + OSD window | ✅ |
| Discord 状态 | `DiscordRichPresence` | ✅ |
| 全局快捷键 | `globalShortcut.ts` | ✅ |
| 多语言（中/英/繁） | `locales/` | ✅ |

> 📖 详细 IPC 通道见 [IPC 通道设计](../spec/architecture/ipc/)
