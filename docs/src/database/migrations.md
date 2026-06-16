# 迁移历史

数据库迁移文件位于 `src/public/migrations/`，通过应用内 `migrate()` 函数按版本号执行。

## 当前状态

开发阶段 `migrate()` 已临时注释（`src/main/db.ts` 构造函数中），每次启动直接执行 `plugin.sql` 重建表结构。历史迁移文件将在重构完成后清理。

## 迁移文件列表

| 文件 | 版本 | 说明 |
| --- | --- | --- |
| `init.sql` | 初始 | 旧版 schema，使用 `json TEXT` 列，包含 AccountData 等旧表 |
| `1.5.0.sql` | 1.5.0 | Track 表增加 `type` 列，移除 `isLocal`/`deleted` |
| `2.4.0.sql` | 2.4.0 | 更新未匹配本地歌曲的 Track picUrl |
| `2.5.0.sql` | 2.5.0 | 协议从 `atom://` 改为 `vutron://` |
| `3.3.0.sql` | 3.3.0 | **重大重构**：所有表增加 `platform` 列作为 composite PK，AccountData 替换为 PluginData，迁移至 `(id, platform)` 复合主键 |
| `plugin.sql` | 当前 | **现行 schema**，每次启动执行，创建所有表（见数据库设计文档） |

## 迁移机制设计（待实现）

重构完成后需要重新设计版本化迁移流程，预期方案：

1. `AppData` 表存储当前数据库版本号
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
