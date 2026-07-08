# VutronMusic

多数据源桌面音乐播放器，基于 Electron + Vue3 + TypeScript。

## 技术栈

- **桌面框架**: Electron 37
- **前端**: Vue 3 + TypeScript + Vite 5
- **状态管理**: Pinia (persist: pinia-plugin-persistedstate)
- **路由**: Vue Router 4 (Hash 模式)
- **数据库**: better-sqlite3 (主进程) + Dexie (渲染进程 IndexedDB)
- **内嵌服务**: Fastify (端口 40001 dev / 41830 prod)
- **插件沙箱**: Node.js Worker 线程
- **数据校验**: Zod
- **音频**: Web Audio API + SoundTouchJS + Plyr
- **国际化**: vue-i18n (zh-hans / zh-hant / en)
- **打包**: electron-builder (dmg/nsis/portable/deb/rpm/AppImage/snap)

## 快速命令

```bash
yarn install     # 安装依赖
yarn dev         # 开发模式
yarn build       # 生产构建
yarn lint        # 代码检查
```

## 会话启动协议

1. 先阅读本文件（AGENTS.md）了解项目架构、约束和当前状态
2. 根据任务类型，查阅 `docs/src/` 下对应文档（按需，不是全读）：
   - 产品理念/功能设计 → `docs/src/product/`
   - 数据库/插件/架构技术规格 → `docs/src/spec/architecture/`
   - 开发工作流 → `docs/src/spec/architecture/workflow`
   - 开发环境搭建 → `docs/src/spec/architecture/env-setup`
   - Store/状态 → `docs/src/spec/architecture/stores`
   - 组件 → `docs/src/spec/architecture/components`
   - 路由 → `docs/src/spec/architecture/router`
   - 代码规范 → `docs/src/spec/architecture/code-conventions`
   - 类型系统 → `docs/src/spec/architecture/types`
   - 主进程启动序列 → `docs/src/spec/architecture/startup`
   - 国际化 → `docs/src/spec/integrations/i18n`
   - 架构决策 → `docs/src/adr/`
   - **文档新鲜度**：每个文档 frontmatter 中的 `last-reviewed` 字段标注了最近一次审核日期。若日期早于你关心的代码变更时间，请以实际代码为准。

## 任务类型 → 查阅文档对照表

| 你想做什么 | 先读什么 | 关键文件 |
| --- | --- | --- |
| 理解产品理念和功能设计 | `docs/src/product/` | — |
| 首次搭建开发环境 | `docs/src/spec/architecture/env-setup` | — |
| 改数据库查询/Schema | `docs/src/spec/architecture/database/` | `src/main/dbHelpers.ts` |
| 新增插件 / 改插件方法 | `docs/src/spec/architecture/plugin/` | `types/` → `schemas` → `public/plugin/` |
| 新增 IPC 通道 | `docs/src/spec/architecture/ipc/` | `src/main/IPCs.ts` + `src/preload/` |
| 新增 UI 页面/组件 | `docs/src/spec/architecture/components` + `docs/src/spec/architecture/code-conventions` | `src/renderer/views/` + `src/renderer/components/` + router 配置 |
| 新增路由 | `docs/src/spec/architecture/router` | `src/renderer/router/index.ts` |
| 修改 Store / 状态管理 | `docs/src/spec/architecture/stores` | `src/renderer/store/` |
| 新增翻译/语言 | `docs/src/spec/integrations/i18n` | `src/renderer/locales/` |
| 理解双类型系统 | `docs/src/spec/architecture/types` | `src/types/music.d.ts` + `src/types/schemas.ts` |
| 理解主进程启动流程 | `docs/src/spec/architecture/startup` | `src/main/index.ts` |
| 理解架构决策 | `docs/src/adr/` | — |
| 首次跑项目 | `docs/src/spec/architecture/workflow` | — |
| 构建/打包/发布 | `docs/src/spec/architecture/build-release` | `buildAssets/builder/config.js` |
| 排错 | `docs/src/troubleshooting/` | — |

## 目录结构

```
src/
├── main/          # Electron 主进程
│   ├── index.ts           # 入口: BackGround 单例
│   ├── IPCs.ts            # 7 组 IPC 通道
│   ├── db.ts              # better-sqlite3 初始化
│   ├── dbHelpers.ts       # 数据库查询 (46KB)
│   ├── pluginManager.ts   # 全局插件管理器
│   ├── workers/           # Worker 线程 (插件执行/缓存/扫描)
│   └── appServer/         # Fastify 路由 (网易云 API 代理)
├── preload/       # contextBridge 桥接
├── renderer/      # Vue 3 前端
│   ├── store/     # 9 个 Pinia stores
│   ├── views/     # 18 个页面视图 (含 1 个独立窗口: OSDLyric)
│   ├── components/ # ~61 个组件
│   ├── api/       # 前端 API 调用 (album/artist/playlist...)
│   └── locales/   # i18n (zh-hans/zh-hant/en)
├── types/         # TS 类型 + Zod Schema（见 types.md 了解双类型系统）
	│   ├── plugin.ts  # PluginAPI 接口（62 个方法，含 2 个已注释）
	│   ├── schemas.ts # PluginResultSchema + Zod 领域模型
	│   └── music.d.ts # DB 层平面类型接口
└── public/plugin/ # 7 个内置插件
    ├── netease.js (library)  # 网易云音乐
    ├── kugou.js   (library)  # 酷狗音乐
    ├── emby.js    (stream)   # Emby
    ├── jellyfin.js(stream)   # Jellyfin
    ├── navidrome.js(stream)  # Navidrome
    ├── local.js   (local)    # 本地音乐
    └── demo.js    (demo)     # 演示插件
```

## 核心约束（不可违反）

### 1. sourceContext 是插件私有 JSON

框架层、其他插件、UI 层**不解析、不假设其字段结构**，原样传递即可。

### 2. 元数据表只代表「用户拥有的歌曲」

`Track` / `Album` / `Artist` 只存储**用户本地实际拥有**的歌曲元数据。在线浏览/搜索的结果走 Zod 定义的结构在内存 / Pinia store 中，不落库。

### 3. 本地去重保留括注

| 强度 | 条件                                      | 处理                        |
| ---- | ----------------------------------------- | --------------------------- |
| 强   | MusicBrainz Track ID 一致                 | 归并为同一 Track 的新 Audio |
| 中   | 归一化标题+专辑+艺术家相同，时长误差 ≤ 2s | 归并                        |
| 弱   | 仅部分匹配                                | 不作为同一 Track            |

归一化：trim 空格、全角/半角统一、忽略大小写。**不要去除 `(Live)` 等括注**。

### 4. DB 操作只能在主进程

渲染进程通过 IPC 间接访问，绝不直接 import `db.ts`。

### 5. 插件返回结果必须过 Zod

不可跳过 `PluginResultSchema[method].parse()`。

### 6. PluginData.id 命名规范

插件的 PluginData 键名前缀为 `{pluginId}:`，避免跨插件冲突。

### 7. 不要恢复 `migrate()` 调用

数据库迁移逻辑已内置于 `db.ts`，不要手动恢复或修改 `migrate()` 调用。

## Agent 决策优先级

1. 用户当前明确要求
2. `docs/src/*` 规范文档
3. AGENTS.md（本文件）
4. 当前代码实现
5. Agent 自行推断

若代码与规范冲突 → 以规范为准。若规范与用户要求冲突 → 先向用户确认。

## 功能决策

新增功能时优先考虑：是否可通过**插件实现** → 是否会**破坏多源聚合架构** → 是否会**增加 sourceContext 耦合** → 是否必须**修改核心数据库 Schema**。

优先插件方案。除非用户明确要求，否则不要为单个平台编写特化逻辑。

## 文档

产品文档在 `docs/src/`，通过 VitePress 构建：

```bash
cd docs && yarn dev    # 本地预览
cd docs && yarn build  # 生产构建
```

按任务类型查阅对应文档：

- 产品文档 → `docs/src/product/`
- 技术规格 → `docs/src/spec/`
- 架构决策 → `docs/src/adr/`
