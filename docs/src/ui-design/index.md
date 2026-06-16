# UI 设计规范

本文档定义 VutronMusic 的 UI 设计规范，供 AI 编码助手在开发新组件或修改现有 UI 时参考。

## 1. 布局结构

```
┌──────────────────────────────────────┐
│  SideNav (fixed, left, 垂直居中)      │
│  NavBar (fixed, top, 64px)           │
│  ├── 标题栏 (LinuxTitleBar/Win32TitleBar) │
│  ├── 导航按钮 (← →)                  │
│  └── 搜索框 + 头像                    │
│                                      │
│  #main (router-view, padding-top)    │
│                                      │
│  PlayerBar (fixed, bottom, 64px)     │
│  ├── 进度条                          │
│  └── 控制区 (左/中/右三栏)            │
│                                      │
│  PlayPage (fixed, 全屏, z-index: 20) │
│  ├── BackgroundPage                  │
│  ├── CommonPlayer / CreativePlayer   │
│  └── Modal 弹窗                      │
└──────────────────────────────────────┘
```

### 关键布局规则

- **SideNav**: 固定左侧，悬浮居中，12px 圆角，`backdrop-filter: blur`
- **NavBar**: 固定顶部，64px 高度，毛玻璃效果 `backdrop-filter: saturate(180%) blur(20px)`
- **PlayerBar**: 固定底部，64px 高度，三栏 grid 布局，毛玻璃背景
- **PlayPage**: 从底部滑入的全屏覆盖层，`z-index: 20`

## 2. 组件规范

### 基础组件

| 组件 | 文件 | 用途 |
| --- | --- | --- |
| `ButtonIcon` | `components/ButtonIcon.vue` | 所有操作按钮的底层封装，自带 hover 背景和 active 缩放 |
| `SvgIcon` | `components/SvgIcon.vue` | SVG 图标，通过 `icon-class` prop 引用 |
| `ScrollBar` | `components/ScrollBar.vue` | 自定义滚动条 |
| `ContextMenu` | `components/ContextMenu.vue` | 右键菜单 |
| `BaseModal` | `components/BaseModal.vue` | 弹窗基类 |
| `CustomSelect` | `components/CustomSelect.vue` | 自定义下拉选择 |
| `SearchBox` | `components/SearchBox.vue` | 搜索框 |

### 列表/封面组件

| 组件 | 文件 | 用途 |
| --- | --- | --- |
| `CoverBox` | `components/CoverBox.vue` | 封面图（支持 Playlist/Album/Artist/User 四种类型） |
| `CoverRow` | `components/CoverRow.vue` | 封面网格行 |
| `VirtualCoverRow` | `components/VirtualCoverRow.vue` | 虚拟滚动封面行 |
| `TrackListItem` | `components/TrackListItem.vue` | 歌曲列表项 |
| `VirtualTrackList` | `components/VirtualTrackList.vue` | 虚拟滚动歌曲列表 |

### 播放器组件

| 组件             | 文件                            | 用途                           |
| ---------------- | ------------------------------- | ------------------------------ |
| `PlayerBar`      | `components/PlayerBar.vue`      | 底部播放控制栏                 |
| `CommonPlayer`   | `components/CommonPlayer.vue`   | Classic 布局全屏播放器         |
| `CreativePlayer` | `components/CreativePlayer.vue` | Creative/Letter 布局全屏播放器 |
| `BackgroundPage` | `components/BackgroundPage.vue` | 播放器背景（10 种类型）        |
| `LyricPage`      | `components/LyricPage.vue`      | 歌词展示                       |

### 组件命名约定

- Vue 组件文件：PascalCase（如 `PlayerControls.vue`）
- 组件内 CSS 类名：kebab-case（如 `player-bar`、`cover-box`）
- 组件 prop：camelCase（如 `iconClass`、`coverType`）

## 3. 主题系统

### 三种布局模式

| 模式       | 特点                                             |
| ---------- | ------------------------------------------------ |
| `Classic`  | 左封面 + 右歌词/评论，封面支持方形/圆形/旋转圆形 |
| `Creative` | 纯歌词沉浸式，6 种动画效果                       |
| `Letter`   | 信笺式歌词布局，居中对齐                         |

### 10 种背景类型

| 类型            | 说明                       |
| --------------- | -------------------------- |
| `none`          | 无背景                     |
| `gradient`      | 渐变色（从封面提取主色调） |
| `blur-image`    | 封面模糊                   |
| `dynamic-image` | 旋转封面                   |
| `letter-image`  | 信笺图片                   |
| `custom-image`  | 用户自定义图片             |
| `custom-video`  | 用户自定义视频             |
| `lottie`        | Lottie 动画                |
| `random-folder` | 随机文件夹                 |
| `api`           | API 获取                   |

### 主题 Store

```typescript
// src/renderer/store/playerTheme.ts
export const usePlayerThemeStore = defineStore('playerTheme', () => {
  const themes = ref<Record<LayoutMode, Theme>>({...})
  const currentPath = ref({ mode: 'Classic', index: 0 })

  const activeTheme = computed(() => themes.value[currentPath.value.mode])
  const activeBG = computed(() => activeTheme.value.activeBG)

  return { themes, currentPath, activeTheme, activeBG }
})
```

## 4. 样式方案

### CSS 变量主题系统

```scss
// src/renderer/assets/css/global.scss
:root,
[data-theme='light'] {
  --color-body-bg: #ffffff;
  --color-text: #000000;
  --color-secondary: #7a7a7b;
  --color-navbar-bg: rgba(255, 255, 255, 0.86);
  --color-border: rgba(0, 0, 0, 0.2);
}

[data-theme='dark'] {
  // 暗色模式变量
}
```

### 主题切换

- 通过 `data-theme="light|dark"` 属性切换
- `--color-primary` 在 `App.vue` 的 `onMounted` 中动态设置

### 样式规范

- 所有组件使用 `<style scoped lang="scss">`
- 仅 `App.vue` 使用非 scoped 样式
- 大量使用 `v-bind()` in CSS 绑定 Vue 变量
- 使用 `rgb(from var(--color-primary) r g b / 60%)` 现代 CSS 语法
- 毛玻璃效果：`backdrop-filter: saturate(180%) blur(20px)`

### 字体栈

```scss
font-family: 'Barlow', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
```

## 5. 响应式布局

- 使用 CSS Grid + Flexbox
- 使用 `min()`/`max()`/`calc()` 现代 CSS 函数
- `CommonPlayer` 支持移动端适配（封面和歌词垂直堆叠）

## 6. 第三方 UI 库

项目**不使用** Vuetify 等第三方 UI 组件库，所有组件为手写。

使用的辅助库：

- `vue-3-slider-component` — 滑块组件
- `vue3-lottie` — Lottie 动画
- `vue-draggable-plus` — 拖拽功能
- `vue-pick-colors` — 颜色选择器
- `plyr` — 视频播放器（MV 播放）

---

## 7. JS 行为规范

### 7.1 避免逐帧驱动业务逻辑

渲染进程避免使用 `requestAnimationFrame` 做连续状态更新，除非无法替代。时间敏感的状态更新优先采用 **setTimeout 轮询 + clearTimeout 取消**模式，而非 rAF 驱动。典型示例见歌词行索引计算（7.2 节）。

需要 rAF 的场景：

- **VirtualScrollNoHeight.vue**：虚拟滚动检测（标准做法，无可替代方案）

### 7.2 歌词行索引计算模式

`src/renderer/store/lyric.ts` 的核心设计：

```
updateIndex()
  ├── clearTimeout(timer)          // 取消旧调度
  ├── currentIndex = getLyricIndex(lyrics, 0, 1)  // 计算当前行
  └── refreshLineIdx()
        ├── 计算到下一行歌词的时间差 driftTime
        └── setTimeout(refreshLineIdx, driftTime * 1000 / rate)  // 自调度
```

关键要点：

- **getLyricIndex(list, start, rate)**：线性扫描，从 `start` 位置开始查找当前播放时间对应的行索引。`rate=1` 时为毫秒级精度，`rate=1000` 时为秒级
- **依赖注入**：时间获取通过 `setTimeGetter(fn)`、`setPlayingGetter(fn)` 注入，与播放器解耦
- **偏移与语速**：支持 `offset`（歌词偏移，毫秒）和 `rate`（语速倍率），调整后自动重新计算索引
- **启停控制**：`shouldGetLrcIndex` 计算属性控制计时器启停（歌词显示/桌面歌词/系统集成等场景才启动），不显示歌词时完全静默

### 7.3 逐字歌词实现模式

`src/renderer/components/LyricLine.vue` 的核心设计：

- **数据来源**：`LyricLine` 中的 `lyric.text`（完整文本）和 `lyric.info`（逐字信息数组 `word[]`，包含每个字的 `text`、`start`、`end`）
- **DOM 结构**：每行歌词一个 DOM 元素 + 一个 `Animation` 对象。当前播放行变化时，触发对应那一行 DOM 和动画的变化
- **测量阶段**：`measureDom(dom, info)` 创建临时候选 DOM，遍历每个字测量其 `offsetWidth`，得到每个字的精确宽度。测量完成后销毁字 DOM。这些宽度用于构建多 keyframe 动画
- **动画阶段**：使用 Web Animations API（`Element.animate()`）创建多 keyframe 动画，每个 keyframe 对应一个字。通过 `Animation` 对象的 `play()`/`pause()`/`finish()` 控制播放状态
- **三种翻译模式**：支持 `tlyric`（翻译）、`rlyric`（罗马音）、`none` 切换

### 7.4 组件尺寸计算模式

避免在 Vue 组件中直接使用 `getBoundingClientRect()` 做反复测量。优先：

- CSS `min()` / `max()` / `calc()` 函数
- `v-bind()` in CSS 绑定 Vue 变量
- 必要时使用 `ResizeObserver` 而非轮询
