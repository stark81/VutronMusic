---
title: 开发环境搭建
order: 0
last-reviewed: 2025-07-21
---

# 开发环境搭建

从零搭建 VutronMusic 开发环境的完整指南。

## 环境要求

| 依赖    | 版本要求  | 说明                                   |
| ------- | --------- | -------------------------------------- |
| Node.js | >= 22.6.0 | `package.json` engines 字段指定        |
| Yarn    | 1.22.22   | `package.json` packageManager 字段指定 |
| Git     | 2.x+      | 版本控制                               |

## 安装步骤

### 1. 安装 Node.js

推荐使用版本管理工具切换 Node 版本：

```bash
# fnm（推荐，速度快）
fnm install 22
fnm use 22

# 或 nvm
nvm install 22
nvm use 22

# 或 volta
volta install node@22
```

验证版本：

```bash
node -v  # 应 >= 22.6.0
```

### 2. 安装 Yarn

```bash
npm install -g yarn@1.22.22
```

### 3. 克隆并安装依赖

```bash
git clone https://github.com/stark81/VutronMusic.git
cd VutronMusic
yarn install
```

### 4. 启动开发模式

```bash
yarn dev
```

此命令会同时启动：

- Vite 开发服务器（HMR 热更新）
- Electron 主进程

## 开发工作流

### 热更新范围

| 修改位置         | 是否自动刷新 | 说明                                        |
| ---------------- | ------------ | ------------------------------------------- |
| `src/renderer/`  | ✅ 是        | Vue 组件、Store、样式等通过 Vite HMR 热更新 |
| `src/main/`      | ❌ 否        | 需要手动重启 Electron                       |
| `src/preload/`   | ❌ 否        | 需要手动重启 Electron                       |
| `public/plugin/` | ❌ 否        | 需要手动重启 Electron                       |

手动重启：关闭 Electron 窗口后重新执行 `yarn dev`。

### 常用命令

```bash
yarn dev          # 开发模式
yarn build        # 生产构建（输出到 dist/）
yarn lint         # ESLint 检查
yarn lint:fix     # ESLint 自动修复
yarn format:fix   # Prettier 格式化
yarn build:pre    # 构建前检查
```

## 常见问题

### 依赖安装失败

```bash
# 清除缓存重新安装
rm -rf node_modules yarn.lock
yarn install
```

### Electron 启动白屏

通常是渲染进程编译错误。检查终端中 Vite 的输出日志，常见原因：

- TypeScript 类型错误
- 缺少依赖包
- 环境变量未配置

### 数据库迁移报错

不要手动修改 `db.ts` 中的 `migrate()` 调用。数据库迁移逻辑已内置，`yarn dev` 启动时自动执行。

### 插件加载失败

插件在 Worker 线程中执行，错误不会直接显示在主窗口。检查 Electron 主进程的终端输出，通常会有 `[Worker]` 前缀的错误日志。
