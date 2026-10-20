---
title: 播放主题 — 技术设计
order: 10
last-updated: 2026-09-27
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

| 类型          | 加载                                  | 暂停       | 销毁               |
| ------------- | ------------------------------------- | ---------- | ------------------ |
| lottie        | `play()`                              | `pause()`  | `stop()` + `destroy()` |
| video         | `play()`                              | `pause()`  | `removeAttribute('src')` + `load()` |
| random-folder | 随机选取文件                          | -          | 清空 tempSrc       |
| api           | `Image` 预加载 + 预解码 → 原子替换     | 停止定时器 | 停止定时器         |

**API 背景为什么要预加载：**

API 类型每次切换都会请求一个新地址（随机图接口尤其如此），直接把新地址写进
`background-image` 的话，「切歌 → 图片下载完成」这段时间里背景是空的，观感上背景明显比歌曲慢一拍。
现在的做法是：

1. 切歌 / 定时到点时，先用 `new Image()` 把图片地址加载并 `decode()` 预解码到「可以立刻上屏」；
2. 图片 ready 之前不碰画面，旧背景继续可见；
3. ready 后**原子替换**单层背景，没有透明度过渡。

> 为什么用 `Image` 而不是 `fetch`：图床基本都不返回 `Access-Control-Allow-Origin`
> （例如 `tu.ltyuanfang.cn` 的 302 与其跳转目标都没有），`fetch` 会被 CORS 直接拦掉并报错，
> 而 `Image` / CSS 背景图的加载不受 CORS 限制。预加载用的地址与最终交给
> `background-image` 的地址**完全一致**，所以可以直接复用浏览器已下载的缓存，不会重复下载。

> 为什么每次都要换地址（`_t=` 时间戳）：图床（或其 CDN）对同一地址会返回
> `Cache-Control: max-age=2592000`，同一地址反复用就永远是同一张图，
> 表现为「定时切换不生效」。

> 为什么不用双层交叉淡入：两层都是半透明（受 `opacity` 设置影响）且叠加了模糊滤镜，
> 交叉过渡期间两张图会同时可见，看起来就是**重影**。因此这里只做原子替换。

**触发时机必须互不重叠：**

| 时机     | 触发者                                                    |
| -------- | --------------------------------------------------------- |
| 首次加载 | `watch([type, src], immediate)` → `switchApiBackground()` |
| 切换地址 | 同上（改 `activeBG.src`）                                 |
| 切歌     | `watch(currentTrack.id)`                                  |
| 定时切换 | `setInterval`（仅 `switchMode === 'time'`）               |

> `api` 的加载入口**只能有一处**。`clearApiSource()` 会 `abort` 前一次加载并递增令牌，
> 若 `onMounted` 与类型监听都触发一次，两者会互相作废，首张图要等两轮才上屏（实测首帧为空白）。

`Image` 加载失败或 8s 超时后会退回直接使用原地址（多花一次下载时间，不会出现背景永久卡住）。
载入令牌（`apiLoadToken`）保证定时切换与切歌几乎同时触发时，只有最后一次的结果会生效；
`AbortController` 用于提前结束「等待」，图片本身仍留在浏览器缓存里。

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
