# VutronMusic 项目上下文文档

## 项目概述

VutronMusic 是一个基于 Electron 的高颜值第三方网易云音乐播放器，使用现代化的前端技术栈构建。该项目支持本地音乐播放、流媒体服务、歌词显示、音效设置等多种功能。

### 核心技术栈

- **脚手架**: vutron (基于 Electron + Vite)
- **前端框架**: Vue 3 + TypeScript
- **状态管理**: Pinia + pinia-plugin-persistedstate
- **后端服务**: Fastify
- **数据库**: better-sqlite3
- **构建工具**: Vite + electron-builder
- **测试框架**: Playwright

### 主要特性

- ⚡️ 支持本地歌曲和离线歌单功能
- ⚡️ 本地歌曲支持读取外挂和内嵌封面歌词，支持逐字歌词功能
- ⚡️ 支持线上信息匹配
- ⚡️ 支持流媒体音乐：navidrome、jellyfin、emby、同人录
- ⚡️ 支持 Mac 状态栏歌词、TouchBar 歌词
- ⚡️ Linux 下可通过 media-controls 插件或 vutronmusic-lyrics 插件显示歌词
- ⚡️ 支持音效设置、变调变速等高级音频功能
- ⚡️ 支持云盘、歌曲评论等功能

## 项目架构

### 目录结构

```
src/
├── main/           # Electron 主进程代码
│   ├── appServer/  # 应用服务器（网易云 API、HTTP 处理）
│   │   ├── 6kLabsAmuse.ts  # 6kLabs Amuse 集成
│   │   ├── httpHandler.ts  # HTTP 请求处理
│   │   ├── netease.ts      # 网易云音乐 API
│   │   └── request.ts      # 请求工具
│   ├── streaming/  # 流媒体服务集成
│   │   ├── emby.ts         # Emby 支持
│   │   ├── jellyfin.ts     # Jellyfin 支持
│   │   ├── navidrome.ts    # Navidrome 支持
│   │   └── tongrenlu.ts    # 同人录支持
│   ├── utils/      # 主进程工具函数
│   │   ├── CacheApis.ts    # 缓存 API
│   │   ├── Constants.ts    # 常量定义
│   │   ├── index.ts        # 通用工具
│   │   ├── lastfm.ts       # Last.fm 集成
│   │   └── shortcuts.ts    # 快捷键
│   ├── workers/    # Web Workers
│   │   ├── cacheTrack.ts   # 音频缓存处理
│   │   ├── scanMusic.ts    # 音乐扫描
│   │   └── writeCover.ts   # 封面写入
│   ├── index.ts       # 主进程入口
│   ├── index.dev.ts   # 开发模式入口
│   ├── IPCs.ts        # IPC 通信定义
│   ├── cache.ts       # 缓存管理
│   ├── checkUpdate.ts # 自动更新
│   ├── db.ts          # 数据库
│   ├── dbus.ts        # DBus 服务（Linux）
│   ├── dbusClient.ts  # DBus 客户端
│   ├── dbusService.ts # DBus 服务实现
│   ├── dock.ts        # Mac Dock 集成
│   ├── globalShortcut.ts # 全局快捷键
│   ├── log.ts         # 日志
│   ├── menu.ts        # 应用菜单
│   ├── mpris.ts       # MPRIS 服务（Linux）
│   ├── store.ts       # 持久化存储
│   ├── thumBar.ts     # 任务栏缩略图按钮
│   ├── touchBar.ts    # Mac TouchBar
│   └── tray.ts        # 系统托盘
├── preload/        # Electron 预加载脚本
│   ├── index.ts     # 主窗口预加载
│   └── osdWin.ts    # OSD 歌词窗口预加载
├── renderer/       # 渲染进程代码（Vue 应用）
│   ├── api/         # API 调用模块
│   │   ├── album.ts     # 专辑 API
│   │   ├── artist.ts    # 艺术家 API
│   │   ├── auth.ts      # 认证 API
│   │   ├── comment.ts   # 评论 API
│   │   ├── mv.ts        # MV API
│   │   ├── other.ts     # 其他 API
│   │   ├── playlist.ts  # 歌单 API
│   │   ├── track.ts     # 歌曲 API
│   │   └── user.ts      # 用户 API
│   ├── assets/      # 静态资源
│   │   ├── css/         # 样式文件
│   │   ├── icons/       # 图标资源
│   │   ├── images/      # 图片资源
│   │   ├── lottie/      # Lottie 动画
│   │   ├── medias/      # 媒体资源
│   │   └── tray/        # 托盘图标
│   ├── components/  # Vue 组件（60+ 组件）
│   ├── locales/     # 国际化文件
│   ├── plugins/     # Vue 插件
│   ├── router/      # 路由配置
│   ├── store/       # Pinia 状态管理
│   │   ├── data.ts          # 数据状态
│   │   ├── localMusic.ts    # 本地音乐状态
│   │   ├── osdLyric.ts      # OSD 歌词状态
│   │   ├── player.ts        # 播放器状态
│   │   ├── playerTheme.ts   # 播放器主题状态
│   │   ├── settings.ts      # 设置状态
│   │   ├── state.ts         # 通用状态
│   │   ├── streamingMusic.ts # 流媒体音乐状态
│   │   └── tongrenlu.ts     # 同人录状态
│   ├── utils/       # 渲染进程工具函数
│   └── views/       # 页面视图
│       ├── AlbumPage.vue       # 专辑页
│       ├── ArtistPage.vue      # 艺术家页
│       ├── ArtistMv.vue        # 艺术家 MV
│       ├── DailyTracks.vue     # 每日推荐
│       ├── ExplorePage.vue     # 发现页
│       ├── HomePage.vue        # 首页
│       ├── LibraryMusic.vue    # 音乐库
│       ├── LocalMusic.vue      # 本地音乐
│       ├── LoginAccount.vue    # 登录页
│       ├── MvPage.vue          # MV 页
│       ├── NextUp.vue          # 待播列表
│       ├── OSDLyric.vue        # OSD 歌词
│       ├── PlaylistPage.vue    # 歌单页
│       ├── PlayPage.vue        # 播放页
│       ├── SearchPage.vue      # 搜索页
│       ├── StreamLogin.vue     # 流媒体登录
│       ├── StreamPage.vue      # 流媒体页
│       ├── SystemSettings.vue  # 系统设置
│       ├── TongrenluPage.vue   # 同人录页
│       └── UserPage.vue        # 用户页
├── public/         # 公共资源
│   ├── images/     # 公共图片
│   └── migrations/ # 数据库迁移脚本
└── types/          # TypeScript 类型定义
    ├── music.d.ts  # 音乐类型
    └── theme.d.ts  # 主题类型
```

### 进程通信

- **主进程**: `src/main/index.ts` - Electron 主进程入口
- **预加载脚本**: `src/preload/index.ts` - 暴露 API 给渲染进程
- **渲染进程**: `src/renderer/main.ts` - Vue 应用入口
- **OSD 歌词窗口**: `src/preload/osdWin.ts` + `src/renderer/osdLyric.ts`

### IPC 通信

主进程与渲染进程之间的通信定义在 `src/main/IPCs.ts`。

### Web Workers

项目使用 Piscina 管理 Web Workers，位于 `src/main/workers/`：

- `cacheTrack.ts` - 处理音频文件缓存
- `scanMusic.ts` - 扫描本地音乐文件
- `writeCover.ts` - 写入封面到音频文件

## 构建和运行

### 环境要求

- Node.js >= 22.6.0
- Python 3.9+（某些原生模块编译需要）
- Yarn 1.22.22

### 安装依赖

```bash
yarn install
```

安装后会自动运行 `npm run rebuild` 来重新编译原生模块（如 better-sqlite3、taglib-wasm）。

### 开发

```bash
# 启动开发服务器
yarn run dev

# 启动调试模式
yarn run dev:debug

# 强制启动调试模式
yarn run dev:debug:force
```

开发服务器运行在 `http://127.0.0.1:41830`，同时会启动一个代理服务器在 `http://127.0.0.1:40001` 处理以下代理：

- `/netease` - 网易云音乐 API
- `/local-asset` - 本地资源
- `/stream-asset` - 流媒体资源
- `/lastfm-callback` - Last.fm 回调

### 构建

```bash
# 完整构建（包含代码检查和类型检查）
yarn run build

# 预处理（格式化、类型检查、构建）
yarn run build:pre

# 构建所有平台（Windows、macOS、Linux）
yarn run build:all

# 构建目录（不打包）
yarn run build:dir

# 构建特定平台
yarn run build:mac
yarn run build:linux
yarn run build:win
```

### 代码质量

```bash
# ESLint 检查
yarn run lint

# ESLint 自动修复
yarn run lint:fix

# Prettier 格式化检查
yarn run format

# Prettier 自动格式化
yarn run format:fix

# TypeScript 类型检查
vue-tsc --noEmit
```

### 测试

```bash
# 运行 Playwright 测试
yarn run test

# Linux 下运行测试（使用 xvfb）
yarn run test:linux
```

### 其他命令

```bash
# 重新编译原生模块
yarn run rebuild

# 修复 taglib-wasm
yarn run fix-taglib
```

## 开发约定

### 代码风格

- 使用 ESLint + Prettier 进行代码格式化
- ESLint 配置基于 `standard` 规范，扩展了 Vue 3 和 TypeScript 规则
- Prettier 配置定义在 `.prettierrc`
- 使用 eslint-friendly-formatter 输出友好的错误信息

### TypeScript 配置

- 启用严格模式（`strict: true`）
- 路径别名：`@/*` 映射到 `./src/*`
- 模块解析：Node 风格
- JSX：保留模式（用于 Vue JSX 支持）
- 目标：ESNext
- 模块：ESNext

### Vue 组件规范

- 使用 Vue 3 Composition API
- 组件使用 `<script setup>` 语法
- 使用 TypeScript 进行类型检查
- 组件文件命名：PascalCase（如 `TrackListItem.vue`）
- 组件按功能分类，共 60+ 组件

### 状态管理

- 使用 Pinia 进行全局状态管理
- 状态持久化使用 `pinia-plugin-persistedstate`
- 主要 store：
  - `player.ts` - 播放器状态
  - `playerTheme.ts` - 播放器主题状态
  - `settings.ts` - 设置状态
  - `localMusic.ts` - 本地音乐状态
  - `streamingMusic.ts` - 流媒体音乐状态
  - `osdLyric.ts` - OSD 歌词状态
  - `tongrenlu.ts` - 同人录状态
  - `data.ts` - 数据状态
  - `state.ts` - 通用状态

### API 调用

- API 模块位于 `src/renderer/api/`
- 使用统一的请求工具 `src/renderer/utils/request.ts`
- 网易云音乐 API 通过本地服务器代理（`src/main/appServer/`）
- 支持模块化 API：album, artist, auth, comment, mv, other, playlist, track, user

### 样式规范

- 使用 SCSS 编写样式
- 全局样式定义在 `src/renderer/assets/css/`
- 使用 SVG 图标（vite-plugin-svg-icons）
- 遵循 Material Design 设计原则

### 国际化

- 使用 Vue I18n 进行国际化
- 禁用旧版 API（`__VUE_I18N_LEGACY_API__: false`）
- 语言文件位于 `src/renderer/locales/`
- 支持简体中文、繁体中文、英文

## 关键依赖

### 核心依赖

- `electron` (^31.0.0): Electron 框架
- `vue` (^3.5.10): Vue 3 框架
- `pinia` (^2.1.7): 状态管理
- `pinia-plugin-persistedstate` (^4.2.0): 状态持久化
- `fastify` (^4.26.2): Web 服务器
- `better-sqlite3` (^12.0.0): SQLite 数据库
- `taglib-wasm` (^0.5.4): 音频元数据解析
- `music-metadata` (^10.5.0): 音频元数据解析
- `soundtouchjs` (^0.1.30): 音频变速变调
- `piscina` (^5.1.3): Web Workers 管理

### 重要模块

- `NeteaseCloudMusicApi` (^4.28.0): 网易云音乐 API 服务
- `@unblockneteasemusic/server` (^0.28.0): 网易云音乐解锁服务
- `@jellybrick/mpris-service` (^2.1.5): Linux MPRIS 支持
- `@httptoolkit/dbus-native` (^0.1.3): Linux DBus 支持
- `electron-store` (^8.2.0): 持久化存储
- `electron-updater` (^6.6.2): 自动更新
- `discord-rich-presence` (^0.0.8): Discord 状态显示
- `dexie` (^4.0.11): IndexedDB 封装

### UI 相关

- `@mdi/font` (^7.4.47): Material Design Icons
- `vscode-codicons` (^0.0.17): VS Code Icons
- `plyr` (^3.7.8): 视频播放器
- `vue-pick-colors` (^1.8.0): 颜色选择器
- `vue-3-slider-component` (^1.0.2): 滑块组件
- `vue-draggable-plus` (^0.5.2): 拖拽组件
- `@vueform/multiselect` (^2.6.11): 多选组件
- `gsap` (^3.13.0): 动画库
- `vue3-lottie` (^3.3.1): Lottie 动画

### 工具库

- `dayjs` (^1.11.10): 日期处理
- `sharp` (^0.34.3): 图像处理
- `qrcode` (^1.5.3): 二维码生成
- `dompurify` (^3.1.6): XSS 防护
- `node-vibrant` (^4.0.0): 提取颜色
- `color` (^4.2.3): 颜色处理
- `iconv-lite` (^0.6.3): 字符编码
- `jschardet` (^3.1.4): 字符编码检测
- `mitt` (^3.0.1): 事件总线
- `fast-glob` (^3.3.3): 文件匹配
- `crypto-js` (^4.2.0): 加密库

## 注意事项

1. **原生模块编译**: better-sqlite3 和 taglib-wasm 需要重新编译，安装依赖后自动执行 `postinstall` 钩子
2. **Python 版本**: 某些原生模块编译需要 Python 3.9+，其他版本可能导致安装失败
3. **开发代理**: 开发模式下，代理服务器运行在 `http://127.0.0.1:40001`
4. **Git 忽略**: 确保 `.gitignore` 正确配置，避免提交 `dist/` 和 `node_modules/`
5. **跨平台**: 项目支持 Windows、macOS、Linux 三个平台，某些功能仅特定平台可用
6. **Electron 版本**: 通过 overrides 确保 vite-plugin-electron 使用项目指定的 Electron 版本
7. **Node.js 版本**: 要求 Node.js >= 22.6.0

## 参考项目

- [YesPlayMusic](https://github.com/qier222/YesPlayMusic) - 界面和功能参考
- "方格音乐" - 侧边导航栏设计参考
- [NSMusicS](https://github.com/Super-Badmen-Viper/NSMusicS) - 本地音乐信息统计参考
- [LDDC](https://github.com/chenmozhijin/LDDC) - 逐字歌词格式参考

## 许可证

MIT License - 本项目仅供个人学习研究使用，禁止用于商业及非法用途。

## 构建输出

构建后的输出目录结构：

```
dist/
├── main/          # 主进程代码
│   ├── index.js   # 主进程入口
│   └── workers/   # Web Workers
├── preload/       # 预加载脚本
└── renderer/      # 渲染进程资源
```

## 数据库迁移

数据库迁移脚本位于 `src/public/migrations/`：

- `init.sql` - 初始化脚本
- `1.5.0.sql` - 1.5.0 版本迁移
- `2.4.0.sql` - 2.4.0 版本迁移
- `2.5.0.sql` - 2.5.0 版本迁移

## 平台特定功能

### macOS

- Dock 集成（`dock.ts`）
- TouchBar 支持（`touchBar.ts`）
- 状态栏歌词
- 应用窗口透明效果

### Linux

- MPRIS 服务（`mpris.ts`）
- DBus 支持（`dbus.ts`, `dbusClient.ts`, `dbusService.ts`）
- 支持 media-controls 插件（GNOME）
- 支持 vutronmusic-lyrics 插件（KDE）

### Windows

- 任务栏缩略图按钮（`thumBar.ts`）
- 系统托盘（`tray.ts`）
- 自定义标题栏（`Win32TitleBar.vue`）
