---
last-updated: 2026-07-08
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

## 通信方式：为什么用 IPC 而不是 MessagePort

### 候选方案

| 方案 | 原理 | 问题 |
| --- | --- | --- |
| **IPC**（ipcMain / ipcRenderer）🏆 | 渲染进程发送 → 主进程中转 → 转发给目标窗口 | 主进程做轻量转发，消息由渲染进程 watch 驱动 |
| **MessageChannelMain** | 两个渲染进程之间直连 | 断连后需重建；主进程仍需参与建连和恢复逻辑 |

### 选定方案：标准 IPC

早期曾尝试 MessageChannelMain 实现两个渲染进程直连，但系统休眠唤醒后连接会断开、需要手动重建。当前实现改为标准 Electron IPC：

```
Main window (synchronize.ts)
  │ Vue watch 检测 Pinia store 变化
  │ window.mainApi.send('synchronize-player-info', partialData)
  │   → ipcRenderer.send (via main window preload bridge)
  ▼
Main Process (IPCs.ts)
  │ ipcMain.on('synchronize-player-info', handler)
  │ lrc.sendToOSD('update-osd-status', data)
  │   → this.lyricWin.webContents.send('update-osd-status', data)
  ▼
OSD window (OsdLyricContainer.vue)
  │ window.mainApi.on('update-osd-status', handleOsdStatus)
  │   → ipcRenderer.on (via OSD window preload bridge)
  │ handleOsdStatus() 解构 data 字段到本地 ref
```

**为什么不用 MessagePort？**

- 系统休眠唤醒后 MessagePort 连接会断开，需要监听 powerMonitor.resume 事件重建
- IPC 三跳路径清晰，主进程仅做轻量转发，不涉及序列化开销
- 统一使用 `synchronize-player-info` 中央通道，OSD 只是其中一个消费者（与 Tray、TouchBar、MPRIS 并列）
- 标准 IPC 在 Electron 中更成熟稳定，调试工具支持更好

---

## 同步的数据内容

主窗口渲染进程通过 Vue watch 监听 Pinia store 状态变化，通过 `synchronize-player-info` 通道发送部分状态更新：

| 字段          | 触发时机                         |
| ------------- | -------------------------------- |
| `lyric`       | 当前歌词文本变化                 |
| `line`        | 歌词行切换或进度变化             |
| `seek`        | 拖动进度条等（伴随其他字段发送） |
| `playing`     | 播放/暂停                        |
| `rate`        | 播放倍速变化                     |
| `title`       | 歌曲切换                         |
| `lyricOffset` | 用户调整歌词偏移                 |
| `lyrics`      | 歌词列表变化（切歌）             |
| `like`        | 喜欢状态变化                     |
| `repeatMode`  | 循环模式变化                     |
| `shuffle`     | 随机播放变化                     |
| `isFM`        | 私人 FM 模式变化                 |
| `setSeek`     | 主动触发跳转进度                 |
| `tWByW`       | 逐字模式变化                     |
| `tooltip`     | 歌曲标题变化                     |

OSD 窗口按增量更新显示，不依赖心跳轮询。

---

## 显示模式总览

| 类型 | 模式 | 窗口高度 | 行为 |
| --- | --- | --- | --- |
| **Mini 模式** | `singleLine`（单行） / `twoLines`（双行） | ≈ 140px | 固定高度，歌词水平滚动 |
| **Full 模式** | 完整歌词列表 | 自适应（可拖拽缩放） | 可滚动，当前行垂直居中 |

演化几乎全部集中在 **Mini 模式的双行（twoLines）模式**上。

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

#### 滚动策略

`LyricLine.vue` 的 `buildScrollKeyFrame` 实现了一种特殊的滚动策略：

```
行宽度的前 1/2 → 不滚动（保持可见）
超出容器宽度的部分 → 滚动
行宽度的后 1/2 → 不滚动（滚动结束后保持可见）
```

- 歌词开始时，前半部分居中显示
- 随着播放进度，歌词向左滚动
- 滚动到后半部分时停止，后半部分居中显示

有逐字数据时，每个字的结束时间对应一个滚动关键帧，实现"字滚到可视区域时刚好读完"的效果。

#### 严格分组逻辑

有了横向滚动的保障，双行模式可以智能地展示翻译/音译：

```
原始歌词行列表：
  ① 这一刻的想法          ← 无 tlyric
  ② In this moment        ← 无 tlyric，② 是 ① 的翻译
  ③ 我曾想过              ← 有 tlyric
  ④ I once thought        ← ④ 是 ③ 的 tlyric
  ⑤ 那时我还不懂          ← 无 tlyric，且⑥是下一组
  ⑥ 那些年                ← 无 tlyric

分组规则：
  组1: [①, ②]     ← 两句歌词，均无翻译，正常显示
  组2: [③, tlyric] ← ③ 有 tlyric，翻译作为第二行
  组3: [⑤, ⑥]     ← 两句歌词，均无翻译，正常显示

特殊情况：某句歌词无翻译且落单 → 单独成组
```

### Phase 3："交叉显示"

严格分组在用户体验上有一个问题：**必须等当前组的两句都唱完，才能切换到下一组。**

```
组1: [① 这一刻的想法, ② In this moment]
     ↑ 唱完 ①         ↑ 唱完 ② 才能切到组2

如果 ①→② 的时间间隔很短，用户会感觉：
  "刚看完 ① 和 ②，还没来得及看下一句就又该切了"
```

解决方案：**当当前行是组内最后一句时，交叉显示下组第一句 + 当前组第二句。**

```
twoLines 模式下，当前组的最后一句 + 下一组的第一句交叉显示：

const isLastLineOfGroup = highlight.value === currentGroup[1]
const nextGroup = groups[currentGroupIndex.value + 1]
if (isLastLineOfGroup && nextGroup?.length === 2) {
  return [lyrics.value[nextGroup[0]], lyrics.value[currentGroup[1]]]
}

用户看到的：
  时间点 A：① 这一刻的想法      | ② In this moment
  时间点 B：③ 我曾想过          | ② In this moment  （③ 提前出现，实现视觉连续）
  时间点 C：③ 我曾想过          | I once thought
```

### 分组逻辑的最终状态

`groupLyric` 计算属性（`OsdLyricContainer.vue`）综合实现以上三个阶段的能力：

1. 将原始 `lyricLine[]` 按是否有翻译分组
2. 处理落单行的配对
3. `lyricToShow` 计算属性根据当前 `currentIndex` 决定是否触发交叉显示

| 情况                                | 分组         |
| ----------------------------------- | ------------ |
| 有翻译的歌词                        | 单独一组     |
| 连续两句无翻译歌词（twoLines 模式） | 合并为一组   |
| oneLine 模式                        | 每句单独一组 |

---

## 锁定模式设计

锁定模式让桌面歌词不拦截鼠标事件——用户点击"透过"歌词窗口操作背后的应用。

| 状态     | 行为                                                   |
| -------- | ------------------------------------------------------ |
| **锁定** | `setIgnoreMouseEvents(true)` — 所有鼠标事件穿透        |
| **解锁** | `setIgnoreMouseEvents(false)` — 正常交互（拖拽、调整） |

### 状态机

`osdWin.ts` 实现了一套精细的透明度控制逻辑：

```
锁定状态
  ├─ 光标在窗口内
  │   ├─ 光标移动 → 显示解锁按钮，恢复不透明，重新计时
  │   └─ 光标静止 → 超过 staticTime 后，透明度降为 0.02
  │
  └─ 光标移出窗口
      └─ 100ms 后 → 隐藏解锁按钮，恢复不透明
```

### 关键实现细节

**防抖设计**：

- 光标进入/离开状态变化时才通知 Vue，避免每 50ms 触发重渲染
- 光标静止时不重置 idle 计时器，保留"空闲后淡出"行为

**定时器管理**：

- `timeoutId`：控制淡出计时（光标静止后触发）
- `hideButtonTimeout`：控制按钮隐藏计时（光标移出后触发）
- 轮询间隔 50ms 不能重置 hideButtonTimeout，否则永远无法触发按钮隐藏

```typescript
// 光标移出：100ms 后隐藏按钮、恢复不透明
if (!inside) {
  clearTimeout(timeoutId)
  if (!hideButtonTimeout) {
    hideButtonTimeout = setTimeout(() => {
      if (lockEl) lockEl.style.opacity = '0'
      root.style.opacity = '1'
      hideButtonTimeout = null
    }, 100)
  }
  return
}

// 光标在窗口内：取消"即将隐藏"的计时，确保按钮可见
clearTimeout(hideButtonTimeout)
hideButtonTimeout = null
if (lockEl) lockEl.style.opacity = '1'
```

通过 preload 脚本的 `osd-lock-mouse-state` IPC 和渲染层的 `startLockMouseWatcher` 实现。

---

## 初始化同步

OSD 窗口挂载时会执行初始化同步流程，确保显示状态与主窗口一致：

```
OSD 窗口挂载
  1. 从 localStorage 读取上次状态（player、lyric）
  2. 发送 init-from-osd 给主窗口
  3. 主窗口回复当前完整播放状态
```

---

## 后续影响

- OSD 窗口是懒创建的：仅在用户首次开启桌面歌词时创建，不影响启动速度
- 滚动策略已与逐字数据深度耦合，新增歌词格式（如逐音节）需同步更新滚动关键帧计算
- 消息类型是增量合并的：发送方发送部分状态，接收方按字段合并到本地状态，新增字段无需修改接收端已有逻辑
- 锁定模式的 50ms 轮询对性能影响可忽略，但在低功耗设备上可考虑优化为运动传感器事件
- 涉及文件：`OsdLyricContainer.vue`、`LyricLine.vue`、`src/preload/osdWin.ts`、`src/main/IPCs.ts`、`src/renderer/utils/synchronize.ts`、`src/renderer/store/osdLyric.ts`、`src/main/osd.ts`
