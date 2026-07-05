---
title: 插件 API 参考
order: 6
---

# 插件 API 参考

## 设计原则

| 原则 | 说明 | 反例 |
|------|------|------|
| **按资源域分组** | search / track / album / playlist / artist / mv / comment | 把 search 和 login 放一起 |
| **动词 + 资源** | `getPlaylistDetail`, `likeATrack` | `doStuff` |
| **统一返回结构** | 所有方法返回 `{ code, ...data }` | 有的返回 `{ data }` 有的返回 `{ result }` |
| **默认 404 回退** | 未实现的方法返回 `{ code: 404 }` | 抛异常让 UI 崩溃 |
| **Zod Schema 守卫** | 所有入参和返回值有 Schema 校验 | 纯 TypeScript 接口，运行时无校验 |

## 方法分类索引

### 首页与发现 (5)

| 方法 | 参数 | 返回 |
|------|------|------|
| `getBanner` | — | `{ code, data: Banner[] }` |
| `getRecommendPlaylist` | — | `{ code, data: Playlist[] }` |
| `getRecommendTracks` | — | `{ code, data: Track[], sourceContext }` |
| `personalFM` | — | `{ code, data: Track[], sourceContext }` |
| `fmTrash` | `{ id }` | `{ code }` |

### 搜索 (1)

| 方法 | 参数 | 返回 |
|------|------|------|
| `search` | `{ keyword, limit, offset, type? }` | `{ code, data: Track[]\|Album[]\|..., count, sourceContext }` |

最核心方法之一。`type` 指定搜索类型：`tracks` / `albums` / `artists` / `playlists` / `mvs`。

### 登录 (5)

| 方法 | 参数 | 返回 |
|------|------|------|
| `loginQrKey` | — | `{ code, data: { url, qrcode } }` |
| `loginQrCodeCheck` | `{ key }` | `{ code, message }` |
| `doLogin` | `{ account, pwd, type? }` | `{ code, message }` |
| `doLogout` | — | `{ code }` |
| `getAccount` | — | `{ code, baseUrl, userName, pwd }` |

### 歌曲 (6)

| 方法 | 参数 | 返回 |
|------|------|------|
| `songUrl` | `{ id }` | `{ code, data: { url: string[], replayGain, peak } }` |
| `getTrackDetail` | `{ id }` | `{ code, data: Track[] }` |
| `getLyric` | `{ id }` | `{ code, data: LyricLine[] }` |
| `topSong` | `{ type? }` | `{ code, data: Track[], sourceContext }` |
| `getAllTracks` | `{ offset, limit }` | `{ code, data: Track[], count, sourceContext }` |
| `matchTrack` | `{ name, album?, artists, duration }` | `{ code, data?: { confidence, sourceContext, picUrl? } }` |

`songUrl` — 所有插件中**必须实现**的方法。`matchTrack` 用于跨平台音源匹配，返回 confidence 表示匹配置信度。

### 专辑 (5)

| 方法 | 参数 | 返回 |
|------|------|------|
| `albumDetail` | `{ id }` | `{ code, data: AlbumDetail }` |
| `topAlbums` | `{ area?, type? }` | `{ code, hasMore, albums: Album[], sourceContext }` |
| `newAlbums` | `{ area?, limit? }` | `{ code, data: Album[], sourceContext }` |
| `artistAlbums` | `{ id }` | `{ code, data: Album[], sourceContext }` |
| `subscribeAlbum` | `{ id, subscribe }` | `{ code }` |

### 艺术家 (8)

| 方法 | 参数 | 返回 |
|------|------|------|
| `artistDetail` | `{ id }` | `{ code, artist: ArtistDetail, songs: Track[], sourceContext }` |
| `artistMVs` | `{ id, offset?, limit? }` | `{ code, data: Mv[], sourceContext }` |
| `topArtists` | `{ area?, offset?, limit? }` | `{ code, data: Artist[], sourceContext }` |
| `artistsList` | `{ cat?, offset?, limit? }` | `{ code, data: Artist[], sourceContext }` |
| `simiArtists` | `{ id }` | `{ code, data: Artist[], sourceContext }` |
| `followArtist` | `{ id, follow }` | `{ code }` |
| `userLikedArtists` | — | `{ code, data: Artist[], sourceContext }` |
| `getArtistCatlist` | — | `{ code, data: ArtistCatlist[] }` |

### 歌单 (13)

| 方法 | 参数 | 返回 |
|------|------|------|
| `getPlaylistDetail` | `{ id }` | `{ code, data: PlaylistDetail }` |
| `getPlaylistTracks` | `{ id, offset?, limit? }` | `{ code, data: Track[], sourceContext }` |
| `userPlaylist` | `{ uid? }` | `{ code, liked, playlists: Playlist[], albums: Album[], sourceContext }` |
| `catlist` | — | `{ code, data: PlaylistCatlist }` |
| `getCategoryPlaylist` | `{ cat, offset?, limit? }` | `{ code, data: Playlist[], sourceContext }` |
| `createPlaylist` | `{ name, description? }` | `{ code }` |
| `editPlaylist` | `{ id, name?, description? }` | `{ code }` |
| `deletePlaylist` | `{ id }` | `{ code }` |
| `subscribePlaylist` | `{ id, subscribe }` | `{ code }` |
| `addOrRemoveTracksToPlaylist` | `{ id, trackIds, op }` | `{ code }` |
| `reorderPlaylistTracks` | `{ id, trackIds }` | `{ code }` |
| `rankList` | — | `{ code, data: Playlist[], sourceContext }` |
| `rankTop` | `{ id }` | `{ code, data: Track[] }` |

### MV (4)

| 方法 | 参数 | 返回 |
|------|------|------|
| `mvDetail` | `{ id }` | `{ code, data: MvDetail }` |
| `subAMV` | `{ id, subscribe }` | `{ code }` |
| `likeAMV` | `{ id, like }` | `{ code }` |
| `userLikedMVs` | — | `{ code, data: Mv[], sourceContext }` |

### 评论 (5)

| 方法 | 参数 | 返回 |
|------|------|------|
| `getCommentTab` | `{ type, id }` | `{ code, data: CommentTab[] }` |
| `getComments` | `{ id, type?, offset?, limit? }` | `{ code, data: Comment[], count, sourceContext }` |
| `likeAComment` | `{ id, type?, liked? }` | `{ code }` |
| `submitAComment` | `{ id, content, type? }` | `{ code, data }` |
| `getFloorComments` | `{ id, commentId }` | `{ code, data: Comment[], count, sourceContext }` |

评论内容类型：`track` / `album` / `playlist` / `mv`。

### 收藏 (4)

| 方法 | 参数 | 返回 |
|------|------|------|
| `likeATrack` | `{ id, like? }` | `{ code }` |
| `likelist` | `{ uid? }` | `{ code, data: Track[], sourceContext }` |
| `userLikedArtists` | — | `{ code, data: Artist[], sourceContext }` |
| `userLikedMVs` | — | `{ code, data: Mv[], sourceContext }` |

### 用户 (3)

| 方法 | 参数 | 返回 |
|------|------|------|
| `userRecord` | `{ uid?, type? }` | `{ code, weekData: Track[], allData: Track[], sourceContext }` |
| `cloudDisk` | `{ offset?, limit? }` | `{ code, data: Track[], sourceContext }` |
| `resizePicUrl` | `{ url, param }` | `{ code, data: string }` |

### 统计 (2)

| 方法 | 参数 | 返回 |
|------|------|------|
| `scrobble` | `{ id, time }` | `{ code }` |
| `reportPlayback` | `{ type, id, position }` | `{ code }` |

### 系统 (2)

| 方法 | 参数 | 返回 |
|------|------|------|
| `updateBaseUrl` | `{ baseUrl }` | `{ code }` |
| `systemPing` | — | `{ code, status }` |

`systemPing` 返回 `status` 表示服务状态：`login` / `logout` / `offline`。

### 分类 (4)

| 方法 | 参数 | 返回 |
|------|------|------|
| `getTrackCatlist` | — | `{ code, data: TrackCatlist[] }` |
| `getAlbumCatlist` | — | `{ code, data: AlbumCatlist[] }` |
| `getArtistCatlist` | — | `{ code, data: ArtistCatlist[] }` |
| `catlist` | — | `{ code, data: PlaylistCatlist }` |

`catlist` 也在「歌单」分类中列出，两个分类共享同一实现。

## 方法覆盖度

| 插件类型 | 必须实现（P0） | 建议实现（P1） |
|---------|--------------|--------------|
| library | `search`, `songUrl`, `getTrackDetail`, `getPlaylistDetail` | `login*`, `getLyric`, `getComments` |
| stream | `updateBaseUrl`, `songUrl`, `getPlaylistDetail` | `search`, `getTrackDetail` |
| local | `getAllTracks`, `getTrackDetail`, `songUrl` | — |

## 返回结构

```json
// 成功
{ "code": 200, "data": { /* 具体数据 */ } }

// 方法未实现（由 defaultMap 自动提供）
{ "code": 404, "message": "not implemented" }

// 服务错误
{ "code": 500, "message": "错误原因" }
```
