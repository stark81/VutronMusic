---
title: 架构设计
order: 1
---

# 架构设计

核心架构文档，涵盖状态管理、数据库、插件系统、IPC 通信等基础模块的设计与实现。

| 文档 | 内容 | 适合场景 |
| --- | --- | --- |
| **开发环境** |  |  |
| [开发环境搭建](env-setup) | Node 版本、依赖安装、常见问题 | 首次搭建开发环境 |
| [开发工作流](workflow) | 快速迭代、新增插件步骤、关键文件索引、提交规范 | 日常开发 |
| [代码规范](code-conventions) | TS 配置、Prettier/ESLint、命名约定、样式规范 | 编码时保持风格一致 |
| [测试](testing) | Playwright E2E 测试、运行方式、编写指南 | 验证功能正确性 |
| **前端架构** |  |  |
| [路由配置](router) | 路由表、守卫、独立窗口、PlayPage vs OSDLyric | 新增页面/路由 |
| [Store 状态管理](stores) | 9 个 Pinia Store 职责、持久化策略、Store 间通信 | 新增/修改组件 |
| [组件参考](components) | 核心组件 Props/Events/Slots、使用场景 | 新增/修改 UI 组件 |
| [Preload 桥接](preload) | contextBridge 白名单、IPC 通道分类、MessagePort | 新增 IPC 通道 |
| [类型系统说明](types) | 双类型系统（DB 层 vs Zod 层）、对照表、转换路径 | 使用 Track/Album/Artist 类型 |
| [主进程启动序列](startup) | 三阶段启动顺序、Store 初始化时机、平台分支 | 新增初始化逻辑 |
| **后端架构** |  |  |
| [数据库 Schema](database/schema) | 完整表结构、SQL 定义、关联关系 | 数据库相关开发 |
| [Track 数据模型](database/track) | 去重策略、三表分离设计、sourceContext | 音源匹配/去重逻辑 |
| [数据清理策略](database/cleanup) | 软删除、孤立数据、CUE 一致性 | 数据维护开发 |
| [插件系统总览](plugin/) | 插件类型、能力声明、实例化 | 插件开发入门 |
| [插件 API 参考](plugin/api) | 62 个方法完整清单（含 2 个已注释）、返回值结构 | 插件方法实现/调用 |
| [插件快速上手](plugin/getting-started) | 10 分钟写一个可用插件 | 首次插件开发 |
| [Worker 沙箱](worker/) | Worker 架构、沙箱安全、生命周期 | 理解插件执行机制 |
| [IPC 通道](ipc/) | 7 组通道详解、插件调用链路、架构图 | 新增 IPC 或理解通信 |
| [Fastify 服务器](app-server) | 内嵌 HTTP 服务、本地资源路由、网易云代理 | 网络/资源相关开发 |
| **构建与发布** |  |  |
| [构建与发布](build-release) | 构建命令、打包配置、签名状态 | 打包/发布 |
