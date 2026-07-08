---
title: 旧版 Renderer API 层（已废弃）
order: 7
---

# 旧版 Renderer API 层（已废弃）

> **此层已废弃**，待删除。`src/renderer/api/` 目录和 `store/data.ts` 是重构前只有网易云时的数据获取方式，现已全面通过插件系统获取数据。新功能**不要**使用此层。

## 历史背景

在引入插件系统之前，VutronMusic 只支持网易云音乐一个在线源。`src/renderer/api/` 封装了对 [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 的前端调用，是当时唯一的数据获取方式。

插件系统上线后，所有平台（包括网易云）均通过插件接口获取数据，此层不再被新代码使用。

## 架构

```
Vue Views / Store
       │
       ▼
api/*.ts ──→ utils/request.ts ──→ /netease/* ──→ Fastify 代理 ──→ NeteaseCloudMusicApi
```

## 模块清单

| 文件          | 大小  | 导出函数数 | 用途                             |
| ------------- | ----- | ---------- | -------------------------------- |
| `album.ts`    | 1.4KB | 4          | 专辑内容、新碟、详情、收藏       |
| `artist.ts`   | 2.5KB | 7          | 歌手详情、专辑、MV、相似、关注   |
| `auth.ts`     | 3.1KB | 8+         | 手机/邮箱/二维码登录、登出、刷新 |
| `comment.ts`  | 0.9KB | 4          | 评论列表、点赞、楼中楼、发表     |
| `mv.ts`       | 2.3KB | 6          | MV 详情、URL、相似、订阅         |
| `other.ts`    | 2.4KB | 6          | 搜索、横幅、私人 FM              |
| `playlist.ts` | 6KB   | 13         | 歌单 CRUD、推荐、排行榜          |
| `track.ts`    | 2.4KB | 6          | 歌曲详情、歌词、喜欢、Scrobble   |
| `user.ts`     | 3.4KB | 8          | 用户信息、收藏、云盘、听歌记录   |

## 通用模式

所有模块遵循一致的模式：

```typescript
import request from '../utils/request'

export function functionName(params) {
  return request({
    url: '/endpoint/path',
    method: 'get' | 'post',
    params: { ... }
  })
}
```

`request` 包装器（`utils/request.ts`）封装了 axios，baseURL 为 `/netease`，由主进程 Fastify 代理到后端 API。支持 cookie 自动管理（MUSIC_U 会话）。

## 认证机制

基于 cookie 的三种登录方式：手机号、邮箱、二维码。`utils/auth.ts` 管理 `document.cookie` 和 `localStorage` 双写。响应拦截器自动检测 301 未登录状态并执行登出。

## 残留引用

搜索发现以下文件仍在引用此层（清理时应同步处理）：

| 消费方                  | 引用的 API 模块                |
| ----------------------- | ------------------------------ |
| `store/data.ts`         | user / auth / track / playlist |
| `utils/index.ts`        | auth                           |
| `utils/auth.ts`         | auth                           |
| `utils/playlist.ts`     | playlist                       |
| `views/DailyTracks.vue` | playlist                       |
| `views/UserPage.vue`    | user / auth                    |
