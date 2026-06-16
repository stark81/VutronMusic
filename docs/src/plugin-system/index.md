# 插件系统

VutronMusic 从 v3.3.0 开始重构为多插件聚合架构。本文档详细描述插件系统的设计原理、通信协议和开发规范。

---

## 1. 架构概览

```
渲染进程 (renderer/store/pluginMusic.ts)
    │  window.mainApi.invoke('plugin-method-call', pluginId, methodName, ...args)
    ▼
Preload (preload/index.ts)
    │  ipcRenderer.invoke → 白名单校验
    ▼
主进程 (main/IPCs.ts)
    │  initPluginIpcMain() → pluginManager.call(pluginId, methodName, params)
    ▼
PluginManager (main/pluginManager.ts)
    │  pluginManager.plugins.get(pluginId) → PluginInstance.call(methodName, params)
    ▼
PluginInstance (main/utils/pluginManager.ts)
    │  worker.postMessage({ type: 'CALL_METHOD', method, args, callId })
    ▼
Worker 线程 (main/workers/pluginRunner.ts)
    │  new Function('api', 'exports', code) 执行插件代码
    │  pluginExports[method](...args) 调用对应方法
    │  结果通过 worker.postMessage({ type: 'CALL_RESULT', callId, result }) 返回
    ▼
主进程
    │  PluginResultSchema[method].parse(result)  ← Zod 验证
    ▼
渲染进程收到类型化结果
```

---

## 2. 插件加载流程

### 2.1 启动时加载

应用启动时，`IPCs.initialize()` 调用 `initPluginIpcMain()`，采用 **DB 驱动加载**：

```
① 从 Plugins 表读取所有已注册插件
   SELECT * FROM Plugins WHERE enabled = 1

② 获取插件文件路径
   内置插件：src/public/plugin/ (开发) 或 dist/plugin/ (生产)
   用户插件：{app.getPath('userData')}/plugins/

③ 创建并注册
   for each plugin:
     plugin = new PluginInstance(filePath, id)   // 创建 Worker 线程
     pluginManager.register(id, plugin)          // 注册到管理器
```

内置插件（local、kugou、netease、emby、jellyfin、navidrome）在 `plugin.sql` 中通过 `INSERT OR IGNORE` 自动注册。用户上传的新插件会同时写入 `Plugins` 表和复制文件。

### 2.2 用户上传插件

用户通过 UI 触发 `upload-plugin` 流程：

```
① 系统弹窗选择 .js 文件
② 复制到 {userData}/plugins/ 目录
③ new PluginInstance(targetPath, id) 创建新实例
④ pluginManager.register(id, plugin) 注册
```

### 2.3 PluginInstance 内部流程

构造函数 (`src/main/utils/pluginManager.ts`)：

```
① 读取 .js 文件内容（fs.readFileSync）
② 创建 Worker 线程（workers/pluginRunner.js）
③ worker.postMessage({ type: 'LOAD_PLUGIN', code }) 发送源码
④ Worker 内通过 new Function('api', 'exports', code) 执行
⑤ 执行成功后返回 { type: 'LOAD_DONE', meta }
⑥ PluginInstance.loaded = true 就绪
```

---

## 3. Worker 通信协议

插件在 Worker 线程中运行，**不能直接访问** electron API、文件系统、DOM 等。所有能力通过消息机制从主进程获取。

### 3.1 消息类型全览

| 方向 | 消息类型 | 用途 | 关键字段 |
| --- | --- | --- | --- |
| 主→Worker | `LOAD_PLUGIN` | 发送插件源码 | `code: string` |
| Worker→主 | `LOAD_DONE` | 插件加载完成 | `meta: PluginMeta` |
| Worker→主 | `ERROR` | 加载失败 | `message: string` |
| Worker→主 | `LOG` | 日志输出 | `msg: string` |
| Worker→主 | `HTTP_REQUEST` | HTTP 网络请求 | `url, params/ data, headers, method, requestId, raw` |
| 主→Worker | `HTTP_RESPONSE` | HTTP 响应 | `requestId, data/ error, status, headers, raw` |
| Worker→主 | `STORE_REQUEST` | 读取 electron-store | `key, requestId` |
| Worker→主 | `STORE_SET` | 写入 electron-store | `key, value` |
| 主→Worker | `STORE_RESPONSE` | 读取结果 | `requestId, data` |
| Worker→主 | `DB_REQUEST` | 读取数据库 | `key('PluginData'/'Track'/'Artist'/'Album'), requestId` |
| Worker→主 | `DB_SET` | 写入数据库 | `key('PluginData'/'Track'/'Artist'/'Album'), value` |
| 主→Worker | `DB_RESPONSE` | 数据库读取结果 | `requestId, data` |
| Worker→主 | `LYRIC_PARSE` | 歌词解析 | `msg, requestId` |
| 主→Worker | `LYRIC_RESPONSE` | 解析结果 | `requestId, data` |
| 主→Worker | `CALL_METHOD` | 调用插件方法 | `callId, method, args` |
| Worker→主 | `CALL_RESULT` | 方法返回结果 | `callId, result/ error` |

### 3.2 HTTP_REQUEST 说明

`api.http.get(url, params, headers?, raw?)` 和 `api.http.post(url, data, headers?, raw?)` 发出的请求在主进程执行，有域名白名单校验：

- 请求超时：12 秒
- 重定向：手动处理，只允许重定向到白名单域名
- 并发：最多 2 个连接（`dispatcher.connections = 2`）
- User-Agent：`Mozilla/5.0 VutronMusic`
- POST 自动添加 `Content-Type: application/json`
- `raw=true` 时返回 `{ data, status, headers }` 完整响应对象
- `raw=false`（默认）时直接返回解析后的 JSON 数据

### 3.3 STORE_REQUEST 说明

数据来源：`electron-store` 的 `plugins.{pluginId}` 命名空间。

- `key` 为空字符串时返回整个命名空间
- `key` 指定时返回 `plugins.{pluginId}.{key}` 子值

### 3.4 DB_REQUEST 说明

支持的 `key` 值：

- `'PluginData'`：插件持久化数据（账号登录态、token、cookie）
- `'Track'`：本地音乐列表（完整组装，含 artist/album/audio 关联数据）
- `'Artist'`：歌手数据（`Artist` 表全量查询）
- `'Album'`：专辑数据（`Album` 表全量查询）

### 3.5 LYRIC_PARSE 说明

支持三种歌词格式：

- YRC 逐字歌词（需包含 `yrc.lyric`）
- LRC 标准歌词（需包含 `lrc.lyric`）
- 纯文本歌词字符串

---

## 4. 插件设计原则

### 4.1 职责边界

插件负责：

- 数据获取（HTTP API 调用）
- 数据转换（平台数据 → VutronMusic 标准结构）
- 登录态管理（token、cookie、session）
- sourceContext 维护
- 平台特有能力实现

插件不负责：

- UI 逻辑
- Vue 组件状态管理
- Pinia Store 设计
- 数据库 Schema 设计
- Track/Album/Artist 聚合逻辑
- 多平台匹配逻辑
- 播放器核心逻辑

### 4.2 多源聚合职责

插件仅负责提供平台数据。

以下逻辑属于核心架构层：

- Track 归一化
- Audio 与 Track 关联
- TrackSource 建立与维护
- 跨平台歌曲匹配
- 歌词来源选择
- 评论来源选择
- 播放源选择

插件不得尝试实现上述逻辑。

例如：

错误：

```javascript
exports.mergeTrack = async () => {}
exports.matchTrack = async () => {}
exports.selectBestAudio = async () => {}
```

正确：

```javascript
exports.search = async () => {}
exports.getLyric = async () => {}
exports.getComments = async () => {}
```

插件只负责提供数据，聚合由核心层完成。

### 4.3 sourceContext 原则

sourceContext 是插件私有数据。

允许：

```javascript
{
  id: 186016
}
```

```javascript
{
  hash: 'xxx',
  mixsongid: 'xxx'
}
```

禁止：

```javascript
{
  trackId: 'canonical-track-id'
}
```

```javascript
{
  selectedLyricProvider: 'kugou'
}
```

```javascript
{
  globalTrackMapping: {
  }
}
```

sourceContext 不应包含跨平台或核心架构状态。

### 4.4 返回值原则

插件返回：

- 原始业务数据
- sourceContext
- 平台特有附加信息

插件不返回：

- UI 状态
- Vue 组件配置
- 页面展示逻辑
- 平台无关聚合数据

错误：

```javascript
{
  showVipIcon: true,
  showCommentButton: false
}
```

```javascript
{
  activeTab: 'comment'
}
```

正确：

```javascript
{
  code: 200,
  data: comments
}
```

UI 展示逻辑由渲染进程决定。

### 4.5 新增能力决策原则

新增功能时按以下顺序评估：

#### 情况 ①：现有 PluginAPI 已覆盖

优先复用现有方法。

不要新增重复接口。

#### 情况 ②：多个插件都需要该能力

新增 PluginAPI 方法：

1. PluginResultSchema
2. defaultMap
3. 插件实现
4. 渲染层调用

统一扩展插件协议。

#### 情况 ③：仅单个插件需要

优先：

- 扩展 sourceContext
- 扩展现有返回结构

谨慎新增 PluginAPI 方法。

#### 情况 ④：涉及多平台聚合

不要放在插件中实现。

应放入：

- 主进程
- 数据库层
- 聚合服务层

由核心架构统一处理。

### 4.6 插件优先原则

实现新功能时优先考虑：

1. 是否能通过插件实现
2. 是否能复用现有 PluginAPI
3. 是否会破坏多源聚合架构
4. 是否会增加 sourceContext 耦合
5. 是否必须修改核心数据库 Schema

若插件方案与核心改造方案均可实现：

优先插件方案。

除非用户明确要求，否则不要为单个平台（网易云、酷狗等）编写核心架构特化逻辑。

### 4.7 向后兼容原则

新增 PluginAPI 方法时：

- 必须提供 defaultMap 默认实现
- 必须允许旧插件返回 code: 404
- 不得要求所有插件同步升级

例如：

```javascript
{
  code: 404
}
```

表示：

```text
当前插件不支持该能力
```

属于正常行为，不应视为错误。

插件系统应保证：

新核心版本能够兼容旧插件。

## 5. 插件开发规范

### 5.1 文件基础约束

- 使用纯 JavaScript（不要 TypeScript）
- **禁止** `import` / `export` / `require`（运行时报错）
- 使用 `exports.xxx = fn` 或 `exports.xxx = { xxx }` 导出

### 5.2 可用 API 对象

插件代码中可以通过全局变量 `api` 访问以下能力（实际在 Worker 中通过 `new Function('api', 'exports', code)` 注入）：

```javascript
// ==================== HTTP 请求 ====================
api.http.get(url, params?, headers?, raw?)        // GET 请求
api.http.post(url, data?, headers?, raw?)          // POST 请求
api.http.delete(url, data?, headers?, raw?)        // DELETE 请求

// ==================== 持久化存储 ====================
api.store.get(key)       // 读取 electron-store（插件命名空间）
api.store.set(key, value) // 写入 electron-store
api.db.get('PluginData')  // 读取数据库（登录态、token、cookie 等）
api.db.set('PluginData', value) // 写入数据库

// ==================== 工具 ====================
api.log(msg)                          // 日志输出
api.utils.parseLyric(msg)             // 歌词解析（返回 LyricLine[]）
api.utils.md5(input)                  // MD5 哈希
api.utils.generateSalt()              // 生成随机盐值
api.utils.generateToken(password, salt) // 生成密码令牌
```

### 5.3 必须导出：meta

插件必须通过 `exports.meta` 导出基本信息：

```javascript
exports.meta = {
  name: '网易云', // 中英文均可，在 UI 中显示的数据来源名称
  type: 'library' // 插件类型：'library' | 'stream' | 'local'
}
```

- `library`：线上音乐服务（网易云、酷狗等）
- `stream`：自建流媒体（Navidrome、Emby、Jellyfin 等）
- `local`：本地音乐

### 5.4 PluginId 与数据注入

#### PluginId 由框架统一分配

`PluginId` 是每个插件的唯一标识符，**由框架在加载时根据文件名自动分配**，插件自身不应声明或修改。即使插件开发者写错了名称，渲染进程会在收到结果后统一覆盖为正确的值——所以插件只需保证字段存在即可，无需关心值的正确性。

```
文件名：navidrome.js  →  PluginId: "navidrome"
文件名：netease.js    →  PluginId: "netease"
文件名：jellyfin.js   →  PluginId: "jellyfin"
```

插件开发者的职责：保证返回的数据里每个实体（Track、Album、Artist、Playlist、Mv 等）**都带有 `pluginId: ''`（空字符串字段）**即可，框架层会自动替换。

涉及的字段（确保格式化函数中显式写出）：

| 返回实体 | 需要设置 pluginId 的位置                                                      |
| -------- | ----------------------------------------------------------------------------- |
| Track    | `pluginId`、`album.pluginId`、`artists[].pluginId`、`albumArtists[].pluginId` |
| Album    | `pluginId`、`artists[].pluginId`                                              |
| Artist   | `pluginId`                                                                    |
| Playlist | `pluginId`、`creator.pluginId`                                                |
| Mv       | `pluginId`、`artists[].pluginId`                                              |

```javascript
function formatTrack(item) {
  return {
    id: item.Id,
    name: item.Name,
    pluginId: '', // ← 显式写出即可，框架会替换
    album: {
      name: item.Album,
      pluginId: '', // ← 同上
      sourceContext: { id: item.AlbumId }
    },
    artists: [
      {
        name: item.Artist,
        pluginId: '', // ← 同上
        sourceContext: { id: item.ArtistId }
      }
    ],
    albumArtists: [
      {
        name: item.AlbumArtist,
        pluginId: '', // ← 同上
        sourceContext: { id: item.AlbumArtistId }
      }
    ]
  }
}
```

```javascript
// ❌ 错误：遗漏 pluginId 字段
function formatTrack(item) {
  return {
    id: item.Id,
    name: item.Name
    // 缺少 pluginId — 下一个点击操作将不知道发往哪个插件
  }
}
```

#### 框架开发者：新增方法时别忘了注入 pluginId

插件返回的数据中 `pluginId` 只是占位的空字符串，最终由渲染进程实际调用方注入。因此，**新增 PluginAPI 方法后，渲染进程的处理代码中必须对返回数据做 pluginId 注入**，否则后续用户操作（点击播放、收藏等）会因 `pluginId` 为空而无法路由。

已知案例：`getBanner` 方法实现后，渲染进程中忘记对 banner 数据注入 `pluginId`，导致 banner 点击无反应。

具体注入方式见 [第 6 节 步骤 ④](#6-新增方法的完整注册流程)。

### 5.5 导出方法

插件通过 `exports.methodName = async (params) => {...}` 暴露可调用的方法。

方法名必须与 `src/types/plugin.ts` 中 `PluginAPI` 类型的方法名一致，返回值必须符合 `src/types/schemas.ts` 中 `PluginResultSchema` 对应的 Zod schema。

```javascript
// 完整示例
exports.meta = { name: '我的插件', type: 'library' }

exports.systemPing = async () => {
  return true
}

exports.search = async (params) => {
  const { keyword, type, offset } = params
  const result = await api.http.get('/search', { keywords: keyword, limit: 50, offset })
  const tracks = result.data.songs.map(formatTrack)
  return {
    code: 200,
    data: tracks,
    count: tracks.length,
    sourceContext: { keyword, offset: offset + 50 }
  }
}
```

### 5.6 reset 分页重置约定

部分列表类方法（如 `search`、`getAllTracks`、`topSong`、`rankList` 等）支持分页参数 `reset`，用于控制分页偏移量重置。

当用户在同一页面内切换 tab、触发新路由跳转、或重新发起查询时，渲染进程会向插件传入 `reset: true`：

```javascript
// 渲染进程调用示例（search 方法）
const res = await pluginMethodCall(pluginId, 'search', {
  tab: 'tracks',
  keywords: '周杰伦',
  reset: true, // ← 新鲜搜索，偏移量应归零
  ...sourceContext // 仍会携带上次的偏移量，但插件不应使用
})
```

插件收到 `reset: true` 时，**必须将当前分页偏移量重置为 0**，忽略参数中携带的历史偏移量值。

```javascript
exports.search = async (_params) => {
  const { tab, keywords, reset } = _params

  // reset 为 true 时强制从 0 开始
  const offset = reset ? 0 : _params.offset || 0

  // ... 正常分页逻辑
  return {
    code: 200,
    data: results,
    count: totalCount,
    sourceContext: { offset: offset + results.length }
  }
}
```

适用场景：

- **搜索页 tab 切换**：从「歌曲」切到「专辑」→ `reset: true`
- **探索页 tab 切换**：从「新歌」切到「新专辑」→ `reset: true`
- **歌单分类切换**：从「华语」切到「流行」→ `reset: true`

注意：

- `reset` 只影响当前请求，下一次正常翻页时不再需要传 `reset`
- 部分一次性返回全部数据的方法（如 `userPlaylist`）可以忽略此参数

**为什么需要 `reset` 而非统一偏移量字段名？**

不同插件的分页字段名各不相同（`_start`、`StartIndex`、`page`、`offset`），且 `sourceContext` 是插件私有不透明的，框架层不解析其内部字段。因此框架无法统一处理分页重置——只能通过 `reset: true` 告知插件"这是新的查询"，由插件自行决定如何重置。

### 5.7 sourceContext 规范

`sourceContext` 是插件私有、不透明的 JSON 对象：

- **Track 的 sourceContext**：重新获取该对象的最小上下文
  - 网易云示例：`{ id: 186016 }`
  - 酷狗示例：`{ hash: '...', mixsongid: '...', album_audio_id: '...', fileid: '...' }`
- **Album 的 sourceContext**：最小上下文 + 后续分页所需信息
- **列表操作返回的 sourceContext**：包含分页参数，用于加载下一页

---

## 6. 新增方法的完整注册流程

在插件中新增一个方法，需要在主进程侧进行同步注册，全过程涉及 4 处改动：

### 步骤 ①：Zod Schema（`src/types/schemas.ts`）

在 `PluginResultSchema` 对象中添加新方法的返回值 schema：

```typescript
export const PluginResultSchema = {
  // ...已有方法
  myNewMethod: z.object({
    code: z.number(),
    data: z.array(TrackSchema),
    sourceContext: z.record(z.string(), z.any())
  })
}
```

### 步骤 ②：默认返回值（`src/types/plugin.ts`）

在 `defaultMap` 中添加兜底返回值（`code: 404` 表示该插件不支持此方法）：

```typescript
export const defaultMap = {
  // ...已有方法
  myNewMethod: { code: 404, data: [], sourceContext: {} }
}
```

TypeScript 类型 `PluginAPI` 会自动从 `PluginResultSchema` 推导，无需手动声明。

### 步骤 ③：插件内实现（`src/public/plugin/<name>.js`）

```javascript
exports.myNewMethod = async (params) => {
  const result = await api.http.get('/some/api', params)
  const data = result.data.map(formatItem)
  return {
    code: 200,
    data,
    sourceContext: {
      /* ... */
    }
  }
}
```

### 步骤 ④：渲染进程调用 + pluginId 注入（`src/renderer/store/pluginMusic.ts`）

通过统一的 `pluginMethodCall()` 调用：

```typescript
const result = await pluginMethodCall(pluginId, 'myNewMethod', { param1: 'value' })
if (result.code === 404) {
  // 该插件不支持此方法
}
```

**关键**：插件返回数据中的 `pluginId` 字段只是空字符串占位符，渲染进程必须在收到结果后注入实际的 PluginId。对每个包含 `pluginId` 字段的实体（Track、Album、Artist、Playlist、Mv）及其嵌套子对象，都需要做注入：

```typescript
// 示例：对返回的 Track 列表注入 pluginId
result.data = result.data.map((item) => ({
  ...item,
  album: item.album ? { ...item.album, pluginId: plugin } : item.album,
  artists: item.artists?.map((a) => ({ ...a, pluginId: plugin })),
  albumArtists: item.albumArtists?.map((a) => ({ ...a, pluginId: plugin })),
  pluginId: plugin
}))
```

⚠️ **极易遗漏**：历史上 `getBanner` 方法实现后就因为渲染进程忘了注入 `pluginId`，导致 banner 点击后无反应——后续事件无法路由回正确的插件。凡是新增返回实体的方法，务必检查渲染进程中是否对所有嵌套 `pluginId` 字段完成了注入。

---

## 7. 插件分类

| 类型         | type 值   | 说明                               | 示例                      |
| ------------ | --------- | ---------------------------------- | ------------------------- |
| 线上音乐服务 | `library` | 提供在线音乐搜索、播放、评论等功能 | netease, kugou            |
| 自建流媒体   | `stream`  | 对接私有流媒体服务器               | navidrome, emby, jellyfin |
| 本地音乐     | `local`   | 本地文件管理                       | local                     |

---

## 8. 当前已注册的方法（60 个）

完整方法列表见 `src/types/plugin.ts` 的 `PluginAPI` 类型和 `defaultMap`。分类如下：

```
账号类：     updateBaseUrl, getAccount, loginQrKey, loginQrCodeCheck, doLogin, doLogout
平台状态：   systemPing
歌曲类：     songUrl, getLyric, getTrackDetail, matchTrack, resizePicUrl,
             likeATrack, likelist, scrobble, personalFM, fmTrash
歌单类：     userPlaylist, getPlaylistDetail, getPlaylistTracks, createPlaylist,
             deletePlaylist, subscribePlaylist, catlist, getCategoryPlaylist,
             getAllTracks, addOrRemoveTracksToPlaylist
推荐类：     getRecommendPlaylist, getRecommendTracks, rankTop, rankList, getBanner
专辑类：     albumDetail, artistAlbums, topAlbums, newAlbums, subscribeAlbum, getAlbumCatlist
艺人类：     artistDetail, artistMVs, simiArtists, topArtists, artistsList,
             followArtist, userLikedArtists, getArtistCatlist
MV类：       mvDetail, subAMV, likeAMV, userLikedMVs
分类：       topSong, getTrackCatlist
云盘：       cloudDisk
听歌记录：   userRecord
评论：       getCommentTab, getComments, likeAComment, submitAComment, getFloorComments
搜索：       search
```

---

## 9. 现有插件

| 插件 ID | 文件 | meta.name | meta.type | 导出函数数 | 功能 |
| --- | --- | --- | --- | --- | --- |
| `netease` | `netease.js` | 「网易云」 | `library` | 59 | 在线音乐全功能（搜索、播放、FM、评论、收藏、歌单、听歌记录） |
| `kugou` | `kugou.js` | 「酷狗」 | `library` | 58 | 歌词/评论补充、封面、FM |
| `navidrome` | `navidrome.js` | 「Navidrome」 | `stream` | 32 | 自建流媒体 |
| `emby` | `emby.js` | 「Emby」 | `stream` | 33 | 自建流媒体 |
| `jellyfin` | `jellyfin.js` | 「Jellyfin」 | `stream` | 33 | 自建流媒体 |
| `local` | `local.js` | 「本地音乐」 | `local` | 58 | 本地音乐管理 |
| `demo` | `demo.js` | 「测试」 | `library` | 61（全） | 完整插件模板（不会被加载） |

---

## 10. 已知限制

- 插件运行在 Worker 线程中，**不能访问** `require('electron')`、DOM、Node.js fs 等
- 每次请求超时时间：HTTP 12 秒，DB 5 秒
- HTTP 域名白名单校验：只允许发往 `plugins.{id}.baseUrl` 配置中的域名
- **不支持热重载**：修改插件代码后需要重启应用
- 插件只能用 JavaScript 编写（不能直接用 TypeScript）

---

## 11. 专用 IPC 通道

以下 IPC 通道不走 `plugin-method-call`，在 `src/main/IPCs.ts` 中有独立的 handler：

| IPC 通道 | 用途 | 说明 |
| --- | --- | --- |
| `trackMatch` | 跨插件歌曲匹配 | 遍历所有 `type='library'` 且 `capabilities.matchTrack` 非 false 的插件，调用 `matchTrack` 方法，结果写入 `TrackSource` 表。匹配成功后自动更新本地 `Track.picUrl` |
| `plugin-lyric` | 歌词获取路由 | 接收 `{ pluginId, sourceContext: { rawCtx } }`，通过 sourceContext 匹配 TrackSource 找有 `getLyric` 能力的插件，按用户优先级遍历 |
| `plugin-comment` | 评论 CRUD 路由 | 通过 `rawCtx/mapCtx/mapPlugin` 映射机制，将评论操作路由到有 `getComments` 能力的插件。支持分页缓存（`mapCtx` 合并分页状态） |
| `get-source-priority` | 读取来源优先级 | 从 electron-store 读取用户设置的歌词/评论插件优先级顺序 |
| `set-source-priority` | 保存来源优先级 | 写入 electron-store，供 `plugin-lyric` / `plugin-comment` 排序候选人 |
