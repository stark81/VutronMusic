---
last-updated: 2026-07-21
title: 开发工作流
order: 2
last-reviewed: 2025-07-21
---

# 开发工作流

## 快速迭代

```
yarn dev → 启动 Vite HMR + Electron

改 renderer/（Vue/TS）→ 页面自动刷新（无需重启）
改 main/（主进程）     → 需要手动重启 Electron
改 preload/          → 需要重启 Electron
改 public/plugin/*.js → 需要重启 Electron
```

**测试**: `yarn playwright test`（e2e，单文件 `tests/app.spec.ts`）

## 新增插件或方法的标准步骤

```
① 在 src/public/plugin/ 下创建 <name>.js
② 在 src/types/schemas.ts 中给 PluginResultSchema 添加方法的 Zod schema
③ 在 src/types/plugin.ts 的 defaultMap 中添加默认返回值（code: 404）
④ PluginAPI 和 PluginMethodCall 类型会自动从 PluginResultSchema 推导
⑤ 在 src/renderer/store/pluginMusic.ts 中添加调用方法
⑥ 插件实现遵循 Worker 消息通信模式
```

## 关键文件索引

### 主进程 (`src/main/`)

| 文件               | 职责                                         | 大小/备注         |
| ------------------ | -------------------------------------------- | ----------------- |
| `index.ts`         | BackGround 单例，初始化链路（见 startup.md） | 入口文件          |
| `IPCs.ts`          | 6 组 IPC 通道                                | ~66KB             |
| `db.ts`            | better-sqlite3 初始化 + 建表                 | 数据库入口        |
| `dbHelpers.ts`     | 数据库查询（CRUD/去重/匹配）                 | ~46KB             |
| `pluginManager.ts` | 全局插件管理器                               | Map<id, Instance> |
| `workers/`         | Worker 线程（插件执行/缓存/扫描）            | 沙箱隔离          |
| `cache.ts`         | 🗑️ 已废弃，无任何引用，可删除                | 遗留缓存类        |

**`utils/index.ts`（17KB）核心导出函数索引**：

| 分类 | 函数 | 用途 |
| --- | --- | --- |
| **文件操作** | `isFileExist`, `createDirIfNotExist`, `createFileIfNotExist` | 底层文件系统工具 |
| **封面/图片** | `getPic(track)` | 从多种来源提取封面（嵌入/路径/网络 API），统一返回 Buffer |
|  | `getPicFromApi(url)`, `getPicFromEmbedded(filePath)`, `getPicFromPath(filePath)` | 三种封面源的独立方法 |
|  | `getPicColor(pic)` | 提取封面图的主色调（用于主题/背景着色） |
| **歌词** | `getLyricFromMetadata(metadata)` | 从音频元数据标签提取歌词（支持 ID3v2/USLT/Vorbis/APEv2） |
|  | `getLyricFromEmbedded(filePath)`, `getLyricFromPath(filePath)` | 从音频文件嵌入/同路径 .lrc 获取歌词 |
|  | `parseLyricString(lyrics)` | 通用歌词解析器（自动识别 LRC/YRC/WRC 格式） |
|  | `yrcLyricParse(data)`, `lrcLyricParse(data)` | 逐字(YRC) / 逐行(LRC) 专用解析 |
| **缓存管理** | `deleteExcessCache(deleteAll?)` | 清理超出缓存限制的音频缓存 |
| **工具** | `formatTime(time, rate?)` | 毫秒/时间戳格式化 |
|  | `cleanFontName(fontName)` | 清理字体名称 |
|  | `createWorker(name)` | 创建 Worker 线程工厂函数 |

### 渲染进程 (`src/renderer/`)

| 模块          | 文件数 | 说明                            |
| ------------- | ------ | ------------------------------- |
| `store/`      | 8 个   | Pinia Store 管理全局状态        |
| `views/`      | 17 个  | 页面视图组件（含 1 个独立窗口） |
| `components/` | ~63 个 | UI 组件                         |
| `locales/`    | 3 种   | zh-hans / zh-hant / en          |

### 类型定义 (`src/types/`)

| 文件         | 内容                                                   |
| ------------ | ------------------------------------------------------ |
| `plugin.ts`  | PluginAPI 接口（62 个方法，含 2 个已注释）+ defaultMap |
| `schemas.ts` | PluginResultSchema Zod 定义 + 领域模型                 |

## 提交前自检

```
① yarn lint:fix && yarn format:fix
② yarn build:pre
③ 涉及 IPC / DB schema / 插件接口 / Store 持久化 → 额外 yarn test
④ 修改了核心代码后，检查对应文档的 `last-reviewed` 是否已过时 → 更新日期或修正内容
```

## 禁区

- ❌ 不要手动修改 `dist/`、`out/`、构建产物、`node_modules/`
- ❌ 不要新增依赖旧迁移流程的数据库代码
- ❌ 不要自行恢复 `migrate()` 调用
- ❌ 渲染进程不要直接 `import` 主进程模块（`db.ts` 等）
- ❌ 不要将账号凭据、cookie、token 写入日志/注释/commit message
