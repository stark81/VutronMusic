---
title: 插件化设计
order: 3
---

# 插件化设计

## 为什么选择插件化

1. **支持扩展** — 新增音源只需一个 .js 文件，无需改核心代码、无需发版
2. **版权合规** — 某平台音源有侵权风险时，可快速移除对应插件，不影响其他功能
3. **权限隔离** — 插件运行在 Worker 沙箱中，只能访问声明的域名，符合 Electron 前后端分离架构
4. **用户控制** — 可自由启用/禁用/排序音源

## 插件类型

| 类型    | 场景                       | 示例                      |
| ------- | -------------------------- | ------------------------- |
| library | 在线平台（搜索/歌单/推荐） | netease, kugou            |
| stream  | 自建媒体库                 | navidrome, emby, jellyfin |
| local   | 本地文件                   | local                     |

## 接口契约

插件返回结果必须通过 Zod schema 校验（`PluginResultSchema[method].parse()`），确保核心程序不依赖具体平台实现。

> 📖 详见 [插件 API 参考](../spec/architecture/plugin/api) 和 [插件系统概览](../spec/architecture/plugin/)
