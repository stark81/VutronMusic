---
title: 数据库 Schema 参考
order: 2
last-reviewed: 2025-07-21
---

# 数据库 Schema 参考

## 表一览

| #   | 表名               | 业务用途                     | 核心关联                        |
| --- | ------------------ | ---------------------------- | ------------------------------- |
| 1   | `Track`            | 歌曲元数据（用户拥有的）     | → Album, → Audio, → TrackSource |
| 2   | `Album`            | 专辑元数据                   | → Track, → ArtistAlbum          |
| 3   | `Artist`           | 艺术家元数据                 | → TrackArtist, → ArtistAlbum    |
| 4   | `Audio`            | 本地音频文件信息             | → Track                         |
| 5   | `TrackSource`      | 歌曲在各插件的映射           | ↔ Track, ↔ Plugins            |
| 6   | `AlbumSource`      | 专辑在各插件的映射           | ↔ Album, ↔ Plugins            |
| 7   | `ArtistSource`     | 艺术家在各插件的映射         | ↔ Artist, ↔ Plugins           |
| 8   | `TrackArtist`      | Track-Artist 多对多关联      | ↔ Track, ↔ Artist             |
| 9   | `ArtistAlbum`      | Artist-Album 多对多关联      | ↔ Artist, ↔ Album             |
| 10  | `Lyrics`           | 歌词内容（每插件一份）       | ↔ Track, ↔ Plugins            |
| 11  | `LyricOffsets`     | 歌词行偏移微调               | ↔ Track, ↔ Plugins            |
| 12  | `Playlist`         | 歌单                         | → Plugins                       |
| 13  | `PlaylistEntry`    | 歌单项（引用 sourceContext） | → Playlist                      |
| 14  | `Plugins`          | 已注册插件清单               | —                               |
| 15  | `PluginData`       | 插件自由键值存储             | → Plugins                       |
| 16  | `AppData`          | 应用级配置                   | —                               |
| 17  | `Unblock`          | 解锁/替代源                  | —                               |
| 18  | `LocalAlbumCover`  | 本地专辑封面缓存             | —                               |
| 19  | `AppleMusicAlbum`  | (遗留) Apple Music 专辑      | —                               |
| 20  | `AppleMusicArtist` | (遗留) Apple Music 艺术家    | —                               |

> 来源：`src/public/migrations/plugin.sql`

## 核心表结构

### Track — 歌曲元数据

```sql
CREATE TABLE IF NOT EXISTS Track (
  id TEXT PRIMARY KEY,
  name TEXT, duration INTEGER,
  albumId TEXT REFERENCES Album(id),
  no INTEGER, alias TEXT, picUrl TEXT,
  playCount INTEGER DEFAULT 0,
  liked INTEGER DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  musicBrainzTrackId TEXT,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Audio — 本地音频文件

```sql
CREATE TABLE IF NOT EXISTS Audio (
  id TEXT PRIMARY KEY,
  trackId TEXT REFERENCES Track(id),
  filePath TEXT, md5 TEXT, bitrate INTEGER,
  gain REAL, peak REAL, size INTEGER,
  deleted INTEGER DEFAULT 0,
  cueOffset INTEGER, cueDuration INTEGER
)
```

### TrackSource — 歌曲跨插件映射

```sql
CREATE TABLE IF NOT EXISTS TrackSource (
  trackId TEXT NOT NULL, pluginId TEXT NOT NULL,
  sourceContext TEXT, matched INTEGER DEFAULT 1,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trackId, pluginId)
)
```

### Plugins — 插件注册表

```sql
CREATE TABLE IF NOT EXISTS Plugins (
  id TEXT PRIMARY KEY, name TEXT, type TEXT, path TEXT,
  builtIn INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### PluginData — 插件键值存储

```sql
CREATE TABLE IF NOT EXISTS PluginData (
  id TEXT PRIMARY KEY, pluginId TEXT NOT NULL, type TEXT NOT NULL,
  json TEXT, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

其余表 Album, Artist, AlbumSource, ArtistSource, TrackArtist, ArtistAlbum, Lyrics, LyricOffsets, Playlist, PlaylistEntry, AppData, Unblock, LocalAlbumCover, AppleMusicAlbum, AppleMusicArtist 见 `src/public/migrations/plugin.sql`。

## 核心数据关系

```
Plugins ──┬── TrackSource ──── Track ──┬── Audio
          ├── AlbumSource ──── Album   ├── Lyrics
          ├── ArtistSource ─── Artist  └── TrackArtist ── Artist
          ├── Lyrics                      ArtistAlbum ── Album
          └── PluginData
```
