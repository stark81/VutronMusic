---
last-updated: 2026-07-05
title: ADR-0004 SQLite Schema
order: 5
---

# ADR-0004：SQLite Schema

---

**状态**：已实施  
**日期**：v3.0  
**决策者**：stark81

---

## Context

VutronMusic 需要一个本地持久化方案来存储用户的音乐数据。核心需求：

1. **离线可用**：所有数据在本地，不依赖网络
2. **复杂查询**：歌曲、专辑、歌手之间的多对多关系，需要 JOIN 查询
3. **性能**：本地音乐库可能有数万首歌，查询需要快
4. **插件数据**：插件需要一种通用的键值存储方式
5. **跨平台**：Windows / macOS / Linux 都能用

## 考虑的方案

### 方案 A：JSON 文件存储

将所有数据保存为 JSON 文件。

- **优点**：零依赖，人类可读
- **优点**：简单，不需要初始化
- **缺点**：全量读写，数据量大时性能差
- **缺点**：不支持索引，查询复杂数据时需要全量加载到内存
- **缺点**：并发写入不安全

### 方案 B：IndexedDB（渲染进程）

在渲染进程中使用浏览器的 IndexedDB。

- **优点**：Electron 内置支持
- **优点**：异步 API，不阻塞 UI
- **缺点**：渲染进程的数据无法直接被主进程访问
- **缺点**：不适合存储大量关联数据
- **缺点**：调试困难

### 方案 C：SQLite + better-sqlite3（选定方案 🏆）

```typescript
import Database from 'better-sqlite3'
const db = new Database('vutron_music.sqlite')
```

- **优点**：成熟的关系数据库，支持复杂查询
- **优点**：同步 API（在主进程中不会阻塞 UI），代码简单
- **优点**：零配置（不需要服务器进程）
- **优点**：跨平台（SQLite 支持所有桌面平台）
- **优点**：性能优秀（10 万条记录查询 <10ms）
- **缺点**：better-sqlite3 需要原生编译（electron-rebuild）
- **缺点**：WAL 模式下需要处理文件锁定

## Decision

选择 **方案 C：SQLite + better-sqlite3**。

## Schema 设计决策

### 主键格式

所有核心表的 ID 使用字符串格式：`${pluginId}:${type}:${key}`。

例如：`netease:track:536099`, `local:audio:abc123`

- **优点**：自解释，不需要额外的 type 字段
- **优点**：全局唯一，不同插件不会冲突

### 软删除

Track 和 Audio 表使用 `deleted` 字段（0/1）实现逻辑删除。

- **优点**：用户误删后可恢复
- **优点**：删除操作不阻塞（只需 UPDATE 而非 DELETE）
- **缺点**：需要查询时记得加 `WHERE deleted = 0`
- **缺点**：数据会持续增长，需要定期清理

### WAL 模式

```typescript
db.pragma('journal_mode = WAL')
```

- **优点**：读操作不阻塞写操作
- **优点**：写入性能更好
- **优点**：故障恢复能力更强

### auto_vacuum

```typescript
db.pragma('auto_vacuum = FULL')
```

- **优点**：删除数据后自动回收空间
- **缺点**：每次写入操作稍微变慢（但影响很小）

## Consequences

### 正面

- 稳定可靠：SQLite 是经过几十年验证的数据库引擎
- 查询灵活：复杂的多表 JOIN 查询可以在 SQL 层面完成
- 零运维：不需要数据库管理员、不需要配置服务器
- 数据便携：`.sqlite` 文件可以直接复制、备份

### 负面

- better-sqlite3 需要 `electron-rebuild`（构建流程复杂一些）
- 同步 API 意味着所有数据库操作在主进程执行（不能放到 Worker 中）
- 没有内置的迁移工具（需要自己写迁移逻辑）

### 后续影响

- 数据库文件路径为 `{userData}/api_cache/vutron_music.sqlite`
- 迁移逻辑内置在 `db.ts` 构造函数中，通过 `ALTER TABLE ADD COLUMN` 增量迁移（目前管理 cueOffset/cueDuration 列 + appVersion），不建议手动调用或修改
- 插件数据的 PluginData 表提供了灵活的 key-value 扩展能力
