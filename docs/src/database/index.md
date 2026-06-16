# 数据库设计

本文档描述音乐播放器从「网易云单一数据源」重构为「多插件聚合」架构后的数据库设计、核心理念与业务规则。

## 1. 项目背景

VutronMusic 是一个 Electron 音乐播放器。原本只支持网易云音乐一个数据源，现在重构为「插件系统」，已知/计划接入的插件包括：

- 本地音乐（local）
- 网易云音乐（netease）
- 酷狗音乐（kugou）
- Navidrome / Emby / Jellyfin（自建流媒体）

数据库使用 better-sqlite3，通过 SQL 文件 + 应用内 `migrate()` 管理结构变更（当前 `migrate()` 已简化为仅追踪 appVersion，无历史 SQL 迁移逻辑）。

## 2. 核心架构理念

### 2.1 元数据表的范围：只代表「用户拥有的歌曲」

Track / Album / Artist 三张表是 canonical（规范化）实体表，只存储用户本地实际拥有的歌曲文件所对应的元数据，不是全网音乐目录。

用户在线浏览/搜索某个插件的内容（比如打开网易云在线歌单）时，数据不落库，走 Zod 定义的 Track/AlbumDetail 结构，存在内存 / store 中。只有当用户「拥有」了某首歌（本地文件、或主动添加/下载），才会在这套表里创建对应记录。

这套表的定位类似 MusicBrainz Picard / beets：本地文件是真理之源，在线插件用于补充元数据（歌词、封面、评论等）。

### 2.2 sourceContext：不透明的插件上下文

`sourceContext` 是一个 JSON 字符串，内容由各插件自行定义，框架层不做任何校验、不假设其结构。

- **对 Track**：意为「重新获取该对象所需的最小上下文」
  - 例：网易云 `{"id": 186016}`
  - 例：酷狗 `{"hash": "...", "mixsongid": "...", "album_audio_id": "...", "fileid": "..."}`

- **对 Album**：最小上下文 + 插件继续执行后续操作所需的上下文（比如分页信息）

插件拿到 `sourceContext` 后自己解析、自己使用；主进程/渲染进程只负责原样传递，不解析、不校验、不假设字段存在。

### 2.3 pluginId：路由与跨对象导航

`pluginId` 标记某条 Source 记录属于哪个插件，用途：

- 决定调用哪个插件的 API 来执行操作（获取歌词 / 评论 / 播放链接 / 收藏等）
- 跨对象跳转：比如从某首歌跳转到该插件里对应的专辑页（查 AlbumSource 里 pluginId 对应的 sourceContext）

### 2.4 多源聚合：核心卖点

同一首歌（一个 canonical Track）可以同时拥有多个数据来源，各自负责不同的功能：

- 本地 flac/mp3 文件（Audio 表）→ 播放
- 网易云的 TrackSource → 评论、收藏歌单
- 酷狗的 TrackSource → 歌词、封面

播放、歌词、评论、封面这些功能可以分别来自不同插件，互不依赖。

## 3. 表结构

### 3.1 分类总览

| 分类 | 表名 | 说明 |
| --- | --- | --- |
| 元数据表 | Track, Album, Artist | 用户拥有的歌曲库（canonical 实体） |
| 关系表 | TrackArtist, ArtistAlbum | 元数据之间的多对多关系 |
| 本地数据表 | Audio | 本地音频文件信息，一个 Track 可对应多个 Audio（不同格式/音质） |
| 缓存表 | Lyrics | 各插件返回的歌词缓存 |
| Source 映射表 | TrackSource, AlbumSource, ArtistSource | 元数据 → 各插件对应条目的映射 |
| 歌单表 | Playlist, PlaylistEntry | 用户歌单及歌单条目 |
| 系统表 | AppData, PluginData, Plugins | 应用配置 / 插件自定义键值存储 / 插件注册表 |

### 3.2 SQL 定义

```sql
-- ============ 元数据表 ============

CREATE TABLE IF NOT EXISTS "Artist" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "picUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "followed" INTEGER NOT NULL DEFAULT 0,
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Album" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "picUrl" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "subscribed" INTEGER NOT NULL DEFAULT 0,
    "isExplicit" INTEGER NOT NULL DEFAULT 0,
    "publishTime" INTEGER NOT NULL DEFAULT 0,
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Track" (
    "id" TEXT PRIMARY KEY,

    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,

    "albumId" TEXT,
    "no" INTEGER NOT NULL DEFAULT 0,
    "alias" TEXT NOT NULL DEFAULT '',
    "picUrl" TEXT NOT NULL DEFAULT '',
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "liked" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "musicBrainzTrackId" TEXT,
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(albumId) REFERENCES Album(id)
);

-- ============ 关系表 ============

CREATE TABLE IF NOT EXISTS "TrackArtist" (
    "trackId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    PRIMARY KEY(trackId, artistId)
);

CREATE TABLE IF NOT EXISTS "ArtistAlbum" (
    "artistId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    PRIMARY KEY(artistId, albumId)
);

-- ============ 本地数据表 ============

CREATE TABLE IF NOT EXISTS "Audio" (
    "id" TEXT PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "md5" TEXT NOT NULL,
    "bitrate" INTEGER NOT NULL DEFAULT 0,
    "gain" REAL NOT NULL DEFAULT 0,
    "peak" REAL NOT NULL DEFAULT 1,
    "size" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(trackId) REFERENCES Track(id)
);

-- ============ 缓存表 ============

CREATE TABLE IF NOT EXISTS "Lyrics" (
    "trackId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(trackId, pluginId)
);

-- ============ Source 映射表 ============

CREATE TABLE IF NOT EXISTS "TrackSource" (
    "trackId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL,
    "matched" INTEGER NOT NULL DEFAULT 1,
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(trackId, pluginId)
);

CREATE TABLE IF NOT EXISTS "AlbumSource" (
    "albumId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL,
    PRIMARY KEY(albumId, pluginId)
);

CREATE TABLE IF NOT EXISTS "ArtistSource" (
    "artistId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL,
    PRIMARY KEY(artistId, pluginId)
);

-- ============ 系统表 ============

CREATE TABLE IF NOT EXISTS "AppData" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "PluginData" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- ============ 插件注册表 ============

CREATE TABLE IF NOT EXISTS "Plugins" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL DEFAULT '',
    "builtIn" INTEGER NOT NULL DEFAULT 0,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============ 歌单表 ============

CREATE TABLE IF NOT EXISTS "Playlist" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "picUrl" TEXT NOT NULL DEFAULT '',
    "createTime" INTEGER NOT NULL,
    "updateTime" INTEGER NOT NULL,
    PRIMARY KEY (id, pluginId)
);

CREATE TABLE IF NOT EXISTS "PlaylistEntry" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "playlistId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createTime" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_playlist_entry_playlist_id" ON "PlaylistEntry" ("playlistId");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_playlist_entry_unique" ON "PlaylistEntry" ("playlistId", "pluginId", "sourceContext");
```

## 4. 完整数据流示例：周杰伦《晴天》

### 4.1 本地扫描

用户硬盘上有 `~/Music/周杰伦/范特西/07 晴天.flac`

1. 创建 `Artist(id=a1, name='周杰伦')`
2. 创建 `Album(id=al1, name='范特西')`
3. 创建 `Track(id=t1, name='晴天', albumId='al1', duration=269)`
4. 关联 `TrackArtist(trackId=t1, artistId=a1)`、`ArtistAlbum(artistId=a1, albumId=al1)`
5. 写入 `Audio(id=au1, trackId=t1, filePath='...flac', bitrate=900)`

### 4.2 同一首歌的 mp3 版本

用户又添加了同一首歌的 mp3 版本：

- 扫描时归一化标题/专辑/艺术家与 `t1` 完全一致，且时长误差 <1s
- 不创建新 Track，只新增 `Audio(id=au2, trackId=t1, filePath='...mp3', bitrate=320)`

### 4.3 匹配在线插件

网易云搜到对应歌曲：写入 `TrackSource(trackId=t1, pluginId='netease', sourceContext='{"id":186016}', matched=1)`

酷狗搜到对应歌曲：写入 `TrackSource(trackId=t1, pluginId='kugou', sourceContext='{"hash":"...","album_audio_id":"..."}', matched=1)`

### 4.4 播放时的多源聚合

- **播放源**：默认选 Audio 表中 bitrate 最高的本地文件（flac, 900kbps）
- **歌词**：调用 kugou 插件 `getLyrics(sourceContext)`，结果可写入 Lyrics 表缓存
- **评论**：调用 netease 插件 `getComments(sourceContext)`（不缓存，实时拉取）
- **专辑跳转**：查 `AlbumSource WHERE albumId='al1' AND pluginId='netease'`，拿到对应专辑的 sourceContext，跳转到网易云专辑页

## 5. 业务规则：「同一首歌」的认定（本地去重）

新扫描到的本地文件，与已有 Track 比对，按信号强度分层判断：

| 信号强度 | 判断条件 | 处理方式 |
| --- | --- | --- |
| 强 | 文件标签内嵌 MusicBrainz Track ID，与已有 Track 一致 | 自动归并为同一 Track 的新 Audio |
| 中 | 归一化后标题+专辑+艺术家完全相同，且时长误差 ≤ 1~2 秒 | 自动归并为同一 Track 的新 Audio |
| 弱 | 仅部分匹配（如标题相同但专辑不同，或时长差异较大） | 不自动归并，作为独立 Track |

**归一化规则**：trim 空格、统一全角/半角字符、忽略大小写。**不要去除括注内容**（如 "(Live)"、"(Remastered)"）——这些括注本身是区分不同版本的有效信号，去掉反而会导致误判合并。

跨平台匹配（写入 TrackSource）风险高于本地去重，全网同名歌曲/翻唱远多于本地库内部冲突，因此置信度要求应更高；不确定的匹配建议写入 `matched=0`，由用户在 UI 中确认后改为 1。

## 6. 约定与待定事项

### 已确定的约定

- 所有表名 PascalCase；JSON 内容统一存为 TEXT
- 布尔值用 INTEGER（0/1）
- 时间字段统一 `DATETIME DEFAULT CURRENT_TIMESTAMP`
- `PluginData.updatedAt` 与其他表的 `updateTime` 命名不一致，属历史遗留，新表请统一用 `updateTime`/`createTime`
- `TrackSource.matched` 字段含义：`1` = 已确认匹配（自动或用户确认），`0` = 待确认匹配（置信度不足，需用户在 UI 中确认）

### 待定事项

> AI 编码助手遇到以下场景请先确认，不要自行假设

- **canonical id 生成策略**：Track/Album/Artist 的 id 如何生成（UUID？基于归一化元数据的 hash？自增转字符串？）尚未定案
- **Album/Artist 的本地去重规则**：第5节只细化了 Track 层级，Album/Artist 的归并策略待设计
- **跨平台匹配的触发时机与 UI**：自动搜索匹配 vs 用户手动添加/确认的具体流程未设计
- **sourceContext 反向查找**：是否约定所有插件的 sourceContext 包含统一的 id 字段
- **插件卸载时的清理逻辑**：删除某 pluginId 在 TrackSource / AlbumSource / ArtistSource / Lyrics / PluginData 中的所有记录，以及孤儿 Track 的垃圾回收，尚未实现
- **迁移机制**：`migrate()` 已简化为仅追踪 appVersion，旧迁移 SQL 文件已清理，后续需重新设计版本化迁移流程

---

## 7. 本地音乐资产管理

本地音乐使用的表结构与在线插件（网易云、酷狗等）**完全一致**，没有特殊的「本地音乐表」——本地音乐的数据同样分布在 Track、Album、Artist、Audio、TrackSource 等标准表中。

### 7.1 数据模型

```
Track（歌曲元数据）
  ├── id: crypto.randomUUID()             — 新 Track 用 UUID
  ├── name, duration, albumId
  ├── albumId → Album(id)
  ├── musicBrainzTrackId                  — 强信号去重依据
  └── TrackArtist(trackId, artistId) → Artist(id)

Album（专辑）
  ├── id: md5("local_album:" + name)      — 同名专辑归并
  └── ArtistAlbum(artistId, albumId) → Artist(id)

Artist（艺术家）
  └── id: md5("local_artist:" + name)     — 同名字符归并

Audio（音频文件）— 本地音乐的核心数据
  ├── id: md5("audio:" + filePath)        — 确定性 ID
  ├── trackId → Track(id)
  ├── filePath, md5, bitrate, gain, peak
  └── 一个 Track 可对应多个 Audio（不同格式/音质的同一首歌）

TrackSource（数据来源标识）
  ├── pluginId = 'local'
  ├── sourceContext: '{}'                 — 文件路径查 Audio 表
  └── matched = 1（本地文件不需要人工确认）
```

关键区别：本地音乐的 **Audio 表是必有的**（每个本地文件对应一条 Audio 记录），而在线插件的数据通常没有 Audio 记录（播放链接是临时的）。

### 7.2 扫描入库流程

由 `msgScanLocalMusic` IPC handler 驱动（`src/main/IPCs.ts`）：

```
用户选择文件夹 → IPC → msgScanLocalMusic
    │
    ├── ① 读取现有 Artist/Album/Audio（用于去重）
    ├── ② fast-glob 搜索音频文件（mp3/aiff/flac/alac/m4a/aac/wav/opus）
    ├── ③ 筛选新文件（不在 Audio 表里的）
    ├── ④ Piscina 线程池 → scanMusic worker 解析元数据
    │     返回：{ name, duration, artists[], album, albumArtist[],
    │            filePath, md5, br, gain, peak, createTime }
    ├── ⑤ 组装数据：
    │   ├── Artist → 按去重规则创建/忽略
    │   ├── Album  → 按去重规则创建/忽略
    │   ├── Track  → md5(filePath) 做 ID
    │   ├── Audio  → 文件路径+MD5+码率+增益
    │   ├── TrackArtist / ArtistAlbum → 关系表
    │   └── TrackSource(pluginId='local') → 标识数据来源
    │
    └── ⑥ 事务写入 → 通知渲染进程扫描完成
```

**scanMusic worker**（`src/main/workers/scanMusic.ts`）负责解析单个文件：

- 使用 `music-metadata` 库读取文件标签
- 计算文件 MD5 哈希
- 读取 replaygain 信息
- 按 `,` `/` `&` `、` 分割多艺术家
- 返回结构化数据供主进程组装

### 7.3 数据读取

渲染进程通过 `getLocalMusic` IPC 获取本地音乐数据：

```typescript
// 返回的完整数据集
{
  tracks: Track[],
  albums: Album[],
  artists: Artist[],
  audios: Audio[],
  trackArtists: { trackId, artistId }[],
  artistAlbums: { artistId, albumId }[],
  playlists: any[]
}
```

渲染进程的 `localMusic.ts` Pinia store 接收这些数据后进行组合展示。

### 7.4 更新与删除

| 操作 | 策略 |
| --- | --- |
| **重新扫描（update=true）** | 全量扫描，`INSERT OR IGNORE` 写入，已存在的数据不受影响 |
| **文件变更**（同一路径内容不同） | 重新扫描时 md5 变化，但因主键是 filePath 的 hash，需手动更新 Audio 记录 |
| **文件删除** | `clearDeletedMusic` 遍历本地文件，删除不存在的文件对应的 Audio 和 Track |
| **清除全部数据** | `deleteLocalMusicDB` 清理所有本地相关记录 |

### 7.5 本地音乐的特殊约定

- **ID 策略（临时）**：Track/Album/Artist 使用 `md5(前缀+名称)` 作为确定性 ID。这是重构期间的过渡方案，最终 canonical id 生成策略待定
- **TrackSource 必定存在**：每首本地歌曲都会有一条 `pluginId='local'` 的 TrackSource 记录。这是本地数据能否被识别为「本地音乐」的关键标志
- **Audio 表**是本地音乐的入口：渲染进程根据 Audio 表的 filePath 构建播放列表，而不是通过 Track 表
- **picUrl**：本地歌曲的封面通过 `vutron://local-asset?type=pic&id={trackId}` 格式的内置协议获取

---

## 8. 跨插件歌曲匹配（trackMatch）

### 8.1 触发时机

播放器 store 中播放歌曲 20 秒后触发（`src/renderer/store/player.ts` 中的 prefetch 逻辑），通过 `trackMatch` IPC 调用主进程。

### 8.2 匹配流程

```
渲染进程调用 trackMatch IPC
    │  传入：trackId, name, album, artists, duration, sourcePlugin, sourceType, sourceContext
    ▼
主进程（src/main/IPCs.ts）
    │
    ├── ① 写入来源自身的 TrackSource（local 已在扫描时写入，INSERT OR IGNORE 会跳过）
    │
    ├── ② 遍历所有已注册插件
    │     过滤条件：meta.type === 'library' && meta.capabilities?.matchTrack !== false
    │
    ├── ③ 跳过已有 TrackSource 记录的插件
    │
    ├── ④ 调用插件 matchTrack 方法
    │     传入：name, album, artists, duration, ...sourceContext
    │
    ├── ⑤ 根据 capabilities.matchTrack 类型和置信度决定 matched 值
    │     official 插件 → matched = 1
    │     search 插件   → confidence ≥ 80 → matched = 1
    │                      confidence ≥ 50 → matched = 0
    │                      confidence < 50 → 丢弃
    │
    └── ⑥ 写入 TrackSource 表（INSERT OR REPLACE）
```

### 8.3 与其他功能的关联

- **歌词来源选择**：通过 `get-content-candidates` IPC，查找 `capabilities.getLyric` 为 true 的插件
- **评论来源选择**：通过 `plugin-comment` IPC，查找 `capabilities.getComments` 为 true 的插件
- **播放链接**：直接通过 TrackSource 中的 pluginId 路由到对应插件的 `songUrl` 方法
