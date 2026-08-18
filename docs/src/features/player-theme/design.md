---
title: 播放主题 — 技术设计
order: 10
last-updated: 2026-07-21
related: [index.md, dev.md]
---

# 播放主题 — 技术设计

> 产品需求见 [index.md](./index.md)。本文档只记录**不常见的技术实现亮点**。

## 1. 主题架构：Layout + Senses

每个主题由两层配置组成，实现布局与视觉风格的解耦：

```typescript
interface Theme {
  activeLayout: 'Classic' | 'Creative' | 'Letter'
  activeBG: string  // 背景类型
  senses: {
    Classic: { cover: number, align: string, lyric: {...} }
    Creative: { align: string, lyric: {...}, region: {...} }
    Letter: { align: string, lyric: {...} }
  }
  backgroundSource: BgSource[]
}
```

**为什么这样设计？**

- 同一布局可以有不同的"感觉"配置（字体、颜色、动画）
- 切换布局时只改 `activeLayout`，不丢失其他布局的配置
- 用户自定义主题时，可以精细控制每个布局的样式

## 2. Vibrant.js 颜色提取

从专辑封面自动提取主色调，生成渐变背景：

```typescript
const palette = await Vibrant.from(pic).getPalette()
let swatch = activeBG.useExtractedColor ? palette.Vibrant : palette.DarkMuted

const base = Color.rgb(swatch.rgb)
primary.value = base.darken(0.1).rgb().string()
secondary.value = base.lighten(0.2).rotate(-30).rgb().string()
```

**两种提取模式：**

| 模式                        | 色板选择  | 效果         |
| --------------------------- | --------- | ------------ |
| `useExtractedColor = true`  | Vibrant   | 鲜艳、突出   |
| `useExtractedColor = false` | DarkMuted | 暗沉、不抢眼 |

**颜色处理：**

- `primary`：原色 darken 10%
- `secondary`：原色 lighten 20% + rotate -30°（色相偏移）
- 生成 `linear-gradient(to top left, primary, secondary)` 渐变

## 3. Creative 布局的 GSAP 动画系统

6 种歌词入场动画，每种包含三阶段：

```
初始状态（set） → 入场动画（to） → 退场动画（to）
```

### 动画类型

| 动画            | 入场效果       | 退场效果     |
| --------------- | -------------- | ------------ |
| `splitAndMerge` | 从分散位置聚合 | 3D 旋转散开  |
| `hingeFlyIn`    | 从右侧铰链飞入 | 模糊上升     |
| `focusRise`     | 从下方聚焦上升 | 缩放模糊上升 |
| `scatterThrow`  | 从左侧散射进入 | 向右上方抛出 |
| `flipReveal`    | Y 轴翻转揭示   | X 轴旋转模糊 |
| `waveDrift`     | 波浪式从下升起 | 向上漂移模糊 |

### 动画时间控制

```typescript
const shouldAni = computed(() => {
  const currentAni = enterAns[aniType]
  return currentLyric.value.time > currentAni.enter + currentAni.leave
})
```

只有当前歌词时长大于入场+退场时间时才播放动画，避免短歌词动画被截断。

### 歌词分词与分组

Creative 布局需要将歌词拆分为字符并分组：

```typescript
const splitLine = (length: number) => {
  // 根据歌词长度和对齐方式，决定分几行
  // 左对齐：5字以内1行，5-10字随机2行，10-38字按比例分2-3行，38字以上分多行
  // 居中对齐：10字以内1行，否则对半分
}
```

### GSAP Timeline 控制

```typescript
tl = gsap.timeline({ paused: true })
tl.set('.ani-char', currentAni.ani[0]) // 初始状态
tl.to('.ani-char', currentAni.ani[1]) // 入场
tl.to('.ani-char', currentAni.ani[2], delay) // 退场（延迟到歌词结束前）

// 根据当前播放进度跳转到对应时间点
const currentTime = (seek.value - currentLyric.value.start) / playbackRate.value
tl.time(currentTime)
```

## 4. Letter 布局的扇形封面

CSS 实现的扇形展开效果：

```scss
.fan-container {
  img {
    transform-origin: 50% 600%; // 旋转中心在下方
    @for $i from 1 through 5 {
      &:nth-child(#{$i}) {
        $angle: ($i - 3) * 10deg; // -20°, -10°, 0°, 10°, 20°
        transform: rotate($angle);
        opacity: max(1 - abs($i - 3) * 0.4, 0.2);
      }
    }
  }
}
```

**关键点：**

- `transform-origin: 50% 600%`：旋转中心在封面下方 600% 处，实现扇形展开
- 5 张封面，中间一张正对，两侧各偏转 10° 和 20°
- 透明度从中间向两侧递减

**播放页展开时的过渡：**

- 扇形展开 → 堆叠成邮票形状
- `transition: all 1s cubic-bezier(0.16, 1, 0.3, 1)` 实现平滑过渡

## 5. 背景类型的生命周期管理

不同背景类型需要不同的资源管理策略：

| 类型          | 加载           | 暂停       | 销毁                                |
| ------------- | -------------- | ---------- | ----------------------------------- |
| lottie        | `play()`       | `pause()`  | `stop()` + `destroy()`              |
| video         | `play()`       | `pause()`  | `removeAttribute('src')` + `load()` |
| random-folder | 随机选取文件   | -          | 清空 tempSrc                        |
| api           | 追加时间戳缓存 | 停止定时器 | 停止定时器                          |

**Lottie 特别注意：**

```typescript
// 从 lottie 切换到其他类型，必须先停止并 destroy
if (oldType === 'lottie' && newType !== 'lottie') {
  lottieContainer.value?.stop()
  lottieContainer.value?.destroy()
}
// 否则 lottie 组件会不断尝试恢复动画，导致 CPU 占用异常
```

## 相关文档

- 产品需求：[index.md](./index.md)
- 实现记录：[dev.md](./dev.md)
