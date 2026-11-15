---
last-updated: 2026-11-15
title: 构建与发布
order: 13
last-reviewed: 2026-11-15
---

# 构建与发布

## 构建命令

| 命令               | 产物                                        | 说明                     |
| ------------------ | ------------------------------------------- | ------------------------ |
| `yarn build`       | 当前平台                                    | 生产构建（自动检测平台） |
| `yarn build:all`   | dmg + nsis/portable + deb/rpm/AppImage/snap | 全平台构建               |
| `yarn build:linux` | deb + rpm + AppImage + snap                 | Linux 构建               |
| `yarn build:mac`   | dmg                                         | macOS 构建               |
| `yarn build:dir`   | 目录（免打包）                              | 调试用                   |

输出目录：`release/${version}/`

## 打包配置

配置文件：`buildAssets/builder/config.js`

| 平台    | 产物类型                                      | 架构        |
| ------- | --------------------------------------------- | ----------- |
| macOS   | `dmg`                                         | x64 + arm64 |
| Windows | `nsis`（安装包）+ `portable`（便携版）+ `zip` | x64 + arm64 |
| Linux   | `deb` + `rpm` + `AppImage` + `snap`           | x64 + arm64 |

NSIS 安装包配置：一键安装关闭、允许修改安装目录、创建桌面快捷方式。

### macOS DMG 的 dmgbuild 来源（当前 26.5.0：系统 Python）

electron-builder 生成 dmg 时依赖 `dmgbuild`，来源随版本不同：

| electron-builder | dmgbuild 来源 | 前置条件 |
| --- | --- | --- |
| **26.5.0（仓库当前固定）** | `dmg-builder/vendor/run_dmgbuild.py`，由**系统 Python** 执行 | 打包机必须装 Python 3 |
| 26.8.x 及以后 | 从 [electron-builder-binaries](https://github.com/electron-userland/electron-builder-binaries) 下载预编译 bundle | 见下，要求 macOS 15+ |

26.5.0 的解释器路径取 `PYTHON_PATH`，取不到就依次尝试 `python3` / `python`，都找不到时报 `Cannot find 'python' or 'python3' executable`。这一版**没有**预编译 bundle，也**不认** `CUSTOM_DMGBUILD_PATH`。

26.8.x 起（26.8.x 用 `dmg-builder@1.2.0`，26.18.x 与 27.0.0-alpha.14 用 `1.2.5`）指向同一个 bundle `dmgbuild-bundle-<arch>-75c8a6c.tar.gz`，其中 OpenSSL（`libssl.3.dylib` / `libcrypto.3.dylib`）的 `otool -l` 显示 `minos 15.0`，即要求 **macOS 15+**，在 macOS 12 及更早版本上 dmg 步骤会失败：

```
dyld: Symbol not found: (_mkfifoat)
Referenced from: .../python/bin/python3.14
```

上游 [PR #10477](https://github.com/electron-userland/electron-builder/pull/10477) 已把 bundle 换成 `dmg-builder@1.2.7`（`cc96fa2`，两个 dylib 的 `minos` 为 `11.0`），但截至 2026-11 **尚无正式版包含它**。

> ⚠️ 因此升级 electron-builder 前必须先确认打包机的 macOS 最低版本：要么只在新系统上出 dmg，要么给 `node_modules` 打补丁 / 用 `CUSTOM_DMGBUILD_PATH` 指向自行准备的 dmgbuild。**仓库当前没有任何 dmg 打包补丁脚本**，`rebuild` 只处理 sandbox、taglib-wasm 与原生模块。

只在本机出 `.app`（跳过 dmg）：`yarn build:dir` → `release/${version}/mac/VutronMusic.app`。

## 原生模块

安装依赖后的收尾由 `rebuild.js`（`postinstall`）完成，分三步：

1. 修补 `taglib-wasm` 的 `package.json`（`fix-taglib-wasm.js`）——这个改动会被打进安装包，所以 CI 也要执行；
2. Linux 上给 `chrome-sandbox` 设置 setuid（`fix-sandbox.js`）——只有本地跑 Electron 才需要；
3. macOS 上编译 tray / touchbar 插件到 `dist-native/`（`build-native.js`）——仅 darwin 有效。

**不再使用 `electron-rebuild`**（旧流程是 `electron rebuild.js`，等于启动 Electron GUI 跑 electron-rebuild，在无图形环境的 CI 上又慢又容易失败）：

- `better-sqlite3` 13+ 自带 Node-API 预编译二进制（`prebuilds/<platform>-<arch>.node`），Node 与 Electron 通用，不需要按 ABI 重新编译；
- `sharp` 同样通过 `@img/sharp-<platform>-<arch>` 可选依赖分发预编译二进制；
- 因此 `buildAssets/builder/config.js` 里设了 `npmRebuild: false`，electron-builder 打包时也不会再调 node-gyp。这同时避开了 Windows ARM64 的坑：`windows-11-arm` 镜像已换成 Visual Studio 2026，而 `node-gyp@11` 只认 VS 2019/2022，一旦触发编译就会报找不到 VS。

需要临时跳过上述第 2、3 步时设置环境变量 `SKIP_REBUILD=true`（CI 就是这么做的，macOS 插件由工作流单独执行 `npm run build:native`）。

## 代码签名

- **macOS**: 公证未启用（`notarize: false`），`hardenedRuntime: true`
- **Windows**: 当前未配置代码签名
- **Linux**: 无需签名

## 自动更新

已集成 `electron-updater`，支持 Windows 和 Linux 版本的自动更新检查和下载。macOS 版本因 App Store 分发策略限制，仅提示更新可用，不支持自动下载安装。

更新流程：

1. 应用启动时检查 GitHub Releases 最新版本
2. 发现新版本后弹窗提示用户
3. 用户确认后下载更新包（Windows: nsis installer, Linux: AppImage/deb/rpm）
4. 下载完成后提示重启安装

## asar 解包

以下模块因平台原生依赖需从 asar 中解包：

- `sharp` / `@img/*`（图像处理）
- `taglib-wasm`（音频元数据读取）
- `dist/main/workers/*.js`（Worker 线程入口）

## CI/CD（GitHub Actions）

### Workflow 总览

| Workflow  | 文件            | 触发条件               | 功能                        |
| --------- | --------------- | ---------------------- | --------------------------- |
| app-test  | `app-test.yml`  | push/PR to master      | 多平台测试                  |
| Release   | `build.yml`     | push tag `v*` / manual | 多架构构建 + GitHub Release |
| documents | `documents.yml` | push `docs/` to master | VitePress 文档构建 + 部署   |

### 测试（app-test.yml）

在 push 或 PR 到 master 时自动运行，排除纯文档变更。

**测试矩阵**：

| 维度    | 值                                          |
| ------- | ------------------------------------------- |
| Node.js | 18, 20                                      |
| 平台    | windows-latest, macos-latest, ubuntu-latest |

Linux 环境通过 `xvfb-run` 提供虚拟帧缓冲以运行 Electron 测试。

### 发布（build.yml）

推送 `v*` tag 或手动触发。

**构建矩阵**（6 路并行）：

| 平台    | Runner           | 架构  |
| ------- | ---------------- | ----- |
| macOS   | macos-15-intel   | x64   |
| macOS   | macos-26         | arm64 |
| Windows | windows-2022     | x64   |
| Windows | windows-11-arm   | arm64 |
| Linux   | ubuntu-22.04     | x64   |
| Linux   | ubuntu-22.04-arm | arm64 |

> macOS 镜像不断退役：`macos-14`（x64）已于 2026-11-02 退役，继续使用会让任务直接失败（`The configuration 'macos-14-arm64-...' is not supported`）。当前可用的免费 arm64 镜像是 `macos-15` 与 `macos-26`。
>
> 架构只由运行器的 `--x64` / `--arm64` 决定：`config.js` 的 `mac/win/linux.target` 里**不要**写死 `arch`，否则会覆盖命令行架构。

CI 的 `Install deps` 步骤带 `SKIP_REBUILD=true`，步骤内部也不会再启动 Electron，因此 Linux 任务不需要 `xvfb`。

**发布流程**：

1. 各平台并行构建，产物上传为 GitHub Artifacts
2. `publish-release` job 汇总所有产物
3. 自动处理 `latest.yml` 去重（保留较大版本，兼容 electron-updater）
4. 创建 Draft Release

**产物矩阵**：

| 平台        | 产物                                                      |
| ----------- | --------------------------------------------------------- |
| macOS       | dmg                                                       |
| Windows     | nsis（安装包）+ portable（便携版）+ blockmap + latest.yml |
| Linux x64   | deb + rpm + AppImage + snap + blockmap + latest.yml       |
| Linux arm64 | deb + rpm + AppImage + blockmap + latest.yml              |

### 文档部署（documents.yml）

- 触发：`docs/` 或 `README.md` 变更
- 构建 VitePress → 部署到 `gh-pages` 分支
- 自定义域名：`vutron.jooy2.com`
