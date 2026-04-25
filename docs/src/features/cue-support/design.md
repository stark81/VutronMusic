---
title: CUE 分轨支持 — 技术设计
version: 1.0
status: 已实施
author: stark81
last-updated: 2026-07-21
order: 5
related: [index.md, dev.md]
---

# CUE 分轨支持 — 技术设计

> 本文档是 CUE 分轨功能的技术设计方案。产品需求见 [index.md](./index.md)。

## 1. CUE 时间格式

CUE 文件使用"帧模式"（75 帧/秒），需要转换为毫秒：

```
格式：MM:SS:FF（分:秒:帧）
转换公式：offset = (分 × 60 + 秒) × 1000 + 帧 × (1000 / 75)

示例：
  INDEX 01 04:01:00
  = (4 × 60 + 1) × 1000 + 0 × (1000 / 75)
  = 241000 ms
```

## 2. 数据流

```
用户选择本地目录
  │
  ├─ 扫描到 CUE 文件
  ├─ 解析 CUE 内容（歌手、专辑、曲目、索引时间）
  ├─ 为每个 TRACK 创建一个 Track 记录
  │   ├─ name = TRACK TITLE
  │   ├─ albumId → 关联专辑
  │   └─ 通过 TrackArtist 关联到歌手
  ├─ 创建 Audio 记录
  │   ├─ filePath → 指向源 FLAC/WAV 文件
  │   ├─ cueOffset = INDEX 01 的时间偏移（毫秒）
  │   └─ cueDuration = 下一轨偏移 - 当前轨偏移
  └─ 播放时
      ├─ audioEngine 使用 cueOffset 精确定位到歌曲开始
      ├─ 进度条范围 = cueDuration
      └─ 用户感觉就像在播放独立的歌曲
```

## 3. 最后一轨时长处理

CUE 文件通常不包含最后一轨的结束时间。解决方案：

- 读取 FLAC 文件的总时长（totalMs）
- 最后一轨 durationMs = totalMs - 最后一轨 startMs

## 4. 技术约束

| 约束 | 说明 | 影响 |
| --- | --- | --- |
| 帧模式精度 | CUE 使用 75 帧/秒，不能简单除以 1000 | 必须使用 `Math.round(ff * (1000 / 75))` |
| 音频定位 | Web Audio API 的 currentTime 是绝对时间 | 播放时需加上 cueOffset 偏移 |
| 进度条映射 | 用户看到的是相对时间，底层是绝对时间 | 需要 `_cueRelative()` 函数转换 |
| CUE 变更检测 | 用户可能手动编辑 CUE 文件 | 扫描时比对 MD5，变化则重解析 |
| 多分轨共享文件 | 3 个分轨指向同一 FLAC | Audio 表通过 filePath + cueOffset 唯一标识 |

## 5. 播放方案设计

### 5.1 偏移计算

```typescript
// 相对时间转换：绝对时间 → 用户看到的时间
const _cueRelative = (t: number) => (_cueOffset > 0 ? t - _cueOffset / 1000 : t)

// 拖动定位：用户拖动位置 → 绝对时间
const absTime = _cueOffsetSec() + time
```

### 5.2 分轨结束检测

```typescript
// 播放进度超过分轨末尾时触发
if (_cueDuration > 0 && audio.currentTime >= (_cueOffset + _cueDuration) / 1000) {
  // 停止播放或跳转下一首
}
```

### 5.3 数据结构

```typescript
// Audio 表新增字段
{
  cueOffset: number // 分轨起始位置（毫秒），0 表示整轨
  cueDuration: number // 分轨时长（毫秒），0 表示整轨
}
```

## 相关文档

- 产品需求：[index.md](./index.md)
- 实现记录：[dev.md](./dev.md)
