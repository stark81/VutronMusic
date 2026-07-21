---
title: VutronMusic 文档
last-updated: 2026-07-21
---

# VutronMusic 文档

**一个播放器，聚合所有来源。**

VutronMusic 是一款桌面音乐播放器，通过插件化架构将本地音乐、网易云、酷狗、Navidrome、Emby、Jellyfin 等多个来源聚合在一起。同一首歌可以同时拥有本地高品质文件、在线歌词、社区评论——三个来源各司其职，但对用户来说就是一首歌。

VutronMusic 的文档分为三个维度：

| 维度 | 适合谁 | 内容 |
| --- | --- | --- |
| [产品文档](product/) | PM / 设计师 / 产品爱好者 | 功能设计、用户故事、设计哲学、方法论 |
| [技术规格](spec/) | 开发者 / AI 编码助手 | 数据库 Schema、插件 API、架构、IPC 通道 |
| [架构决策](adr/) | 所有读者 | 8 个 ADR：插件架构、TrackSource 设计、Worker 模型、SQLite Schema、插件演进、歌词渲染演进等 |
| [排错指南](troubleshooting/) | 遇到问题的用户 | 症状→原因→解决方案，覆盖 DNS/Linux/TagLib |
| [归档](archive/) | 想了解历史的开发者 | 项目记忆：旧设计、迁移记录、架构演变 |

> 💡 **为 AI / vibe-coding 准备**：会话启动时请先读 `AGENTS.md`（项目根目录），然后按任务类型查阅上表。

## 开发者速查

| 命令                  | 说明                            |
| --------------------- | ------------------------------- |
| `yarn install`        | 安装依赖                        |
| `yarn dev`            | 开发模式（Vite HMR + Electron） |
| `yarn build`          | 生产构建                        |
| `yarn lint`           | 代码检查                        |
| `cd docs && yarn dev` | 文档站本地预览                  |

## 项目地址

- GitHub: [stark81/VutronMusic](https://github.com/stark81/VutronMusic)
- 问题反馈: [Issues](https://github.com/stark81/VutronMusic/issues)
