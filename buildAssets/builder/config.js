/* eslint-disable no-template-curly-in-string */
const dotenv = require('dotenv')

const baseConfig = {
  productName: 'VutronMusic',
  appId: 'io.github.stark81.VutronMusic',
  asar: true,
  asarUnpack: [
    '**/node_modules/sharp/**/*',
    '**/node_modules/@img/**/*',
    'dist/main/workers/*.js',
    '**/node_modules/taglib-wasm/**/*'
  ],
  extends: null,
  artifactName: '${productName}-${version}_${os}_${arch}.${ext}',
  // 原生模块全部自带预编译产物，不需要 electron-builder 再跑 node-gyp：
  //  - better-sqlite3 13+ 自带 Node-API 预编译（prebuilds/<platform>-<arch>.node），Node/Electron 通用
  //  - sharp 通过 @img/sharp-<platform>-<arch> 可选依赖分发预编译二进制
  //  - macOS 的 tray / touchbar 插件由 build-native.js 预先生成到 dist-native/
  // 关闭后还能避开 Windows ARM64 上的 node-gyp 问题（该镜像自带 VS2026，node-gyp 11 识别不了）
  npmRebuild: false,
  directories: {
    output: './release/${version}'
  },
  mac: {
    bundleVersion: '1.0',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: false,
    icon: 'buildAssets/icons/icon.icns',
    type: 'distribution',
    // 不写死 arch，交给命令行 --x64 / --arm64（默认取当前机器架构）
    target: ['dmg']
  },
  dmg: {
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications'
      },
      {
        x: 130,
        y: 150,
        type: 'file'
      }
    ],
    sign: false
  },
  win: {
    icon: 'buildAssets/icons/icon.ico',
    target: ['zip', 'portable', 'nsis']
  },
  portable: {
    artifactName: '${productName}-${version}_${os}_${arch}-Portable.${ext}'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    runAfterFinish: true
  },
  flatpak: {
    runtimeVersion: '25.08',
    baseVersion: '25.08',
    finishArgs: [
      // Wayland/X11 Rendering
      '--socket=wayland',
      '--socket=x11',
      '--share=ipc',
      // Open GL
      '--device=dri',
      // Audio output
      '--socket=pulseaudio',
      // Read/write home directory access
      '--filesystem=home',
      // Allow communication with network
      '--share=network',
      // System notifications with libnotify
      '--talk-name=org.freedesktop.Notifications',
      // MPRIS media controls (own D-Bus name)
      '--own-name=org.mpris.MediaPlayer2.VutronMusic',
      // Discord RPC IPC socket
      '--filesystem=xdg-run/discord-ipc:create',
      // DBus session bus (lyric extension communication)
      '--socket=session-bus',
      '--talk-name=org.gnome.Shell.TrayLyric',
      '--talk-name=org.kde.StatusNotifierWatcher'
    ]
  },
  linux: {
    executableName: 'vutron',
    icon: 'buildAssets/icons/icon.icns',
    category: 'Utility',
    target: ['snap', 'AppImage', 'deb', 'rpm', 'flatpak']
  }
}

dotenv.config()

baseConfig.copyright = `ⓒ ${new Date().getFullYear()} $\{author}`
baseConfig.files = [
  /* A list of files not to be included in the build. */
  /*
    (Required) The files and folders listed below should not be included in the build.
  */
  'dist/**/*',
  'dist-native/*',
  '!dist/main/index.dev.js',
  '!docs/**/*',
  '!tests/**/*',
  '!release/**/*',
  '!**/.build-id/**'
]

// TODO: Notarize for macOS
baseConfig.mac.identity = null
/* if (process.env.MAC_NOTARIZE === 'true') {
  baseConfig.afterSign = './buildAssets/builder/notarize.ts'
} else {
  baseConfig.mac.identity = null
} */

module.exports = {
  ...baseConfig
}
