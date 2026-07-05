---
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

这一约束决定了整个架构的基本方向。

---

## Phase 1（早期）："Canvas 渲染 + 30fps 逐帧传图"

### 架构

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

### 实现细节

- `trayLyrics.ts` 中维护三个子 Canvas：`Lyric`（歌词文本）、`Control`（播放按钮）、`Icon`（应用图标）
- 每帧：三个子 Canvas 各自 draw → 合成到主 Canvas → `toDataURL()` → IPC 发送
- TouchBar 只使用 `Lyric` 子 Canvas（无需控制按钮）
- 歌词超长时，Canvas 内的 `Lyric` 类启动横向滚动动画，每帧重新计算位置

### 问题

| 问题 | 原因 | 影响 |
|------|------|------|
| **高频 IPC 传输** | 30fps × dataURL（base64 ≈ 增大 33% 体积） | 主进程持续繁忙 |
| **CPU 高负载** | Canvas 渲染 + base64 编码 + IPC 序列化 + nativeImage 解码 | 电池消耗明显 |
| **帧率不稳定** | 编码时间波动导致丢帧 | 歌词滚动卡顿 |
| **TouchBar 发热** | TouchBar 独立屏幕持续刷新 | MacBook 用户反馈 |

---

## Phase 2（当前）："文本传递 + 窗口移动"

### 架构

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

### 关键改变

1. **不再逐帧传图**：渲染进程只在歌词切换时发送文本，而不是每帧发送完整 dataURL
2. **主进程渲染一次**：收到文本后渲染一次静态 `nativeImage`，包含全部歌词
3. **窗口移动替代逐帧重绘**：需要滚动时，不重新绘制 Canvas，而是通过调整 `tray.setImage()` 的裁剪区域（bounds）来模拟滚动效果
4. **IPC 频率**：从 30fps → 仅在歌词行切换时（≈ 每 3-10 秒一次）

### 性能对比

| 指标 | Phase 1（30fps 传图） | Phase 2（文本+窗口移动） |
|------|----------------------|------------------------|
| IPC 频率 | 30 次/秒 | 0.1-0.3 次/秒（歌词切换时） |
| dataURL 传输 | 持续 | 仅切歌时 |
| Canvas 渲染 | 每帧重新绘制 | 切换歌词时一次 |
| 主进程负载 | 持续解码 | 几乎为零 |
| 电池影响 | 明显 | 可忽略 |

---

## 组件复用

TrayLyric 和 TouchBarLyric 共享同一套 Canvas 绘制逻辑（`src/renderer/utils/canvas.ts` 中的 `Lyric` 类）：

```
canvas.ts: Lyric 类
  ├── measureText()     → CanvasRenderingContext2D.measureText
  ├── updateLyric()     → 设置歌词文本 + 计算滚动参数
  │                        ├── staticTime（滚动前静止时间）
  │                        └── scrollPixelsPerMS（滚动速度）
  ├── draw()            → 渲染当前帧到 Canvas
  ├── startAnimation()  → requestAnimationFrame 循环
  ├── pause() / resume() → 生命周期管理
  └── calculatePosition() → 滚动位移计算

trayLyrics.ts
  ├── TrayLyric 类       → 3 个子 Canvas（Lyric + Control + Icon）
  └── TouchBarLyric 类   → 1 个子 Canvas（仅 Lyric）
```

---

## Tray 点击交互

Tray 的点击处理通过 `handleTrayClick` IPC 传递到渲染进程：

```typescript
const handleClick = (position: { x: number }) => {
  const singleWidth = 22  // 每个按钮宽度
  const index = Math.floor(position.x / singleWidth)
  switch (index) {
    case 0: // 上一首 / 踩（FM 模式）
    case 1: // 播放 / 暂停
    case 2: // 下一首
    case 3: // 喜欢 / 取消喜欢
    case 4: // 显示主窗口（图标区）
  }
}
```

## 后续影响

- 非 macOS 平台的 tray 仅显示静态图标，不支持歌词（系统限制）
- 歌词滚动的 `staticTime`（2000ms）和最大滚动速度经过多次调优，平衡了可读性和效率
- 当前的"窗口移动"方案仍有改进空间：可考虑完全由主进程渲染歌词文本（避免 Canvas 绘制），但工程量较大
- 此架构代码集中在 `src/renderer/utils/trayLyrics.ts`（247 行）和 `src/renderer/utils/canvas.ts`（273 行）
