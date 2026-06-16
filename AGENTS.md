# AGENTS.md

VutronMusic — 插件化架构的桌面音乐播放器。本文档指导 AI 编码助手在 vibe coding 中做出与项目设计一致的正确决策。

---

## 1. 项目速览

| 维度         | 内容                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| **定位**     | 多数据源桌面音乐播放器（本地、网易云、酷狗、Navidrome/Emby/Jellyfin）     |
| **版本**     | v3.3.0（插件化重构中）                                                    |
| **Stack**    | Electron 37 + Vue 3 + TypeScript + Pinia + Fastify + better-sqlite3 + Zod |
| **包管理**   | Yarn 1.22.22，Node >= 22.6.0                                              |
| **路径别名** | `@/*` → `./src/*`                                                         |

### 启动流程

```
Electron 启动 → main/index.ts → 创建窗口 → 加载 renderer/index.html
                      ↓
               IPCs.initialize() → 注册所有 IPC handler
                      ↓
               initPluginIpcMain() → 扫描 src/public/plugin/*.js
                      ↓
               每个插件 → new PluginInstance(file, id) → Worker 线程加载
                      ↓
               IPC 通道就绪 → 渲染进程可调用插件方法
```

---

## 2. 重构状态地图

项目从 v3.3.0 起将「网易云单一数据源」重构为「多插件聚合架构」。当前迁移进度如下：

### ✅ 已完成的迁移

- [x] 数据库 schema 多源化（Track/Album/Artist + Source 映射表体系）
- [x] 插件系统基础框架（PluginManager + Worker 线程执行引擎）
- [x] 插件调用链（renderer → invoke → main → worker → Zod 验证 → 返回）
- [x] 网易云插件（netease）完整功能
- [x] 酷狗插件（kugou）歌词/封面补充功能
- [x] Navidrome 插件（navidrome）主体功能
- [x] Emby 插件（emby）初步功能
- [x] 探索页、歌单、专辑、歌手页面迁移
- [x] 评论功能迁移
- [x] MPRIS/Linux 集成修复
- [x] 各插件返回值统一 albumArtist 字段适配

### 🔄 迁移中 / 待完善

- [ ] Jellyfin 插件功能完善
- [ ] 听歌历史插件化适配
- [ ] 搜索 - 按歌词搜索的插件化
- [ ] 跨平台匹配的 UI 确认流程
- [ ] 插件卸载清理 + 孤儿 Track 垃圾回收
- [ ] 自建流媒体与线上流媒体信息匹配

### 🏛️ 注意：旧写法残留区域

以下模块可能仍使用重构前的写法，**不要参照复制**：

- local 插件当前为 `local.js_bak`，尚未完成迁移
- `src/main/streaming/` 下的 navidrome/emby/jellyfin 是旧版流媒体处理逻辑，新功能应通过插件系统实现
- `src/main/plugin/` 目录当前为空

---

## 3. 架构与数据流

### 3.1 三进程分工

```
src/
  main/          → Electron 主进程（entry: src/main/index.ts）
                   数据库、文件系统、网络请求、插件 Worker 管理
  preload/       → Preload 脚本（IPC 桥接，暴露 mainApi）
  renderer/      → Vue 3 前端（entry: src/renderer/main.ts）
                   UI 组件、Pinia store、路由
  types/         → 共享 TypeScript 类型 + Zod schema 定义
```

**关键规则**：

- 渲染进程**绝不直接访问**数据库或文件系统
- 所有 DB 操作、网络请求、文件读写必须在主进程完成
- 渲染进程通过 `window.mainApi.invoke()` / `.send()` 与主进程通信

### 3.2 插件调用链（写插件功能时必须遵守）

```
渲染进程 store/pluginMusic.ts
   │  window.mainApi.invoke('plugin-method-call', pluginId, methodName, ...args)
   ▼
preload → ipcRenderer.invoke
   ▼
main/IPCs.ts → initPluginIpcMain()
   │  根据 pluginId 从 pluginManager 获取 PluginInstance
   │  调用 plugin.call(methodName, params)
   ▼
PluginInstance → Worker 线程内的插件代码执行
   │  插件通过 worker.postMessage 返回结果
   ▼
main/IPCs.ts → Zod schema 验证
   │  PluginResultSchema[method].parse(result)
   ▼
渲染进程收到类型化结果（TypeScript 类型由 PluginAPI 保证）
```

**不可违反**：

- 所有插件方法返回值必须经过 `PluginResultSchema[method].parse()` 验证，不可跳过
- 插件在 Worker 线程中运行，通过消息机制与主进程通信（HTTP_REQUEST / STORE_REQUEST / DB_REQUEST / LYRIC_PARSE 等消息类型）
- 新增插件方法时，必须在 `src/types/schemas.ts` 的 `PluginResultSchema` 中注册对应的 Zod schema

### 3.3 多源聚合数据流

同一首歌（一个 canonical Track）可同时拥有多个数据来源，各司其职：

```
Track（元数据）
  ├── Audio（本地 flac/mp3 文件）→ 播放源
  ├── TrackSource(pluginId='kugou') → 歌词获取
  └── TrackSource(pluginId='netease') → 评论、收藏
```

播放、歌词、评论、封面等功能可来自不同插件，互不依赖。

#### 数据流示例：晴天

以周杰伦《晴天》为例，用户硬盘有 `~/Music/周杰伦/范特西/07 晴天.flac`：

1. **本地扫描**：创建 `Artist`(周杰伦) → `Album`(范特西) → `Track`(晴天, duration=269) → 关联关系 → `Audio` flac 文件
2. **匹配在线插件**：网易云匹配 → `TrackSource(trackId, pluginId='netease', sourceContext='{"id":186016}', matched=1)`；酷狗匹配 → `TrackSource(trackId, pluginId='kugou', sourceContext, matched=1)`
3. **播放时聚合**：播放源选 Audio 中 bitrate 最高的本地文件；歌词调 kugou 插件；评论调 netease 插件

若用户再添加同一首歌的 mp3 版本，归一化后标题/专辑/艺术家一致且时长误差 <1s，**不创建新 Track**，只新增一条 Audio 记录。

数据库详细表结构、SQL 定义、业务规则见 `docs/src/database/index.md`。

### 3.4 关键文件索引

| 功能 | 主进程 | 渲染进程 | 类型定义 |
| --- | --- | --- | --- |
| 数据库操作 | `db.ts`, `cache.ts` | — | `types/schemas.ts` |
| 插件核心引擎 | `utils/pluginManager.ts` | — | `types/plugin.ts` |
| 插件管理器 | `pluginManager.ts` | — | — |
| IPC 通道 | `IPCs.ts` | — | — |
| 插件数据 store | — | `store/pluginMusic.ts` | — |
| 播放器核心 | — | `store/player.ts`, `store/audioEngine.ts` | — |
| 本地音乐 | `workers/scanMusic.ts` | `store/localMusic.ts` | — |
| 流媒体 | `streaming/`（旧版） | `store/streamingMusic.ts` | — |
| 桌面歌词 | — | `osdLyric.ts`, `store/osdLyric.ts` | — |
| 设置/状态 | `store.ts`（electron-store） | `store/settings.ts`, `store/state.ts` | — |
| 应用服务 | `appServer/netease.ts` 等 | — | — |

### 3.5 双 tsconfig

- `tsconfig.json` → `src/renderer` + `src/types`（渲染进程）
- `tsconfig.node.json` → `src/main` + `src/preload`（主进程/Preload）

---

## 4. Agent决策优先级

当多个信息来源冲突时，按以下优先级处理：

1. 用户当前明确要求
2. docs/src/\* 规范文档
3. AGENTS.md
4. 当前代码实现
5. Agent 自行推断

若代码与规范冲突：以规范为准。

若规范与用户要求冲突：先向用户确认。

## 5. 功能决策

新增功能时优先考虑：

1. 是否可通过插件实现
2. 是否会破坏多源聚合架构
3. 是否会增加 sourceContext 耦合
4. 是否必须修改核心数据库 schema

若插件方案与核心改造方案均可实现：

优先插件方案。

除非用户明确要求，否则不要为单个平台（网易云、酷狗等）编写特化逻辑。

## 6. 核心约束（不可违反）

### 6.1 sourceContext 是插件私有、不透明的 JSON

框架层、其他插件、UI 层**不解析、不假设其字段结构**，原样传递即可。

- Track 的 sourceContext：重新获取该对象的最小上下文
  - 网易云：`{"id": 186016}`
  - 酷狗：`{"hash": "...", "mixsongid": "...", "album_audio_id": "...", "fileid": "..."}`
- Album 的 sourceContext：最小上下文 + 分页等后续操作所需信息

### 6.2 元数据表只代表「用户拥有的歌曲」

`Track` / `Album` / `Artist` 三张表只存储**用户本地实际拥有**的歌曲元数据。在线浏览/搜索的结果**不落库**，走 Zod 定义的结构在内存 / Pinia store 中。

### 6.3 本地去重保留括注

信号强度分层判断：

| 强度 | 条件                                            | 处理                            |
| ---- | ----------------------------------------------- | ------------------------------- |
| 强   | 内嵌 MusicBrainz Track ID 一致                  | 自动归并为同一 Track 的新 Audio |
| 中   | 归一化后标题+专辑+艺术家相同，且时长误差 ≤ 1~2s | 自动归并                        |
| 弱   | 仅部分匹配                                      | 不作为同一 Track                |

**归一化规则**：trim 空格、统一全角/半角字符、忽略大小写。**不要去除 `(Live)`、`(Remastered)` 等括注**——这些是区分版本的有效信号。

### 6.4 DB 操作只能在主进程

渲染进程通过 IPC 间接访问，绝不直接 import `db.ts`。

### 6.5 插件返回结果必须过 Zod

不可在插件实现里直接 return 原始对象，必须经过 `PluginResultSchema[method].parse()`。

### 6.6 PluginData.id 命名格式

统一为 `${pluginId}:${type}:${key}`。

### 6.7 不要手动恢复 migrate()

数据库迁移机制处于过渡状态，`migrate()` 已临时注释，不要新增依赖旧迁移流程的代码。

### 6.8 敏感信息不泄露

各插件涉及的账号凭据、cookie、token：不写入日志、注释、示例代码、commit message，不硬编码在源码中。

---

## 7. 开发模式

### 7.1 快速迭代流程（vibe coding 友好）

```
yarn dev → 启动 Vite HMR + Electron

改 renderer/（Vue/TS）→ Vite 热更新，页面自动刷新
改 main/（主进程）    → 需要手动重启 Electron（Ctrl+C → 重跑 yarn dev）
改 preload/          → 需要重启 Electron
改 public/plugin/*.js → 需要重启 Electron（插件在 Worker 中初始化时加载）
```

### 7.2 新增插件或方法的标准步骤

```
① 在 src/public/plugin/ 下创建 <name>.js
② 在 src/types/schemas.ts 中给 PluginResultSchema 添加方法的 Zod schema
③ 在 src/types/plugin.ts 的 defaultMap 中添加默认返回值（code: 404）
④ `PluginAPI` 和 `PluginMethodCall` 类型会自动从 `PluginResultSchema` 推导，无需手动声明
⑤ 在 src/renderer/store/pluginMusic.ts 中添加调用方法
⑥ 插件实现遵循 Worker 消息通信模式（HTTP_REQUEST / STORE_REQUEST / DB_REQUEST）
```

### 7.3 插件实现要点

- 插件运行在 Worker 线程中，不能直接访问 electron API
- 网络请求通过向主进程发送 `HTTP_REQUEST` 消息完成（见 `PluginInstance.handleHttp()`）
- 持久化存储通过 `STORE_REQUEST`/`DB_REQUEST` 消息完成
- 歌词解析通过 `LYRIC_PARSE` 消息由主进程处理
- 插件通过 `call(methodName, params)` 暴露方法供外部调用

### 7.4 已注册的插件方法

所有插件方法的完整列表见 `src/types/plugin.ts` 的 `PluginAPI` 类型和 `defaultMap`。每个方法都有：

- `params`：传入参数类型
- `result`：返回值类型（经过 Zod 验证）

当前已注册方法（不完整列表，完整以代码为准）： `updateBaseUrl`, `getAccount`, `search`, `getSongUrl`, `getLyric`, `getBanner`, `userPlaylist`, `getPlaylistDetail`, `getPlaylistTracks`, `songUrl`, `loginQrKey`, `loginQrCodeCheck`, `albumDetail`, `artistDetail`, `artistAlbums`, `getComments`, `likeATrack` 等约 50 个方法。

### 7.5 已知陷阱

| 陷阱                     | 说明                                                         |
| ------------------------ | ------------------------------------------------------------ |
| postinstall 触发 rebuild | `yarn install` 后自动执行 `electron-rebuild`，可能耗时较长   |
| taglib-wasm 需 fix       | 安装或 rebuild 后执行 `node fix-taglib-wasm.js`              |
| fix-sandbox.js           | Linux 上需要以设置 chrome-sandbox 权限                       |
| Electron 版本锁定        | 在 `package.json.overrides` 中，改版本需同步改               |
| Worker 线程限制          | 插件在 Worker 中运行，不能访问 `require('electron')`、DOM 等 |
| 插件热重载               | 目前不支持，改插件代码需重启应用                             |
| constants 使用           | `Constants.IS_DEV_ENV` 用于判断开发/生产环境路径             |

### 7.6 插件目录

- 开发环境：`src/public/plugin/`（fs 读取）
- 生产环境：`app.getPath('userData')/plugins/`（用户上传）
- 当前插件列表（`src/public/plugin/`）：
  - `netease.js` — 网易云音乐
  - `kugou.js` — 酷狗音乐（歌词/封面补充）
  - `navidrome.js` — Navidrome 流媒体
  - `emby.js` — Emby 流媒体
  - `jellyfin.js` — Jellyfin 流媒体
  - `demo.js` — 示例插件（不会被加载）
  - `local.js_bak` — 本地音乐（迁移中）

---

## 8. 提交与验证

### 8.1 提交前自检

按顺序执行：

```
① yarn lint:fix && yarn format:fix   修复风格/格式问题
② yarn build:pre                     类型检查 + Vite 构建
③ 涉及 IPC / DB schema / 插件接口 / Store 持久化 → 建议额外执行 yarn test
```

### 8.2 Commit 规范

（当前实践）使用中文祈使句简洁描述，例如：

- 「修复歌词同步偶发延迟」
- 「新增酷狗插件专辑跳转支持」
- 「完成 navidrome 部分功能迁移」

避免「update」「fix bug」「change」等无信息量的描述。

> **待定**：是否采用 Conventional Commits、分支命名规则尚未明确。

### 8.3 禁区

- 不要手动修改：`dist/`、`out/`、构建产物、`node_modules/`
- 不要新增依赖旧迁移流程的数据库代码
- 不要自行恢复 `migrate()` 调用

---

## 9. 规范文档索引

项目有详细的规范文档，位于 `docs/src/`：

| 文档       | 路径                                 | 内容                                     |
| ---------- | ------------------------------------ | ---------------------------------------- |
| 数据库设计 | `docs/src/database/index.md`         | 表结构、SQL 定义、业务规则、多源聚合架构 |
| 插件系统   | `docs/src/plugin-system/index.md`    | 插件架构、Zod 验证、sourceContext        |
| Store 模式 | `docs/src/stores/index.md`           | Pinia 风格、持久化策略                   |
| UI 设计    | `docs/src/ui-design/index.md`        | 布局、组件、主题、样式规范               |
| 代码风格   | `docs/src/code-conventions/index.md` | Prettier/ESLint/TypeScript 配置          |

**使用规则**：

- 修改数据库 schema → 先读 `docs/src/database/index.md`
- 修改插件系统 → 先读 `docs/src/plugin-system/index.md`
- 修改 store → 先读 `docs/src/stores/index.md`
- 修改 UI 组件 → 先读 `docs/src/ui-design/index.md`
- 若代码与规范文档不一致 → **以规范文档为准**，旧代码可能尚未迁移
- 若规范文档缺失/过时 → 告知用户"该领域规范暂缺/过时"
- 注意，当实现相关功能前，务必操作上述规范文档

---

## 10. 待定事项

以下事项标记为「待定」，AI 遇到时必须先提方案、等你确认后再实现：

| 事项                          | 涉及文档 | 现状                                            |
| ----------------------------- | -------- | ----------------------------------------------- |
| canonical id 生成策略         | 数据库   | UUID / 归一化元数据 hash / 自增ID？             |
| Album/Artist 本地去重规则     | 数据库   | 第5节只细化了 Track 层级                        |
| 跨平台匹配触发时机与 UI       | 数据库   | 自动搜索 vs 用户手动确认的流程                  |
| sourceContext 反向查找        | 数据库   | 是否约定所有插件 sourceContext 包含统一 id 字段 |
| Playlist / PlaylistEntry 设计 | 数据库   | 本轮重构暂未涉及                                |
| 插件卸载清理                  | 数据库   | 删除 Source/Lyrics/PluginData + 孤儿 GC         |
| 迁移机制                      | 数据库   | `migrate()` 临时注释，重构完成后需重新设计      |
| commit message 格式           | AGENTS   | 是否采用 Conventional Commits？                 |
| 分支命名规则                  | AGENTS   | 尚未明确                                        |
| yarn test 覆盖范围            | AGENTS   | 强制触发条件待细化                              |

---

## 11. Communication

- 所有 agent 输出使用简体中文
- 代码注释使用简体中文
- Commit Message 使用简体中文
- 用户可显式要求其他语言
