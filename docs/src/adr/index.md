---
title: 架构决策记录 (ADR) 说明
order: 1
---

# 架构决策记录 (ADR) 说明

## ADR 是什么

架构决策记录（Architecture Decision Record）是一种轻量级的文档方式，记录项目中的重要架构决策。每个 ADR 回答三个问题：

1. **Context**：我们面临什么问题？
2. **Decision**：我们做了什么选择？
3. **Consequences**：这个选择带来了什么影响？

> **谁该读**：所有想了解「为什么系统是现在这样」的人。 **怎么读**：每篇 ADR 独立，挑感兴趣的看 Context 和 Consequences 即可。

## ADR 的产品价值

| 价值             | 说明                                                   |
| ---------------- | ------------------------------------------------------ |
| **知识传承**     | 新加入的开发者/PM 可以快速了解为什么系统是现在这样     |
| **决策复盘**     | 一段时间后回顾，当时的假设是否成立？要不要改？         |
| **沟通工具**     | 用 ADR 与利益相关方沟通技术决策，而不是在 Slack 上争论 |
| **避免重复讨论** | "这个问题我们去年讨论过了，ADR-0002 有记录"            |

## 如何阅读 ADR

- 每篇 ADR 是独立的，可以只读感兴趣的
- 重点关注 **Context** 部分（为什么会有这个决策）和 **Consequences**（实际效果如何）
- 不要用现在的认知去评判过去的决策——每个 ADR 都是当时约束下的最优解

---

## ADR 目录

| # | 标题 | 决策领域 |
| --- | --- | --- |
| 0001 | [插件架构选择](0001-plugin-architecture) | 为什么用 Worker 线程实现插件系统 |
| 0002 | [TrackSource 表设计](0002-tracksource-design) | 为什么需要 TrackSource 关联表 |
| 0003 | [Worker 线程模型](0003-worker-model) | 为什么用消息队列而非直接调用 |
| 0004 | [SQLite Schema](0004-sqlite-schema) | 为什么选 better-sqlite3 和当前 Schema |
| 0005 | [插件架构演化史](0005-plugin-evolution) | 三阶段演化：HTTP直连 → 主进程聚合 → Worker沙箱 |
| 0006 | [歌词组件渲染演化](0006-lyric-rendering-evolution) | 逐行DOM → 逐字多DOM → 单DOM+Web Animations API |
| 0007 | [桌面歌词窗口演化](0007-desktop-lyric-evolution) | MessagePort通信、mini/双行/全屏模式、锁定设计 |
| 0008 | [macOS Tray/TouchBar 歌词演化](0008-tray-touchbar-lyric-evolution) | Canvas 30fps传图 → 文本传递+窗口移动 |
