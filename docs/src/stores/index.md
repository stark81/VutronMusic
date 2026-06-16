# State 管理

项目使用 Pinia 进行状态管理，采用 Composition API（setup function）风格。

## Store 总览

| Store ID      | 文件                | 职责                                  | 持久化 |
| ------------- | ------------------- | ------------------------------------- | ------ |
| `state`       | `state.ts`          | UI 状态（模态框、通知、滚动条等）     | 否     |
| `settings`    | `settings.ts`       | 应用设置（主题、语言、快捷键等）      | 是     |
| `player`      | `player.ts`         | 播放器核心（播放列表、进度、音量等）  | 是     |
| `audioEngine` | `audioEngine.ts`    | Web Audio API 图（EQ、混响、增益等）  | 否     |
| `lyric`       | `lyric.ts`          | 歌词索引和定时更新                    | 否     |
| `data`        | `data.ts`           | 网易云用户数据（收藏、历史等）        | 是     |
| `pluginMusic` | `pluginMusic.ts`    | 插件系统数据（多源聚合）              | 是     |
| `localMusic`  | `localMusic.ts`     | 本地音乐管理                          | 是     |
| `streamMusic` | `streamingMusic.ts` | 流媒体服务（navidrome/jellyfin/emby） | 是     |
| `playerTheme` | `playerTheme.ts`    | 播放器主题布局                        | 是     |
| `osdLyric`    | `osdLyric.ts`       | 桌面歌词窗口状态                      | 是     |

## Composition API 风格

所有 store 使用 setup function 风格定义：

```typescript
// 典型 store 结构
export const useXxxStore = defineStore('xxx', () => {
  // State
  const someState = ref(initialValue)

  // Computed
  const someGetter = computed(() => { ... })

  // Methods
  function doSomething() { ... }

  // 返回所有需要暴露的内容
  return { someState, someGetter, doSomething }
}, {
  persist: {
    pick: ['someState']  // 只持久化指定字段
  }
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

Store 之间通过直接导入和调用进行通信：

```typescript
// player store 调用其他 store
import { useAudioEngineStore } from './audioEngine'
import { useLyricStore } from './lyric'
import { useSettingsStore } from './settings'

export const usePlayerStore = defineStore('player', () => {
  const audioEngine = useAudioEngineStore()
  const lyric = useLyricStore()
  const settings = useSettingsStore()

  function playOrPause() {
    audioEngine.play()
    lyric.updateIndex()
  }

  return { playOrPause }
})
```

## IPC 同步

部分 store 状态需要同步到主进程，通过 `window.mainApi?.send()` 实现：

```typescript
// settings store 同步到主进程
watch(
  () => settings.shortcutKeys,
  (val) => {
    window.mainApi?.send('setStoreSettings', {
      type: 'shortcutKeys',
      value: val
    })
  },
  { deep: true }
)
```
