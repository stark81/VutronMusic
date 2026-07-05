---
title: 代码规范
order: 4
last-reviewed: 2025-07-07
---

# 代码规范

## Prettier 配置

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "none",
  "endOfLine": "lf",
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "htmlWhitespaceSensitivity": "strict"
}
```

**关键规则**：无分号、单引号、无尾逗号、LF 换行、2 空格缩进。

## ESLint

- **扩展**: `vue3-recommended` + `standard` + `prettier`
- **解析器**: `vue-eslint-parser` + `@typescript-eslint/parser`
- **未使用变量**: 仅警告（`no-unused-vars: 0`）

## TypeScript 配置

### 渲染进程 (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": false,
    "allowJs": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/renderer", "src/types"]
}
```

### 主进程 / Preload (`tsconfig.node.json`)

```json
{
  "compilerOptions": { "composite": true, "module": "ESNext", "moduleResolution": "node" },
  "include": ["src/main", "src/preload", "package.json", "vite.config.ts", "buildAssets/builder"]
}
```

**注意**：`strict: true` 但 `noImplicitAny: false`，允许隐式 any。

## Vue / 样式规范

| 规范 | 约定 |
|------|------|
| Vue 组件 | PascalCase 文件名 |
| CSS 类名 | kebab-case |
| Prop 命名 | camelCase |
| 样式作用域 | `<style scoped lang="scss">`，仅 `App.vue` 非 scoped |
| 主题系统 | CSS 变量（`--color-*`）+ `data-theme="light\|dark"` |
| 毛玻璃 | `backdrop-filter: saturate(180%) blur(20px)` |
| 字体栈 | `'Barlow', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif` |

## 文件组织

### 目录职责

| 目录 | 放什么 | 命名模式 |
|------|--------|----------|
| `views/` | 路由页面级组件 | `{Name}Page.vue`（PlayPage, SearchPage, ExplorePage） |
| `components/` | 可复用 UI 组件 | PascalCase，无固定后缀 |
| `store/` | Pinia Store | camelCase（player.ts, audioEngine.ts） |
| `api/` | 前端 API 调用 | camelCase 按领域划分（track.ts, auth.ts, user.ts） |
| `utils/` | 工具函数 | camelCase |
| `locales/` | 国际化翻译 | `{lang}.json`（zh-hans.json, en.json） |

### 组件命名约定

| 类别 | 前缀/后缀 | 示例 |
|------|-----------|------|
| 页面视图 | `{Name}Page` | `PlayPage.vue`, `SearchPage.vue`, `ExplorePage.vue` |
| 模态框 | `Modal{Name}` | `ModalConvolver.vue`, `ModalPitch.vue`, `ModalNewPlaylist.vue` |
| 列表项 | `{Name}Item` | `TrackListItem.vue`, `AlbumListItem.vue`, `ArtistListItem.vue` |
| 平台标题栏 | `{Platform}TitleBar` | `Win32TitleBar.vue`, `LinuxTitleBar.vue` |

### 目录布局约定

- `components/` 下所有组件**平铺在根目录**，不分子目录（目前 ~60 个组件均为单层结构）
- `store/`、`api/`、`utils/` 下按领域/功能拆分文件，不嵌套子目录

## Import 顺序

组件 `<script setup>` 中的 import 排列遵循以下模式：

```typescript
// 1. 本地组件
import SvgIcon from './SvgIcon.vue'
import ArtistsInLine from './ArtistsInLine.vue'

// 2. Vue / 第三方库
import { computed, ref, toRefs, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import isEqual from 'lodash/isEqual'

// 3. Store
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import { usePlayerStore } from '../store/player'

// 4. 类型
import { PluginId, Track } from '@/types/plugin'
import { SourceType } from '@/types/music'
```

## Store 使用模式

```typescript
// 初始化
const settingsStore = useSettingsStore()
const playerStore = usePlayerStore()

// 响应式解构
const { general } = storeToRefs(settingsStore)
const { currentTrack, enabled } = storeToRefs(playerStore)

// 非响应式解构（方法）
const { likeATrack } = pluginStore
```

## Props / Events 命名

| 概念 | 约定 | 示例 |
|------|------|------|
| Props | camelCase（TypeScript 泛型定义） | `trackProp`, `typeProp`, `isLyric`, `showService` |
| Events | kebab-case（`$emit('event-name')`） | `@play-this`, `@add-to-playlist` |
| Slots | camelCase | `#default`, `#header` |

## 与 workflow.md 禁区的交叉引用

代码规范中的约定与 [开发工作流](./workflow) 中的禁区互补：
- **workflow.md** 定义了**不要做什么**（禁区）
- **本文件** 定义了**怎么做**（约定）
