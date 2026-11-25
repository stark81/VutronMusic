import { test, expect } from '@playwright/test'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { ARM64_UPDATE_CHANNEL, resolveUpdateChannel } from '../src/main/utils/updateChannel'

/**
 * 自动更新元数据的架构隔离（issue #374）。
 *
 * 事故链：electron-builder 只给 Linux 的 latest*.yml 加架构后缀 → Windows/macOS 的
 * x64 与 arm64 都写同一个 latest.yml → CI 把同名文件按大小合并（挑中了 arm64 的）→
 * 发布的 latest.yml 指向 VutronMusic-4.0.0_win_arm64.exe → x64 用户自动更新下载到
 * arm64 安装包。
 *
 * 这里校验两端约定一致的通道名/文件名：
 *   · 客户端：electron-updater 的 Provider.getChannelFilePrefix() + 自定义通道；
 *   · 构建端：build.yml 给 arm64 传 UPDATE_CHANNEL，config.js 把它写进 publish.channel。
 */

const requireFromRoot = createRequire(path.join(process.cwd(), 'package.json'))
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Provider } = requireFromRoot('electron-updater/out/providers/Provider')

const repoRoot = process.cwd()
const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/build.yml'), 'utf8')
const builderConfig = fs.readFileSync(path.join(repoRoot, 'buildAssets/builder/config.js'), 'utf8')

/** 客户端会去请求的更新元数据文件名 */
const clientChannelFile = (platform: 'win32' | 'darwin' | 'linux', arch: 'x64' | 'arm64') => {
  // Provider.getChannelFilePrefix() 用这个环境变量模拟架构（electron-updater 自带的测试开关）
  process.env.TEST_UPDATER_ARCH = arch
  const provider = new Provider({ platform, executor: {} })
  const channel = resolveUpdateChannel(platform, arch) ?? 'latest'
  return `${provider.getCustomChannelName(channel)}.yml`
}

test('arm64 只对 Windows/macOS 使用独立更新通道', () => {
  expect(resolveUpdateChannel('win32', 'arm64')).toBe(ARM64_UPDATE_CHANNEL)
  expect(resolveUpdateChannel('darwin', 'arm64')).toBe(ARM64_UPDATE_CHANNEL)
  // Linux 由 electron-updater 自己加 -linux-arm64 后缀，再套自定义通道会变成双后缀
  expect(resolveUpdateChannel('linux', 'arm64')).toBeUndefined()
  // x64 一律走默认通道
  for (const platform of ['win32', 'darwin', 'linux'] as const) {
    expect(resolveUpdateChannel(platform, 'x64')).toBeUndefined()
  }
})

test('x64 与 arm64 请求不同的更新元数据文件（issue #374）', () => {
  const expected = {
    'win32/x64': 'latest.yml',
    'win32/arm64': 'latest-arm64.yml',
    'darwin/x64': 'latest-mac.yml',
    'darwin/arm64': 'latest-arm64-mac.yml',
    'linux/x64': 'latest-linux.yml',
    'linux/arm64': 'latest-linux-arm64.yml'
  }

  for (const [key, filename] of Object.entries(expected)) {
    const [platform, arch] = key.split('/') as ['win32' | 'darwin' | 'linux', 'x64' | 'arm64']
    expect(clientChannelFile(platform, arch), `${key} 的更新元数据文件名`).toBe(filename)
  }

  // 同一平台的 x64 与 arm64 绝不能落到同一个文件（否则后发布的会覆盖前一个）
  for (const platform of ['win32', 'darwin', 'linux'] as const) {
    expect(clientChannelFile(platform, 'x64')).not.toBe(clientChannelFile(platform, 'arm64'))
  }
})

test('构建端与客户端使用同一个通道名', () => {
  // CI：Windows/macOS 的 arm64 任务必须传 UPDATE_CHANNEL，否则会退回共用 latest.yml
  expect(workflow).toContain("matrix.arch == 'arm64' && 'latest-arm64' || ''")
  expect(workflow).toContain('UPDATE_CHANNEL')
  // 发布前必须校验各架构的更新元数据，且不能再按文件大小挑同名文件
  expect(workflow).toContain('Verify update metadata per architecture')
  expect(workflow).not.toContain('stat -c%s')
  // 打包配置：UPDATE_CHANNEL 必须落到 publish.channel
  expect(builderConfig).toContain('process.env.UPDATE_CHANNEL')
  expect(builderConfig).toContain('channel: updateChannel')
})
