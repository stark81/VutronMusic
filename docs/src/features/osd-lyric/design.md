---
title: OSD 歌词 — 技术设计
last-updated: 2026-07-21
order: 8
related: [index.md, dev.md]
---

# OSD 歌词 — 技术设计

> 产品需求见 [index.md](./index.md)。本文档只记录**不常见的技术实现亮点**。

## 1. 歌词横向滚动（mini 模式）

mini 模式下，歌词可能超出容器宽度，需要横向滚动。`LyricLine.vue` 的 `buildScrollKeyFrame` 实现了一种特殊的滚动策略：

### 滚动策略

```
行宽度的前 1/2 → 不滚动（保持可见）
超出容器宽度的部分 → 滚动
行宽度的后 1/2 → 不滚动（滚动结束后保持可见）
```

这意味着：

- 歌词开始时，前半部分居中显示
- 随着播放进度，歌词向左滚动
- 滚动到后半部分时停止，后半部分居中显示

### 逐字同步滚动

当歌词有逐字数据时，滚动关键帧与逐字进度同步：

```typescript
for (let i = 0; i < info.length; i++) {
  curWidth += spanWidths[i]
  if (curWidth <= containerWidth / 2) continue
  // 计算每个字对应的滚动位置
  const sWidth = Math.min(curWidth - containerWidth / 2, scrollWidth)
  const offset = (info[i].end - start) / duration
  keyframes.push({ transform: `translateX(${-sWidth}px)`, offset })
}
```

每个字的结束时间对应一个滚动关键帧，实现"字滚到中间时刚好读完"的效果。

### 无逐字数据时的平滑滚动

```typescript
const p1 = containerWidth / 2 / totalWidth // 前 1/2 不滚动的比例
const p2 = scrollWidth / totalWidth // 滚动部分的比例
// 关键帧：不动 → 滚动 → 不动
```

## 2. 锁定后鼠标悬停透明度控制

`osdWin.ts` 实现了一套精细的透明度控制逻辑，解决"锁定后歌词挡视线但又需要偶尔查看"的问题。

### 状态机

```
锁定状态
  ├─ 光标在窗口内
  │   ├─ 光标移动 → 显示解锁按钮，恢复不透明，重新计时
  │   └─ 光标静止 → 超过 staticTime 后，透明度降为 0.02
  │
  └─ 光标移出窗口
      └─ 100ms 后 → 隐藏解锁按钮，恢复不透明
```

### 关键实现细节

**防抖设计**：

- 光标进入/离开状态变化时才通知 Vue，避免每 50ms 触发重渲染
- 光标静止时不重置 idle 计时器，保留"空闲后淡出"行为

**定时器管理**：

- `timeoutId`：控制淡出计时（光标静止后触发）
- `hideButtonTimeout`：控制按钮隐藏计时（光标移出后触发）
- 轮询间隔 50ms 不能重置 hideButtonTimeout，否则永远无法触发

```typescript
// 光标移出：100ms 后隐藏按钮、恢复不透明
if (!inside) {
  lastTrackedPos = null
  clearTimeout(timeoutId)
  if (!hideButtonTimeout) {
    hideButtonTimeout = setTimeout(() => {
      if (lockEl) lockEl.style.opacity = '0'
      root.style.opacity = '1'
      hideButtonTimeout = null
    }, 100)
  }
  return
}

// 光标在窗口内：取消"即将隐藏"的计时，确保按钮可见
clearTimeout(hideButtonTimeout)
hideButtonTimeout = null
if (lockEl) lockEl.style.opacity = '1'
```

## 3. 双行歌词分组逻辑

`OsdLyricContainer.vue` 的 `groupLyric` 计算属性将歌词行分组，决定 mini 模式下显示哪些行。

### 分组规则

| 情况                                | 分组         |
| ----------------------------------- | ------------ |
| 有翻译的歌词                        | 单独一组     |
| 连续两句无翻译歌词（twoLines 模式） | 合并为一组   |
| oneLine 模式                        | 每句单独一组 |

### 交叉显示

twoLines 模式下，当前组的最后一句 + 下一组的第一句可以交叉显示：

```typescript
const isLastLineOfGroup = highlight.value === currentGroup[1]
const nextGroup = groups[currentGroupIndex.value + 1]
if (isLastLineOfGroup && nextGroup?.length === 2) {
  return [lyrics.value[nextGroup[0]], lyrics.value[currentGroup[1]]]
}
```

当前行是组内第二句时，显示"下组第一句 + 当前组第二句"，实现视觉上的连续感。

## 4. 窗口间数据同步

### 数据流

```
主窗口 (player store)
  │ watch 各种状态变化
  ▼
synchronize.ts
  │ window.mainApi.send('synchronize-player-info', data)
  ▼
主进程 (IPCs.ts)
  │ 转发给 OSD 窗口
  ▼
OSD 窗口 (OsdLyricContainer.vue)
  │ window.mainApi.on('update-osd-status', handleOsdStatus)
  ▼
更新本地状态
```

### 同步的消息类型

| 消息          | 内容              | 触发时机     |
| ------------- | ----------------- | ------------ |
| `line`        | [lineIndex, seek] | 歌词行切换   |
| `lyricOffset` | [offset, seek]    | 歌词偏移变化 |
| `playing`     | boolean           | 播放/暂停    |
| `seek`        | number            | 进度变化     |
| `rate`        | number            | 播放速率变化 |
| `lyrics`      | LyricLine[]       | 歌词列表变化 |

### 初始化同步

OSD 窗口挂载时：

1. 从 localStorage 读取上次状态（player、lyric）
2. 发送 `init-from-osd` 给主窗口
3. 主窗口回复当前完整状态

## 相关文档

- 产品需求：[index.md](./index.md)
- 实现记录：[dev.md](./dev.md)
- 歌词系统：[../lyrics/](../lyrics/)
