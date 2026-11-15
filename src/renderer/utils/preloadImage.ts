const DEFAULT_TIMEOUT = 8_000

interface PreloadImageOptions {
  /** 只用于取消「等待」，图片本身仍留在缓存里 */
  signal?: AbortSignal
  /** 等待超时（ms） */
  timeout?: number
}

/**
 * 用 `new Image()` 预加载并预解码，返回是否 ready。
 * 不走 `fetch`：图床基本都不返回 CORS 头，`fetch` 会被拦掉；`Image` 不受此限制，
 * 且与最终展示使用完全相同的地址，可直接复用浏览器缓存。
 * signal 只用于取消「等待」——超时或已有更新的切换时提前返回，图片本身仍留在缓存里，
 * 因此即便这里返回 false，调用方退回直连地址也能立刻命中缓存。
 */
export const preloadImage = (src: string, opts: PreloadImageOptions = {}) =>
  new Promise<boolean>((resolve) => {
    const { signal, timeout = DEFAULT_TIMEOUT } = opts

    // 调用方可能复用（或传入）一个已经 abort 的 controller：此时 abort 事件不会再来，
    // 不提前返回就会一直挂到 timeout。
    if (signal?.aborted) {
      resolve(false)
      return
    }

    const image = new Image()
    let settled = false
    const settle = (ready: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      // 断开回调，避免超时/取消后图片加载完成时再跑一次 settle 闭包
      image.onload = null
      image.onerror = null
      resolve(ready)
    }
    const onAbort = () => settle(false)
    const timer = setTimeout(() => settle(false), timeout)
    signal?.addEventListener('abort', onAbort)
    image.onerror = () => settle(false)
    image.onload = async () => {
      // decode() 失败不代表图片不可用（例如响应缺少 CORS 头），忽略即可
      try {
        await image.decode()
      } catch {
        /* noop */
      }
      settle(true)
    }
    image.src = src
  })
