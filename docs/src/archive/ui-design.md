---
title: UI 设计
order: 6
---

# UI 设计

## 设计来源

VutronMusic 的 UI 不是从零开始的。它参考了多个优秀项目，然后逐步形成了自己的风格。

| 参考来源 | 影响 | 说明 |
|---------|------|------|
| **[YesPlayMusic](https://github.com/qier222/YesPlayMusic)** | 整体布局和播放页面 | 网易云第三方播放器的经典布局 |
| **方格音乐** | 侧边导航栏设计 | 侧边栏的导航结构和图标风格 |
| **[NSMusicS](https://github.com/Super-Badmen-Viper/NSMusicS)** | 本地音乐统计信息 | 本地音乐页面的数据展示方式 |

## 播放器主题系统

VutronMusic 提供了多种播放器主题（Theme），用户可以在设置中切换：

| 主题 | 特点 | 适用场景 |
|------|------|---------|
| **Classic** | 经典播放器布局 | 日常使用 |
| **Creative** | 创意播放器布局 | 沉浸式听歌 |
| **Letter** | 文字的播放器 | 简洁风 |
| **Customize** | 用户自定义 | 个性化 |

每个主题可以独立配置背景、歌词样式、颜色方案。

## 设计原则

1. **内容优先** — 专辑封面、歌词是视觉中心，控制元素不喧宾夺主
2. **暗色为主** — 音乐播放器适合暗色背景，减少视觉疲劳
3. **平台自适应** — macOS 使用 `hiddenInset` 标题栏，Windows/Linux 使用原生标题栏
4. **透明度与毛玻璃** — 播放器背景支持透明/毛玻璃效果

---

## 技术参考

### 主题系统

**文件**：`src/renderer/store/playerTheme.ts`

```typescript
interface PlayerTheme {
  themes: {
    classic: ThemeConfig[]
    creative: ThemeConfig[]
    customize: ThemeConfig[]
    copy: ThemeConfig[]
  }
  currentPath: { mode: string; index: number }
}
```

### 主要页面

| 页面 | 路由 | 组件 | 功能 |
|------|------|------|------|
| 首页 | `/` | `HomePage.vue` | 推荐、最近播放、快捷入口 |
| 探索 | `/explore` | `ExplorePage.vue` | 分类浏览、排行榜 |
| 曲库 | `/library` | `LibraryMusic.vue` | 按专辑/歌手/歌单浏览 |
| 本地音乐 | `/local-music` | `LocalMusic.vue` | 本地文件管理 |
| 播放页 | `/play` | `PlayPage.vue` | 全屏播放器、歌词 |
| 搜索 | `/search` | `SearchPage.vue` | 多源搜索 |
| 设置 | `/settings` | `SystemSettings.vue` | 所有配置项 |

### 图标与资源

- 应用图标：`buildAssets/icons/icon.png`
- 默认封面：`src/public/images/default-cover.svg`
- 缩略图按钮：`src/public/images/thumBar/`
- 托盘图标：`src/public/images/tray/`
