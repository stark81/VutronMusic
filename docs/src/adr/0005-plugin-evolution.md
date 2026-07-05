---
title: ADR-0005 插件架构演化史
order: 6
---

# ADR-0005：插件架构演化史

---

**状态**：已实施  
**日期**：持续演化（v1.0 → v3.0 → v3.3.0）  
**决策者**：stark81

---

## 演化全景图

VutronMusic 的数据获取架构经历了三个阶段。理解这段历史有助于解释为什么代码中有看似冗余的目录和通信模式。

```
Phase 1 ──────────→ Phase 2 ──────────→ Phase 3（当前）
本地 + 网易云 API      主进程聚合            Worker 沙箱
（v1.0 起）           （v3.0 附近）        （v3.3.0 起）
```

---

## Phase 1（v1.0 起）："本地 + 网易云 API"

### 架构

```
Renderer Process (Vue)
    │
    ├── axios → /netease/* → NeteaseCloudMusicApi（自部署 HTTP 服务）
    │
    └── 本地文件直接读取（通过 Electron 原生能力）
```

### 特点

- **音乐源**：仅支持本地音频文件和网易云音乐
- **数据获取**：渲染进程通过 axios 直接访问自部署的 NeteaseCloudMusicApi 服务
- **认证**：基于 cookie（MUSIC_U），渲染进程直接管理登录态
- **插件概念**：不存在。添加新平台 = 改核心代码 + 增 IPC 通道 + 改 preload + 改渲染层

### 遗留至今的痕迹

- `src/renderer/api/` 目录：网易云的 API 封装层（已废弃，见 archive）
- `src/renderer/utils/request.ts`：当时唯一的 HTTP 客户端
- `store/data.ts`：当时唯一的 Pinia 数据 store（正在被 pluginMusic 替代）
- 前端的 cookie 认证机制

---

## Phase 2（v3.0 附近）："主进程聚合"

### 架构

```
Renderer Process               Main Process
    │                                │
    ├── IPC ──────→ require('emby.js')       ← Emby
    ├── IPC ──────→ require('jellyfin.js')   ← Jellyfin
    ├── IPC ──────→ require('navidrome.js')  ← Navidrome
    │                                │
    └── axios → /netease/*    (网易云仍走 HTTP)
```

### 动机

用户需要支持 Emby、Jellyfin、Navidrome 等自建流媒体服务。这些服务的接入逻辑被直接实现在主进程中：

1. 每个服务对应一个 `.js` 文件，通过 `require()` 加载
2. 主进程封装通用逻辑（HTTP 请求、数据解析），渲染进程通过 IPC 调用
3. 网易云仍保留 Phase 1 的 HTTP 直连方式（未迁移）

### 问题

| 问题 | 影响 |
|------|------|
| **无隔离** | 一个插件的 crash 导致整个应用挂掉 |
| **无超时** | 插件死循环卡死主进程 |
| **无域名限制** | 插件可以访问任意网络资源 |
| **无能力声明** | 框架不知道插件能做什么 |
| **扩展困难** | 第三方贡献需要修改主程序代码 |

### 遗留痕迹

- `src/main/utils/CacheApis.ts`：当时的路由枚举
- `src/main/cache.ts`：当时的缓存类（已废弃）

---

## Phase 3（v3.3.0 起）："Worker 沙箱"

### 架构

```
Renderer Process               Main Process                    Worker Pool
    │                                │                              │
    ├── pluginMusic store ──→ PluginManager ──→ Worker(netease.js)
    │                         (Map<id,           Worker(kugou.js)
    │                          Instance>)        Worker(emby.js)
    │                                            Worker(jellyfin.js)
    │                                            Worker(navidrome.js)
    │                                            Worker(local.js)
    │                                            Worker(demo.js)
    │
    └── archive/ 中的旧 API 层（不再用于新功能）
```

### 做了什么

1. **Worker 线程沙箱**：每个插件在独立的 Worker 线程中执行，无法访问 `fs`、`electron`、`require` 等 Node.js 原生模块
2. **统一 API 接口**：62 个方法，全部经过 Zod Schema 运行时校验
3. **安全机制**：域名白名单、12 秒超时自动销毁、能力声明
4. **PluginManager**：全局统一调度，Map<pluginId, Instance>
5. **多实例支持**：同一插件以不同配置加载（如多个 Emby 公益服）→ 多个 Worker 实例

### 为什么选 Worker 而不是别的

（详见 [ADR-0001](./0001-plugin-architecture) 的完整方案对比——require vs child_process vs Worker。以下是摘要）

| 方案 | 优点 | 缺点 |
|------|------|------|
| **require**（Phase 2 方式） | 简单直接 | 无隔离，一个 crash 全挂 |
| **child_process** | 进程级隔离 | 启动开销大，管理复杂 |
| **Worker 线程** 🏆 | 线程级隔离，轻量，可超时销毁 | 不能使用 npm 包，通信需序列化 |

### 支持的特性

| 特性 | 说明 |
|------|------|
| **扩展** | 用户导入任意 `.js` 文件即成为新插件 |
| **移除** | 设置页面停用/删除不需要的插件 |
| **多开** | 同插件以不同配置创建多个实例（如两个 Emby 公益服） |
| **安全** | 域名白名单 + Worker 沙箱 + Zod 校验 |
| **稳定** | 12 秒超时机制，插件崩溃不影响主进程 |

---

## 三阶段对比

| 维度 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| **时间** | v1.0 起 | v3.0 附近 | v3.3.0 起 |
| **数据获取** | 渲染进程 HTTP | 主进程 direct require | Worker 沙箱 |
| **平台扩展** | 改核心代码 | 添加 .js 文件 | 导入插件文件 |
| **安全隔离** | 无 | 无 | 沙箱 + 白名单 |
| **超时控制** | 无 | 无 | 12 秒 |
| **第三方支持** | ❌ | 理论上可，不安全 | ✅ 安全沙箱 |
| **结果校验** | 无 | 无 | Zod Schema |
| **多实例** | ❌ | ❌ | ✅ 多 Worker |
| **方法数量** | 自定义 | 部分实现 | 62 个统一 API |

## 后续影响

- **Phase 1 残留**：`src/renderer/api/` + `store/data.ts` + cookie 认证机制 → 待清理（见 [archive/renderer-api](../archive/renderer-api)）
- **Phase 2 残留**：`cache.ts` → 已废弃可删除
- **Phase 3 持续演化**：`api.*` 工具方法不断增加（如最近新增的 `reportPlayback`、`matchTrack`）
- **插件生态**：安全沙箱使得第三方插件成为可能，但仍需完善开发者文档和调试工具
