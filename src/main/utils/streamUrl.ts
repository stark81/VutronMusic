/**
 * 播放地址 → 缓存下载地址的归一化。
 *
 * 渲染层用 `<audio crossOrigin="anonymous">` 播放线上音频（可视化需要 Web Audio
 * 拿到原始采样），因此部分地址必须由主进程的 `vutron://` 协议代理：需要补 CORS
 * 头、或者绕开 http/https 混用限制。插件也沿用这套约定，例如 netease 的音源替换
 * 返回的就是 `vutron://get-online-music/<真实地址>`。
 *
 * 但缓存 Worker 是纯 Node 线程（没有 Electron 的 protocol 实现），只能走
 * `http`/`https`；把 `vutron://` 地址丢给 `https.get()` 会直接
 * `ERR_INVALID_PROTOCOL`，表现为「能播放但永远缓存不下来」（issue #427）。
 *
 * 所以派发缓存任务前必须把代理地址还原成真实地址：
 *   · `vutron://get-online-music/<real-url>` → `<real-url>`
 *   · `http(s)://…` → 原样返回
 * 其余 `vutron://` 资源（`local-asset`、`get-plugin-asset` 等）Worker 无法直接
 * 下载，返回 `null`，由调用方跳过缓存（不影响播放）。
 */

/** 播放代理地址前缀，与 `src/main/index.ts` 中 `get-online-music` 路由保持一致 */
const ONLINE_MUSIC_PREFIX = 'vutron://get-online-music/'

/** 是否为 Worker 可以直接下载的 http(s) 地址 */
export const isHttpUrl = (url: unknown): url is string =>
  typeof url === 'string' && /^https?:\/\//i.test(url)

/**
 * 取播放地址背后的真实音频地址，供缓存 Worker 下载。
 * 无法直接下载时返回 `null`。
 */
export const resolveDownloadableUrl = (rawUrl?: string | null): string | null => {
  if (typeof rawUrl !== 'string' || !rawUrl) return null

  // 只做字符串切片、不做 decode：音源替换给出的地址带签名 query，解码会破坏它
  const candidate = rawUrl.startsWith(ONLINE_MUSIC_PREFIX)
    ? rawUrl.slice(ONLINE_MUSIC_PREFIX.length)
    : rawUrl

  return isHttpUrl(candidate) ? candidate : null
}
