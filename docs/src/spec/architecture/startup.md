---
title: 主进程启动序列
order: 11
last-reviewed: 2025-07-07
---

# 主进程启动序列

`src/main/index.ts` 是整个 Electron 应用的唯一入口。启动过程分为 **三个阶段**，理解这个顺序对新增初始化逻辑或排查启动问题至关重要。

## 启动序列图

```
Phase 0: 模块加载 (import 时刻)
═══════════════════════════════════════════════════
  加载所有 import 依赖
  store (electron-store) 单例初始化 ← 此时已可读 settings
  定义 closeOnLinux / 图片路径等常量
  → 注册 MAIN_PROCESS_INITIALIZED_KEY 守卫
  → 调用 new BackGround().init()

Phase 1: BackGround.init() (app.whenReady 之前)
═══════════════════════════════════════════════════
  ① 注册 unhandledRejection / uncaughtException
  ② app.setAppUserModelId (Windows)
  ③ app.requestSingleInstanceLock() → 失败则 quit
  ④ 强制缩放因子 (settings.forceFactor)
  ⑤ Linux 标志调整 (禁用硬件媒体键)
  ⑥ 注册 vutron:// 特权协议 scheme
  ⑦ 创建 Fastify HTTP 服务器 ← 在 app ready 之前启动！
     ├── 注册 fastifyCookie / fastifyStatic
     ├── 加载 NeteaseCloudMusicApi
     └── 监听端口 (40001 dev / 41830 prod)

Phase 2: app.whenReady() 回调
═══════════════════════════════════════════════════
  开始并行初始化多个子系统：
  │
  ├── ⑧ createMainWindow()
  │   ├── 从 store 恢复窗口位置
  │   ├── 创建 BrowserWindow (隐藏)
  │   └── 加载 APP_INDEX_URL (dev / prod)
  │
  ├── ⑨ handleWindowEvents()
  │   ├── ready-to-show → 显示窗口 + 创建 Windows thumBar
  │   ├── close → 保存窗口位置
  │   ├── maximize/unmaximize/resize/move
  │   └── macOS close → hide (不 quit)
  │
  ├── ⑩ handleAmuseServer()
  │   └── 监听 store.settings.enableAmuseServer 变化
  │       → 响应式启动/停止 6kLabs Amuse 服务
  │
  ├── ⑪ initAutoUpdater() → 自动更新检查
  ├── ⑫ createTray() → 系统托盘
  ├── ⑬ createMpris() → Linux MPRIS (仅 Linux)
  ├── ⑭ registerGlobalShortcuts() → 全局快捷键
  ├── ⑮ IPCs.initialize() → 所有 IPC 通道注册
  ├── ⑯ 配置 HTTP/HTTPS 代理 (若启用)
  ├── ⑰ createMenu() → 应用菜单
  ├── ⑱ createDockMenu() → macOS Dock 菜单 (仅 macOS)
  └── ⑲ createTouchBar() → macOS Touch Bar (仅 macOS)

OSD 窗口 (懒初始化)
════════════════════
  initOSDWindow() / showOSDWindow()
  → 仅当 store.osdWin.show = true 时创建
  → 透明 BrowserWindow，通过 MessagePort 通信

process 事件
════════════════
  activate (macOS) → 重建/显示窗口
  second-instance → 聚焦已有窗口 + 处理 vutron:// 协议
  before-quit → 标记 willQuitApp
  quit → 清理 Fastify / Amuse / 全局快捷键
  powerMonitor.resume → 重连 OSD MessagePort
```

## 关键注意事项

### 1. Store 在 import 时即初始化
`src/main/store.ts` 的 `electron-store` 单例在模块加载时同步构造。这意味着：
- **所有在 `init()` 之前执行的模块都能读 settings**（window 位置、代理配置、OSD 状态等）
- 如果 AI 新建模块需要访问配置，直接 `import store from '../store'` 即可，无需等待任何生命周期

### 2. Fastify 在 app ready 之前启动
HTTP 服务器（网易云 API 代理 + 静态资源服务）在 Phase 1.⑦ 中启动。如果端口冲突，应用会在创建窗口**之前**崩溃（无重试/回退逻辑）。这是有意为之：API 服务必须在窗口渲染前可用。

### 3. MAIN_PROCESS_INITIALIZED_KEY 守卫
```typescript
const global = globalThis as any
if (!global[MAIN_PROCESS_INITIALIZED_KEY]) {
  global[MAIN_PROCESS_INITIALIZED_KEY] = true
  const bgProcess = new BackGround()
  bgProcess.init()
}
```
- 防止 Vite HMR 热重载时重复初始化（生成重复窗口/Tray/服务器）
- ⚠️ 没有旧实例的销毁逻辑——旧对象成为内存孤儿

### 4. 各平台分支

| 功能 | 平台 | 初始化时机 |
|------|------|-----------|
| `createDockMenu()` | macOS | Phase 2 末尾 |
| `createTouchBar()` | macOS | Phase 2 末尾 |
| `createThumBar()` | Windows | `ready-to-show` 事件 |
| `createMpris()` | Linux | Phase 2 |
| `closeOnLinux` | Linux | Phase 0 常量 |
| `setAppUserModelId` | Windows | Phase 1.② |

### 5. OSD 窗口是懒加载的
OSD 桌面歌词窗口**不在** Phase 2 中创建。它通过 `initOSDWindow()` / `showOSDWindow()` 方法在用户首次开启桌面歌词时才创建。这意味着：
- 启动时不会创建第二个 BrowserWindow
- OSD 窗口的 `lrc` 控制器对象在 Phase 2.⑮ 中定义并传给 `IPCs.initialize()`
- powerMonitor.resume 会重连 OSD 的 MessagePort

### 6. Amuse 服务是响应式启动/停止的
`handleAmuseServer()` 订阅 `store.onDidAnyChange()`，在 `settings.enableAmuseServer` 变化时启动/停止 Fastify 实例。不是 Phase 2 顺序初始化的一部分——它可以在应用运行中的**任何时间**触发。

### 7. 错误处理现状
`bgProcess.init()` 的调用是 fire-and-forget（无 `.catch()`）。如果 `createFastifyApp()` 抛出异常，应用会静默失败，仅有 `unhandledRejection` 处理器的日志输出。没有用户可见的启动失败对话框。

## 给 AI 的指引

**场景：新增一个在启动时初始化的模块**
→ 在 Phase 2 的 `app.whenReady().then()` 中添加（约 `index.ts:678`），注意要排在 `IPCs.initialize()` 之前还是之后取决于是否依赖 IPC 通道。

**场景：新增一个 IPC 通道**
→ 无需修改启动序列。在 `IPCs.ts` 中添加新的 `init*IpcMain` 函数，并在 `IPCs.initialize()` 中调用即可（它会被自动收集到 Phase 2.⑮）。

**场景：新增一个平台专属功能**
→ 使用 `process.platform` 判断，参考 macOS/Windows/Linux 分支模式。注意各分支的初始化时机不同。

**场景：新增一个 store 配置项**
→ 只需在 `src/main/store.ts` 的 `TypeElectronStore.settings` 接口中添加字段和默认值。无需修改启动序列。
