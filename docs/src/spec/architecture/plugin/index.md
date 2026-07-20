---
title: 插件生态总览
order: 5
last-reviewed: 2025-07-21
---

# 插件生态总览

## 插件的三种类型

| 类型 | 用户场景 | 示例 |
| --- | --- | --- |
| **local** | 用户有本地音乐文件 | `local.js`（~940行） |
| **library** | 用户订阅在线音乐平台 | `netease.js`（~2100行）, `kugou.js`（~2600行） |
| **stream** | 用户自建媒体服务器 | `navidrome.js`（~890行）, `emby.js`（~960行）, `jellyfin.js`（~950行） |

## 插件的能力声明

插件通过 `exports.meta.capabilities` 声明自己支持的能力。框架据此决定哪些 UI 对该插件可见。

**产品逻辑**：如果插件声明了 `getLyric: true`，UI 才会显示歌词面板。如果声明了 `comment.submit: true`，用户才能发表评论。这让 UI 自适应插件能力。

## 内置插件 vs 第三方插件

| 维度   | 内置插件              | 第三方插件   |
| ------ | --------------------- | ------------ |
| 来源   | 项目发布时自带        | 用户自行上传 |
| 可删除 | ❌ 不可删除，只能禁用 | ✅ 可删除    |
| 更新   | 随应用更新            | 用户自行管理 |

## 插件实例化

用户可为同一插件创建多个实例（例如两个 Navidrome 服务器）：

```
Plugins 表:
┌──────────────┬──────────────────┬────────┬──────────┐
│ id           │ name             │ type   │ builtIn  │
├──────────────┼──────────────────┼────────┼──────────┤
│ navidrome    │ Navidrome        │ stream │ 1        │
│ navidrome:home│ 我的家庭服务器   │ stream │ 0 ← 用户新增 │
│ navidrome:off│ 办公室服务器      │ stream │ 0 ← 用户新增 │
└──────────────┴──────────────────┴────────┴──────────┘
```

## 内置插件清单

| 插件      | 文件                             | 大小    | 类型    |
| --------- | -------------------------------- | ------- | ------- |
| 网易云    | `src/public/plugin/netease.js`   | ~2100行 | library |
| 酷狗      | `src/public/plugin/kugou.js`     | ~2600行 | library |
| Emby      | `src/public/plugin/emby.js`      | ~960行  | stream  |
| Jellyfin  | `src/public/plugin/jellyfin.js`  | ~950行  | stream  |
| Navidrome | `src/public/plugin/navidrome.js` | ~890行  | stream  |
| 本地音乐  | `src/public/plugin/local.js`     | ~940行  | local   |
| 演示插件  | `src/public/plugin/demo.js`      | ~900行  | —       |

> 📖 插件的执行机制和沙箱见 [Worker 沙箱](../worker/)
