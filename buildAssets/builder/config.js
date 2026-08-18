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
    target: [{ target: 'dmg', arch: 'x64' }]
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
    target: [
      { target: 'zip', arch: 'x64' },
      { target: 'portable', arch: 'x64' },
      { target: 'nsis', arch: 'x64' }
    ]
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
    target: [
      {
        target: 'snap',
        arch: 'x64'
      },
      {
        target: 'AppImage',
        arch: 'x64'
      },
      {
        target: 'deb',
        arch: 'x64'
      },
      {
        target: 'rpm',
        arch: 'x64'
      },
      {
        target: 'flatpak',
        arch: 'x64'
      }
    ]
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
