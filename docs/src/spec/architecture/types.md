---
title: 类型系统说明
order: 10
last-reviewed: 2025-07-07
---

# 类型系统说明

VutronMusic 存在**两套类型系统**，分别服务于持久化层和 API 层。理解它们的差异是正确编码的关键。

## 为什么要两套？

| 系统 | 位置 | 用途 | 特点 |
| --- | --- | --- | --- |
| **DB 类型** | `src/types/music.d.ts` | 映射数据库行结构 | 平面、包含存储字段 |
| **Zod 类型** | `src/types/schemas.ts` + `src/types/plugin.ts` | 插件 API 输入/输出校验 | 嵌套、运行时验证 |

历史原因：项目早期使用 `music.d.ts` 描述数据结构。引入插件系统后，需要运行时校验和嵌套关系，因此通过 Zod schema 定义了第二套类型。两套共存，各有适用场景。

## Track 核心差异对照

| 维度 | `music.d.ts`（DB 类型） | `schemas.ts`（Zod 类型） |
| --- | --- | --- |
| **结构** | 平面，节点类型全平铺 | 深度嵌套：`album`、`artists`、`albumArtists` 为子对象 |
| **ID** | `string` | `number \| string` |
| **alias** | `string`（单值） | `string[]`（数组） |
| **专辑** | `albumId: string`（外键） | `album: AlbumSchema`（完整对象） |
| **艺术家** | 不在 Track 上 | `artists: ArtistSchema[]` |
| **playable / reason** | 不存在 | 存在（插件路由所需） |
| **sourceContext** | 不存在 | `Record<string, any>` |
| **type 枚举** | `'online' \| 'local' \| 'stream'` | `'local' \| 'library' \| 'stream'` |
| **filePath** | `string`（必需） | `string`（可选） |
| **size** | `number`（必需） | `number`（可选，默认 0） |
| **md5 / bitrate / gain / peak / offset / deleted** | 存在（DB 行元数据） | 不存在于顶层 Track |
| **updatedAt** | 存在 | 不存在 |

## Album / Artist 同理

`Album` 和 `Artist` 也遵循同样的双层结构：

- **music.d.ts**：`Album` 有 `id, name, picUrl, type, company, publishTime, desc` 等平面字段
- **schemas.ts**：`AlbumSchema` 多了 `pluginId, copywriter, artists, sourceContext` 等运行时字段

## 转换路径

```
插件返回 Zod TrackSchema
        │
        ▼
saveCacheResult() [dbHelpers.ts:917]
  ├── 拍平 album → 写入 Album 表
  ├── 拍平 artists → 写入 Artist 表 + TrackArtist 关联表
  ├── 拍平 albumArtists → 写入 ArtistAlbum 关联表
  ├── sourceContext → 写入 TrackSource 表
  └── url/size → 写入 Audio 表
        │
        ▼
pluginDbGet('Track', ...) [dbHelpers.ts:477]
  ├── JOIN 多表重新组装
  ├── 返回 { id, name, albumId, albumName, artists: [{id, name}], ... }
  └── 注意：不会还原完整的 AlbumSchema 嵌套结构
        │
        ▼
渲染进程 pluginMusic.ts
  ├── PluginResultSchema[method].safeParse() 校验
  ├── 注入 pluginId 到 album、artists、albumArtists
  └── 最终得到 Zod 类型
```

## 黄金法则

| 层 | 应使用 |
| --- | --- |
| **主进程 DB 操作**（dbHelpers.ts/db.ts） | `music.d.ts` 类型或原始 SQL 行 |
| **主进程 IPC 处理**（IPCs.ts） | 两者皆可，IPC 接收端用 `@/types/plugin` 的 Zod 类型 |
| **渲染进程 Store/组件** | **必须用 Zod 类型**（`@/types/plugin`） |
| **渲染进程旧 API 层**（`src/renderer/api/`） | 返回原始 axios 数据，不在类型系统内 |

## 相关文件

| 文件                    | 内容                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `src/types/music.d.ts`  | 平面 DB 层接口（Track/Album/Artist/PlaylistRow...）           |
| `src/types/schemas.ts`  | Zod Schema 定义（TrackSchema/AlbumSchema/PluginResultSchema） |
| `src/types/plugin.ts`   | 从 Zod 推断的导出类型 + PluginAPI + defaultMap                |
| `src/main/dbHelpers.ts` | 拍平（saveCacheResult）和重组（pluginDbGet）的转换逻辑        |
