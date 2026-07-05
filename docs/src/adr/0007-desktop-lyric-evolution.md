---
title: ADR-0007 桌面歌词窗口演化
order: 8
---

# ADR-0007：桌面歌词窗口演化

---

**状态**：已实施  
**日期**：持续演化  
**决策者**：stark81

---

## 要解决的问题

桌面歌词窗口（OSD Lyric）是一个独立于主窗口的透明 Electron 窗口，覆盖在桌面上。它需要解决：

1. **实时同步**：与主窗口的播放进度、状态保持同步
2. **多种显示模式**：单行小窗、双行、全屏歌词列表
3. **低干扰**：锁定模式下不拦截鼠标事件，空闲时自动隐藏
4. **跨平台**：macOS / Windows / Linux 统一行为

---

## 通信方式：为什么用 MessagePort 而不是 IPC

### 候选方案

| 方案 | 原理 | 问题 |
|------|------|------|
| **IPC**（ipcMain / ipcRenderer） | 主进程中转消息 | 消息量大时主进程成为瓶颈；每个通道需提前注册 |
| **MessageChannelMain** 🏆 | 两个渲染进程之间直连 | 主进程仅做建连中介，建立后数据直通 |

### 选定方案：MessageChannelMain

**建立过程**：

```
Main Process
  new MessageChannelMain()
  ├── port1 → this.win.webContents.postMessage('port-connect', null, [port1])
  └── port2 → this.lyricWin.webContents.postMessage('port-connect', null, [port2])

Main Window (preload)                  OSD Window (preload)
  port1.onmessage →                           port2.onmessage →
  window.postMessage(event.data, '*')          window.postMessage(event.data, '*')
```

建立后，主窗口渲染进程直接向 OSD 窗口推送状态增量——**主进程不再参与**。

**为什么不是 IPC？**

- IPC 每个通道需要注册和转发，消息类型多时维护成本高
- IPC 经过主进程序列化/反序列化，增加延迟
- MessagePort 是 Electron 提供的标准机制，适合两个渲染进程直通的场景

---

## 同步的数据内容

主窗口通过 MessagePort 推送以下消息类型（全部为 `{ type, data }` 结构）：

| 消息类型 | 数据 | 触发时机 |
|---------|------|---------|
| `update-osd-status` | `{ line: [currentIndex, currentTime] }` | 歌词行切换 |
| `update-osd-status` | `{ playing: boolean }` | 播放/暂停 |
| `update-osd-status` | `{ lyrics: LyricLine[] }` | 切歌或歌词更新 |
| `update-osd-status` | `{ lyricOffset: [offset, currentTime] }` | 用户调整歌词偏移 |
| `update-osd-status` | `{ seek: currentTime }` | 拖动进度条 |
| `update-osd-status` | `{ rate: playbackRate }` | 倍速变化 |
| `update-osd-status` | `{ title: string }` | 歌曲切换 |

OSD 窗口按增量更新显示，不依赖心跳轮询。

---

## 显示模式总览

桌面歌词从最初就同时支持两种窗口类型：

| 类型 | 模式 | 窗口高度 | 行为 |
|------|------|---------|------|
| **Mini 模式** | `singleLine`（单行）/ `twoLines`（双行） | ≈ 140px | 固定高度，歌词水平滚动 |
| **Normal 模式** | 全屏歌词列表 | ≈ 600px | 可滚动，当前行垂直居中 |

两种模式在最初就已存在，后续的演化几乎全部集中在 **Mini 模式的双行（twoLines）模式**上。

---

## Mini 双行模式的三阶段演化

### Phase 1："没有横向滚动"

```
┌──────────────────────────────────────┐
│ 这一刻的想法                         │
│ 其实就是我从来没有   ← 超长歌词换行    │
│ 告诉过你的那些事       导致显示不全    │
└──────────────────────────────────────┘
```

最初 Mini 模式不支持歌词横向滚动。遇到超长歌词时，文本会自动换行。但 Mini 窗口高度固定（≈ 140px），换行后的第二行会超出窗口范围，导致歌词截断显示不全。

**问题**：超长歌词无法完整显示。

### Phase 2："横向滚动 + 严格分组"

为了解决超长歌词的显示问题，引入了**横向滚动**机制：

```
┌──────────────────────────────────────┐
│ → 这一刻的想法其实就是我从来没有告...  │  ← 超出宽度部分横向滚动
│ → In this moment                  │
└──────────────────────────────────────┘
```

横向滚动之后，每一行都能完整显示整句歌词（不换行）。滚动时机：先静止 2 秒，再以计算速度向左滚动，滚动结束后恢复显示状态。

有了横向滚动的保障，就希望双行模式能智能地展示翻译/音译：

- 如果两句歌词都**没有翻译/音译** → 显示两句歌词
- 如果某句歌词**有翻译/音译** → 只显示一行歌词 + 其翻译

于是引入了**严格分组逻辑**：

```
原始歌词行列表：
  ① 这一刻的想法          ← 无 tlyric
  ② In this moment        ← 无 tlyric ② 是 ① 的翻译
  ③ 我曾想过              ← 有 tlyric
  ④ I once thought        ← ④ 是 ③ 的 tlyric
  ⑤ 那时我还不懂          ← 无 tlyric，且⑥是下一组
  ⑥ 那些年                 ← 无 tlyric

分组规则：
  组1: [①, ②]     ← 两句歌词，均无翻译，正常显示
  组2: [③, tlyric] ← ③ 有 tlyric，翻译作为第二行
  组3: [⑤, ⑥]     ← 两句歌词，均无翻译，正常显示

特殊情况：如果某句歌词无翻译，但因为前后分组导致无法配对而落单 → 单独成组，只用显示一行
```

### Phase 3："提前预切换"

严格分组在用户体验上有一个问题：**必须等当前组的两句都唱完，才能切换到下一组。**

```
组1: [① 这一刻的想法, ② In this moment]
     ↑ 唱完 ①         ↑ 唱完 ② 才能切到组2

如果 ①→② 的时间间隔很短，用户会感觉：
  "刚看完 ① 和 ②，还没来得及看下一句就又该切了"
```

解决方案：**在当前组的第二句开唱时，把第一句提前切换为下一组的第一句。**

```
        ① 唱       ② 唱
组1: [────────] [────────]
                  ↑
             ② 开唱时，① 的位置提前显示下一组的第一句

用户看到的：
  时间点 A：① 这一刻的想法      | ② In this moment
  时间点 B：③ 我曾想过          | ② In this moment  （③ 提前出现了）
  时间点 C：③ 我曾想过          | I once thought
```

这样用户在唱第二句时，余光已经能看到下一句的内容了。

### 分组逻辑的最终状态

`groupLyric` 计算属性（`OsdLyricContainer.vue`）综合实现以上三个阶段的能力：

1. 将原始 `lyricLine[]` 按是否有翻译分组
2. 处理落单行的配对
3. `lyricToShow` 计算属性根据当前 `currentIndex` 决定是否触发预切换

---

## 锁定模式设计

锁定模式让桌面歌词不拦截鼠标事件——用户点击"透过"歌词窗口操作背后的应用。

| 状态 | 行为 |
|------|------|
| **锁定** | `setIgnoreMouseEvents(true)` — 所有鼠标事件穿透 |
| **解锁** | `setIgnoreMouseEvents(false)` — 正常交互（拖拽、调整） |

**自动隐藏机制**：

```
isLock = true
    │
    └→ 启动 50ms 轮询鼠标位置
        │
        ├→ 鼠标在窗口内 → 显示（opacity: 1）
        └→ 鼠标离开 → 开始计时
            │
            └→ 超时 → 渐隐至 opacity: 0.02
                │
                └→ 鼠标再次进入 → 恢复 opacity: 1
```

通过 preload 脚本的 `osd-lock-mouse-state` IPC 和渲染层的 `startLockMouseWatcher` 实现。

---

## 后续影响

- OSD 窗口是懒创建的：仅在用户首次开启桌面歌词时创建，不影响启动速度
- powerMonitor.resume 事件中需要重建 MessagePort 连接（系统休眠唤醒后断开）
- 消息类型需要双向维护：新增同步字段时，发送方和接收方需同步更新
- 锁定模式的 50ms 轮询对性能影响可忽略，但在低功耗设备上可考虑优化为事件驱动
