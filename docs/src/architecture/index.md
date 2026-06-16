# 架构与数据流

## 三进程分工

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

## 插件调用链（写插件功能时必须遵守）

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

## 多源聚合数据流

同一首歌（一个 canonical Track）可同时拥有多个数据来源，各司其职：

```
Track（元数据）
  ├── Audio（本地 flac/mp3 文件）→ 播放源
  ├── TrackSource(pluginId='kugou') → 歌词获取
  └── TrackSource(pluginId='netease') → 评论、收藏
```

播放、歌词、评论、封面等功能可来自不同插件，互不依赖。

### 数据流示例：晴天

以周杰伦《晴天》为例，用户硬盘有 `~/Music/周杰伦/范特西/07 晴天.flac`：

1. **本地扫描**：创建 `Artist`(周杰伦) → `Album`(范特西) → `Track`(晴天, duration=269) → 关联关系 → `Audio` flac 文件
2. **匹配在线插件**：网易云匹配 → `TrackSource(trackId, pluginId='netease', sourceContext='{"id":186016}', matched=1)`；酷狗匹配 → `TrackSource(trackId, pluginId='kugou', sourceContext, matched=1)`
3. **播放时聚合**：播放源选 Audio 中 bitrate 最高的本地文件；歌词调 kugou 插件；评论调 netease 插件

若用户再添加同一首歌的 mp3 版本，归一化后标题/专辑/艺术家一致且时长误差 <1s，**不创建新 Track**，只新增一条 Audio 记录。

数据库详细表结构、SQL 定义、业务规则见 `docs/src/database/index.md`。

## 关键文件索引

| 功能 | 主进程 | 渲染进程 | 类型定义 |
| --- | --- | --- | --- |
| 数据库操作 | `db.ts` | — | `types/schemas.ts` |
| 数据库辅助层 | `dbHelpers.ts` | — | — |
| 插件核心引擎 | `utils/pluginManager.ts` | — | `types/plugin.ts` |
| 插件管理器 | `pluginManager.ts` | — | — |
| 插件注册表 | `Plugins` 表（plugin.sql） | — | `db.ts Tables` |
| IPC 通道 | `IPCs.ts` | — | — |
| 插件数据 store | — | `store/pluginMusic.ts` | — |
| 播放器核心 | — | `store/player.ts`, `store/audioEngine.ts` | — |
| 本地音乐 | `workers/scanMusic.ts` | `store/pluginMusic.ts` | — |
| 封面写入 | `workers/writeCover.ts` | — | — |
| 歌曲缓存 | `workers/cacheTrack.ts` | `store/player.ts` | — |
| 桌面歌词 | — | `osdLyric.ts`, `store/osdLyric.ts` | — |
| 设置/状态 | `store.ts`（electron-store） | `store/settings.ts`, `store/state.ts` | — |
| HTTP 服务 | `appServer/netease.ts`, `appServer/httpHandler.ts` | — | — |
| 6kLabs 服务 | `appServer/6kLabsAmuse.ts` | — | — |

## 双 tsconfig

- `tsconfig.json` → `src/renderer` + `src/types`（渲染进程）
- `tsconfig.node.json` → `src/main` + `src/preload`（主进程/Preload）
