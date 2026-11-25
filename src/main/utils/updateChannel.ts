/**
 * 自动更新通道名（见 issue #374）。
 *
 * electron-builder 的 `getArchPrefixForUpdateFile()` 只给 **Linux** 的更新元数据文件名
 * 加架构后缀：Linux 会分别产出 `latest-linux.yml` / `latest-linux-arm64.yml`，
 * 而 Windows 与 macOS 两个架构都写同一个 `latest.yml` / `latest-mac.yml`，后构建的覆盖
 * 先构建的。v4.0.0 发布出来的 `latest.yml` 指向了 `VutronMusic-4.0.0_win_arm64.exe`，
 * 于是所有 Windows x64 客户端自动更新时下载到 arm64 安装包。
 *
 * 解决办法：Windows / macOS 的 arm64 走独立更新通道 `latest-arm64`
 * （electron-updater 会在通道名后追加平台前缀）：
 *
 * | 平台    | x64 客户端请求      | arm64 客户端请求           |
 * | ------- | ------------------- | -------------------------- |
 * | Windows | `latest.yml`        | `latest-arm64.yml`         |
 * | macOS   | `latest-mac.yml`    | `latest-arm64-mac.yml`     |
 * | Linux   | `latest-linux.yml`  | `latest-linux-arm64.yml`（客户端自动加后缀，不需要通道） |
 *
 * 构建侧通过 `UPDATE_CHANNEL=latest-arm64` 让 electron-builder 生成同名文件
 * （见 `buildAssets/builder/config.js` 与 `.github/workflows/build.yml`），
 * 两侧的通道名必须保持一致。
 */
export const ARM64_UPDATE_CHANNEL = 'latest-arm64'

/**
 * 当前进程应使用的更新通道；返回 `undefined` 表示用默认通道 `latest`。
 *
 * Linux 不返回通道：electron-updater 的 `Provider.getChannelFilePrefix()` 会自己拼
 * `-linux-arm64`，再套一层自定义通道反而会变成 `latest-arm64-linux-arm64.yml`。
 */
export const resolveUpdateChannel = (platform: string, arch: string): string | undefined => {
  if (arch !== 'arm64') return undefined
  if (platform !== 'win32' && platform !== 'darwin') return undefined
  return ARM64_UPDATE_CHANNEL
}
