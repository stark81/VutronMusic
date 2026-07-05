---
title: ADR-0002 TrackSource 设计
order: 3
---

# ADR-0002：TrackSource 表设计

---

**状态**：已实施  
**日期**：v3.0 重构期间  
**决策者**：stark81

---

## Context

在多源场景下，同一个 Track（歌曲）在不同平台有不同的 ID 和上下文。例如：

```
同一首歌「起风了」：
- 在网易云的 ID 是 536099，有对应的歌曲详情页面
- 在酷狗的 ID 是 123456，有完全不同的详情页面
- 在本地是一个文件 /music/起风了.flac
```

数据库需要记录这种「一个 Track 对应多个平台 ID」的关系。

## 考虑的方案

### 方案 A：在 Track 表中为每个平台加列

```sql
CREATE TABLE Track (
  id TEXT PRIMARY KEY,
  name TEXT,
  -- ...
  neteaseSourceContext TEXT,   -- 网易云上下文
  kugouSourceContext TEXT,     -- 酷狗上下文
  localSourceContext TEXT       -- 本地上下文
)
```

- **优点**：查询简单，不需要 JOIN
- **缺点**：每新增一个平台就要修改 Track 表结构；不支持同一平台多个实例（如两个 Navidrome 服务器）
- **缺点**：大部分行的平台列都是 NULL（数据稀疏）

### 方案 B：预留 JSON 字段

```sql
CREATE TABLE Track (
  id TEXT PRIMARY KEY,
  name TEXT,
  -- ...
  sourceContexts TEXT  -- {"netease": {...}, "kugou": {...}}
)
```

- **优点**：灵活，新增平台不需要改表
- **优点**：查询简单
- **缺点**：JSON 字段无法建索引；查询特定平台的数据效率低
- **缺点**：类型安全差，应用层需要自己解析和验证

### 方案 C：独立的 TrackSource 关联表（选定方案 🏆）

```sql
CREATE TABLE TrackSource (
  trackId TEXT NOT NULL,
  pluginId TEXT NOT NULL,
  sourceContext TEXT,
  matched INTEGER DEFAULT 1,
  PRIMARY KEY (trackId, pluginId)
)
```

- **优点**：每行记录一个映射关系，完全符合关系数据库设计范式
- **优点**：新增平台 = 插入新行，不需要改表
- **优点**：支持同一平台多个实例（插件 ID 可包含实例标识）
- **优点**：可用于查询「某插件有哪些 Track」
- **缺点**：查询时需要 JOIN，稍微复杂

## Decision

选择 **方案 C：独立的 TrackSource 关联表**。

## Consequences

### 正面

- Schema 稳定：新增平台不影响 Track 表的定义
- 查询灵活：可以「查找所有来自网易云的 Track」或「查找某个 Track 的所有音源」
- 数据完整：复合主键 `(trackId, pluginId)` 保证了唯一性
- 人工确认：`matched` 字段支持用户确认匹配是否正确
- 插件私有：`sourceContext` 设计为 JSON 文本且框架不解析，各插件自由使用

### 负面

- 获取所有音源需要 `LEFT JOIN` 或子查询
- `sourceContext` 的 JSON 内容由插件维护，无法在数据库层做完整性约束
- 历史数据清理需要额外逻辑（删除 TrackSource 不会自动通知插件）

### 后续影响

- 相同设计模式扩展到 AlbumSource 和 ArtistSource
- `sourceContext` 的「框架不解析」原则成为插件系统的重要约定
