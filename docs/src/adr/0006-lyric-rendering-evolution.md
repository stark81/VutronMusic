---
last-updated: 2026-07-08
title: ADR-0006 歌词组件渲染演化
order: 7
---

# ADR-0006：歌词组件渲染演化

---

**状态**：已实施  
**日期**：持续演化（v1.0 → v3.0+）  
**决策者**：stark81

---

> 📖 歌词格式的选型历史（LRC → Lyricify → LDDC）见 [archive/lyric-design](../archive/lyric-design)。本文聚焦**渲染方式**的演化。

## 核心问题

歌词渲染的核心矛盾：**逐字高亮效果 vs DOM 性能**。要实现卡拉 OK 式的逐字颜色变化，需要在每个字上应用独立的样式，但 DOM 元素越多，重排/重绘成本越高。

---

## Phase 1（早期）："逐行歌词"

### 实现

```vue
<div v-for="(line, index) in lyrics" :class="{ active: index === currentIndex }">
  {{ line.lyric.text }}
</div>
```

- 每行歌词一个 `<div>`，高亮通过 CSS class 切换
- `currentIndex` 通过 `audio.currentTime` 与歌词时间戳对比计算
- 仅支持 LRC 格式（`[mm:ss.xx]` 逐行时间戳）

### 局限

- **无逐字高亮**：无法实现卡拉 OK 式的每个字依次变色效果
- **精度有限**：只有行级时间戳，遇到长句时用户不知道唱到哪个字了

---

## Phase 2（中期）："逐字歌词——每个字一个 DOM"

### 实现

```vue
<div v-for="(line, index) in lyrics">
  <span v-for="(word, wi) in line.lyric.info"
        ref="wordRefs"
        :data-word-index="wi">
    {{ word.word }}
  </span>
</div>
```

- 每个字一个独立的 `<span>` DOM 节点
- 使用 **Web Animations API** 驱动逐字高亮——与 Phase 3 相同的 `KeyframeEffect` + `Animation` 机制，通过 `backgroundPosition` 逐字偏移实现颜色变化
- 每个字对应一个 Animation 对象，按 `wordIndex` 顺序触发
- `wordIndex` 通过 `audio.currentTime` 与 YRC/Lyricify 的逐字时间戳对比计算
- 格式扩展到支持 YRC、Lyricify 的逐字时间戳

### 问题

| 问题                 | 影响                                                        |
| -------------------- | ----------------------------------------------------------- |
| **DOM 数量大**       | 一首 4 分钟的歌 ≈ 2000 个字 → 2000 个独立 `<span>` + 行容器 |
| **Animation 对象多** | 每个字一个 Animation 实例，暂停/恢复需遍历全部              |
| **字间距/定位**      | 每个字独立排版，遇到标点/空格时视觉对齐需额外计算           |
| **滚动开销**         | 歌词列表滚动时大量 DOM 参与重排                             |

---

## Phase 3（当前）："逐字歌词——一行一个 DOM + Web Animations API"

### 实现

```vue
<LyricLine v-for="(line, index) in lyrics" />
```

`LyricLine` 内部：

```vue
<template>
  <div ref="lineRef" class="lyric-line">
    <span>{{ item.lyric.text }}</span>
  </div>
</template>
```

**整个一行的歌词文本只在一个 `<span>` 里。** 逐字高亮不依赖子 DOM，而是通过 **Web Animations API** 操控 `background-position` 实现：

```
背景：linear-gradient(高亮色, 常态色)
动画：通过 backgroundPosition 的 x 偏移来"裁剪"显示区域

时间轴：
  word[0].start → word[0].end → word[1].start → word[1].end → ...
    偏移 0%       偏移 10%       偏移 10%       偏移 25%       ...
                                                    ↑
                                        Animation.currentTime 自动驱动
```

核心代码（LyricLine.vue）：

```typescript
const buildWordAnimation = (el: HTMLElement, words: word[], duration: number) => {
  const keyframes = words.map((w, i) => ({
    offset: w.start / duration, // 时间比例
    backgroundPosition: `${(i / words.length) * 100}% 0%` // 位置偏移
  }))
  const effect = new KeyframeEffect(el, keyframes, { duration, fill: 'forwards' })
  const animation = new Animation(effect, document.timeline)
  return animation
}
```

行索引仍通过 `audio.currentTime` 计算，字索引不再显式计算——由 Animation 的 `currentTime` 自动驱动。

### 差异对比

| 指标             | Phase 2（每字一 DOM）         | Phase 3（单 DOM + Web Animation） |
| ---------------- | ----------------------------- | --------------------------------- |
| DOM 数量         | O(字数) ≈ 2000 个 `<span>`    | O(行数) ≈ 40-80 个 `<span>`       |
| Animation 对象数 | 每字 1 个 ≈ 2000 个           | 每行 1 个 ≈ 40-80 个              |
| 动画机制         | Web Animations API            | Web Animations API（相同）        |
| 运行时 CPU       | 略高（DOM 多 → 重排成本略高） | 略低（DOM 少 → 重排成本低）       |

两者差距主要是 **DOM 数量和 Animation 对象数量**的规模差异，而非动画机制本身的不同。在大多数设备上运行时 CPU 差别不至于特别显著。

### 取舍

Phase 3 胜出不是因为性能碾压，而是因为：

1. **DOM 结构更简洁**：一行一个 `<span>`，无需维护每个字的位置和对齐
2. **Animation 管理更轻量**：40-80 个 vs 2000 个，暂停/恢复的开销更低
3. **后续维护更简单**：排版逻辑集中在行级，不需要逐字处理

但 Phase 2 方案并未完全被否定——如果后续需要更精细的逐字控制（如逐字歌词搜索高亮、逐字点击调整偏移），每字独立 DOM 的方案反而更灵活，**不排除未来因功能需求回退到 Phase 2 方案**。

### lineMode 自动检测

```typescript
const lineMode = computed(() => {
  return !isNWordByWord.value || lyrics.value.every((line) => !line.lyric?.info)
})
```

- `lineMode = true`（纯行级）：没有 `lyric.info` → 仅行高亮，不创建 Animation
- `lineMode = false`（逐字）：有 `lyric.info` → 创建 Web Animation
- **无需用户手动切换**，完全由数据驱动

---

## 歌词格式 → 渲染映射

```
LRC ─────────→ lrcLyricParse() ──→ lyricLine[].lyric = { text }    → 行级高亮
eLRC ────────→ _parseEnhancedLrcLine() ──→ lyricLine[].lyric =     → 逐字
                   { text, info: word[] }
YRC ─────────→ yrcLyricParse() ──→ lyricLine[].lyric =             → 逐字
                   { text, info: word[] }
Lyricify ────→ yrcLyricParse() ──→ (同上，兼容)                     → 逐字
```

三种 parser 统一输出 `lyricLine[]` 结构，渲染层根据 `info` 是否存在自动选择高亮模式。

## 后续影响

- 歌词格式兼容层（三种 parser）接管了所有格式差异，渲染层无需关心来源
- 翻译（`tlyric`）和转写（`rlyric`）使用相同的 Animation 机制，只需额外创建 Animation 对象
- `measureWords()` 工具（`utils/lyricMeasure.ts`）通过 Canvas `measureText` 预计算词宽，供 `backgroundPosition` keyframe 使用
- 歌词格式文档见 [archive/lyric-design](../archive/lyric-design)
