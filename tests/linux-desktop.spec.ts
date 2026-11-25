import { test, expect } from '@playwright/test'
import { createRequire } from 'module'
import path from 'path'

/**
 * Linux 窗口身份一致性（issue #436）。
 *
 * 任务栏图标分组靠 `.desktop` 的 `StartupWMClass` 匹配窗口的 `WM_CLASS`：
 *   · Electron 42+ 用 XDG app id（`package.json` 的 `desktopName` 去掉 `.desktop`）
 *     同时设置 X11 `WM_CLASS` 与 Wayland `app_id`；
 *   · electron-builder 的 `StartupWMClass` 取 `desktopName`，未设置时退回 `productName`。
 *
 * 两边一旦不一致（本项目曾经是 `VutronMusic` vs `vutronmusic`），GNOME/KDE 就会在
 * 任务栏多显示一个空图标。这个用例校验三处取值（WM_CLASS 来源、StartupWMClass、
 * .desktop 文件名）仍然相等。
 *
 * 注意：只能校验「打包输入」，不能校验真实窗口的 WM_CLASS——那需要一台 Linux 机器
 * （`xprop WM_CLASS`）。Electron 大版本升级后要重新实测。
 */

const requireFromRoot = createRequire(path.join(process.cwd(), 'package.json'))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LinuxTargetHelper } = requireFromRoot('app-builder-lib/out/targets/LinuxTargetHelper')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const builderConfig = requireFromRoot('./buildAssets/builder/config.js')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = requireFromRoot('./package.json')

const linuxOptions = builderConfig.linux
const desktopName: string = pkg.desktopName

test('Linux 桌面入口的 StartupWMClass 与窗口 WM_CLASS 一致（issue #436）', async () => {
  // 必须显式声明 desktopName：否则 Electron 会用 app name 的 slug（vutronmusic），
  // 而 electron-builder 用 productName（VutronMusic），两边对不上
  expect(desktopName, 'package.json 缺少 desktopName').toBeTruthy()
  expect(linuxOptions.syncDesktopName, 'config.js 未开启 linux.syncDesktopName').toBe(true)

  // .desktop 文件名必须等于 desktopName 去掉后缀（Wayland 按 app_id 找同名 .desktop）
  const desktopId = desktopName.replace(/\.desktop$/, '')
  expect(desktopId).toBe(linuxOptions.executableName)

  const packager = {
    appInfo: {
      productName: builderConfig.productName,
      sanitizedProductName: builderConfig.productName.replace(/\s+/g, '-'),
      productFilename: builderConfig.productName,
      version: pkg.version,
      description: pkg.description || ''
    },
    executableName: linuxOptions.executableName,
    config: builderConfig,
    platformSpecificBuildOptions: linuxOptions,
    info: { metadata: pkg },
    fileAssociations: [],
    getTempFile: (name: string) => path.join('/tmp', name)
  }

  const helper = new LinuxTargetHelper(packager as any)
  const desktopEntry: string = await helper.computeDesktopEntry(linuxOptions, undefined, undefined)

  const startupWMClass = /^StartupWMClass=(.+)$/m.exec(desktopEntry)?.[1]?.trim()
  expect(startupWMClass, 'StartupWMClass 必须等于 Electron 的 XDG app id').toBe(desktopId)
  expect(helper.getDesktopFileName()).toBe(desktopId)
  // 图标名保持 executableName（deb 安装的 /usr/share/icons/hicolor/*/apps/vutron.png）
  expect(/^Icon=(.+)$/m.exec(desktopEntry)?.[1]?.trim()).toBe(linuxOptions.executableName)
})
