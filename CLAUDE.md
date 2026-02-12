# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

VutronMusic 是一个基于 Electron + Vue 3 的第三方网易云音乐播放器，支持本地音乐、流媒体音乐（Navidrome、Jellyfin、Emby）、歌词显示、音效调节等功能。

## 常用命令

### 开发

```bash
yarn run dev              # 启动开发服务器（端口 41830）
yarn run dev:debug        # 带调试启动
yarn run dev:debug:force  # 强制重新加载调试
```

### 构建

```bash
yarn run build       # 格式化 + 类型检查 + electron-builder 构建
yarn run build:pre   # 格式化 + 类型检查 + Vite 构建（仅预构建）
yarn run build:all   # 构建所有平台（Windows、macOS、Linux）
yarn run build:win   # 仅 Windows
yarn run build:mac   # 仅 macOS
yarn run build:linux # 仅 Linux
yarn run build:dir   # 构建到目录（不打包）
```

### 依赖和重构

```bash
yarn run rebuild      # 重建原生模块（better-sqlite3、taglib-wasm）
yarn run fix-taglib   # 修复 taglib-wasm 问题
```

### 代码质量

```bash
yarn run lint         # ESLint 检查
yarn run lint:fix     # 自动修复 ESLint 问题
yarn run format       # Prettier 检查
yarn run format:fix   # Prettier 自动格式化
```

### 测试

```bash
yarn run test         # 运行 Playwright 测试
yarn run test:linux   # Linux 上运行测试（使用 xvfb）
```

## 核心架构

项目采用 Electron 多进程架构：

```
┌─────────────────────────────────────────────────────────┐
│                   Electron App                          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │  Main Process (src/main/)                       │  │
│  │  - 窗口管理、IPC 处理、原生数据库                │  │
│  │  - Fastify 服务器 (端口 41830/40001)            │  │
│  │  - Workers: scanMusic, cacheTrack, writeCover   │  │
│  └──────────────────────────────────────────────────┘  │
│                      ▲ IPC                              │
│  ┌─────────────────┼────────────────────────────────┐  │
│  │  Preload Scripts (src/preload/)                  │  │
│  │  - index.ts: 主窗口 preload                      │  │
│  │  - osdWin.ts: OSD 歌词窗口 preload               │  │
│  └─────────────────┼────────────────────────────────┘  │
│                     ▼                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Renderer Process (src/renderer/)                │  │
│  │  - Vue 3 + Pinia + Vue Router                    │  │
│  │  - Views、Components、Stores、API 层             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 关键目录说明

| 目录                       | 用途                                        |
| -------------------------- | ------------------------------------------- |
| `src/main/`                | Electron 主进程代码                         |
| `src/main/IPCs.ts`         | 所有 IPC 处理器的集中定义                   |
| `src/main/workers/`        | 使用 piscina 的 Worker 线程池               |
| `src/main/streaming/`      | 流媒体服务集成（Navidrome、Jellyfin、Emby） |
| `src/preload/`             | Preload 脚本，暴露 window.mainApi           |
| `src/renderer/`            | 渲染进程代码（Vue 应用）                    |
| `src/renderer/store/`      | Pinia stores（player、data、settings 等）   |
| `src/renderer/api/`        | API 层，调用网易云 API                      |
| `src/renderer/views/`      | 页面组件                                    |
| `src/renderer/components/` | 可复用 UI 组件                              |

## 开发模式

### 添加 IPC 通道

1. 在 `src/preload/index.ts` 的 `mainAvailChannels` 中添加通道名称
2. 在 `src/main/IPCs.ts` 中使用 `ipcMain.handle()` 或 `ipcMain.on()` 实现处理器
3. 在渲染进程通过 `window.mainApi.invoke()` 或 `window.mainApi.send()` 调用

### 添加 Pinia Store

1. 在 `src/renderer/store/` 创建文件
2. 使用 `defineStore('name', () => { ... })` Composition API 模式
3. 使用 `pinia-plugin-persistedstate` 选项进行持久化

### 自定义协议

项目使用 `atom://` 协议：

- `atom://local-asset` - 本地音频/图片流
- `atom://get-default-pic` - 默认图片
- `atom://get-color` - 提取图片主色调
- `atom://get-online-music` - 代理在线音乐请求

## 重要约定

- Vue 组件使用 `<script setup lang="tsx">`
- 文件命名：Vue 组件用 PascalCase（如 `PlayerBar.vue`），Store 用小写（如 `player.ts`）
- 路径别名：`@/` 映射到 `src/`
- 路由使用 hash 模式（Electron 环境）
- 音频使用 Web Audio API，AudioWorklet 用于变调变速

## 原生依赖

- `better-sqlite3` - 需要在安装后重建（`yarn run rebuild`）
- `taglib-wasm` - 用于读取/写入音频元数据
- `piscina` - Worker 线程池

## 环境要求

- Node.js >= 22.6.0
- Python 3.9（其他版本可能导致依赖安装失败）
- Yarn 1.22.22
