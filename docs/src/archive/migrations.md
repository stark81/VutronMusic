---
title: 数据库迁移
order: 4
---

# 数据库迁移

## 数据库迁移的困境

当应用升级时，用户已有的数据库可能缺少新版本需要的表或字段。迁移（Migration）就是「让旧数据库兼容新代码」的过程。

VutronMusic 面临的挑战：

1. **SQLite 没有内置的迁移工具** — 需要自己实现
2. **用户数据不可丢** — 迁移失败不能导致用户的数据丢失
3. **版本碎片** — 用户可能从任意旧版本升级到最新版

## 当前的迁移策略

**简化方案**：使用 `CREATE TABLE IF NOT EXISTS` 确保新表存在，使用 `ALTER TABLE` 迁移新增字段。

```typescript
// src/main/db.ts 中的迁移逻辑
import { migrate } from './migrations'

// migrate() 函数当前已临时注释
// 原因：新插件架构的数据库 schema 尚未完全稳定
// 待 schema 稳定后重新启用
```

**为什么注释掉了？** v3.3.0 的插件化重构导致数据库 schema 可能还会变化。等 Schema 稳定后再恢复迁移逻辑，避免频繁调整。

## 迁移的未来

预计的迁移流程：

```
应用启动 → 检查当前数据库版本 (AppData 表)
  │
  ├─ 版本匹配 → 正常使用
  │
  └─ 版本不匹配 →
      ├─ 逐版本执行迁移脚本
      ├─ 每个迁移脚本是幂等的（可重复执行）
      └─ 迁移完成后更新版本号
```

---

## 技术参考

### 当前迁移实现

```typescript
// src/main/db.ts
// 初始化时执行的迁移
db.prepare(
  `
  ALTER TABLE Audio ADD COLUMN cueOffset INTEGER
`
).run() // 幂等：如果列已存在，SQLite 会报错，代码中需要 try-catch

db.prepare(
  `
  ALTER TABLE Audio ADD COLUMN cueDuration INTEGER
`
).run()
```

### 迁移规范（计划）

```
src/public/migrations/
├── 001_initial.sql        ← 初始 Schema
├── 002_add_cue_fields.sql ← 添加 CUE 分轨字段
└── ...
```

每个迁移文件的结构：

```sql
-- 002_add_cue_fields.sql
-- Up: 应用迁移
ALTER TABLE Audio ADD COLUMN cueOffset INTEGER;
ALTER TABLE Audio ADD COLUMN cueDuration INTEGER;
-- Down: 回滚（可选）
-- ALTER TABLE Audio DROP COLUMN cueOffset;
```
