---
last-updated: 2026-07-21
title: 路由配置
order: 8
last-reviewed: 2025-07-21
---

# 路由配置

Vue Router 4 管理所有页面视图的导航，位于 `src/renderer/router/index.ts`。

## 历史模式

| 环境     | 模式                     | 说明                         |
| -------- | ------------------------ | ---------------------------- |
| Electron | `createWebHashHistory()` | Hash 模式，兼容 file:// 协议 |
| Web      | `createWebHistory()`     | HTML5 History 模式           |

通过 `window.env?.isElectron` 判断当前环境。

## 路由表

### 首页与发现（立即加载）

| 路径                     | 组件          | 说明      |
| ------------------------ | ------------- | --------- |
| `/`                      | `HomePage`    | 首页      |
| `/explore`               | `ExplorePage` | 发现/探索 |
| `/daily/songs/:pluginId` | `DailyTracks` | 每日推荐  |

### 音乐库（懒加载）

| 路径                      | 组件           | 说明         |
| ------------------------- | -------------- | ------------ |
| `/library`                | `LibraryMusic` | 音乐库主页   |
| `/liked-songs/:pluginId+` | `LibraryMusic` | 喜欢的歌曲   |
| `/localPlaylist/:id`      | `PlaylistPage` | 本地播放列表 |
| `/localMusic`             | `LocalMusic`   | 本地音乐扫描 |

### 在线内容（懒加载）

| 路径                                 | 组件           | 说明           |
| ------------------------------------ | -------------- | -------------- |
| `/Playlist/:pluginId/:sourceContext` | `PlaylistPage` | 播放列表详情   |
| `/album/:pluginId/:sourceContext`    | `AlbumPage`    | 专辑详情       |
| `/artist/:pluginId/:sourceContext`   | `ArtistPage`   | 艺术家详情     |
| `/artistmv/:pluginId/:sourceContext` | `ArtistMv`     | 艺术家 MV 列表 |
| `/mv/:pluginId/:sourceContext`       | `MvPage`       | MV 播放        |
| `/stream`                            | `StreamPage`   | 流媒体浏览     |

### 其他（懒加载）

| 路径                    | 组件             | 说明                 |
| ----------------------- | ---------------- | -------------------- |
| `/search`               | `SearchPage`     | 搜索结果             |
| `/settings`             | `SystemSettings` | 系统设置             |
| `/login/:service/:type` | `LoginAccount`   | 登录页               |
| `/next`                 | `NextUp`         | 即将播放             |
| `/:pathMatch(.*)*`      | —                | 通配符，重定向到 `/` |

## 路由守卫

`beforeEach` 中执行两个检查：

### 1. 数据源可用性检查

带 `meta.sourceType`（`library` / `stream` / `local`）的路由，会检查对应插件类型是否已启用。未启用时按以下顺序回退：

```
目标 sourceType 路由 → 其他 sourceType 首页 → /settings
```

### 2. 登录状态检查

带 `meta.requireLogin` 的路由，会检查对应 sourceType 是否有已登录的插件。未登录时重定向到：

```
/login/:service/:type
```

其中 `LoginType` 由 `sourceType` 推导：

- `library` → `QrCode`（扫码登录）
- `stream` → `Username`（用户名密码）
- `local` → `LocalDir`（本地目录）

## 独立窗口

### PlayPage（全屏播放器）

PlayPage **不是**独立窗口，而是主窗口内的一个普通 Vue 组件。通过 `showLyrics` 状态控制显示/隐藏，使用 `slide-up` 过渡动画。它在同一个 Vue 应用中渲染，共享 router、i18n、Pinia。

### OSDLyric（桌面歌词）

OSDLyric **是**独立的 Electron `BrowserWindow`，与主窗口完全隔离：

| 对比项    | 主窗口                              | OSDLyric                             |
| --------- | ----------------------------------- | ------------------------------------ |
| 入口 HTML | `index.html` → `App.vue`            | `osdlyric.html` → `OSDLyric.vue`     |
| 入口 TS   | `main.ts`（含 router、i18n、Pinia） | `osdLyric.ts`（仅 Pinia）            |
| Preload   | `preload/index.js`                  | `preload/osdWin.js`                  |
| 窗口属性  | 标准窗口                            | 透明、无边框、跳过任务栏、不抢焦点   |
| 尺寸模式  | 固定                                | `small`（700×140）或 full（500×600） |

两个窗口通过 `MessageChannelMain` 建立直接通信通道，不经过 IPC 中转。
