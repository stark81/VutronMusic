---
last-updated: 2026-07-26
title: 插件开发入门
order: 7
---

# 插件开发入门

## 设计目标

让有 JavaScript 基础的开发者在 **10 分钟内写出一个能运行的插件**。

## 一个插件就是 .js 文件

不需要 TypeScript、不需要构建工具、不需要 npm install。一个标准的插件就是一个 CommonJS 模块，通过 `exports` 暴露 `meta` 和能力方法。

## 最快上手路径

### 第一步：复制 demo.js

```bash
cd src/public/plugin/
cp demo.js myplugin.js
```

`demo.js` 是内置的演示插件，它**实现了所有 API 方法**，每个方法都返回兜底的 `{ code: 404 }`。这意味着复制出来的插件即使什么都不改，页面也不会报错。

### 第二步：修改元信息

编辑 `myplugin.js`，只改两个地方：

```javascript
exports.meta = {
  name: '我的插件', // ← 改这里（显示名称）
  type: 'library', // 'local' | 'library' | 'stream'
  capabilities: {
    /* ... */
  } // 暂不需要改
}
```

文件的 `id` 会自动根据文件名生成（去掉 `.js` 后缀），所以文件名就是插件 ID。

### 第三步：在设置页面导入

1. 重启应用（修改插件文件后需要重启 Electron）
2. 进入 **设置 → 插件管理**
3. 点击「导入插件」，选择 `myplugin.js`
4. 插件出现在列表中，默认已启用

> 第三方插件通过设置页面导入；`src/public/plugin/` 目录下的插件是内置的，随应用自动加载。

### 第四步：迭代实现功能

你想实现哪个功能，就改哪个方法。推荐的分步策略：

```javascript
// 1️⃣ 先写内部逻辑，用 api.log 调试，不返回实际结果
exports.search = async function (params) {
  const { keyword } = params
  // 写你的逻辑...
  const result = await api.http.get('https://api.example.com/search', { q: keyword })
  api.log('search result: ' + JSON.stringify(result)) // 用 log 确认数据正确

  // 2️⃣ 确认逻辑正确前，继续返回兜底 404，不影响页面其他功能
  return { code: 404 }
}

// 3️⃣ 等内部逻辑和数据结构都调通了，再返回实际结果
exports.search = async function (params) {
  const { keyword, limit = 30, offset = 0 } = params
  const response = await api.http.get('https://api.example.com/search', { keyword, limit, offset })
  return {
    code: 200,
    data: response.data.songs || [],
    count: response.data.songCount || 0,
    sourceContext: {}
  }
}
```

**为什么这样分步？** 因为插件方法的返回值会经过 Zod Schema 运行时校验。如果返回的数据结构不对（比如字段名拼错、类型不匹配），框架会打印校验失败日志，但不会让页面崩溃——返回 `{ code: 404 }` 则直接走兜底，页面完全不受影响。你可以放心地在 `api.log` 中观察数据，等确认格式正确了再返回。

### 第五步：查看日志

`api.log()` 的输出会出现在 **DevTools 控制台**（主进程日志）和 **插件管理页面的日志面板** 中。打开方式：

- 开发模式：`yarn dev` 后自动打开 DevTools
- 生产模式：可以在设置中开启「开发者模式」查看日志

## 核心概念

### exports.meta — 插件身份证

```javascript
exports.meta = {
  name: '显示名称', // 必填
  type: 'library', // 'local' | 'library' | 'stream'
  capabilities: {
    /* ... */
  }
}
```

`type` 决定了插件属于哪个分类，影响其在 UI 中的出现位置：

| 类型      | 说明                               | 示例                      |
| --------- | ---------------------------------- | ------------------------- |
| `library` | 在线音乐库（搜索、歌单、排行榜）   | 网易云、酷狗              |
| `stream`  | 流媒体服务器（需用户配置 baseUrl） | Emby、Jellyfin、Navidrome |
| `local`   | 本地音乐管理                       | 本地文件扫描              |

### api 对象 — 插件工具箱

```javascript
api.http.get(url, params?, headers?, raw?) // HTTP GET 请求
api.http.post(url, data?, headers?, raw?) // HTTP POST 请求
api.http.delete(url, data?, headers?, raw?) // HTTP DELETE 请求
api.store.set('key', 'value') // 插件私有键值存储（持久化）
api.store.get('key') // 读取
api.db.set(table, value) // 全局数据库写入（table 为表名，如 'PluginData'）
api.db.get(table, filter?) // 全局数据库读取，filter 可选（如 { ids: string[] }）
api.utils.parseLyric(lrcString) // 解析 LRC / 逐字歌词
api.utils.md5('string') // MD5 哈希
api.utils.generateSalt() // 生成 12 字符十六进制盐值
api.utils.generateToken(password, salt) // 密码加盐 MD5 哈希
api.utils.getEmbeddedLyric(filePath) // 从音频文件提取嵌入歌词
api.utils.getPathLyric(filePath) // 从 LRC 文件路径读取歌词
api.utils.checkFileExist(paths) // 批量检查文件是否存在
api.log('消息') // 日志输出（DevTools + 日志面板），单字符串参数
```

### 方法返回结构

每个方法必须返回 `{ code, ...data }`。`code` 的含义：

| code  | 含义          | 框架行为                     |
| ----- | ------------- | ---------------------------- |
| `200` | 成功          | 使用返回数据                 |
| `404` | 未实现 / 兜底 | 跳过此插件，继续询问其他插件 |
| `4xx` | 业务错误      | 调用方收到错误，通常跳过     |
| `5xx` | 服务端错误    | 同上                         |

## 注意事项

| 注意点 | 说明 |
| --- | --- |
| 12 秒超时 | 每个方法调用最多 12 秒，超时返回 `{ code: 408 }` |
| 域名白名单 | HTTP 请求目标域名必须与 `baseUrl`（或 `meta.baseUrl`）同域 |
| 异步方法 | 所有 API 方法应返回 Promise |
| 无 npm 包 | Worker 沙箱不支持 `require` 第三方包 |
| 无 `fs` / `electron` | Worker 沙箱不暴露 Node.js 原生模块 |
| 返回结构校验 | 返回值会经过 `PluginResultSchema[method].parse()` 校验，不符合会打印错误日志 |
| 日志调式 | 用 `api.log()` 输出调试信息，可在 DevTools 和插件日志面板查看 |

> 📖 完整方法列表见 [插件 API 参考](./api)
