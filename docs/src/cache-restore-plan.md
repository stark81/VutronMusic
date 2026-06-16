# 自动缓存歌曲 — 实现文档

## 核心逻辑

播放线上歌曲 → 下载到本地目录 → 写入 Track / Audio / TrackSource 表 → 下次播放优先用本地缓存

## 数据流

```
replaceCurrentTrack(pluginId='netease', sourceContext={ id: 186016 })
  ├─ pluginMethodCall('getTrackDetail') → currentTrack
  ├─ IPC 'get-song-url'(pluginId, sourceContext, track) → 主进程
  │     ├─ 查 Audio.trackId 是否已缓存 → 命中则直接返回本地路径
  │     ├─ 未命中：pluginManager.call(pluginId, 'songUrl', sourceContext)
  │     ├─ 异步投递缓存任务到 worker: { track, url, audioCachePath }
  │     └─ 暂存 gain/peak/pluginId 到 pendingCacheMeta
  ├─ engineStore.playAudioSource(url, gain, peak) ← 首次走线上，后续走缓存
  │
  └─ Worker task-done:
        事务：
          ① IF NOT EXISTS → INSERT Track (id, name, duration, picUrl, albumId)
          ② INSERT OR IGNORE → Album, Artist, TrackArtist, ArtistAlbum
          ③ INSERT OR IGNORE → TrackSource (trackId, pluginId, sourceContext)
          ④ INSERT OR REPLACE → Audio (filePath, gain, peak, size)
        清理: deleteExcessCache()
        通知: receiveCacheInfo

下次播放同一首歌 →
  replaceCurrentTrack(pluginId='netease', sourceContext={ id: 186016 })
    ├─ pluginMethodCall('getTrackDetail') → currentTrack (id=...)
    ├─ IPC 'get-song-url' → Audio 命中 → 返回本地 filePath + gain + peak
    ├─ engineStore.playAudioSource(localFilePath, gain, peak) ← 跳过 songUrl
    └─ 不再触发缓存
```

## 改动明细

### 1. `main/IPCs.ts` — `get-song-url` IPC（缓存查询 + 线上获取 + 触发缓存）

合并了计划中的 `getCachedAudio` + `songUrl` 调用 + `cacheATrack` 为一个 IPC，减少一次 renderer↔main 往返：

```ts
ipcMain.handle('get-song-url', async (_, params) => {
  const { pluginId, sourceContext, track } = params

  // 1. 查缓存 — 命中直接返回
  const cached = db.sqlite
    .prepare(`SELECT * FROM Audio WHERE trackId = ? AND filePath LIKE ? AND deleted = 0 LIMIT 1`)
    .get(track.id, `${audioCachePath}%`)
  if (cached?.filePath) return { url: cached.filePath, replayGain: cached.gain, peak: cached.peak }

  // 2. 无缓存 → 调插件获取线上地址
  const result = await pluginManager.call(pluginId, 'songUrl', sourceContext)
  if (result?.code === 200 && result.data?.url?.length) {
    const { url, replayGain, peak } = result.data

    // 3. 异步触发缓存（仅 library 插件 + autoCacheTrack 开启 + url 有效）
    const autoCacheSettings = store.get('settings.autoCacheTrack')
    const pType = pluginManager.get(pluginId)?.meta?.type
    if (autoCacheSettings?.enable && pType === 'library' && cacheWorker && url[0]) {
      if (
        !db.sqlite.prepare(`SELECT id FROM Audio WHERE trackId = ? AND deleted = 0`).get(track.id)
      ) {
        pendingCacheMeta.set(track.id, { gain: replayGain, peak, plugin: pluginId })
        cacheWorker.postMessage({ type: 'task', track, url: url[0], audioCachePath })
      }
    }
    return { url: url[0], replayGain, peak }
  }
  return { url: '', replayGain: 0, peak: 1 }
})
```

### 2. `main/IPCs.ts` — `task-done` 回调

```ts
if (msg.type === 'task-done') {
  const data = msg.data // { ...track, size, url: filePath }
  const meta = pendingCacheMeta.get(data.id)
  pendingCacheMeta.delete(data.id)

  if (data.url && data.size !== undefined) {
    db.sqlite.transaction(() => {
      // ① Track 不存在则插入（含 Album / Artist / TrackArtist / ArtistAlbum）
      // ② INSERT OR IGNORE → TrackSource(trackId, pluginId, sourceContext)
      // ③ INSERT OR REPLACE → Audio(id='cache:{trackId}', filePath, gain, peak, size)
    })()
  }

  await deleteExcessCache()
  // 统计并通知渲染进程 receiveCacheInfo
}
```

### 3. `main/utils/index.ts` — deleteExcessCache

物理删除策略（Audio 表的核心是磁盘文件，文件删了保留记录无意义）：

```ts
export const deleteExcessCache = async (deleteAll = false): Promise<boolean> => {
  // 查询 Audio 表，按 rowid 升序（最旧优先）
  const rows = db.sqlite
    .prepare(`SELECT rowid, * FROM Audio WHERE filePath LIKE ? AND deleted = 0 ORDER BY rowid ASC`)
    .all(`${audioCachePath}%`)

  // 获取 library 类插件 ID 列表（stream 无缓存文件，其 TrackSource 应保留）
  const libraryPluginIds = [...pluginManager.plugins.entries()]
    .filter(([_, p]) => p.meta.type === 'library')
    .map(([id]) => id)

  if (deleteAll) {
    // 先删磁盘文件（fire-and-forget），再事务删 DB 记录
    for (const r of rows) fs.promises.unlink(r.filePath).catch(() => {})
    db.sqlite.transaction(() => {
      // DELETE FROM Audio WHERE id IN (...)
      // DELETE FROM TrackSource WHERE trackId IN (...) AND pluginId IN (libraryPluginIds)
    })()
  }

  // 超额清理：按 rowid 升序逐个标记，超出 sizeLimit 则删文件 + 事务删 DB
}
```

关键设计决策：

- **物理删除** Audio + 对应 library 插件的 TrackSource（保留 local/stream 映射）
- **先文件后 DB**：文件删除失败不阻塞 DB，DB 事务失败则文件已删但记录还在（影响最小）
- **O(1) 查找**：`deletedIdSet = new Set(deletedIds)` 替代 `deletedIds.includes()`

### 4. `main/IPCs.ts` — deleteACacheTrack

```ts
ipcMain.handle('deleteACacheTrack', (event, trackId: string) => {
  // 1. 查询并删除 Audio（文件 + DB 记录）
  // 2. 清理 library 插件的 TrackSource（保留 local/stream 映射）
  const libraryPluginIds = [...pluginManager.plugins.entries()]
    .filter(([_, p]) => p.meta.type === 'library')
    .map(([id]) => id)
  // DELETE FROM TrackSource WHERE trackId = ? AND pluginId IN (libraryPluginIds)
})
```

### 5. `main/IPCs.ts` — getCacheTracksInfo

```ts
ipcMain.handle('getCacheTracksInfo', () => {
  return (
    db.sqlite
      .prepare(
        `SELECT COUNT(*) as length, COALESCE(SUM(size), 0) as size FROM Audio WHERE filePath LIKE ? AND deleted = 0`
      )
      .get(`${audioCachePath}%`) || { length: 0, size: 0 }
  )
})
```

### 6. `renderer/store/player.ts` — replaceCurrentTrack

```ts
// 删除了 libraryPlugins / autoCacheTrack computed
// 用 get-song-url IPC 替代原来的 pluginMethodCall('songUrl') + cacheATrack.send()
const songUrlResult = (await window.mainApi?.invoke('get-song-url', {
  pluginId: plugin,
  sourceContext,
  track: currentTrack.value
})) ?? { url: '', replayGain: 0, peak: 1 }

engineStore.playAudioSource(
  songUrlResult.url,
  songUrlResult.replayGain,
  songUrlResult.peak,
  autoPlay
)
```

### 7. `main/dbHelpers.ts` — pluginDbGet 按 TrackSource 过滤

```sql
-- 有 pluginId 时 JOIN TrackSource，只返回该插件来源的 Track：
SELECT t.* FROM Track t
JOIN TrackSource ts ON ts.trackId = t.id AND ts.pluginId = ?
WHERE t.deleted = 0
```

### 8. `preload/index.ts` — 新增通道

`'get-song-url'` 加入 `mainAvailChannels`

### 9. Plugins 表（新增）

`src/public/migrations/plugin.sql` 新增 `Plugins` 表及 6 个内置插件种子数据：

```sql
CREATE TABLE IF NOT EXISTS "Plugins" (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL DEFAULT '',
    type      TEXT NOT NULL DEFAULT '',    -- local | library | stream
    path      TEXT NOT NULL DEFAULT '',     -- 上传插件存储完整路径，内置插件留空
    builtIn   INTEGER NOT NULL DEFAULT 0,
    enabled   INTEGER NOT NULL DEFAULT 1,
    createTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO Plugins (id, name, type, builtIn) VALUES
  ('local', '本地音乐', 'local', 1),
  ('kugou', '酷狗音乐', 'library', 1),
  ('netease', '网易云音乐', 'library', 1),
  ('emby', 'Emby', 'stream', 1),
  ('jellyfin', 'Jellyfin', 'stream', 1),
  ('navidrome', 'Navidrome', 'stream', 1);
```

`initPluginIpcMain` 改为从 DB `Plugins` 表加载插件（不再扫描内置插件目录），兼容升级时 `uploadDir` 中的遗留文件自动补录到 DB。`upload-plugin` IPC 同步写入 `Plugins` 表。

## 涉及文件清单

| 文件 | 改动 |
| --- | --- |
| `src/public/migrations/plugin.sql` | 新增 `Plugins` 表 + 6 个内置插件种子数据 |
| `src/main/db.ts` | `Tables` 枚举新增 `Plugins` |
| `src/main/IPCs.ts` | ① `task-done` 回调事务写入；② `get-song-url` IPC；③ `deleteACacheTrack` 恢复；④ `initPluginIpcMain` 改为 DB 驱动加载；⑤ `upload-plugin` 写入 DB；⑥ `getCacheTracksInfo` 改为查 Audio 表 |
| `src/main/utils/index.ts` | 重写 `deleteExcessCache`：物理删除 + 事务包裹 + Set 优化 + 精确清理 library 的 TrackSource |
| `src/main/dbHelpers.ts` | `pluginDbGet('Track')` 加 JOIN `TrackSource` 过滤 |
| `src/renderer/store/player.ts` | `replaceCurrentTrack` 改用 `get-song-url` IPC |
| `src/preload/index.ts` | 新增 `get-song-url` 通道 |

## 清理策略

- **物理删除** Audio 表记录 + 磁盘文件（文件是核心，记录无独立价值）
- **保留** Track / Album / Artist 元数据（评论/歌词路由需要）
- **精确清理**：仅删除 library 类型插件对应的 TrackSource 行（stream/local 无缓存文件，映射需保留）
- 按 `rowid` 升序（最旧优先），超出容量上限则删除
- `deleteAll` 模式清除所有缓存文件 + 对应的 library TrackSource
