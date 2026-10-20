---
title: 播放主题 — 实现记录
order: 10
last-updated: 2026-09-27
related: [index.md, design.md]
---

# 播放主题 — 实现记录

> 产品需求见 [index.md](./index.md)，技术设计见 [design.md](./design.md)。

## 涉及文件

| 文件                                         | 职责                       |
| -------------------------------------------- | -------------------------- |
| `src/renderer/store/playerTheme.ts`          | 主题状态管理               |
| `src/renderer/components/BackgroundPage.vue` | 背景渲染（10 种类型）      |
| `src/renderer/components/CreativePlayer.vue` | Creative 布局（GSAP 动画） |
| `src/renderer/components/CommonPlayer.vue`   | Classic 布局               |
| `src/types/theme.ts`                         | 主题类型定义               |

## 主题数据结构

类型定义见 [design.md §1](./design.md#1-主题架构layout--senses) 和 `src/types/theme.ts`。

## 内置主题

| 名称     | 布局     | 背景          | 说明         |
| -------- | -------- | ------------- | ------------ |
| 经典布局 | Classic  | gradient      | 默认主题     |
| 歌词环游 | Creative | lottie (snow) | 雪花动画背景 |
| 信笺歌词 | Letter   | letter-image  | 信笺风格     |

## 背景类型切换逻辑

`BackgroundPage.vue` 使用 `watch` 监听 `activeBG.type` 和 `activeBG.src` 变化：

```typescript
watch([activeBG.type, activeBG.src], (newType, oldType) => {
  // 1. 清空临时状态 + 丢弃当前 api 背景图（clearApiSource）
  // 2. 停止旧类型的资源（lottie destroy, video pause）
  // 3. 加载新类型的资源
  // 4. 启动定时器（api 类型）
  // 注意：不要在这里再触发 switchApiBackground，否则会和 onMounted 的首次加载互相作废
})
```

## api 背景的预加载实现

| 关注点        | 位置                                                          |
| ------------- | ------------------------------------------------------------- |
| 当前背景地址  | `apiSrc`（带 `_t=` 的原始地址）/ `apiBgStyle`（内联样式）     |
| 预加载 + 预解码 | `preloadImage()`（`new Image()` + `decode()`，不用 `fetch`） |
| 切换入口      | `switchApiBackground()`；api 的**唯一加载入口**是 `watch([type, src], immediate)` |
| 缓存破坏      | 每次拼接 `_t=${Date.now()}`，否则图床的 30 天缓存会一直返回同一张图 |

**不要用 `fetch` 取图**：图床普遍不返回 `Access-Control-Allow-Origin`（302 与跳转目标都没有），
`fetch` 会被 CORS 拦掉并刷错误日志，而 `Image`/CSS 背景图不受此限制。预加载地址与最终
`background-image` 地址保持一致，即可复用浏览器缓存，不产生重复下载。

其他触发时机的定义见 [design.md §5](./design.md#5-背景类型的生命周期管理)。

## GSAP 动画关键代码

- `CreativePlayer.vue:392-591` — 6 种动画定义
- `CreativePlayer.vue:707-740` — `enterAnimation()` 创建 timeline
- `CreativePlayer.vue:602-670` — `splitLine()` 歌词分组逻辑
- `CreativePlayer.vue:680-694` — `buildLyricElements()` DOM 构建

## Vibrant 颜色提取

- `BackgroundPage.vue:218` — `getImage()` 提取颜色
- `BackgroundPage.vue:237` — watch `pic` 和 `useExtractedColor`
- 使用 `node-vibrant/browser` 库
