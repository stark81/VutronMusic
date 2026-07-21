---
last-updated: 2026-07-21
title: 组件参考
order: 7
last-reviewed: 2025-07-21
---

# 组件参考

渲染进程共有 ~63 个 Vue 组件，位于 `src/renderer/components/`。本文档覆盖核心组件的 Props、Events、Slots 和使用场景。

## 组件总览

| 组件               | 行数 | 职责                                           |
| ------------------ | ---- | ---------------------------------------------- |
| `VirtualTrackList` | 759  | 虚拟滚动歌曲列表（含右键菜单、拖拽、评论面板） |
| `PlayerBar`        | 489  | 底部播放控制栏                                 |
| `CreativePlayer`   | ~400 | 创意播放器布局                                 |
| `CommonPlayer`     | ~350 | 通用播放器布局                                 |
| `NavBar`           | 277  | 顶部导航栏（返回/前进、搜索、用户菜单）        |
| `CoverRow`         | 206  | 专辑/艺术家/歌单网格卡片                       |
| `BaseModal`        | 193  | 通用模态框容器                                 |
| `SideNav`          | 169  | 左侧浮动导航栏                                 |

---

## BaseModal — 通用模态框

所有模态框的底层容器，提供遮罩层、标题栏、滚动内容区和可选底部操作栏。

```vue
<BaseModal :show="isVisible" :close-fn="close" title="编辑歌单" width="30vw" :show-footer="true">
  <template #default>
    <!-- 模态框内容 -->
  </template>
  <template #footer>
    <!-- 底部按钮 -->
  </template>
</BaseModal>
```

### Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `show` | `Boolean` | `false` | 否 | 控制显示/隐藏 |
| `closeFn` | `Function` | — | **是** | 关闭回调（不是 emit，是 prop） |
| `title` | `String` | `''` | 否 | 标题文本 |
| `width` | `String` | `'50vw'` | 否 | 模态框宽度 |
| `minWidth` | `String` | `'calc(min(23rem, 100vw))'` | 否 | 最小宽度 |
| `showFooter` | `Boolean` | `true` | 否 | 是否显示底部区域 |

### Slots

| 名称      | 说明                                          |
| --------- | --------------------------------------------- |
| `default` | 模态框主体内容                                |
| `footer`  | 底部操作按钮区（仅 `showFooter=true` 时渲染） |

### 行为

- 打开时自动禁用页面滚动（`enableScrolling = false`），关闭时恢复
- 关闭通过 `closeFn` 回调而非 `close` emit — 调用方传入自己的关闭逻辑
- 支持暗色主题（`[data-theme='dark']`），含 Firefox 兼容处理

---

## PlayerBar — 播放控制栏

固定在窗口底部的播放控制条，显示当前曲目封面/名称/艺术家、进度条、播放控制和音量。

```vue
<!-- 无 props，所有状态来自 Pinia store -->
<PlayerBar />
```

### Props / Emits / Slots

均无。所有状态通过 Pinia store 获取。

### 依赖的 Store

| Store | 使用的成员 |
| --- | --- |
| `usePlayerStore` | `duration`, `currentTrack`, `playing`, `isPersonalFM`, `repeatMode`, `isShuffle`, `seek`, `pic`, `volume`, `isLiked`, `lyrics`, `source` |
| `useOsdLyricStore` | `show` |
| `useNormalStateStore` | `showLyrics`, `enableScrolling` |
| `useSettingsStore` | `general.jumpToLyricBegin`, `general.clickToLyric` |
| `usePluginMusic` | `likeATrack()` |

### 行为

- 进度条拖拽时，若启用 `jumpToLyricBegin`，会吸附到最近歌词行的起始时间
- 悬停进度条显示对应歌词文本
- 音量通过鼠标滚轮调节（每格 ±0.02）
- Personal FM 模式下"上一首"按钮替换为"不喜欢"按钮
- 点击主控制区切换歌词侧面板

---

## NavBar — 顶部导航栏

包含浏览器式返回/前进按钮、上下文子标签页（搜索结果或发现分类）、搜索框和用户头像菜单。

```vue
<!-- 无 props -->
<NavBar />
```

### 子标签页

根据当前路由自动切换：

| 路由       | 显示的子标签                                    |
| ---------- | ----------------------------------------------- |
| `/search`  | tracks / albums / artists / playlists / mvs     |
| `/explore` | playlist / chart / newTrack / newAlbum / artist |

### 子组件

`ButtonIcon`, `SvgIcon`, `SearchBox`, `ContextMenu`, `LinuxTitleBar`, `Win32TitleBar`

---

## SideNav — 侧边导航

左侧浮动垂直图标栏，提供首页、发现、音乐库、流媒体、本地音乐、设置的快捷入口。

```vue
<!-- 无 props -->
<SideNav />
```

### 行为

- 各导航项根据已启用的插件类型条件渲染
- "本地音乐"需要 `enableLocal && window.env?.isElectron`
- 路由激活状态通过精确路径匹配判断

---

## CoverRow — 卡片网格

以网格布局渲染专辑/艺术家/歌单卡片，每张卡片包含封面图、标题和可选副文本。

```vue
<CoverRow
  :items="albumList"
  type="album"
  :colunm-number="5"
  sub-text="artist"
  :show-play-count="true"
/>
```

### Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `items` | `(Album \| Artist \| Playlist)[]` | — | 数据列表 |
| `type` | `CoverType` | — | `'album'` / `'artist'` / `'playlist'` |
| `subText` | `String` | `'null'` | 副文本模式：`'artist'` / `'updateFrequency'` / `'copywriter'` / `'releaseYear'` |
| `colunmNumber` | `Number` | `5` | 列数 |
| `gap` | `String` | `'34px 24px'` | 网格间距 |
| `showPlayCount` | `Boolean` | `false` | 是否显示播放次数 |
| `playButtonSize` | `Number` | `22` | 播放按钮大小 |

---

## VirtualTrackList — 虚拟滚动歌曲列表

项目中最复杂的组件（759 行），集成了虚拟滚动、右键菜单、拖拽排序、评论面板和播放队列管理。

```vue
<VirtualTrackList :tracks="trackList" :type="'playlist'" :id="playlistId" />
```

### 核心能力

- **虚拟滚动**：仅渲染可视区域内的行，支持万级数据量
- **右键菜单**：添加到播放队列、收藏、查看评论等
- **拖拽排序**：通过 `vue-draggable-plus` 支持
- **评论面板**：内嵌评论列表和发表评论功能
- **播放队列**：管理"下一首播放"和队列顺序

---

## 其他常用组件

| 组件 | 用途 | 关键 Props |
| --- | --- | --- |
| `SearchBox` | 搜索输入框 + 插件选择器 | `services`, `placeholder`, `inputWidth` |
| `ContextMenu` | 右键菜单容器 | `show`, `position` |
| `ButtonIcon` | 图标按钮 | `iconClass` |
| `SvgIcon` | SVG 图标渲染 | `iconClass` |
| `CustomSelect` | 自定义下拉选择器 | `options`, `modelValue` |
| `CoverBox` | 单个封面图卡片（含播放按钮覆盖层） | `url`, `type`, `playButtonSize` |
| `AlbumListItem` | 专辑列表项 | `album` |
| `ArtistListItem` | 艺术家列表项 | `artist` |
| `TrackListItem` | 歌曲列表项 | `track`, `index` |
| `DailyTracksCard` | 每日推荐卡片 | — |
| `ModalEditPlaylist` | 编辑歌单模态框 | `show`, `playlist` |
| `ModalNewPlaylist` | 新建歌单模态框 | `show` |
| `ModalAccurateMatch` | 精确匹配模态框 | `show`, `track` |
| `ModalPlayerTheme` | 播放器主题设置模态框 | `show` |
| `ModalPlayerFont` | 播放器字体设置模态框 | `show` |
| `ModalSaveTheme` | 保存自定义主题模态框 | `show` |
| `ModalPitch` | 音调调节模态框 | `show` |
| `ModalBackground` | 播放器背景设置模态框 | `show` |
| `ModalPlayback` | 播放设置模态框 | `show` |
| `ModalConvolver` | 混响效果设置模态框 | `show` |
| `ModalFilePaths` | 文件路径设置模态框 | `show` |
| `LyricLine` | 单行歌词渲染 | `line`, `active` |
| `ScrollBar` | 自定义滚动条 | — |
| `Pagination` | 分页器 | `total`, `pageSize` |
