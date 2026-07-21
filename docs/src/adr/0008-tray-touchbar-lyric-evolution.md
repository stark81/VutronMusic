---
last-updated: 2026-07-08
title: ADR-0008 macOS Tray / TouchBar 歌词演化
order: 9
---

# ADR-0008：macOS Tray / TouchBar 歌词演化

---

**状态**：已实施  
**日期**：持续演化  
**决策者**：stark81

---

## 核心约束

macOS 的系统 Tray（菜单栏图标）和 TouchBar 只能展示 `nativeImage`（静态位图）。这意味着歌词文本无法以 HTML 或文本形式直接传递——必须被"画"出来再传给系统。

这一约束决定了整个架构的基本方向。最终方案选择绕过 Electron 的限制，直接使用 macOS 原生 API。

---

## 三阶段演进

### Phase 1（历史）："Canvas 渲染 + 30fps 逐帧传图"

#### 架构

```
Renderer Process                          Main Process
    │                                          │
    ├── Canvas 绘制歌词文本                      │
    ├── canvas.toDataURL()  →  base64          │
    ├── IPC.send('updateTray', { img })  ──────→  nativeImage.createFromDataURL()
    │                                          ├── tray.setImage(image)
    │                                          └── touchBar.setImage(image)
    │
    └── 每秒 30 帧重复上述流程
```

#### 问题

| 问题              | 原因                                                      | 影响             |
| ----------------- | --------------------------------------------------------- | ---------------- |
| **高频 IPC 传输** | 30fps × dataURL（base64 ≈ 增大 33% 体积）                 | 主进程持续繁忙   |
| **CPU 高负载**    | Canvas 渲染 + base64 编码 + IPC 序列化 + nativeImage 解码 | 电池消耗明显     |
| **帧率不稳定**    | 编码时间波动导致丢帧                                      | 歌词滚动卡顿     |
| **TouchBar 发热** | TouchBar 独立屏幕持续刷新                                 | MacBook 用户反馈 |

---

### Phase 2（历史）："文本传递 + 窗口移动"

#### 架构

```
Renderer Process                          Main Process
    │                                          │
    ├── 歌词切换时发送文本                       │
    ├── IPC.send('updateTray', { text })  ──────→  渲染一次静态 nativeImage
    │                                          ├── 图像包含完整歌词
    │                                          └── 通过 image 裁剪偏移切换显示
    │                                               ↓
    │                                          tray.setImage(image, 裁剪区域)
    │
    └── dataURL 传输从 30fps → 仅歌词切换时触发
```

#### 性能对比 Phase 1

| 指标         | Phase 1（30fps 传图） | Phase 2（文本+窗口移动）    |
| ------------ | --------------------- | --------------------------- |
| IPC 频率     | 30 次/秒              | 0.1-0.3 次/秒（歌词切换时） |
| dataURL 传输 | 持续                  | 仅切歌时                    |
| Canvas 渲染  | 每帧重新绘制          | 切换歌词时一次              |
| 主进程负载   | 持续解码              | 几乎为零                    |
| 电池影响     | 明显                  | 可忽略                      |

**局限**：通过裁剪区域模拟滚动，无法实现逐字高亮动画和流畅滚动。

---

### Phase 3（当前）："原生 Objective-C++ 实现"

#### 架构

```
Renderer Process                          Main Process (tray.ts / touchBar.ts)
    │                                          │
    ├── synchronize.ts watch 状态变化            │
    ├── window.mainApi.send('synchronize-       │  加载 native addon
    │   player-info', data)                     │    └─ tray_addon.node (tray)
    │                                     ──→  │    └─ touchbar_addon.node (TouchBar)
    │                                          │
    │                                          ├── tray.updateInfo(data)
    │                                          ├── touchBar?.updateInfo(data)
    │                                          │
    │                                          ▼
    │                                   macOS Native (ObjC++)
    │                                     tray_view.mm / touchbar_view.mm
    │                                       Core Animation 渲染
```

渲染进程不再直接处理 Tray/TouchBar 的渲染逻辑。改为通过 `synchronize-player-info` 中央通道发送状态数据，主进程传递数据给原生 addon，由 macOS 原生代码驱动 Core Animation。

#### Core Animation 三层文字系统

```
┌─────────────────────────────────────┐
│  baseText (CATextLayer)             │  ← 未播放颜色（白色/深色）
│  ┌─────────────────────────────────┐│
│  │ highlightText (CATextLayer)     ││  ← 已播放颜色（黄色）
│  │ + maskLayer (CALayer)           ││  ← 裁剪遮罩，控制可见范围
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

- `baseText`：渲染完整歌词文本，使用未播放颜色
- `highlightText`：渲染相同文本，使用已播放颜色
- `maskLayer`：作为 `highlightText` 的遮罩，只露出已播放部分

#### 逐字高亮动画

通过 `CAKeyframeAnimation` 控制 `maskLayer.bounds.size.width`：

```
时间轴：  0% ──────── 30% ──────── 60% ──────── 100%
遮罩宽度：0px ──────── 120px ────── 280px ────── 400px
视觉效果：[爱在西元前] → [爱在西元前] → [爱在西元前] → [爱在西元前]
           ↑已播放部分逐渐扩大
```

每个字的 `start`/`end` 时间戳对应一个关键帧，mask 宽度按字的累计像素宽度比例增长。

#### 暂停/恢复的动画同步

Core Animation 的 `fillMode: forwards` 会导致 model layer 不更新，直接暂停会出现动画跳变：

```objc
// 暂停时：从 presentationLayer 读取当前状态
CALayer *presented = [_highlightText.presentationLayer];
CGFloat currentWidth = presented.bounds.size.width;
// 移除所有动画，将 model layer 快照到当前位置
[_maskLayer removeAllAnimations];
_maskLayer.bounds = CGRectMake(0, 0, currentWidth, height);

// 恢复时：从快照位置重建动画，计算偏移
CGFloat offsetMs = (currentWidth / totalWidth) * duration;
// 重新创建 CAKeyframeAnimation，从 offsetMs 开始
```

#### 横向滚动动画

当歌词宽度超出托盘区域时，第二个 `CAKeyframeAnimation` 控制 `position.x`：

```
短歌词：居中显示，不滚动
长歌词：左对齐，随播放进度向左滚动
```

滚动关键帧与逐字关键帧同步，实现"字滚到可视区域时刚好读完"的效果。

---

## 组件复用

Tray 和 TouchBar 共享相同的原生渲染策略，但实现独立：

```
src/native/tray/
  ├── tray_addon.mm    →  N-API 桥接层，暴露 createTrayItem
  └── tray_view.mm/.h  →  NativeTrayView（自定义 NSView，歌词 + 控制按钮 + 封面）

src/native/touchbar/
  ├── touchbar_addon.mm →  N-API 桥接层
  └── touchbar_view.mm  →  自定义 NSTouchBar 实现

src/main/
  ├── tray.ts           →  Tray 管理（优先加载 native addon，回退 Electron Tray）
  └── touchBar.ts       →  TouchBar 管理（优先加载 native addon，回退 Electron TouchBar）
```

macOS 优先加载原生 N-API addon，加载失败时回退到 Electron 内置 API。

---

## 中央分发模式

`synchronize-player-info` 是一个中央 IPC 通道，主进程收到后扇出到所有消费者：

```
Renderer (synchronize.ts)
  │ watch 播放状态变化
  │ window.mainApi.send('synchronize-player-info', data)
  ▼
Main Process (IPCs.ts)
  │ ipcMain.on('synchronize-player-info', handler)
  │
  ├→ lrc.sendToOSD('update-osd-status', data)   // OSD 窗口
  ├→ tray.updateInfo(data)                       // macOS 原生 Tray
  ├→ touchBar?.updateInfo(data)                  // macOS TouchBar
  ├→ mpris?.updateInfo(data)                     // Linux MPRIS
  └→ dbus.iface?.UpdateLyric(JSON.stringify(...)) // Linux DBus
```

优点：

- 渲染进程只发一次，主进程负责扇出
- 新增消费者只需在主进程添加一行转发
- 各消费者独立运行，互不影响

---

## Linux DBus 双向通信

Linux 不直接在托盘渲染歌词，而是通过 DBus 协议将歌词数据发送给外部服务。

### 架构

```
VutronMusic                          外部服务
    │                                    │
    │ ──── UpdateLyric(json) ──────→     │  作为客户端：推送歌词
    │                                    │
    │ ←── CurrentLrc(signal) ────────    │  作为服务端：供第三方订阅
    │ ←── LikeThisTrack(method) ────     │
```

### 作为客户端：推送歌词

监听 `org.gnome.Shell.TrayLyric` 扩展，歌词以 JSON 格式推送：

```json
{
  "content": "爱在西元前",
  "start": 1.234,
  "time": 4.567,
  "sender": "VutronMusic"
}
```

### 作为服务端：供第三方订阅

导出 `org.vutronmusic.Lyric` 接口：

- `CurrentLrc` 信号：歌词文本
- `UpdateLikeStatus` 信号：喜欢状态
- `LikeThisTrack` 方法：第三方客户端可触发喜欢操作

---

## Tray 点击交互

macOS 原生 Tray 使用自定义 NSView（`NativeTrayView`），控制按钮直接绘制在 NSView 上，通过原生事件处理响应点击，不再依赖坐标计算：

| 区域      | 操作             |
| --------- | ---------------- |
| 歌词区    | 点击切换显示模式 |
| 上一首    | 切到上一曲       |
| 播放/暂停 | 切换播放状态     |
| 下一首    | 切到下一曲       |
| 喜欢      | 切换喜欢状态     |
| 应用图标  | 显示主窗口       |

---

## IPC 通道

### 渲染进程 → 主进程

| 通道                      | 说明                             |
| ------------------------- | -------------------------------- |
| `synchronize-player-info` | 中央分发：歌词、播放状态、进度等 |
| `initTrayState`           | 初始化 Tray 状态                 |
| `updateTrayVisibility`    | 更新歌词/按钮/图标可见性         |
| `setStoreSettings`        | 持久化 Tray 设置                 |

### 主进程 → 渲染进程

| 通道                      | 说明                    |
| ------------------------- | ----------------------- |
| `msgExtensionCheckResult` | Linux DBus 扩展连接状态 |

---

## 后续影响

- 非 macOS 平台的 tray 仅显示静态图标，不支持歌词（系统限制）
- Windows 不支持托盘歌词（系统 API 限制）
- TouchBar 仅在带 TouchBar 的 MacBook Pro 上可用
- 原生 addon 需要编译，CI 需配置 macOS 构建环境
- Linux 依赖于外部服务（如 GNOME Shell 扩展），不保证所有桌面环境可用
- 涉及文件：`src/native/tray/`（addon + view）、`src/native/touchbar/`、`src/main/tray.ts`、`src/main/touchBar.ts`、`src/main/dbusClient.ts`、`src/main/dbusService.ts`、`src/main/IPCs.ts`、`src/renderer/utils/synchronize.ts`
