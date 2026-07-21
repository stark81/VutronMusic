---
last-updated: 2026-07-21
title: Worker 沙箱与插件执行
order: 8
last-reviewed: 2025-07-21
---

# Worker 沙箱与插件执行

## 为什么需要沙箱？

在插件化之前，所有功能代码都在主进程中直接运行。插件化的核心转变是：**从「信任代码」到「不信任代码」**。

| 产品问题              | 沙箱方案                      | 效果                      |
| --------------------- | ----------------------------- | ------------------------- |
| 插件 crash → App 挂掉 | 独立 Worker 线程              | 插件崩溃不影响主进程和 UI |
| 插件访问用户文件      | Worker 无 `fs` 模块           | 用户本地文件安全          |
| 插件发送恶意请求      | 域名白名单校验                | 只能向配置的服务器发请求  |
| 插件死循环            | 12 秒超时                     | 不会卡死整个 App          |
| 插件窃取其他插件数据  | store/db 按 pluginId 前缀隔离 | 数据隔离                  |

## 沙箱的代价

| 代价         | 缓解方案                          |
| ------------ | --------------------------------- |
| 插件功能受限 | 提供 `api.*` 工具函数覆盖常见需求 |
| 调用延迟     | 实际测试 <10ms，用户无感知        |
| 调试困难     | 日志全部转发到主进程统一输出      |

## 插件生命周期

```
注册 (create) → 加载 (load) → 运行 (call API)
                                │
                          ┌─────┴─────┐
                          │           │
                      禁用 (disable)  卸载 (destroy)
```

## 插件开发者的视图

```javascript
// 1. 声明元数据
exports.meta = { name: '我的插件', type: 'library', capabilities: { getLyric: true } }

// 2. 实现 API 方法
exports.search = async (params) => {
  const response = await api.http.get('/search', params)
  return { code: 200, data: response.data }
}

// 3. 通过 Zod Schema 保证返回格式正确
```

> 📖 详细开发指南见 [插件开发入门](../plugin/getting-started)

## 其他 Worker 类型

除了插件沙箱，项目还使用了以下 Worker：

| Worker | 文件 | 线程模型 | 用途 | 触发时机 |
| --- | --- | --- | --- | --- |
| 音乐扫描 | `src/main/workers/scanMusic.ts` | Piscina 线程池（2-6 线程） | 遍历文件、解析音频标签、批量写入 DB | 用户触发扫描或自动扫描 |
| 音频缓存 | `src/main/workers/cacheTrack.ts` | Node.js worker_threads（单例） | 下载在线歌曲到本地缓存 | `autoCacheTrack.enable` 开启时，每次播放触发 |
| 封面写入 | `src/main/workers/writeCover.ts` | Node.js worker_threads（单例） | 将匹配到的封面嵌入本地文件 | 精确匹配成功且有封面时 |
| 封面写入 | `src/main/workers/writeCover.ts` | Node.js worker_threads（单例） | 将匹配到的封面嵌入本地文件 | 精确匹配成功且有封面时 |

Piscina 是线程池方案，用于并行扫描大量文件；后两者是单 Worker 线程，用于处理队列型任务。

## 技术参考

| 文件                               | 角色                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| `src/main/pluginManager.ts`        | 全局单例（23 行），管理 Map&lt;PluginId, PluginInstance&gt; |
| `src/main/utils/pluginManager.ts`  | PluginInstance 类实现：每个插件一个实例，持有 Worker        |
| `src/main/workers/pluginRunner.ts` | Worker 入口：执行插件代码 + 实现 api 对象                   |

**PluginInstance 核心逻辑**：分配 callId → worker.postMessage() → 12 秒超时 → Promise resolve/reject。

**Worker 运行时**：接收 LOAD_PLUGIN 消息 → `new Function('api', 'exports', code)` → 接收 CALL_METHOD → 返回 CALL_RESULT。

| 错误类型     | 触发条件                | 前端表现               |
| ------------ | ----------------------- | ---------------------- |
| TimeoutError | 插件 12 秒未返回        | 「插件响应超时」       |
| DomainError  | HTTP 域名不在白名单     | 「请求被安全策略拦截」 |
| HttpError    | HTTP 请求失败           | 网络错误提示           |
| SchemaError  | 返回值不符合 Zod Schema | 「数据格式异常」       |
