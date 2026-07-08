---
title: Store 状态管理
order: 3
last-reviewed: 2025-07-07
---

# Store 状态管理

项目使用 Pinia 进行状态管理，采用 Composition API（setup function）风格。

## Store 总览

| Store ID | 文件 | 职责 | 持久化 |
| --- | --- | --- | --- |
| `state` | `state.ts` | UI 状态（模态框、通知、滚动条等） | 否 |
| `settings` | `settings.ts` | 应用设置（主题、语言、快捷键等） | 是 |
| `player` | `player.ts` | 播放器核心（播放列表、进度、音量等） | 是 |
| `audioEngine` | `audioEngine.ts` | Web Audio API 图（EQ、混响、增益等） | 否 |
| `lyric` | `lyric.ts` | 歌词索引和定时更新 | 是 |
| `data` | `data.ts` | 🚧 旧版网易云数据（逐步迁移中，仍被 App.vue / LibraryMusic / auth / trayLyrics / utils 引用；新功能应通过 `pluginMusic`） | 是 |
| `pluginMusic` | `pluginMusic.ts` | 插件系统数据（多源聚合；承载本地与在线音乐管理） | 是 |
| `playerTheme` | `playerTheme.ts` | 播放器主题布局 | 是 |
| `osdLyric` | `osdLyric.ts` | 桌面歌词窗口状态 | 是 |

## Store 间依赖关系

```
player ──→ audioEngine, lyric, pluginMusic, osdLyric, state, settings
lyric   ──→ state, settings, osdLyric
pluginMusic ──→ state
settings ──→ (无外部依赖)
audioEngine ──→ settings
```

`player` 是最顶层的 store，聚合了 lyric、audioEngine、pluginMusic 的状态和方法，对外暴露统一的播放控制接口。

---

## 各 Store 详细说明

### state（UI 状态）

**文件**: `src/renderer/store/state.ts`（188 行） **依赖**: 无

管理与业务逻辑无关的 UI 临时状态。

**核心 State**:

| 字段                             | 类型                            | 说明               |
| -------------------------------- | ------------------------------- | ------------------ |
| `showLyrics`                     | `ref<boolean>`                  | 是否显示歌词页     |
| `searchTab`                      | `ref<SearchTab>`                | 搜索页当前 tab     |
| `exploreTab`                     | `ref<ExploreTab>`               | 发现页当前 tab     |
| `modalOpen`                      | `ref<boolean>`                  | 是否有模态框打开   |
| `toast`                          | `reactive({show, text, timer})` | Toast 通知         |
| `scrollbar`                      | `reactive({instances, active})` | 虚拟滚动位置缓存   |
| `fontList`                       | `ref<{label, value}[]>`         | 系统字体列表       |
| `dailyTracks`                    | `ref<Track[]>`                  | 每日推荐歌曲       |
| `updateStatus` / `latestVersion` | `ref`                           | 应用更新状态       |
| `amuseServerRunning`             | `ref<boolean>`                  | Amuse 服务运行状态 |

**模态框状态**（均为 `ref<boolean>` 或 `reactive`）: `setConvolverModal`, `setPlaybackRateModal`, `setPitchModal`, `setThemeModal`, `setFontModal`, `setSaveThemeModal`, `selectDirModal`, `addTrackToPlaylistModal`, `newPlaylistModal`, `accurateMatchModal`, `backgroundModal`, `editPlaylistModal`

**核心 Actions**:

| 方法                                                    | 说明                       |
| ------------------------------------------------------- | -------------------------- |
| `showToast(text)`                                       | 显示 3.2s 自动消失的 Toast |
| `getFontList()`                                         | 通过 IPC 获取系统字体列表  |
| `registerInstance(tabId)` / `unregisterInstance(tabId)` | 虚拟滚动实例注册/注销      |
| `updateScroll(tabId, payload)`                          | 更新滚动位置               |
| `checkUpdate()`                                         | 检查应用更新               |

---

### settings（应用设置）

**文件**: `src/renderer/store/settings.ts`（328 行） **依赖**: 无 **持久化**: 全量持久化（`omit: ['playerThemeNew']`）

管理所有用户可配置的设置项，每个字段变更通过 `watch` 同步到主进程。

**核心 State**:

| 分组 | 字段 | 说明 |
| --- | --- | --- |
| **theme** | `appearance` | 主题模式（auto/light/dark） |
|  | `colors` | 主题色数组（blue/purple/orange/cyan/customize） |
| **general** | `language` | 语言（zh/zh-tw/en） |
|  | `musicQuality` | 音质（128000/320000/999000） |
|  | `closeAppOption` | 关闭行为（ask/quit/minimize） |
|  | `fadeDuration` | 淡入淡出时长（秒） |
|  | `lyricBackground` | 歌词页背景效果 |
|  | `volumeNormalization` | ReplayGain 音量均衡开关 |
|  | `pageSize` | 全局每页加载数量 |
| **localMusic** | `replayGain` | 本地歌曲 ReplayGain |
|  | `embedCoverArt` | 嵌入封面模式（0/1/2/3） |
| **tray** | `showLyric` / `showControl` | 托盘歌词/控制显示 |
|  | `enableExtension` | Linux 扩展支持 |
| **unblockNeteaseMusic** | `enable` / `source` | 解锁网易云 + 来源优先级 |
| **autoCacheTrack** | `enable` / `path` / `sizeLimit` | 自动缓存配置 |
| **misc** | `enableDiscordRichPresence` | Discord 状态显示 |
|  | `lastfm` | Last.fm 连接状态 |
|  | `proxy` | 代理设置 |
| **shortcuts** | `shortcuts[]` | 自定义快捷键列表 |
| **enableGlobalShortcut** | `ref<boolean>` | 全局快捷键开关 |

**核心 Actions**:

| 方法                                     | 说明              |
| ---------------------------------------- | ----------------- |
| `updateShortcut({id, type, shortcut})`   | 更新单个快捷键    |
| `restoreDefaultShortcuts()`              | 恢复默认快捷键    |
| `lastfmConnect()` / `lastfmDisconnect()` | Last.fm 授权/断开 |
| `deleteCacheTracks(clearAll)`            | 清理缓存歌曲      |

---

### player（播放器核心）

**文件**: `src/renderer/store/player.ts`（1309 行） **依赖**: `audioEngine`, `lyric`, `pluginMusic`, `osdLyric`, `state`, `settings` **持久化**: 排除 `pic`, `title`, `fmTracks`

最顶层的播放控制 store，聚合了多个子 store 的状态和方法。

**核心 State**:

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `playing` | `ref<boolean>` | 是否正在播放 |
| `enabled` | `ref<boolean>` | 播放器是否启用（有过播放行为） |
| `progress` | `ref<number>` | 当前播放进度（秒） |
| `seek` | `computed`（可写） | 同步到 audio.currentTime + 歌词索引更新 |
| `currentTrack` | `ref<Track>` | 当前播放歌曲 |
| `currentTrackIndex` | `ref<number>` | 当前歌曲在列表中的索引 |
| `nextTrack` | `ref<Track>` | 预加载的下一首 |
| `playList` / `shuffleList` | `ref<[PluginId, ctx][]>` | 顺序/随机播放列表 |
| `playNextList` | `ref<[PluginId, ctx][]>` | "播放下一首"插队队列 |
| `isShuffle` | `ref<boolean>` | 随机播放开关 |
| `repeatMode` | `ref<RepeatMode>` | 循环模式（off/on/one） |
| `volume` / `volumeBeforeMuted` | `ref<number>` | 音量 / 静音前音量 |
| `isPersonalFM` | `ref<boolean>` | 是否在 FM 模式 |
| `fmTracks` | `ref<Track[]>` | FM 预取队列 |
| `playbackRate` | `ref<number>` | 播放速率 |
| `pic` | `ref<string>` | 当前歌曲封面 URL |
| `chorus` | `ref<number>` | 副歌起始时间 |

**从子 Store 转发的状态**:

| 来源 | 字段 | 说明 |
| --- | --- | --- |
| `lyric` | `lyrics`, `currentIndex`, `currentLyric`, `noLyric`, `lyricOffset` | 歌词相关 |
| `audioEngine` | `biquadParams`, `biquadUser`, `convolverParams`, `pitch`, `outputDevice`, `fadeDuration` | 音效相关 |
| `pluginMusic` | `likedTracks` | 收藏列表 |

**核心 Actions**:

| 方法                                             | 说明                                       |
| ------------------------------------------------ | ------------------------------------------ |
| `replacePlaylist(source, list, index)`           | 替换整个播放列表并开始播放                 |
| `replaceCurrentTrack(plugin, ctx, autoPlay)`     | 切换当前歌曲（获取详情 → 获取 URL → 播放） |
| `playOrPause()`                                  | 播放/暂停切换                              |
| `playPrev()` / `playNext(isPersonal)`            | 上一首/下一首                              |
| `switchRepeatMode()`                             | 切换循环模式（off → on → one → off）       |
| `addTrackToPlayNext(tracks, playNow, addToHead)` | 插队播放                                   |
| `playPersonalFM(playing)`                        | 进入 FM 模式                               |
| `moveToFMTrash()`                                | FM 跳过（trash + 下一首）                  |
| `resetPlayer(resetAll)`                          | 重置播放器状态                             |
| `fetchLyric()`                                   | 获取当前歌曲歌词                           |
| `reportPlayback(type)`                           | 上报播放数据（start/progress/end）         |

**IPC 监听**（通过 `handleIpcRenderer` 注册）: `play`, `previous`, `next`, `repeat`, `repeat-shuffle`, `like`, `fm-trash`, `setPosition`, `increaseVolume`, `decreaseVolume`, `resume`

#### 播放状态机

player 是全局最复杂的 store（1309 行）。以下核心状态机的设计理解直接影响调试：

**循环模式切换**：`switchRepeatMode()` 按照 `off → on → one → off` 循环。`off` 不循环列表播完即停，`on` 播完自动从头开始，`one` 单曲循环。

**Shuffle 与 playNextList**：`playList` 为顺序列表，`shuffleList` 为其洗牌版本。开启 `isShuffle` 时由 `shuffleList` 决定下一首。`playNextList` 是**插队队列**，无论是否 shuffle，下一首优先取 `playNextList` 头部，播完后自动移除。

**PersonalFM 模式**：一种特殊的非列表播放模式：

1. 通过 `playPersonalFM()` 进入，设置 `isPersonalFM = true`
2. 调用插件 `personalFM` 方法获取推荐曲目填充 `fmTracks`
3. 每次 `playNext()` 消费 `fmTracks` 头部，不足时自动补充
4. 切换为普通播放列表时通过 `replacePlaylist()` 退出 FM 模式
5. `moveToFMTrash()` 跳过当前曲目并通知插件 `fmTrash`

**两条播放路径**：

- `replacePlaylist(source, list, index)`：替换整个 `playList` 和 `shuffleList`，重置索引，开始播放。用于切换页面/歌单。
- `replaceCurrentTrack(plugin, ctx, autoPlay)`：只切换当前曲目，不修改列表。用于精确匹配、单曲切换等场景。

---

### audioEngine（音频引擎）

**文件**: `src/renderer/store/audioEngine.ts`（730 行） **依赖**: `settings`

管理 Web Audio API 图拓扑，处理 EQ、混响、音量均衡、变调变速。

**音频节点拓扑**:

```
                        ┌─── (optional) soundtouch ───┐
  audioSource ──────────┤                             ├──── eqChainIn
                        └─────────────────────────────┘

  eqChainIn ── [biquad×10] ── eqChainOut
                                  │
                    ┌─────────────┴──────────────┐
                    │                            │
              dryGain                      convolver
                    │                            │
                    │                       wetGain
                    │                            │
                    └──────────┬─────────────────┘
                               │
                          replayGain   ← 换曲时写入
                               │
                            volume     ← 用户音量（0-1）
                               │
                             fade      ← 淡入/淡出
                               │
                          destination
```

**核心 State**:

| 字段              | 类型                        | 说明                                   |
| ----------------- | --------------------------- | -------------------------------------- |
| `biquadParams`    | `reactive<BiquadParams>`    | 10 段 EQ 参数（31Hz ~ 16kHz，单位 dB） |
| `biquadUser`      | `ref<Record[]>`             | 用户保存的 EQ 预设                     |
| `convolverParams` | `reactive<ConvolverParams>` | 混响参数（IR 文件名、dry/wet 增益）    |
| `pitch`           | `ref<number>`               | 变调倍率（1.0 = 原调）                 |
| `outputDevice`    | `ref<string>`               | 输出设备 ID                            |
| `progress`        | `ref<number>`               | 当前播放时间                           |

**核心 Actions**:

| 方法 | 说明 |
| --- | --- |
| `setup(options?)` | 初始化 AudioContext + 固定拓扑（仅调用一次） |
| `destroy(options?)` | 销毁所有节点 |
| `play()` / `pause()` | 播放/暂停（带 fade 过渡） |
| `playAudioSource(urls, gain, peak, autoPlay, cueOffset, cueDuration)` | 加载并播放音频源 |
| `setPosition(time)` | 跳转（处理 CUE 分轨偏移） |
| `setPlaybackRate(rate)` | 设置播放速率 |
| `smoothGain(to, duration)` | 淡入/淡出（操作 fade 节点） |
| `setConvolver({name, source, mainGain, sendGain})` | 加载 IR 文件设置混响 |
| `applyVolume(value)` | 设置用户音量（操作 volume 节点） |
| `setDevice(device)` | 切换输出设备 |
| `getCurrentTime()` | 获取当前时间（考虑 CUE 偏移） |

**CUE 分轨支持**: 通过 `_cueOffset` / `_cueDuration` 在时间轴上映射分轨的起止位置。

---

### lyric（歌词）

**文件**: `src/renderer/store/lyric.ts`（195 行） **依赖**: `state`, `settings`, `osdLyric` **持久化**: 全量

管理歌词索引更新和定时器。

**核心 State**:

| 字段           | 类型               | 说明                   |
| -------------- | ------------------ | ---------------------- |
| `lyrics`       | `ref<LyricLine[]>` | 歌词行数组             |
| `currentIndex` | `ref<number>`      | 当前播放到的歌词行索引 |
| `offset`       | `ref<number>`      | 歌词时间偏移（秒）     |
| `currentLyric` | `computed`         | 当前行内容 + 持续时间  |

**歌词索引更新机制**: 不使用 `requestAnimationFrame` 轮询，而是用 `setTimeout` 精确预约到下一行的起始时间，减少 CPU 占用。

**核心 Actions**:

| 方法                                                          | 说明                           |
| ------------------------------------------------------------- | ------------------------------ |
| `updateIndex()`                                               | 重新计算当前歌词行并启动定时器 |
| `clearTimer()`                                                | 清除定时器（暂停时调用）       |
| `updateRate(rate)`                                            | 更新播放速率（影响定时器间隔） |
| `setOffset(value)`                                            | 设置偏移并持久化到数据库       |
| `setTimeGetter/setPlayingGetter/setRateGetter/setTrackGetter` | 注入 player 的状态读取函数     |

---

### pluginMusic（插件数据管理）

**文件**: `src/renderer/store/pluginMusic.ts`（946 行） **依赖**: `state` **持久化**: `services`, `additionalTags`, `users`, `tools`, `scanDir`, `enableLibrary/Stream/Local`

多源聚合的核心 store，管理所有插件的数据和方法调用。

**核心 State**:

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `services` | `ref<service[]>` | 所有已注册插件服务（含运行时状态） |
| `users` | `reactive<Record<PluginId, User>>` | 各插件登录用户信息 |
| `tracks` / `albums` / `artists` / `playlists` / `mvs` | `reactive<Record<PluginId, {data, sourceContext}>>` | 各插件的分页数据 |
| `likedTracks` | `reactive` | 各插件收藏歌曲 |
| `cloudDisks` / `playHistory` | `reactive` | 云盘/播放历史 |
| `tools` | `reactive<Record<MusicType, Tool>>` | 各类型插件的分页/排序参数 |
| `enableLibrary` / `enableStream` / `enableLocal` | `ref<boolean>` | 三类插件的启用开关 |

**核心 Actions**:

| 方法                                              | 说明                                   |
| ------------------------------------------------- | -------------------------------------- |
| `pluginMethodCall(pluginId, methodName, ...args)` | 插件方法调用（含 Zod 校验）            |
| `getPlugins()`                                    | 从主进程获取所有已安装插件             |
| `fetchAllTracks(plugin, reset)`                   | 加载某插件全部歌曲（支持后台全量同步） |
| `loadTrackPage(pluginId, page)`                   | 按页加载歌曲                           |
| `fetchLikedPlaylists(plugin)`                     | 获取用户歌单 + 收藏专辑                |
| `getPlaylistDetail(plugin, params)`               | 获取歌单详情                           |
| `fetchLikedArtists/MVs/CloudDisk/PlayHistory`     | 获取各类用户数据                       |
| `likeATrack(track)`                               | 收藏/取消收藏歌曲                      |
| `uploadPlugin()`                                  | 上传自定义插件                         |
| `createPluginInstance(baseId, name)`              | 创建插件实例（如多账号）               |
| `deletePluginInstance(pluginId)`                  | 删除插件实例                           |
| `scanLocalMusic()`                                | 触发本地音乐扫描                       |

---

### playerTheme（播放器主题）

**文件**: `src/renderer/store/playerTheme.ts`（252 行） **依赖**: 无 **持久化**: 全量

管理播放器页面的布局和背景主题。

**核心 State**:

| 字段          | 类型                                        | 说明                 |
| ------------- | ------------------------------------------- | -------------------- |
| `themes`      | `reactive<Record<LayoutMode, ThemeItem[]>>` | 按布局分类的主题列表 |
| `currentPath` | `reactive({mode, index})`                   | 当前选中的主题位置   |

**布局模式**: Classic（经典）、Creative（创意，含歌词环游/信笺歌词）、Customize（用户自定义）

**背景类型**: none / gradient / blur-image / dynamic-image / letter-image / custom-image / custom-video / lottie / random-folder / api

---

### osdLyric（桌面歌词）

**文件**: `src/renderer/store/osdLyric.ts`（67 行） **依赖**: 无 **持久化**: 全量

管理桌面歌词（OSD）窗口的显示状态。通过 `storage` 事件与 OSD 窗口同步。

**核心 State**:

| 字段                                | 类型                   | 说明                            |
| ----------------------------------- | ---------------------- | ------------------------------- |
| `show`                              | `ref<boolean>`         | 是否显示桌面歌词                |
| `type`                              | `ref<Type>`            | 歌词类型（small/medium）        |
| `mode`                              | `ref<Mode>`            | 显示模式（twoLines/singleLine） |
| `isLock`                            | `ref<boolean>`         | 是否锁定（不可拖动）            |
| `alwaysOnTop`                       | `ref<boolean>`         | 是否置顶                        |
| `fontSize`                          | `ref<number>`          | 字体大小                        |
| `isWordByWord`                      | `ref<boolean>`         | 逐字歌词开关                    |
| `translationMode`                   | `ref<TranslationMode>` | 翻译模式（tlyric/rlyric）       |
| `playedLrcColor` / `unplayLrcColor` | `ref<string>`          | 已播放/未播放颜色               |
| `font`                              | `ref<string>`          | 字体                            |

---

### data（🚧 逐步迁移中）

**文件**: `src/renderer/store/data.ts`（239 行） **依赖**: `state` **持久化**: `user`, `likedSongPlaylistID`, `lastRefreshCookieDate`, `loginMode`

旧版网易云专属数据 store，承载迁移前的用户认证、收藏、播放历史等状态。当前仍被 `App.vue`、`LibraryMusic.vue`、`auth.ts`、`utils/index.ts`、`trayLyrics.ts` 等文件引用，**尚未完成废弃**。新功能应通过 `pluginMusic` 的插件化接口实现。

---

## Composition API 风格

所有 store 使用 setup function 风格定义：

```typescript
export const useXxxStore = defineStore('xxx', () => {
  const someState = ref(initialValue)
  const someGetter = computed(() => { ... })
  function doSomething() { ... }
  return { someState, someGetter, doSomething }
}, {
  persist: { pick: ['someState'] }
})
```

## 持久化策略

使用 `pinia-plugin-persistedstate`，通过 `persist.pick` 指定需要持久化的字段：

```typescript
// 只持久化部分字段
{
  persist: {
    pick: ['user', 'likedSongPlaylistID', 'lastRefreshCookieDate']
  }
}

// 持久化全部（排除某些字段）
{
  persist: {
    omit: ['pic', 'title']
  }
}
```

## Store 间通信

Store 之间通过直接导入和调用通信：

```typescript
import { useAudioEngineStore } from './audioEngine'
import { useLyricStore } from './lyric'

export const usePlayerStore = defineStore('player', () => {
  const audioEngine = useAudioEngineStore()
  const lyric = useLyricStore()
  function playOrPause() {
    audioEngine.play()
    lyric.updateIndex()
  }
  return { playOrPause }
})
```

## IPC 同步

部分 store 状态需要同步到主进程，通过 `window.mainApi?.send()` 实现。

## 常见模式

| 模式                   | 说明                                                           |
| ---------------------- | -------------------------------------------------------------- |
| Store 内调用其他 Store | 直接 `import` + `useXxxStore()`                                |
| Store → 主进程         | `window.mainApi.send()`                                        |
| 持久化                 | `persist.pick` 选择性持久化                                    |
| Store 拆分             | 专职 store 放专门的领域逻辑                                    |
| 状态转发               | player store 通过 computed 转发子 store 状态，对外暴露统一接口 |
