---
title: Fastify 内嵌服务器
order: 11
last-reviewed: 2025-07-21
---

# Fastify 内嵌服务器

应用内嵌两个 Fastify HTTP 服务器，提供本地资源服务和第三方 API 代理。

**核心文件**:

- `src/main/index.ts` — 服务器创建和生命周期管理
- `src/main/appServer/httpHandler.ts` — 本地资源路由
- `src/main/appServer/netease.ts` — 网易云 API 代理
- `src/main/appServer/6kLabsAmuse.ts` — Amuse 第三方播放器集成

## 服务器实例

### 主服务

| 属性     | 值                                                |
| -------- | ------------------------------------------------- |
| 端口     | 40001（dev）/ 41830（prod）                       |
| 用途     | 本地资源服务 + 网易云 API 代理                    |
| 静态文件 | `@fastify/static` 提供 `out/renderer/` 的静态资源 |
| Cookie   | `@fastify/cookie` 解析请求 cookie                 |

### Amuse 服务

| 属性     | 值                                 |
| -------- | ---------------------------------- |
| 端口     | 动态分配                           |
| 用途     | 6kLabsAmuse 第三方播放器集成       |
| 生命周期 | 按需启动（用户开启时），关闭时销毁 |
| CORS     | `@fastify/cors` 允许跨域           |

## 路由一览

### 本地资源路由（httpHandler）

| 路由 | 方法 | 说明 |
| --- | --- | --- |
| `/local-asset?trackId=xxx&size=256` | GET | 本地歌曲封面（优先级：同名图片 → 内嵌封面 → 默认封面） |
| `/local-asset/default-cover` | GET | 默认封面图片 |
| `/local-asset/singer-cover` | GET | 歌手默认图片 |
| `/local-asset/player` | GET | 获取当前播放器状态（`window.vutronmusic`） |

封面查找逻辑：

1. 根据 `trackId` 查数据库获取文件路径
2. 调用 `getPic()` 查找同名图片文件（song.mp3 → song.jpg/png/jpeg/webp）
3. 回退到音频文件内嵌封面
4. 最终回退到默认封面

支持 `size` 参数缩放（通过 `sharp` 库）。

### 网易云 API 代理（netease）

| 路由模式                    | 说明                                            |
| --------------------------- | ----------------------------------------------- |
| `/netease/{api-name}`       | GET/POST — 代理 NeteaseCloudMusicApi 的所有接口 |
| `/netease/unblock/song/url` | GET — UnblockNeteaseMusic 解锁歌曲 URL          |
| `/netease`                  | GET — 健康检查                                  |

**UnblockNeteaseMusic**：

- 来源优先级：bodian → kuwo → kugou → ytdlp → qq → bilibili → pyncmd → migu
- 支持代理配置（HTTP/HTTPS）
- 支持 QQ Cookie、Joox Cookie
- 支持 FLAC 格式开关

## 请求处理流程

```
Renderer (fetch)
  → Fastify (localhost:41830)
    → httpHandler（本地资源）
    → netease（网易云代理）
    → NeteaseCloudMusicApi / UnblockNeteaseMusic
```

所有请求通过 `electron.net` 发出，绕过 Chromium 网络栈，支持系统代理。
