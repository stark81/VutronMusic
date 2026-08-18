---
title: 歌词系统 — 技术设计
last-updated: 2026-07-21
order: 7
related: [index.md, dev.md]
---

# 歌词系统 — 技术设计

> 产品需求见 [index.md](./index.md)。本文档只记录**不常见的技术实现亮点**。

## 1. Lyric-Index：基于 setTimeout 的歌词索引机制

歌词索引的核心问题是：**如何在正确的时刻切换当前高亮行？**

常见方案是用 `requestAnimationFrame` 每帧轮询判断，但 VutronMusic 采用了 `setTimeout` 精确预约方案。

### 实现原理

```typescript
function refreshLineIdx() {
  currentIndex.value = getLyricIndex(lyrics.value, 0, 1)
  const nextLine = lyrics.value[currentIndex.value + 1]

  if (nextLine) {
    const driftTime = nextLine.start - (_getTime() + offset.value)
    timer = setTimeout(() => refreshLineIdx(), (driftTime * 1000) / _getRate())
  }
}
```

每次回调时重新读取 `audio.currentTime`，计算到下一行起始时间的差值，精确预约下一次唤醒。

### 为什么可行

| 特性             | 说明                                                           |
| ---------------- | -------------------------------------------------------------- |
| **锚定真实进度** | 每次回调重新读取 `audio.currentTime`，不依赖自己的计时         |
| **误差不累积**   | 绝对时间计算，即使 setTimeout 有偏差，下一次回调会重新校准     |
| **CPU 占用极低** | 两行歌词间隔通常 3-5 秒，setTimeout 在这段时间内不消耗任何 CPU |

### 对比 rAF 方案

```
rAF 方案：
  0ms → 判断 → 16ms → 判断 → 32ms → 判断 → ...（每秒 60 次）

setTimeout 方案：
  0ms → 预约 3200ms → 3200ms → 判断并预约下一次（每首歌约 10-20 次）
```

rAF 每秒执行 60 次判断，其中 59 次是"还没到切换时间"的无效判断。setTimeout 只在需要切换时才唤醒。

### 触发时机

歌词索引在以下事件时重置：

- 用户拖动进度条（seek）
- 切换歌曲
- 歌词偏移量变化
- 播放状态变化（暂停/恢复）
- 歌词列表加载完成

---

## 2. 逐字高亮动画：CSS Gradient + Web Animations API

VutronMusic 的逐字歌词高亮**不是通过逐字 DOM 实现的**，而是用了一个组合技巧：

> 单个 `<span>` 渲染整行文字 + CSS 渐变色分割 + Web Animations API 控制渐变位置。

### 核心技巧

**第一步：CSS 渐变实现颜色分割**

```css
.lyric-line span {
  background: linear-gradient(to right, played 50%, unplayed 50%);
  background-clip: text;
  color: transparent;
  background-size: 200% 100%;
  background-position: 100% 0%; /* 完全显示"未播放"色 */
}
```

`background-position: 100%` 显示右半部分（未播放色），`0%` 显示左半部分（已播放色）。由于 `background-clip: text`，渐变直接作用于文字。

**第二步：Canvas 离屏测量文字宽度**

```typescript
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')!

export function measureWords(words: string[], font: string, fontSize: number): number[] {
  ctx.font = `600 ${fontSize}px ${font}`
  return words.map((word) => ctx.measureText(word).width)
}
```

用离屏 Canvas 测量每个词的像素宽度，避免在 DOM 中插入隐藏元素导致布局抖动。结果会缓存，相同文字只测量一次。

**第三步：Web Animations API 控制扫过效果**

```typescript
const keyframes = info.map((word, index) => {
  const offset = (word.start - lineStart) / lineDuration
  const bgPos = 100 - (cumulativeWidth / totalWidth) * 100
  return { backgroundPosition: `${bgPos}% 0%`, offset }
})
// 最后追加终点：backgroundPosition: 0% 0%
```

每个词对应一个 keyframe，`backgroundPosition` 按词的累计宽度比例设置。动画播放时，渐变从右向左扫过，视觉上就是"逐字变色"。

**第四步：父组件手动控制进度**

```typescript
const updateCurrentTime = (timeMs: number) => {
  const timeOffset = timeMs - lineStartMs
  animation.currentTime = timeOffset // 直接设置动画进度
}
```

动画不是自动播放的，而是由父组件根据播放进度手动设置 `currentTime`。浏览器的合成器会自动渲染正确的中间帧。

### 为什么用逐行 DOM 而不是逐字 DOM

| 维度                 | 逐行 DOM（当前方案） | 逐字 DOM                   |
| -------------------- | -------------------- | -------------------------- |
| DOM 节点数           | ~100 个（50 行 × 2） | ~500+ 个（每字一个 span）  |
| Animation 对象数     | 50 个                | 500+ 个                    |
| lyric-index 更新频率 | 每 3-5 秒切换一行    | 每 0.1-0.5 秒切换一字      |
| Vue 响应式开销       | 低                   | 高（每个字都是响应式对象） |

---

## 3. 逐行方案的优劣势

### 优势

| 优势             | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| **DOM 复杂度低** | 每行一个 `<span>`，50 行歌词只有 ~100 个节点，布局计算快     |
| **动画性能好**   | 渐变动画由浏览器合成器处理，不触发 layout/paint              |
| **降级简单**     | 无逐字数据时，只需改变 CSS 变量颜色，无需改 DOM 结构         |
| **变速播放廉价** | `animation.playbackRate = rate` 一行代码，无需重建 keyframes |
| **内存占用低**   | 50 个 Animation 对象 vs 500+                                 |

### 劣势

| 劣势 | 说明 |
| --- | --- |
| **测量是近似值** | Canvas `measureText()` 不考虑 subpixel 渲染、letter-spacing、word-spacing，渐变边界可能与实际文字有 1-2px 偏差 |
| **无法逐字交互** | DOM 是单个 span，无法实现"点击某个字跳转到对应时间点" |
| **渐变是硬边** | `linear-gradient(to right, played 50%, unplay 50%)` 产生清晰的颜色分界线，无法做柔和的发光/渐变过渡 |
| **预先创建动画** | 所有行在加载时就创建 Animation 对象，即使用户不会看到那些行（可优化为懒创建） |
| **两套 CSS 路径** | 逐字模式用渐变动画，非逐字模式用简单颜色切换，维护两套样式 |

## 相关文档

- 产品需求：[index.md](./index.md)
- 实现记录：[dev.md](./dev.md)
