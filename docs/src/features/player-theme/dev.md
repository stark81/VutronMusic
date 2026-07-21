---
title: 播放主题 — 实现记录
order: 10
last-updated: 2026-07-21
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
  // 1. 清空临时状态
  // 2. 停止旧类型的资源（lottie destroy, video pause）
  // 3. 加载新类型的资源
  // 4. 启动定时器（api 类型）
})
```

## GSAP 动画关键代码

- `CreativePlayer.vue:392-591` — 6 种动画定义
- `CreativePlayer.vue:707-740` — `enterAnimation()` 创建 timeline
- `CreativePlayer.vue:602-670` — `splitLine()` 歌词分组逻辑
- `CreativePlayer.vue:680-694` — `buildLyricElements()` DOM 构建

## Vibrant 颜色提取

- `BackgroundPage.vue:146-163` — `getImage()` 提取颜色
- `BackgroundPage.vue:165-174` — watch `pic` 和 `useExtractedColor`
- 使用 `node-vibrant/browser` 库
