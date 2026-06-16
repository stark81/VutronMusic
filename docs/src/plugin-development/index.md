# 插件开发

## 快速迭代流程

```
yarn dev → 启动 Vite HMR + Electron

改 renderer/（Vue/TS）→ Vite 热更新，页面自动刷新
改 main/（主进程）    → 需要手动重启 Electron（Ctrl+C → 重跑 yarn dev）
改 preload/          → 需要重启 Electron
改 public/plugin/*.js → 需要重启 Electron（插件在 Worker 中初始化时加载）
```

## 新增插件或方法的标准步骤

```
① 在 src/public/plugin/ 下创建 <name>.js
② 在 src/types/schemas.ts 中给 PluginResultSchema 添加方法的 Zod schema
③ 在 src/types/plugin.ts 的 defaultMap 中添加默认返回值（code: 404）
④ `PluginAPI` 和 `PluginMethodCall` 类型会自动从 `PluginResultSchema` 推导，无需手动声明
⑤ 在 src/renderer/store/pluginMusic.ts 中添加调用方法
⑥ 插件实现遵循 Worker 消息通信模式（HTTP_REQUEST / STORE_REQUEST / DB_REQUEST）
```

## 插件实现要点

- 插件运行在 Worker 线程中，不能直接访问 electron API
- 网络请求通过向主进程发送 `HTTP_REQUEST` 消息完成（见 `PluginInstance.handleHttp()`）
- 持久化存储通过 `STORE_REQUEST`/`DB_REQUEST` 消息完成
- 歌词解析通过 `LYRIC_PARSE` 消息由主进程处理
- 插件通过 `call(methodName, params)` 暴露方法供外部调用

## 已注册的插件方法（60 个）

所有插件方法的完整列表见 `src/types/plugin.ts` 的 `PluginAPI` 类型和 `defaultMap`。每个方法都有：

- `params`：传入参数类型
- `result`：返回值类型（经过 Zod 验证）

60 个方法完整清单：

账号类：`updateBaseUrl`, `getAccount`, `loginQrKey`, `loginQrCodeCheck`, `doLogin`, `doLogout` 平台状态：`systemPing` 歌曲类：`songUrl`, `getLyric`, `getTrackDetail`, `matchTrack`, `resizePicUrl`, `likeATrack`, `likelist`, `scrobble`, `personalFM`, `fmTrash` 歌单类：`userPlaylist`, `getPlaylistDetail`, `getPlaylistTracks`, `createPlaylist`, `deletePlaylist`, `subscribePlaylist`, `catlist`, `getCategoryPlaylist`, `getAllTracks`, `addOrRemoveTracksToPlaylist` 推荐类：`getRecommendPlaylist`, `getRecommendTracks`, `rankTop`, `rankList`, `getBanner` 专辑类：`albumDetail`, `artistAlbums`, `topAlbums`, `newAlbums`, `subscribeAlbum`, `getAlbumCatlist` 艺人类：`artistDetail`, `artistMVs`, `simiArtists`, `topArtists`, `artistsList`, `followArtist`, `userLikedArtists`, `getArtistCatlist` MV类：`mvDetail`, `subAMV`, `likeAMV`, `userLikedMVs` 分类：`topSong`, `getTrackCatlist` 云盘：`cloudDisk` 听歌记录：`userRecord` 评论：`getCommentTab`, `getComments`, `likeAComment`, `submitAComment`, `getFloorComments` 搜索：`search`

## 已知陷阱

| 陷阱                     | 说明                                                         |
| ------------------------ | ------------------------------------------------------------ |
| postinstall 触发 rebuild | `yarn install` 后自动执行 `electron-rebuild`，可能耗时较长   |
| taglib-wasm 需 fix       | 安装或 rebuild 后执行 `node fix-taglib-wasm.js`              |
| fix-sandbox.js           | Linux 上需要以设置 chrome-sandbox 权限                       |
| Electron 版本锁定        | 在 `package.json.overrides` 中，改版本需同步改               |
| Worker 线程限制          | 插件在 Worker 中运行，不能访问 `require('electron')`、DOM 等 |
| 插件热重载               | 目前不支持，改插件代码需重启应用                             |
| constants 使用           | `Constants.IS_DEV_ENV` 用于判断开发/生产环境路径             |

## 插件目录

- 开发环境：`src/public/plugin/`（fs 读取）
- 生产环境：`app.getPath('userData')/plugins/`（用户上传）
- 当前插件列表（`src/public/plugin/`）：
  - `netease.js` — 网易云音乐（library，59 个导出函数，含 FM/听歌记录）
  - `kugou.js` — 酷狗音乐（library，58 个导出函数，含 FM）
  - `navidrome.js` — Navidrome 流媒体（stream，32 个导出函数）
  - `emby.js` — Emby 流媒体（stream，33 个导出函数）
  - `jellyfin.js` — Jellyfin 流媒体（stream，33 个导出函数）
  - `local.js` — 本地音乐（local，58 个导出函数）
  - `demo.js` — 完整插件模板（不会被加载，61 个导出函数全部含 JSDoc）
