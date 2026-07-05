---
title: 构建与发布
order: 13
last-reviewed: 2025-07-07
---

# 构建与发布

## 构建命令

| 命令 | 产物 | 说明 |
|------|------|------|
| `yarn build` | 当前平台 | 生产构建（自动检测平台） |
| `yarn build:all` | dmg + nsis/portable + deb/rpm/AppImage/snap | 全平台构建 |
| `yarn build:linux` | deb + rpm + AppImage + snap | Linux 构建 |
| `yarn build:mac` | dmg | macOS 构建 |
| `yarn build:dir` | 目录（免打包） | 调试用 |

输出目录：`release/${version}/`

## 打包配置

配置文件：`buildAssets/builder/config.js`

| 平台 | 产物类型 | 架构 |
|------|---------|------|
| macOS | `dmg` | x64 |
| Windows | `nsis`（安装包）+ `portable`（便携版）+ `zip` | x64 |
| Linux | `deb` + `rpm` + `AppImage` + `snap` | x64 |

NSIS 安装包配置：一键安装关闭、允许修改安装目录、创建桌面快捷方式。

## 代码签名

- **macOS**: 公证未启用（`notarize: false`），`hardenedRuntime: true`
- **Windows**: 当前未配置代码签名
- **Linux**: 无需签名

## 自动更新

当前未集成自动更新机制。`checkUpdate` / `downloadUpdate` 通过 IPC 触发，仅检测版本号。

## asar 解包

以下模块因平台原生依赖需从 asar 中解包：

- `sharp` / `@img/*`（图像处理）
- `taglib-wasm`（音频元数据读取）
- `dist/main/workers/*.js`（Worker 线程入口）

## CI/CD（GitHub Actions）

### Workflow 总览

| Workflow | 文件 | 触发条件 | 功能 |
|----------|------|---------|------|
| app-test | `app-test.yml` | push/PR to master | 多平台测试 |
| Release | `build.yml` | push tag `v*` / manual | 多架构构建 + GitHub Release |
| documents | `documents.yml` | push `docs/` to master | VitePress 文档构建 + 部署 |

### 测试（app-test.yml）

在 push 或 PR 到 master 时自动运行，排除纯文档变更。

**测试矩阵**：

| 维度 | 值 |
|------|-----|
| Node.js | 18, 20 |
| 平台 | windows-latest, macos-latest, ubuntu-latest |

Linux 环境通过 `xvfb-run` 提供虚拟帧缓冲以运行 Electron 测试。

### 发布（build.yml）

推送 `v*` tag 或手动触发。

**构建矩阵**（6 路并行）：

| 平台 | Runner | 架构 |
|------|--------|------|
| macOS | macos-15-intel | x64 |
| macOS | macos-14 | arm64 |
| Windows | windows-2022 | x64 |
| Windows | windows-11-arm | arm64 |
| Linux | ubuntu-22.04 | x64 |
| Linux | ubuntu-22.04-arm | arm64 |

**发布流程**：

1. 各平台并行构建，产物上传为 GitHub Artifacts
2. `publish-release` job 汇总所有产物
3. 自动处理 `latest.yml` 去重（保留较大版本，兼容 electron-updater）
4. 创建 Draft Release

**产物矩阵**：

| 平台 | 产物 |
|------|------|
| macOS | dmg |
| Windows | nsis（安装包）+ portable（便携版）+ blockmap + latest.yml |
| Linux x64 | deb + rpm + AppImage + snap + blockmap + latest.yml |
| Linux arm64 | deb + rpm + AppImage + blockmap + latest.yml |

### 文档部署（documents.yml）

- 触发：`docs/` 或 `README.md` 变更
- 构建 VitePress → 部署到 `gh-pages` 分支
- 自定义域名：`vutron.jooy2.com`
