---
title: 桌面歌词设计
order: 8
---

# 桌面歌词设计

## 关键设计决策

| 决策         | 选择                    | 理由                       |
| ------------ | ----------------------- | -------------------------- |
| 歌词窗口形态 | **独立 OSD 窗口**       | 不依赖主窗口状态，始终显示 |
| 窗口间通信   | **MessagePort**         | 避免走 IPC 中转，延迟更低  |
| 歌词格式     | **LRC + Lyricify 逐字** | 兼容已有文件 + 支持新体验  |

## 独立窗口架构

桌面歌词是独立于主窗口的 BrowserWindow，通过 MessagePort 与主窗口通信：

```
主窗口 ←→ MessagePort ←→ OSD 歌词窗口
```

- 主进程通过 `port-connect` 事件建立连接
- 消息格式：`{ type: string, data: any }`
- 常见消息类型：`update-osd-status`、`init-from-osd`、`get-seek`

**为什么用独立窗口？** 不依赖主窗口状态，即使主窗口最小化或被遮挡，歌词仍然可见。可拖拽到副屏。

## Lyricify 逐字歌词格式

在 LRC 基础上增加逐字时间戳：

```
[00:01.00]爱(00:00.10)在(00:00.20)西(00:00.30)元(00:00.40)前(00:00.50)
```

逐字渲染通过 Web Animations API 实现，支持三种入场动画：`hingeFlyIn`、`splitAndMerge`、`scatterThrow`。
