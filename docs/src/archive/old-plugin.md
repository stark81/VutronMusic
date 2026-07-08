---
title: 旧插件系统
order: 5
---

# 旧插件系统

## 旧方案的问题

在 v3.3.0 之前，VutronMusic 的「插件系统」本质上是一个文件约定的模式：

```
src/public/plugin/[pluginId].js
  │
  ├─ 直接在主进程通过 require() 加载
  ├─ 所有插件运行在同一进程空间
  ├─ 没有沙箱隔离
  └─ 插件可以访问所有 Node.js API
```

| 问题          | 影响                              | 严重程度 |
| ------------- | --------------------------------- | -------- |
| 无隔离        | 一个插件的 crash 导致整个应用挂掉 | 🔴 高    |
| 无超时        | 插件死循环会卡死主进程            | 🔴 高    |
| 无域名限制    | 插件可以访问任意网络资源          | 🟡 中    |
| 无能力声明    | 框架不知道插件能做什么            | 🟡 中    |
| 插件只能用 JS | 虽然不是问题，但无扩展性          | 🟢 低    |

### 新旧对比

| 维度       | 旧系统             | 新系统 (v3.3.0)       |
| ---------- | ------------------ | --------------------- |
| 执行环境   | 主进程 (require)   | Worker 线程 (沙箱)    |
| 安全性     | 完全信任           | 域名白名单 + 受限 API |
| 通信方式   | 直接调用函数       | postMessage IPC       |
| 超时控制   | 无                 | 12 秒自动终止         |
| 结果校验   | 无                 | Zod Schema 校验       |
| 方法数量   | 部分实现           | 60 个统一 API         |
| 第三方插件 | 理论上可以但不安全 | 安全沙箱支持          |
| 插件热更新 | 不支持             | 仍不支持（待实现）    |

### 迁移兼容性

旧插件格式不能直接在新系统上运行。需要：

1. 将导出方式从 `module.exports` 改为 `exports.xxx`
2. 使用 `api.http` 替代直接发送 HTTP 请求
3. 使用 `api.store` 替代直接操作文件系统
4. 声明 `meta` 元数据

> 📖 详细的迁移指南见 [插件开发入门](../spec/architecture/plugin/getting-started)

---

## 技术参考

旧插件的加载方式（已弃用）：

```javascript
// 旧方式：主进程 direct require
const plugin = require(path.join(pluginDir, `${pluginId}.js`))
plugin.search(keyword) // 直接在主进程执行
```

新插件的加载方式：

```javascript
// 新方式：Worker 沙箱执行
const instance = new PluginInstance(pluginId, jsCode)
const result = await instance.call('search', { keyword })
```
