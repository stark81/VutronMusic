---
title: CUE 分轨支持 — 实现记录
version: 1.0
status: 已实施
author: stark81
last-updated: 2026-07-21
order: 5
related: [index.md, design.md]
---

# CUE 分轨支持 — 实现记录

> 本文档是 CUE 分轨功能的开发实现备忘。产品需求见 [index.md](./index.md)，技术设计见 [design.md](./design.md)。

## 1. 涉及文件

| 文件                                | 职责                                               |
| ----------------------------------- | -------------------------------------------------- |
| `src/main/utils/cueParser.ts`       | CUE 文件解析（84 行）                              |
| `src/main/workers/scanMusic.ts`     | 扫描时检测同名 .cue 并调用解析                     |
| `src/renderer/store/audioEngine.ts` | 播放时处理 cueOffset/cueDuration                   |
| `src/renderer/store/player.ts`      | 获取歌曲 URL 时传递偏移信息                        |
| `src/main/dbHelpers.ts`             | Audio 表查询（包含 cueOffset/cueDuration）         |
| `src/main/IPCs.ts`                  | 扫描入口 + songUrl IPC 通道                        |
| `src/types/schemas.ts`              | PluginResultSchema 中的 cueOffset/cueDuration 字段 |

## 2. 关键实现

### 2.1 CUE 解析（cueParser.ts）

```typescript
const FRAMES_PER_SECOND = 75

function cueTimeToMs(time: string): number {
  const [mm, ss, ff] = time.split(':').map(Number)
  return mm * 60000 + ss * 1000 + Math.round(ff * (1000 / FRAMES_PER_SECOND))
}
```

解析流程：

1. 逐行读取 CUE 文件
2. 提取全局 PERFORMER、TITLE
3. 每遇到 TRACK 开始新曲目
4. INDEX 01 提取起始时间
5. 推算每首时长（下一首 startMs - 当前 startMs）
6. 最后一轨通过 `setLastTrackDuration()` 外部补充

### 2.2 扫描集成（scanMusic.ts）

```typescript
// 查找同名 .cue 文件
const findCompanionCue = (filePath: string): string | null => {
  const dir = path.dirname(filePath)
  const ext = path.extname(filePath)
  const base = path.basename(filePath, ext)
  const cuePath = path.join(dir, base + '.cue')
  return fs.existsSync(cuePath) ? cuePath : null
}
```

扫描逻辑：

1. 解析音频元数据
2. 调用 `findCompanionCue()` 查找同名 .cue
3. 如果存在，调用 `parseCue()` 解析
4. 为每个 TRACK 生成独立的扫描结果
5. 解析失败时 fallback 为整轨

### 2.3 播放偏移（audioEngine.ts）

相对时间映射的实现见 [design.md §2.3](./design.md#23-播放方案设计)。

关键函数：`_cueRelative()`、`_cueOffsetSec()`、`updateCurrentTime()`

### 2.4 Audio ID 生成

```typescript
// 同一文件不同分轨的 ID 区分
const audioKey = item.filePath + '@' + (item.cueOffset || 0)
const audioId = makeId('audio', audioKey)
// 例如：local:audio:/path/to/file.flac@0、local:audio:/path/to/file.flac@241000
```

## 3. 数据库变更

```sql
-- Audio 表的 cueOffset / cueDuration 字段已内置于 plugin.sql 的初始建表定义中
-- （v3.3.0 曾用 3.3.0.sql 通过 ALTER TABLE 增量添加，已删除，避免与初始建表重复报错）
```

迁移逻辑在 `db.ts` 构造函数中通过 `appVersion` 对比执行（当前剩余迁移：`3.3.1.sql`）。

## 4. 已知限制

- CUE 文件编码仅支持 UTF-8
- 不支持 INDEX 00（pregap）
- 不支持多 FILE 的 CUE（一张 CD 对应多个音频文件）
- 解析失败时静默 fallback 为整轨，无用户提示
