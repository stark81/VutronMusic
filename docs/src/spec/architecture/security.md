---
last-updated: 2026-09-26
title: 安全边界与不变量
order: 14
last-reviewed: 2026-09-26
---

# 安全边界与不变量

本文件记录 VutronMusic 进程间与文件系统访问的**安全不变量**。这些规则来自 [issue #416](https://github.com/stark81/VutronMusic/issues/416) 的修复（存储型 HTML 注入 + 未限制的窗口导航 + 无校验的文件系统 IPC 组成的攻击链）。

> 核心心智模型：**渲染进程是不可信输入源**。preload 的通道白名单只约束「channel 名」，不能约束「谁在调用」——preload 会在窗口当前承载的任意 origin 上重新执行。

> 逐条缺陷的核对依据、行为验证数据与残留风险见 [安全审查：#416 修复复核](./security-audit-416)。

## 一、四条硬性不变量

### 1. 窗口只能在应用自身 origin 内导航

- 实现：`src/main/utils/windowHardening.ts` 的 `lockDownNavigation()` / `hardenWindow()`
- 约束：主 frame 导航 / 重定向 / `window.open` / `target=_blank` / `<webview>` 全部受限，跨 origin 一律拦截并降级到系统浏览器（仍走协议白名单）。
- 新增窗口**必须**调用 `hardenWindow(win, kind)`；这是唯一能把窗口标记为可信 IPC 调用方的入口。

### 2. IPC 只接受可信窗口的主 frame

- 实现：`src/main/utils/ipcGuard.ts` 的 `installIpcGuard()`（包装 `ipcMain.on/handle`）
- 校验内容：`event.senderFrame` 必须是该 webContents 的主 frame、该 webContents 已登记、且 frame URL 的 origin 等于 `Constants.APP_ORIGIN`。任一条不满足即拒绝（fail-closed）并记 `log.warn`。
- 通道分级：`OSD_ONLY_CHANNELS`（桌面歌词窗口专用）与 `MAIN_ONLY_CHANNELS`（文件系统原语等高危通道）。
- 加通道时**不要**绕过 `ipcMain` 守卫；新通道默认继承同一套校验。

### 3. 渲染进程传来的路径必须先授权再使用

- 实现：`src/main/utils/pathGrants.ts` + `src/main/utils/pathSafety.ts`
- 授权来源只有两个原生对话框：`selecteFolder`、`showOpenDialog`（目录 → `grantedPaths`，文件 → `grantedFiles`）。授权结果持久化在 electron-store 的 `security.*`（**不是** `settings.*`，因此渲染进程写不到）。
- 允许读取的本地资源 = 授权目录内 + 授权文件 + 应用自身目录（`screenshots` / `audioCache`）。
- 涉及通道/入口（**新增任何触碰文件系统的入口都必须补进这里**）：
  - `getFilesInFolder`、`msgCheckFileExist`：只处理授权目录（未授权时分别抛错 / 返回 `authorized: false`）
  - `msgScanLocalMusic`：过滤掉未授权目录，全部未授权时直接拒绝（不在校验前置扫描标志）
  - `msgShowInFolder`：只允许定位授权范围内的文件
  - `check-local-resource`：供渲染层查询某个文件是否仍被授权
  - `get-screenshot` / `delete-screenshot`：限制在 `userData/screenshots` 内的 `.png`
  - `vutron://local-resource`、`vutron://local-asset?type=stream|json`、`vutron://get-pic-path`：同上
  - **插件 API**：`plugin-method-call` → `apis.utils.checkFileExist` / `getPathLyric` / `getEmbeddedLyric` 在 `src/main/utils/pluginManager.ts` 内同样经过本模块判定。插件运行在主进程的 Node 权限下，不能因为「参数来自插件」就跳过授权。
- 坐标系一致性：授权根以 realpath 存储，因此校验时对**不存在的目标**也必须解析「第一个存在的祖先」的 realpath（`canonicalize()`）。否则路径含符号链接分量时（macOS `/var` → `/private/var`、`/tmp`、自定义 `--user-data-dir`）会把授权目录内尚不存在的文件误判为未授权。
- 升级提示：授权不自动迁移。旧版本选择过的目录/文件会失效，渲染层会提示 `toast.reauthRequired` 请用户重新选择（产品决策：宁可打扰一次，也不把历史遗留路径直接授权）。

### 4. 富文本必须经过白名单，UGC 一律按纯文本渲染

- 实现：`src/renderer/main.ts` 的 `v-safe-html` 指令（应用内**唯一**允许写 `innerHTML` 的入口）
- 唯一使用点：`LatestVersion.vue` 的更新日志。
- 规则：
  - 平台 UGC（歌名/专辑名/艺人名/歌单简介/昵称/评论）**只能**用 `{{ }}` 或 `src/renderer/components/SubTextContent.vue` 渲染，禁止拼接 HTML 字符串。
  - 需要应用内跳转时产出 `to`（路由对象），由 `<router-link>` 渲染。
  - 确需富文本时复用 `v-safe-html`（严格标签/属性白名单 + 链接强制 `https:`、`target=_blank` + `rel="noopener noreferrer nofollow"`）。
  - 禁止新增 `v-html` / 直接赋值 `innerHTML`。

## 二、其它已加固项

| 项 | 处理 |
| --- | --- |
| `setStoreSettings` | 运行时白名单（`src/main/utils/settingKeys.ts`），未列入的 key 丢弃并记日志；避免 dot-path 覆盖嵌套设置 |
| `msgOpenExternalLink` | 只允许 `http:` / `https:` / `mailto:`（`openExternalSafely()`） |
| `vutron://` 协议 | 请求带 `Origin` 且非应用 origin 时返回 403（挡跨源 `fetch` 读取本地文件）。scheme 登记为 `corsEnabled` 只是为了 `<audio crossOrigin>` 能拉流：`Access-Control-Allow-Origin` **只回显 `Constants.APP_ORIGIN`**，其他人仍被上面的 403 挡在前面；`OPTIONS` 预检也在 Origin 校验之后才放行 |
| 本地 HTTP 服务 | 显式 `host: '127.0.0.1'`；主服务端口被占用时 **fail-closed**（弹错退出而不是加载他人内容） |
| 响应头 | `Content-Security-Policy`（安全子集）+ `X-Content-Type-Options: nosniff` |
| preload 白名单 | 按窗口拆分（`index.ts` / `osdWin.ts`）。**注意：白名单不是安全边界**，真正的边界是不变量 2 |

### CSP 现状（刻意收窄）

`Constants.LOCAL_SERVER_CSP` 目前只包含 `object-src 'none'; base-uri 'none'; frame-ancestors 'none'`。

未启用 `script-src` / `img-src` / `connect-src` 的原因：本应用是多源在线音乐播放器，需要访问任意 `https:` 源、`blob:` / `data:` 资源以及 `vutron://` 自定义协议，且渲染层依赖 Plyr / dotLottie（WASM）/ node-vibrant / soundtouch 等第三方库。收紧这些指令必须逐页面人工验证（尤其确认没有库依赖 `eval`），否则会直接破坏功能。

## 三、已知遗留（未在本次修复中处理）

| 项 | 说明 |
| --- | --- |
| Amuse 服务（9863）CORS | 仍是 `origin: '*'`：客户端通常是 OBS 浏览器源（强制 CORS），合法 origin 无法枚举，收紧会破坏集成。代价是任意网站可读到当前播放的曲目信息。建议与 Amuse 客户端约定来源白名单或一次性 token 后再收紧 |
| Amuse 监听地址 | 已收敛为 `127.0.0.1`。跨机使用 OBS 的场景会失效，属有意的安全取舍（如需恢复，必须同时解决 CORS 白名单问题） |
| `setPermissionRequestHandler` | 未设置。`setPermissionCheckHandler` 若拒绝 `media` 会让「音频输出设备」列表拿不到 `device.label`（`SystemSettings.vue` 的 `getAllOutputDevices`），需要先验证权限策略再收紧 |
| `/local-asset/player` | 无鉴权的第三方集成接口（读取 `window.vutronmusic`）。未启用 CORS，网页无法读取响应；本机同用户进程本来就能读取应用数据，因此未加 token |
| `/netease/*` 代理 | 本机同用户进程可访问，且没有 CSRF 保护。因默认 `SameSite=Lax` 且无 CORS，跨站写入路径有限，但值得单独评估 |
| `vutron://get-color`、`get-online-music` | 属于网络请求（SSRF 面）而非本地文件读取，未在本轮限制 |
| `blob:` URL 的 origin | `new URL('blob:http://localhost:41830/…').origin` 等于 `APP_ORIGIN`，因此 `ipcGuard` 会视其为可信来源。走到这一步需要攻击者已能在应用 origin 执行脚本（即缺陷 1 的前提，已修复）；若要更严，可要求 frame URL 协议为 `http:` 且路径落在已知入口内 |
| dev 模式的端口 fail-closed 覆盖面 | dev 时 Fastify 绑 40001、页面由 Vite(41830) 提供，因此「41830 被他人占用」在 dev 不会被 `createFastifyApp` 的 try/catch 捕获（生产环境才是被保护的情形） |

## 四、修改这些代码时的检查清单

1. 新增窗口 → 是否调用 `hardenWindow()`？该窗口需要哪些通道（是否需要加入 `OSD_ONLY` / `MAIN_ONLY`）？
2. 新增 IPC 通道 → 是否需要在 `src/preload/index.ts` 加白名单？是否处理了不可信入参？
3. 新增任何触碰文件系统的入口（IPC 通道 / **插件 API** / `vutron://` 协议分支）→ 是否经过 `pathGrants` / `pathSafety`？是否需要新增授权来源？
4. 新增设置项 → 是否加入 `settingKeys.ts` 白名单？渲染层调用点的 key 是否一致？
5. 渲染 UGC → 是否只用了 `{{ }}` 或 `SubTextContent`？有没有新的 `innerHTML` sink？
6. 新增依赖 → 是否会引入 `eval` / 内联脚本（影响未来启用 `script-src`）？
