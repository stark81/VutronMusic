import { _electron as electron } from 'playwright'
import { ElectronApplication, Page } from 'playwright-core'
import { test, expect } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

declare global {
  interface Window {
    mainApi?: {
      invoke: (channel: string, ...data: unknown[]) => Promise<any>
      send: (channel: string, ...data: unknown[]) => void
      on: (channel: string, listener: (event: unknown, ...args: any[]) => void) => void
    }
    /** msgScanLocalMusic 的负向断言用（见下） */
    __scanEvents?: unknown[]
  }
}

/**
 * 安全回归测试（issue #416）。
 *
 * 前置条件：
 *   1. 已执行构建（需要 `dist/main/index.js` 与 `dist/preload/index.js`）；
 *   2. `node_modules/electron` 已下载二进制（`yarn install` 的 postinstall）；
 *   3. 本机 41830 端口空闲 —— 主进程在端口被占用时会 fail-closed 直接退出，
 *      因此运行前请先关闭正在运行的 VutronMusic。
 *
 * 使用独立的 --user-data-dir，避免污染真实用户数据。
 */

let appElectron: ElectronApplication
let appWindow: Page

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vutron-sec-test-'))

test.beforeAll(async () => {
  appElectron = await electron.launch({
    // --no-sandbox 与 `vite dev`（vite-plugin-electron）启动 Electron 时保持一致，
    // 否则在受限环境下 Chromium sandbox 初始化失败、GPU 进程退出导致应用立即关闭。
    args: ['dist/main/index.js', '--no-sandbox', `--user-data-dir=${userDataDir}`],
    locale: 'en-US',
    colorScheme: 'light',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  })
  appWindow = await appElectron.firstWindow()
  await appWindow.waitForEvent('load')
})

test.afterAll(async () => {
  await appElectron?.close().catch(() => {})
  fs.rmSync(userDataDir, { recursive: true, force: true })
})

test('应用自身窗口的 IPC 调用仍然可用（守卫不能误伤正常调用）', async () => {
  const version = await appWindow.evaluate(() => window.mainApi?.invoke('msgRequestGetVersion'))
  expect(typeof version).toBe('string')
  expect(String(version)).toMatch(/^\d+\.\d+\.\d+/)

  const cachePath = await appWindow.evaluate(() => window.mainApi?.invoke('get-cache-path'))
  expect(typeof cachePath).toBe('string')
  expect(String(cachePath)).toContain('audioCache')
})

test('特权窗口不能被导航到应用 origin 之外', async () => {
  const before = appWindow.url()
  // 刻意使用非 http/https 协议：跨源导航会被拦截，且不会真的拉起系统浏览器
  await appWindow.evaluate(() => {
    window.location.href = 'ftp://blocked.example/poc'
  })
  await appWindow.waitForTimeout(1500)

  expect(appWindow.url()).toBe(before)
  // 导航被拦截后 preload 上下文未被替换，IPC 仍来自可信窗口
  const version = await appWindow.evaluate(() => window.mainApi?.invoke('msgRequestGetVersion'))
  expect(String(version)).toMatch(/^\d+\.\d+\.\d+/)
})

test('window.open / target=_blank 被拒绝', async () => {
  const opened = await appWindow.evaluate(() => {
    try {
      return String(window.open('ftp://blocked.example/poc'))
    } catch {
      return 'threw'
    }
  })
  expect(opened).toBe('null')

  const pageCount = appElectron.windows().length
  await appWindow.waitForTimeout(500)
  expect(appElectron.windows().length).toBe(pageCount)
})

test('未授权的路径读取被拒绝', async () => {
  const denied = await appWindow.evaluate(() =>
    window.mainApi?.invoke('check-local-resource', '/etc/hosts')
  )
  expect(denied).toBe(false)

  const files = await appWindow
    .evaluate(() => window.mainApi?.invoke('getFilesInFolder', '/etc', ['conf']))
    .catch((error: Error) => `rejected:${error.message}`)
  expect(String(files)).toContain('FOLDER_NOT_AUTHORIZED')
})

test('setStoreSettings 忽略白名单之外的键', async () => {
  const before = await appWindow.evaluate(() => window.mainApi?.invoke('get-source-priority'))

  // sourcePriority 由主进程自行维护，不在渲染层可写白名单内
  await appWindow.evaluate(() => {
    window.mainApi?.send('setStoreSettings', { sourcePriority: { lyric: ['evil'] } })
  })
  await appWindow.waitForTimeout(300)

  const after = await appWindow.evaluate(() => window.mainApi?.invoke('get-source-priority'))
  expect(after).toEqual(before)
})

/**
 * 取出应用真实的 userData 目录（用 get-cache-path 反推，避免依赖 --user-data-dir 被正确解析）。
 */
async function getAppUserDataDir(): Promise<string> {
  const cachePath = await appWindow.evaluate(() => window.mainApi?.invoke('get-cache-path'))
  expect(typeof cachePath).toBe('string')
  return path.dirname(String(cachePath))
}

test('get-screenshot 清洗文件名，无法路径遍历写出（CWE-22）', async () => {
  const userData = await getAppUserDataDir()
  const screenshotsDir = path.join(userData, 'screenshots')

  // issue #416 原文 PoC：把 ../ 塞进主题名
  const traversalLabel = 'x\\..\\..\\..\\..\\evil-written'
  const written = String(
    await appWindow.evaluate(
      (label) => window.mainApi?.invoke('get-screenshot', label),
      traversalLabel
    )
  )

  // 落盘路径必须被限制在 screenshots 目录内
  expect(written.startsWith(screenshotsDir + path.sep)).toBe(true)
  expect(path.basename(written)).toMatch(/^screenshot_.+\.png$/)
  expect(fs.existsSync(written)).toBe(true)

  // 遍历目标位置不得被写入
  for (const escapeTarget of [
    path.join(userData, 'evil-written.png'),
    path.join(path.dirname(userData), 'evil-written.png'),
    path.join(os.tmpdir(), 'evil-written.png')
  ]) {
    expect(fs.existsSync(escapeTarget), `不应写入 ${escapeTarget}`).toBe(false)
  }

  fs.rmSync(written, { force: true })
})

test('delete-screenshot 不能删除 screenshots 目录之外的文件（CWE-22）', async () => {
  const victimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vutron-victim-'))
  const victim = path.join(victimDir, 'victim.txt')
  fs.writeFileSync(victim, 'do-not-delete')

  await appWindow.evaluate((target) => window.mainApi?.send('delete-screenshot', target), victim)
  await appWindow.waitForTimeout(300)

  expect(fs.existsSync(victim), '任意路径删除必须被拒绝').toBe(true)

  fs.rmSync(victimDir, { recursive: true, force: true })
})

test('delete-screenshot 仍能删除本应用生成的主题截图（不误伤正常功能）', async () => {
  const written = String(
    await appWindow.evaluate(() => window.mainApi?.invoke('get-screenshot', 'e2e-theme'))
  )
  expect(fs.existsSync(written)).toBe(true)

  await appWindow.evaluate((target) => window.mainApi?.send('delete-screenshot', target), written)
  await appWindow.waitForTimeout(300)

  expect(fs.existsSync(written)).toBe(false)
})

test('授权判定对「尚不存在的目标」保持一致（应用自有目录）', async () => {
  const userData = await getAppUserDataDir()
  const missing = path.join(userData, 'screenshots', 'screenshot_does-not-exist.png')

  // 该文件确实不存在：修复前在 macOS(/var→/private/var) 上会被误判为未授权
  expect(fs.existsSync(missing)).toBe(false)
  const allowed = await appWindow.evaluate(
    (target) => window.mainApi?.invoke('check-local-resource', target),
    missing
  )
  expect(allowed).toBe(true)

  // 未授权路径依然拒绝（fail-closed 未被削弱）
  const denied = await appWindow.evaluate(() =>
    window.mainApi?.invoke('check-local-resource', '/etc/hosts')
  )
  expect(denied).toBe(false)
})

test('msgScanLocalMusic 忽略未授权目录（CWE-200 任意目录枚举）', async () => {
  await appWindow.evaluate(() => {
    window.__scanEvents = []
    const record = (_event: unknown, payload: unknown) => window.__scanEvents?.push(payload)
    window.mainApi?.on('scanLocalMusicProgress', record)
    window.mainApi?.on('scanLocalMusicDone', record)
    window.mainApi?.on('msgHandleScanLocalMusicError', record)
  })

  // /etc 存在但从未被用户通过原生对话框授权
  await appWindow.evaluate(() => {
    window.mainApi?.send('msgScanLocalMusic', { filePath: ['/etc'] })
  })
  await appWindow.waitForTimeout(2500)

  const events = await appWindow.evaluate(() => window.__scanEvents?.length ?? 0)
  expect(events, '未授权目录不应触发任何扫描事件').toBe(0)
})

test('插件侧的存在性探测同样受授权限制', async () => {
  const plugins = await appWindow.evaluate(() => window.mainApi?.invoke('get-plugins'))
  const ids = Array.isArray(plugins) ? plugins.map((entry: [string, unknown]) => entry[0]) : []
  test.skip(!ids.includes('local'), '本环境未注册 local 插件')

  // 旧实现会经 apis.utils.checkFileExist 直接 fs.access('/etc') 并把它当成有效扫描目录
  const result = await appWindow.evaluate(() =>
    window.mainApi?.invoke('plugin-method-call', {
      pluginId: 'local',
      methodName: 'doLogin',
      params: { dirs: ['/etc'] }
    })
  )

  expect(result?.code).toBe(400)
})

test('vutron:// 已登记 CORS：应用 origin 可 fetch，未授权路径仍 403', async () => {
  const result = await appWindow.evaluate(async () => {
    const read = async (url: string) => {
      try {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        return { status: res.status, bytes: buf.byteLength }
      } catch (err) {
        return { status: -1, bytes: 0, error: String(err) }
      }
    }
    return {
      defaultPic: await read('vutron://get-default-pic'),
      forbidden: await read('vutron://get-pic-path/not-granted/secret.png')
    }
  })

  // 未开启 corsEnabled（或缺少 Access-Control-Allow-Origin）时，这两条都会在
  // fetch 阶段直接抛 CORS 错误、拿不到 status —— 那正是 <audio crossOrigin> 被拦、
  // 播放层「重试 → 跳歌」的根因，所以这里把状态码当回归断言。
  expect(result.defaultPic.status).toBe(200)
  expect(result.defaultPic.bytes).toBeGreaterThan(0)
  // 图片能读，但未授权路径依然 fail-closed
  expect(result.forbidden.status).toBe(403)
})
