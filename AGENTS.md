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

## 2. 重构状态

当前进度、待完善项、待定设计决策详见 `docs/src/migration-status.md`。

## 3. 架构与数据流

详见 `docs/src/architecture/index.md`。要点速览：

- **三进程**：main（数据库/IPC/Worker）/ preload（桥接）/ renderer（Vue/Pinia）
- **插件调用链**：renderer → invoke → main → Worker 线程 → Zod 验证 → 返回
- **多源聚合**：Track 关联多个 TrackSource，各司其职（播放/歌词/评论来自不同插件）
- **关键文件**：`IPCs.ts`、`pluginManager.ts`、`dbHelpers.ts`、`store/pluginMusic.ts`

## 4. Agent 决策优先级

1. 用户当前明确要求
2. docs/src/\* 规范文档
3. AGENTS.md
4. 当前代码实现
5. Agent 自行推断

若代码与规范冲突 → 以规范为准。若规范与用户要求冲突 → 先向用户确认。

## 5. 功能决策

新增功能时优先考虑：是否可通过插件实现 → 是否会破坏多源聚合架构 → 是否会增加 sourceContext 耦合 → 是否必须修改核心数据库 schema。

优先插件方案。除非用户明确要求，否则不要为单个平台编写特化逻辑。

## 6. 核心约束（不可违反）

### 6.1 sourceContext 是插件私有 JSON

框架层、其他插件、UI 层**不解析、不假设其字段结构**，原样传递即可。

### 6.2 元数据表只代表「用户拥有的歌曲」

`Track` / `Album` / `Artist` 只存储**用户本地实际拥有**的歌曲元数据。在线浏览/搜索的结果走 Zod 定义的结构在内存 / Pinia store 中，不落库。

### 6.3 本地去重保留括注

| 强度 | 条件                                      | 处理                        |
| ---- | ----------------------------------------- | --------------------------- |
| 强   | MusicBrainz Track ID 一致                 | 归并为同一 Track 的新 Audio |
| 中   | 归一化标题+专辑+艺术家相同，时长误差 ≤ 2s | 归并                        |
| 弱   | 仅部分匹配                                | 不作为同一 Track            |

**归一化**：trim 空格、全角/半角统一、忽略大小写。**不要去除 `(Live)` 等括注**。

### 6.4 DB 操作只能在主进程

渲染进程通过 IPC 间接访问，绝不直接 import `db.ts`。

### 6.5 插件返回结果必须过 Zod

不可跳过 `PluginResultSchema[method].parse()`。

### 6.6 PluginData.id 命名

统一为 `${pluginId}:${type}:${key}`。

### 6.7 不要恢复 migrate()

`migrate()` 已临时注释，不要新增依赖旧迁移流程的代码。

### 6.8 敏感信息不泄露

账号凭据、cookie、token 不写入日志、注释、示例代码、commit message。

## 7. 开发模式

详见 `docs/src/plugin-development/index.md`。要点速览：

- **快速迭代**：`yarn dev` → Vite HMR；改 main/preload/plugin 需重启
- **新增插件步骤**：创建 .js → 添加 Zod schema → 添加 defaultMap → store 中调用
- **插件方法清单**：60 个方法，见 `src/types/plugin.ts` 的 `PluginAPI` 和 `defaultMap`
- **插件目录**：`src/public/plugin/` 下 7 个插件
- **插件注册表**：`Plugins` 表（DB 驱动加载，内置 6 个插件种子数据）

## 8. 提交与验证

### 8.1 提交前自检

```
① yarn lint:fix && yarn format:fix
② yarn build:pre
③ 涉及 IPC / DB schema / 插件接口 / Store 持久化 → 建议额外 yarn test
```

### 8.2 禁区

- 不要手动修改：`dist/`、`out/`、构建产物、`node_modules/`
- 不要新增依赖旧迁移流程的数据库代码
- 不要自行恢复 `migrate()` 调用

## 9. 待定事项

见 `docs/src/migration-status.md` → 待定事项。

## 10. Communication

- 所有 agent 输出使用简体中文
- 代码注释使用简体中文
- Commit Message 使用简体中文
