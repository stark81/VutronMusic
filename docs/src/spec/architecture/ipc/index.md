---
title: 进程模型与数据流
order: 9
last-reviewed: 2025-07-07
---

# 进程模型与数据流

## 为什么需要三进程？

| 决策              | 理由                                                         |
| ----------------- | ------------------------------------------------------------ |
| 使用 Electron     | 需要文件系统访问、系统集成（MPRIS/TouchBar）、后台常驻       |
| 主进程隔离        | 数据库（better-sqlite3）只能在主进程；窗口管理需要主进程 API |
| Worker 线程再隔离 | 插件代码不应直接访问 Electron API（安全沙箱）                |
| Preload 桥接      | 渲染进程不能直接 require Node.js 模块                        |

## 架构图

```
Renderer Process
  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐
  │ Views   │  │ Store     │  │ API Layer │  │ Components       │
  └────┬────┘  └─────┬────┘  └─────┬────┘  └────────┬─────────┘
       │             │             │                 │
       └─────────────┼─────────────┼─────────────────┘
                     │             │
              ┌──────▼─────────────▼──────┐
              │      contextBridge         │
              │   window.mainApi.*          │
              └──────┬─────────────┬──────┘
                     │             │
               ┌─────┴─────────────┴─────────────────┐
               │              Main Process             │
               │  ┌──────────┐  ┌──────────┐  ┌──────┐│
│  │ IPCs.ts  │  │ DB       │  │Window││
                │  │ (7 组)   │  │(SQLite)  │  │/Tray ││
               │  └────┬─────┘  └──────────┘  └──────┘│
               │       │                               │
               │  ┌────▼─────────────────────────────┐ │
               │  │  Worker Thread Pool               │ │
               │  │  pluginRunner / scanMusic / cache │ │
               │  └──────────────────────────────────┘ │
               └───────────────────────────────────────┘
```

## 主进程启动顺序

```
BackGround 初始化
├─ 1. 注册异常处理器
├─ 2. 单实例锁
├─ 3. 注册 vutron:// 自定义协议
├─ 4. 创建 Fastify 服务器
├─ 5. app.whenReady() →
│   ├─ 创建主窗口
│   ├─ 创建桌面歌词 OSD 窗口
│   ├─ 初始化数据库
│   ├─ 初始化插件管理器
│   ├─ 初始化 IPC 通道（7 组）
│   ├─ 创建系统托盘
│   ├─ 创建 MPRIS (Linux) / TouchBar (macOS)
│   ├─ 注册全局快捷键
│   └─ 加载渲染进程
└─ 6. 监听 activate / second-instance / before-quit
```

## 四条核心数据流

### 1. 用户操作 → UI 响应

```
用户操作 → 组件事件 → Pinia Action → (可选 API 调用) → 组件更新
```

示例：点击「下一首」→ `player.playNext()` → `audioEngine` 换源 → `lyric` 重置 → 组件更新。

### 2. 渲染进程 → 插件（跨进程调用）

```
Renderer → IPC invoke('pluginMusic:call')
         → Main: PluginManager.call()
         → Worker: exports[method](params)
         → Main: Zod Schema 校验
         → Renderer: Store 更新
```

**关键设计点**：12 秒超时、Zod 校验、callId Promise 映射。

> 📖 详细超时和错误处理见 [ADR-0003 Worker 模型](../../../adr/0003-worker-model)

### 3. 本地音乐扫描

```
用户触发扫描 → Worker: scanMusic → 遍历文件 → 解析标签 → 去重 → 写 DB → 通知 Renderer
```

**产品方案**：增量扫描、后台执行、进度反馈、三级去重。

### 4. Fastify 服务器（在线 API 代理）

```
Renderer/Main ──HTTP──→ Fastify (端口 40001/41830)
  ├─ /netease/* → 网易云 API
  └─ /http/* → 通用 HTTP 代理
```

好处：统一 Cookie 管理、请求签名、代理支持、插件兼容。

## 7 组 IPC 通道

| #   | IPC 模块     | 功能           | 关键方法                                 |
| --- | ------------ | -------------- | ---------------------------------------- |
| 1   | WindowIpc    | 窗口控制       | minimize, maximizeOrUnmaximize, close    |
| 2   | OSDWindowIpc | 桌面歌词窗口   | show, hide, lock, setSize, playPause     |
| 3   | TrayIpc      | 系统托盘       | updateTray, setPlayState, updateSettings |
| 4   | TaskbarIpc   | Windows 任务栏 | (预留)                                   |
| 5   | MprisIpc     | Linux 媒体键   | playPause, next, prev, setVolume         |
| 6   | OtherIpc     | 杂项           | Discord, Last.fm, 版本查询               |
| 7   | PluginIpc    | 插件管理       | call, getPlugins, create/delete instance |

### 渲染进程 → 主进程（完整清单）

| 通道名 | 分组 | 说明 | 处理位置 |
| --- | --- | --- | --- |
| `minimize` | Window | 最小化窗口 | `initWindowIpcMain` |
| `maximizeOrUnmaximize` | Window | 最大化/还原 | `initWindowIpcMain` |
| `close` | Window | 关闭窗口（ask/quit/minimize） | `initWindowIpcMain` |
| `showWindow` | Window | 从托盘恢复窗口 | `initTrayIpcMain` |
| `updateOsdState` | OSD | 更新桌面歌词状态（show/type/isLock） | `initOSDWindowIpcMain` |
| `from-osd` | OSD | OSD 窗口发送的控制消息（playNext/playPrev/playOrPause） | `initOSDWindowIpcMain` |
| `osd-resize` | OSD | OSD 窗口高度变更 | `initOSDWindowIpcMain` |
| `osd-start-resize` | OSD | OSD 窗口拖拽缩放开始 | `initOSDWindowIpcMain` |
| `osd-stop-resize` | OSD | OSD 窗口拖拽缩放结束 | `initOSDWindowIpcMain` |
| `set-ignore-mouse` | OSD | 临时切换鼠标穿透 | `initOSDWindowIpcMain` |
| `mouseleave` | OSD | 鼠标离开 OSD 窗口，恢复锁定 | `initOSDWindowIpcMain` |
| `updateTray` | Tray | 更新托盘图标 | `initTrayIpcMain` |
| `updatePlayerState` | Tray | 更新播放状态（playing/repeatMode/shuffle/like/progress/rate/isPersonalFM） | `initTrayIpcMain` |
| `setStoreSettings` | Tray | 设置项变更，同步到主进程 | `initTrayIpcMain` |
| `updateTooltip` | Tray | 更新托盘 tooltip | `initTrayIpcMain` |
| `msgRequestGetVersion` | Other | 获取应用版本号 | `initOtherIpcMain` |
| `msgOpenExternalLink` | Other | 在浏览器中打开链接 | `initOtherIpcMain` |
| `openLogFile` | Other | 在文件管理器中打开日志文件 | `initOtherIpcMain` |
| `msgOpenFile` | Other | 打开文件选择对话框 | `initOtherIpcMain` |
| `msgCheckFileExist` | Other | 检查文件是否存在 | `initOtherIpcMain` |
| `selecteFolder` | Other | 选择文件夹对话框 | `initOtherIpcMain` |
| `showOpenDialog` | Other | 通用文件打开对话框 | `initOtherIpcMain` |
| `getFilesInFolder` | Other | 获取目录下指定扩展名的文件列表 | `initOtherIpcMain` |
| `getLocalMusic` | Other | 获取本地音乐数据 | `initOtherIpcMain` |
| `msgScanLocalMusic` | Other | 扫描本地音乐（Piscina 线程池） | `initOtherIpcMain` |
| `msgShowInFolder` | Other | 在文件管理器中显示文件 | `initOtherIpcMain` |
| `deleteLocalMusicDB` | Other | 删除本地音乐数据库 | `initOtherIpcMain` |
| `clearCacheTracks` | Other | 清理音频缓存 | `initOtherIpcMain` |
| `getStreamMatchCount` | Other | 获取流媒体匹配计数 | `initOtherIpcMain` |
| `clearStreamMatches` | Other | 清分流媒体匹配记录 | `initOtherIpcMain` |
| `getCacheTracksInfo` | Other | 获取缓存信息 | `initOtherIpcMain` |
| `check-update` | Other | 检查应用更新 | `initOtherIpcMain` |
| `downloadUpdate` | Other | 下载更新 | `initOtherIpcMain` |
| `update-powersave` | Other | 阻止系统休眠 | `initOtherIpcMain` |
| `getFontList` | Other | 获取系统字体列表 | `initOtherIpcMain` |
| `get-screenshot` | Other | 截取当前窗口 | `initOtherIpcMain` |
| `delete-screenshot` | Other | 删除截图 | `initOtherIpcMain` |
| `get-cache-path` | Other | 获取音频缓存路径 | `initOtherIpcMain` |
| `write-cover` | Other | 写入封面到本地文件 | `initOtherIpcMain` |
| `accurateMatch` | Other | 精确匹配 TrackSource | `initOtherIpcMain` |
| `playDiscordPresence` | Discord | 更新 Discord 状态（播放中） | `initOtherIpcMain` |
| `pauseDiscordPresence` | Discord | 更新 Discord 状态（暂停） | `initOtherIpcMain` |
| `lastfm-auth` | Last.fm | Last.fm 授权 | `initOtherIpcMain` |
| `get-lastfm-session` | Last.fm | 获取 Last.fm 会话信息 | `initOtherIpcMain` |
| `disconnect-lastfm` | Last.fm | 断开 Last.fm | `initOtherIpcMain` |
| `metadata` | MPRIS | 更新 MPRIS 元数据 | `initMprisIpcMain` |
| `updateLyricInfo` | MPRIS | 更新 GNOME Shell 扩展歌词 | `initMprisIpcMain` |
| `askExtensionStatus` | MPRIS | 查询 GNOME Shell 扩展状态 | `initMprisIpcMain` |
| `get-song-url` | Plugin | 获取歌曲播放 URL（含缓存查询） | `initOtherIpcMain` |
| `plugin-method-call` | Plugin | 通用插件方法调用 | `initPluginIpcMain` |
| `get-plugins` | Plugin | 获取所有已注册插件列表 | `initPluginIpcMain` |
| `upload-plugin` | Plugin | 上传自定义插件 | `initPluginIpcMain` |
| `create-plugin-instance` | Plugin | 创建插件实例（多账号） | `initPluginIpcMain` |
| `delete-plugin-instance` | Plugin | 删除插件实例 | `initPluginIpcMain` |
| `trackMatch` | Plugin | 歌曲自动匹配（library 插件） | `initPluginIpcMain` |
| `plugin-comment` | Plugin | 评论获取/操作（跨插件兜底） | `initPluginIpcMain` |
| `plugin-lyric` | Plugin | 歌词获取（跨插件兜底） | `initPluginIpcMain` |
| `get-lyric-offset` | Plugin | 获取歌词偏移 | `initPluginIpcMain` |
| `set-lyric-offset` | Plugin | 保存歌词偏移 | `initPluginIpcMain` |
| `get-source-priority` | Plugin | 获取音源优先级配置 | `initPluginIpcMain` |
| `report-playback` | Plugin | 上报播放记录（含 Last.fm scrobble） | `initPluginIpcMain` |
| `setPluginEnable` | Plugin | 设置插件类型启用/禁用 | `initPluginIpcMain` |
| `set-source-priority` | Plugin | 设置音源优先级 | `initPluginIpcMain` |

### 主进程 → 渲染进程（完整清单）

| 通道名                         | 说明           | 触发时机           |
| ------------------------------ | -------------- | ------------------ |
| `play`                         | 播放/暂停切换  | 快捷键或 MPRIS     |
| `previous`                     | 上一首         | 快捷键或 MPRIS     |
| `next`                         | 下一首         | 快捷键或 MPRIS     |
| `repeat`                       | 切换循环模式   | 快捷键             |
| `repeat-shuffle`               | 切换随机播放   | 快捷键             |
| `like`                         | 收藏/取消收藏  | 快捷键或 MPRIS     |
| `increaseVolume`               | 增加音量       | 快捷键             |
| `decreaseVolume`               | 减小音量       | 快捷键             |
| `fm-trash`                     | FM 模式下跳过  | 快捷键             |
| `setPosition`                  | 跳转到指定进度 | 快捷键             |
| `resume`                       | 恢复播放       | 快捷键             |
| `scanLocalMusicProgress`       | 扫描进度通知   | 本地扫描每批次完成 |
| `scanLocalMusicDone`           | 扫描完成       | 扫描结束           |
| `msgHandleScanLocalMusicError` | 扫描出错       | 扫描异常           |
| `receiveCacheInfo`             | 缓存状态更新   | 缓存任务完成       |
| `msgDeletedTracks`             | 已删除歌曲通知 | 文件变更检测       |
| `update-error`                 | 更新出错       | 自动更新失败       |
| `download-progress`            | 下载进度       | 更新下载中         |
| `handleTrayClick`              | 托盘点击       | 系统托盘操作       |
| `rememberCloseAppOption`       | 记住关闭选项   | 用户选择关闭行为   |

## IPCs.ts 注册入口

```
IPCs.initialize(win, tray, mpris, lrc)
  ├── initWindowIpcMain.main()
  ├── initOSDWindowIpcMain.main()
  ├── initTrayIpcMain.main()
  ├── initMprisIpcMain.main()
  ├── initTaskbarIpcMain.main()
  ├── initOtherIpcMain.main()
  └── initPluginIpcMain.main()
```
