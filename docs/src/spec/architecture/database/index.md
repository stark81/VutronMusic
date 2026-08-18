---
last-updated: 2026-07-26
title: 数据架构总览
order: 1
---

# 数据架构总览

## 核心决策：什么是「用户拥有的歌曲」？

**问题**：用户在网易云搜索到一首歌，点击播放，这首歌应该入库吗？

| 方案                | 做法                                | 问题                                 |
| ------------------- | ----------------------------------- | ------------------------------------ |
| A：搜索结果全部入库 | 搜到的每首歌都写入 Track 表         | 用户只是搜了一下就被写入「永久」数据 |
| B：仅播放/收藏入库  | 只有用户真正播放或收藏时才写入      | 边界模糊：播了 5 秒也算？            |
| C：仅「拥有」才入库 | 本地文件 + 添加到歌单的才算「拥有」 | 最严格，但丢失了播放历史             |

**VutronMusic 的答案**：**Track/Album/Artist 表只存储用户「拥有」的歌曲**。搜索/浏览的结果只在 Pinia store 的内存中，不落库。

## 数据库快照

| 项目 | 内容 |
| --- | --- |
| 引擎 | better-sqlite3（同步 API，主进程直接调用） |
| 文件路径 | `{userData}/api_cache/vutron_music.sqlite` |
| 建表 | `src/public/migrations/plugin.sql` → 16 张表（Tables 枚举含 20 个条目，其中 AppleMusicAlbum/AppleMusicArtist/Unblock/LocalAlbumCover 为历史遗留） |
| 初始化 | `src/main/db.ts`（建表 → WAL → 迁移） |
| 查询层 | `src/main/dbHelpers.ts`（45KB，含去重/匹配/CRUD） |
| 插件数据 | 通过 `api.db.get/set` 访问 `PluginData` 表 |
| 渲染进程访问 | ❌ 不允许，必须通过 IPC 间接访问 |

> 📖 详细 Schema 见 [数据库 Schema 参考](./schema)
