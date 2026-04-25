# 为本地歌曲写入歌曲封面 — 实施计划

## Context

在插件化重构之前，`writeCover.ts` worker 已实现写入封面功能，并通过 `playerBak.ts_bak` 中的 `searchMatchForLocal` 函数触发。重构后：
- Worker 代码和 IPC handler（`IPCs.ts:1218-1228`）仍然存在
- 但 **preload 白名单缺少 `write-cover` 通道**，渲染进程无法发送消息
- **新的 `player.ts` 没有调用 `write-cover`**，功能完全断开

## Worker 代码审阅结论

`src/main/workers/writeCover.ts` 代码**无需修改**，逻辑完整：
- 从 URL 下载封面图 → sharp 缩放到 512×512 → 写入文件 / 嵌入音频标签
- 队列系统处理嵌入任务，跳过当前播放文件避免冲突
- IPC handler 已从 store 读取 `embedCoverArt` 和 `embedStyle` 设置
- 退出时通过 `before-quit` 事件 flush 队列

## 实施步骤

### 1. 添加 IPC 通道到 preload 白名单

**文件**: `src/preload/index.ts`

在 `mainAvailChannels` 数组中添加 `'write-cover'`，使渲染进程可以通过 `window.mainApi.send('write-cover', ...)` 发送消息。

### 2. 在 player store 中触发封面写入

**文件**: `src/renderer/store/player.ts`

在 `replaceCurrentTrack` 函数中，在 `triggerTrackMatch` 调用之后（约第 477 行之后），添加对本地歌曲的封面写入逻辑：

```typescript
// 替换歌曲后，为本地歌曲触发封面写入
if (currentTrack.value?.type === 'local' && currentTrack.value?.filePath) {
  window.mainApi?.send('write-cover', {
    filePath: currentTrack.value.filePath,
    picUrl: currentTrack.value.picUrl || null,
    currentPlayingPath: currentTrack.value.filePath
  })
}
```

触发条件：
- `track.type === 'local'` — 仅本地歌曲
- `track.filePath` 存在 — 有物理文件路径
- `picUrl` 可能来自 trackMatch 匹配结果（主进程已在 `trackMatch` handler 中通过 `updateTrackPicUrl` 更新了 DB 中的 picUrl）

### 3. 确认 picUrl 的来源

在 `replaceCurrentTrack` 中，`currentTrack` 是通过 `pluginMethodCall(plugin, 'getTrackDetail', ...)` 获取的。对于 local 插件，`getTrackDetail` 返回的 track 应包含 `picUrl`（来自 DB 中的 Track 表）。

`trackMatch` 匹配成功后，主进程会调用 `updateTrackPicUrl(effectiveTrackId, result.data.picUrl)` 更新 DB。但 `getTrackDetail` 是在 `trackMatch` 之前调用的，所以第一次播放时 picUrl 可能为空。后续播放时 picUrl 会从 DB 中读取到更新后的值。

如果需要在匹配成功后**立即**写入封面，可以在 `triggerTrackMatch` 的 Promise 回调中触发 `write-cover`。但这会增加复杂度，建议先采用简单方案（匹配后下一次播放时写入），观察效果再决定是否需要优化。

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/preload/index.ts` | `mainAvailChannels` 添加 `'write-cover'` |
| `src/renderer/store/player.ts` | `replaceCurrentTrack` 中添加 `write-cover` 调用 |

## 验证方式

1. 启动 `yarn dev`
2. 确保设置中 `embedCoverArt` 不为 0（默认为 0 即"两者都"）
3. 播放一首本地歌曲（有 picUrl 的，如已匹配的歌曲）
4. 检查歌曲目录下是否生成了 `.jpg` / `.png` 封面文件
5. 用音频播放器检查音频文件是否嵌入了封面
6. 在设置中切换 `embedCoverArt` 选项，验证不同模式是否正常工作
