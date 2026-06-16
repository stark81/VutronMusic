# VutronMusic AI 编程规范

本文档为 AI 编码助手提供项目编程规范参考。

## 规范文档索引

| 文档       | 路径                                 | 内容                                   |
| ---------- | ------------------------------------ | -------------------------------------- |
| 数据库设计 | `docs/src/database/index.md`         | 表结构、SQL 定义、业务规则、待定事项   |
| 插件系统   | `docs/src/plugin-system/index.md`    | 插件架构、Zod 验证、sourceContext 规范 |
| Store 模式 | `docs/src/stores/index.md`           | Pinia Composition API 风格、持久化策略 |
| 代码风格   | `docs/src/code-conventions/index.md` | Prettier/ESLint/TypeScript 配置        |
| UI 设计    | `docs/src/ui-design/index.md`        | 布局、组件、主题、样式规范             |

## 快速参考

### 数据库核心概念

- canonical 实体表（Track/Album/Artist）只存储用户拥有的歌曲
- sourceContext 是不透明 JSON 字符串，框架层不解析
- 多源聚合：一首歌可有多个数据来源

### 插件调用链

```
Renderer → mainApi.invoke('plugin-method-call', pluginId, methodName, ...args)
         → Main process routes to plugin
         → Zod schema validation
         → Renderer receives typed result
```

### 代码风格

- Prettier：无分号、单引号、无尾逗号、LF 换行、2 空格缩进
- 路径别名：`@/*` → `./src/*`
- Vue 组件：PascalCase 文件名
- Store 文件：camelCase 文件名

### UI 布局

- SideNav（左侧）+ NavBar（顶部）+ PlayerBar（底部）+ PlayPage（全屏覆盖）
- 毛玻璃效果：`backdrop-filter: saturate(180%) blur(20px)`
- CSS 变量驱动主题切换

## 使用说明

1. 修改数据库 schema 前，先阅读 `docs/src/database/index.md`
2. 开发插件前，先阅读 `docs/src/plugin-system/index.md`
3. 创建 store 前，先阅读 `docs/src/stores/index.md`
4. 开发 UI 组件前，先阅读 `docs/src/ui-design/index.md`
5. 所有代码必须遵循 `docs/src/code-conventions/index.md` 中的规范
