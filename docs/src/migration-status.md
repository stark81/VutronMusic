# 重构状态与待定事项

## ✅ 已完成的迁移

- 数据库 schema 多源化（Track/Album/Artist + Source 映射表体系）
- 插件系统基础框架（PluginManager + Worker 线程执行引擎）
- 插件调用链（renderer → invoke → main → worker → Zod 验证 → 返回）
- 网易云、酷狗、Navidrome、Emby、Jellyfin 插件完整/主体功能
- 探索页、歌单、专辑、歌手页面迁移
- 评论功能迁移（rawCtx/mapCtx/mapPlugin 映射机制）
- 歌词功能迁移（plugin-lyric IPC，TrackSource 路由）
- 歌曲封面自动更新（matchTrack 成功后写入 Track.picUrl）
- 来源优先级设置（拖拽排序歌词/评论的候选插件顺序）
- 统一缓存 + 预加载策略（watch 列表变化自动触发）
- dbHelpers.ts 替代 cache.ts
- 各插件返回值统一 albumArtist 字段适配
- demo.js 全面完善（完整类型定义 + 全部 60 个 Zod 方法 stub）
- 跨平台歌曲匹配（trackMatch IPC + matchTrack 插件方法 + meta.capabilities 能力声明）
- 跨平台匹配自动触发（播放后 20 秒自动匹配，matched=0 需 UI 确认）
- 自动缓存歌曲（get-song-url IPC + cache Worker + 超额清理）
- Plugins 表 + DB 驱动插件加载
- 插件启用/禁用开关（setPluginEnable IPC）
- 听歌历史 userRecord + 听歌打卡 scrobble
- FM 电台功能（personalFM + fmTrash）
- 音量平衡开关（replayGain 支持）
- Playlist / PlaylistEntry 歌单表实现
- writeCover Worker（写封面）
- cacheTrack Worker（缓存歌曲）
- httpHandler.ts（HTTP 处理器）
- 6kLabsAmuse.ts（6kLabs 娱乐服务）
- Cookie 登录支持（library 类型插件）

## 🔄 迁移中 / 待完善

- 搜索 - 按歌词搜索的插件化
- 插件卸载清理 + 孤儿 Track 垃圾回收
- 离线歌单相关

## ⛔️ 已废弃

- `playback.ts` — 播放器插件化迁移实验，大多数方法为空函数，整体已废弃。所有播放功能保留在 `player.ts`

## 🏛️ 旧写法残留区域（不要参照复制）

- `src/main/plugin/` 目录当前为空
- `src/main/cache.ts` 已被 `dbHelpers.ts` 替代（文件残留但未被引用）

## 待定事项

| 事项                       | 涉及   | 现状                                                 |
| -------------------------- | ------ | ---------------------------------------------------- |
| canonical id 生成策略      | 数据库 | UUID / hash / 自增 ID？                              |
| Album/Artist 本地去重规则  | 数据库 | 仅 Track 层级已细化                                  |
| 跨平台匹配 UI 确认交互     | 数据库 | 自动触发已实现，matched=0 的 UI 确认流程待设计       |
| sourceContext 反向查找约定 | 数据库 | 是否统一 id 字段                                     |
| 插件卸载清理               | 数据库 | 删除 + 孤儿 GC                                       |
| 迁移机制                   | 数据库 | 当前为幂等初始化 + AppData 版本追踪，无增量 SQL 迁移 |
| matched=0 的 UI 确认交互   | 数据库 | 跨平台匹配低置信度需用户确认，交互流程待设计         |
