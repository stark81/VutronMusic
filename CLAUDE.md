# VutronMusic — CLAUDE.md

## 每次会话启动时必读

- 开始新任务前，先阅读 **AGENTS.md** 了解项目架构、约束和当前重构状态
- 根据任务类型，阅读 `docs/src/` 下对应的规范文档：
  - 数据库相关 → `docs/src/database/index.md`
  - 插件系统相关 → `docs/src/plugin-system/index.md`
  - Store/Pinia 相关 → `docs/src/stores/index.md`
  - UI 相关 → `docs/src/ui-design/index.md`
  - 代码风格相关 → `docs/src/code-conventions/index.md`

## Agent 决策优先级

1. 用户当前明确要求
2. docs/src/\* 规范文档
3. AGENTS.md
4. 当前代码实现
5. Agent 自行推断

若代码与规范冲突 → 以规范为准。若规范与用户要求冲突 → 先向用户确认。

## 核心约束速查

- 新增功能优先通过插件方案实现
- 插件返回值必须经过 Zod 验证（`PluginResultSchema[method].parse()`）
- DB 操作只能在主进程，渲染进程通过 IPC 通信
- `sourceContext` 是插件私有 JSON，框架层不解析其字段结构
- 不要恢复 `migrate()` 调用
- 提交前执行 `yarn lint:fix && yarn format:fix && yarn build:pre`

完整约束见 `AGENTS.md`。
