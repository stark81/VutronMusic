# 数据库迁移机制

数据库文件路径：`<userData>/api_cache/vutron_music.sqlite`

## 当前机制

数据库使用**单文件幂等初始化**模式，没有版本化迁移流程：

### 初始化阶段

应用启动时 `src/main/db.ts` 构造函数依次执行：

1. **`initTables()`** — 读取并执行 `plugin.sql`，其中所有 `CREATE TABLE` 使用 `IF NOT EXISTS`，幂等安全
2. **`migrate()`** — 检查 `AppData` 表中的 `appVersion` 值，若与 `Constants.APP_VERSION` 不符则更新

```typescript
// src/main/db.ts（简化）
constructor() {
  createFileIfNotExist(this.dbFilePath)
  this.sqlite = new SQLite3(this.dbFilePath)
  this.sqlite.pragma('auto_vacuum = FULL')
  this.initTables()   // 执行 plugin.sql（幂等）
  this.migrate()      // 追踪版本号
}

migrate() {
  const key = 'appVersion'
  const appVersion = this.findAppData(key)
  if (appVersion?.value !== Constants.APP_VERSION) {
    this.upsertAppData({ id: key, value: Constants.APP_VERSION })
  }
}
```

### 迁移文件

当前仅有**一个**迁移文件 `plugin.sql`，位置：

- 开发环境：`src/public/migrations/plugin.sql`
- 生产环境：`dist/migrations/plugin.sql`

该文件包含全部 15 张表的 `CREATE TABLE IF NOT EXISTS`：

- `PluginData` / `AppData` — 键值存储
- `Plugins` — 插件注册表
- `Artist` / `Album` / `Track` — 元数据
- `TrackArtist` / `ArtistAlbum` — 关联关系
- `Audio` — 音频文件信息
- `Lyrics` — 歌词缓存
- `TrackSource` / `AlbumSource` / `ArtistSource` — 多源映射
- `Playlist` / `PlaylistEntry` — 歌单及歌单条目

> **注意**：`init.sql`、`1.5.0.sql`、`2.4.0.sql`、`2.5.0.sql`、`3.3.0.sql` 等历史迁移文件已随架构重构全部清理。旧版使用的是 `json TEXT` 列和 `(id, platform)` 复合主键，已在 `plugin.sql` 中被规范化表和 UUID 主键替代。

## 未来改进（待定）

当需要增量 Schema 变更时，预计改为版本化迁移流程：

1. `AppData` 表存储数据库版本号
2. 启动时比较应用版本与数据库版本
3. 按顺序执行版本间的迁移 SQL
4. 更新版本号

```typescript
// 预期的迁移逻辑（伪代码）
migrate() {
  const dbVersion = this.findAppData('dbVersion')?.value || '0.0.0'
  const migrations = ['1.5.0', '2.4.0', '2.5.0', '3.3.0']
  for (const version of migrations) {
    if (compare(Constants.APP_VERSION, version, '>=') && compare(dbVersion, version, '<')) {
      this.sqlite.exec(readSqlFile(`${version}.sql`))
      this.upsertAppData({ id: 'dbVersion', value: version })
    }
  }
}
```

当前 `migrate()` 仅做版本号记录，未实际执行增量 SQL。
