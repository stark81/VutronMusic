---
title: 产品文档
last-updated: 2026-07-21
order: 1
---

# 产品文档

VutronMusic 产品的设计理念和架构决策。

> **谁该读**：想理解「为什么这样设计」的人。
>
> **怎么读**：先看[产品概览](./overview.md)了解全貌，再按兴趣深入。

## 产品层

| 文档                            | 核心内容                           |
| ------------------------------- | ---------------------------------- |
| [产品概览](overview)            | 核心场景 + 功能矩阵                |
| [多源聚合设计](aggregation)     | 三层聚合模型 + 匹配流程            |
| [插件化设计](plugin-philosophy) | 为什么插件化 + 插件类型 + 接口契约 |

## 功能文档

具体功能的设计文档在 [features/](../features/) 目录下：

| 功能                                     | 核心内容                            |
| ---------------------------------------- | ----------------------------------- |
| [CUE 分轨支持](../features/cue-support/) | 用户故事、功能需求、验收标准        |
| [歌词系统](../features/lyrics/)          | 获取策略、格式共存、setTimeout 索引 |
| [OSD 歌词](../features/osd-lyric/)       | 横向滚动、锁定透明度、双行分组      |
| [本地音乐库](../features/music-library/) | 三级去重策略、增量扫描              |
| [Tray 歌词](../features/tray-lyric/)     | macOS 原生实现、Linux DBus 通信     |
| [播放主题](../features/player-theme/)    | 三种布局、10 种背景、GSAP 动画      |
