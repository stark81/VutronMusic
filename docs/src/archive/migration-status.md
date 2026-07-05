---
title: 迁移状态 v3.3.0
order: 3
---

# 迁移状态：v3.3.0 插件化重构

---

> 本文档跟踪 VutronMusic v3.3.0 从「单体架构」到「插件化架构」的重构进度。

---

## 重构目标

从「以网易云音乐为主，其他平台为附加」的架构，迁移到「所有平台通过插件平等接入」的架构。

### 核心变化

| 原架构 | 新架构 |
|--------|--------|
| 网易云逻辑直连（`data.ts`） | 所有平台通过 `pluginMusic.ts` 调用 |
| 平台代码散落在 main/renderer | 每个平台代码封装在插件 .js 中 |
| 新增平台 = 修改核心代码 | 新增平台 = 编写新插件 |
| renderer 直接调用网易云 API | 所有 API 通过 IPC → Worker 调用 |

---

## 已完成

- [x] **Worker 线程插件沙箱** — `pluginRunner.ts` 执行环境
- [x] **7 个内置插件** — 覆盖 local/library/stream 三种类型
- [x] **PluginAPI 接口定义** — 60 个方法 + Zod Schema 校验
- [x] **PluginManager 全局管理器** — 插件注册/加载/调用生命周期
- [x] **Zod Schema 校验** — `PluginResultSchema` 运行时代码守卫
- [x] **域名白名单** — `checkDomain()` 确保 HTTP 请求安全
- [x] **插件配置隔离** — `api.store` 按 pluginId 键名前缀隔离
- [x] **插件数据库隔离** — `api.db` 前缀过滤 `PluginData` 表
- [x] **TrackSource 多源映射** — Track ↔ 插件的关联表

## 进行中

- [ ] **渲染进程迁移** — 部分功能仍使用 `data.ts`（网易云直连），未完全切换到 `pluginMusic.ts`
  - `data.ts` 中的 `fetchLikedPlaylist`, `fetchLikedSongs`, `fetchLikedAlbums` 等正在迁移
  - 部分 UI 页面可能仍直接引用 `data.ts`
- [ ] **评论模块** — 插件化评论系统已定义 API 但 UI 层还未完全适配多来源
- [ ] **分类浏览** — getXXCatlist 等分类接口的 UI 层统一

## 待定

- [ ] **搜索结果的统一排序和展示** — 当前是并行显示各插件的搜索结果，未来可考虑融合排序
- [ ] **插件的热更新** — 目前修改插件需要重启应用
- [ ] **插件市场** — 从应用内浏览和安装第三方插件（目前需要手动复制文件）
- [ ] **自动清理** — 数据库软删除记录的自动物理清理
- [ ] **插件健康检查** — Worker 的心跳检测和自动恢复

---

## 未解决的问题

1. **migrate() 函数已临时注释** — 新的数据库迁移流程尚未完全确定，详见 [数据库迁移](migrations)
2. **data.ts 和 pluginMusic.ts 的功能重叠** — 两者都管理 liked/albums/artists/MVs/cloudDisk，但 `data.ts` 是旧网易云直连，`pluginMusic.ts` 是通用插件接口。最终应弃用 `data.ts`
3. **Store 持久化策略** — 哪些数据持久化到 electron-store，哪些只存内存，需要统一规范

---

## 关于本文档

本文档会随重构进度持续更新。如果你在开发过程中发现本文档未覆盖的事项，请更新它。
