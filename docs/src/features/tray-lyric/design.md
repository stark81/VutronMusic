---
title: Tray 歌词 — 技术设计
last-updated: 2026-07-21
order: 9
related: [index.md, dev.md]
---

# Tray 歌词 — 技术设计

> 产品需求见 [index.md](./index.md)。本文档只记录**不常见的技术实现亮点**。

## 1. macOS 原生实现的演进

macOS 托盘歌词经历了三个阶段，最终选择了原生实现。

### 演进历程

| 阶段 | 方案 | 问题 |
| --- | --- | --- |
| 第 1 阶段 | 渲染进程 Canvas 绘制 → IPC 传图片给 Tray | 滚动时每秒发送几十次图片，性能差 |
| 第 2 阶段 | 渲染进程发送歌词 → 主进程 skia-canvas 绘制 | 未实施（代码在 `dev.feature.mac-tray-lyric` 分支） |
| 第 3 阶段 | 原生 Objective-C++ 实现 | 当前方案，支持真正的滚动和逐字高亮动画 |

### 为什么选择原生实现

Electron 的 `Tray` API 只能设置静态图片，无法实现动画。要实现歌词滚动和逐字高亮，必须绕过 Electron 的限制，直接使用 macOS 原生 API。

## 2. macOS 原生实现核心技巧

### Core Animation 三层文字系统

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

### 逐字高亮动画

通过 `CAKeyframeAnimation` 控制 `maskLayer.bounds.size.width`：

```
时间轴：  0% ──────── 30% ──────── 60% ──────── 100%
遮罩宽度：0px ──────── 120px ────── 280px ────── 400px
视觉效果：[爱在西元前] → [爱在西元前] → [爱在西元前] → [爱在西元前]
           ↑已播放部分逐渐扩大
```

每个字的 `start`/`end` 时间戳对应一个关键帧，mask 宽度按字的累计像素宽度比例增长。

### 暂停/恢复的动画同步

Core Animation 的 `fillMode: forwards` 会导致 model layer 不更新，直接暂停会出现动画跳变。解决方案：

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

### 横向滚动动画

当歌词宽度超过托盘区域宽度时，第二个 `CAKeyframeAnimation` 控制 `position.x`：

```
短歌词：居中显示，不滚动
长歌词：左对齐，随播放进度向左滚动
```

滚动关键帧与逐字关键帧同步，实现"字滚到可视区域时刚好读完"的效果。

## 3. Linux DBus 双向通信

### 架构

Linux 托盘歌词采用双向 DBus 通信：

```
VutronMusic                          外部服务
    │                                    │
    │ ──── UpdateLyric(json) ──────→     │  作为客户端：推送歌词
    │                                    │
    │ ←── CurrentLrc(signal) ────────    │  作为服务端：供第三方订阅
    │ ←── LikeThisTrack(method) ────     │
```

### 作为客户端：推送歌词

监听 `org.gnome.Shell.TrayLyric` 扩展的启动/停止，歌词以 JSON 格式发送：

```json
{
  "content": "爱在西元前",
  "start": 1.234,
  "time": 4.567,
  "sender": "VutronMusic"
}
```

### 作为服务端：供第三方订阅

导出 `org.vutronmusic.Lyric` 接口，提供：

- `CurrentLrc` 信号：歌词文本
- `UpdateLikeStatus` 信号：喜欢状态
- `LikeThisTrack` 方法：第三方客户端可触发喜欢操作

## 4. 中央分发模式

`synchronize-player-info` 是一个中央 IPC 通道，主进程收到后扇出到所有消费者：

```
渲染进程 (synchronize.ts)
  │ watch 播放状态变化
  │ window.mainApi.send('synchronize-player-info', data)
  ▼
主进程 (IPCs.ts)
  │
  ├→ lrc.sendToOSD('update-osd-status', data)     // OSD 窗口
  ├→ tray.updateInfo(data)                          // macOS 原生 Tray
  ├→ touchBar?.updateInfo(data)                     // macOS Touch Bar
  ├→ mpris?.updateInfo(data)                        // Linux MPRIS
  └→ dbus.iface?.UpdateLyric(JSON.stringify(lrc))   // Linux DBus 扩展
```

这种模式的优点：

- 渲染进程只需发送一次，主进程负责扇出
- 新增消费者只需在主进程添加转发逻辑
- 各消费者独立运行，互不影响

## 相关文档

- 产品需求：[index.md](./index.md)
- 实现记录：[dev.md](./dev.md)
