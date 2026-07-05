---
title: 数据清理策略
order: 4
---

# 数据清理策略

## 清理分类

| 数据类型 | 清理时机 | 策略 |
|---------|---------|------|
| 软删除的 Track | 软件启动时 / 手动触发 | 删除 >30 天且用户未恢复的 deleted=1 记录 |
| 失效的 Audio 路径 | 每次扫描时 | 文件不存在的标记为 deleted=1 |
| 孤立歌词 | Track 删除时一并处理 | 级联删除 |
| 插件缓存数据 | 卸载插件时 | 清理关联的 PluginData + TrackSource |
| CUE 分离数据 | 源文件变更时 | 重新解析 CUE 文件 |

## 当前状态

**已有的清理能力**：
- 本地扫描时自动标记不存在的文件为 `deleted=1`
- 删除插件实例时清理关联数据
- 软删除的 Track 在 UI 中不可见（`WHERE deleted = 0`）

**待完善的清理能力**：
- 自动定期清理超过一定时间的软删除记录
- 孤立数据检测与清理工具
- 用户可视化的「数据管理」UI

## CUE 分轨的数据一致性

当用户删除 CUE 文件或源 FLAC 文件变化时，所有依赖该 CUE 的分轨数据都需要重新解析。策略：

1. **扫描时检测** — 每次本地扫描时检查 CUE 文件是否存在、MD5 是否变化
2. **CUE 变更 = 全量重解析** — CUE 文件内容变了，所有分轨 Track 重新建立
3. **源文件丢失 → 仅标记** — 标记为 `deleted=1` 而非直接清除

## 技术参考：清理相关代码

所有业务查询默认过滤 `deleted`：

```typescript
const tracks = db.prepare(`
  SELECT * FROM Track WHERE deleted = 0 AND albumId = ? ORDER BY no
`).all(albumId)
```

当前缺失的清理逻辑：

```typescript
// 清理 >30 天的软删除 Track
db.prepare(`DELETE FROM Track WHERE deleted = 1 AND updateTime < datetime('now', '-30 days')`).run()

// 清理孤立歌词
db.prepare(`DELETE FROM Lyrics WHERE trackId NOT IN (SELECT id FROM Track)`).run()
```
