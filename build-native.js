/**
 * 构建原生 Node 插件
 * 运行 node-gyp rebuild 并拷贝产物到 dist-native/
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = __dirname
const DIST_NATIVE = path.join(ROOT, 'dist-native')

const PLATFORM = process.platform

function build(name, subdir) {
  const srcDir = path.join(ROOT, 'src/native', subdir)
  const buildDir = path.join(srcDir, 'build/Release')
  const target = `${name}_addon.node`
  const platformTag = PLATFORM === 'darwin' ? 'darwin' : PLATFORM === 'win32' ? 'win32' : PLATFORM
  const output = path.join(DIST_NATIVE, `vutron_${name}_addon_${platformTag}_${process.arch}.node`)

  console.log(`[build-native] Building ${name}...`)

  // 创建 dist-native 目录
  fs.mkdirSync(DIST_NATIVE, { recursive: true })

  // 运行 node-gyp rebuild
  execSync(`${path.join(ROOT, 'node_modules/.bin/node-gyp')} rebuild`, {
    cwd: srcDir,
    stdio: 'inherit'
  })

  // 拷贝产物
  const built = path.join(buildDir, target)
  if (fs.existsSync(built)) {
    fs.copyFileSync(built, output)
    console.log(`[build-native] ${name} → ${output}`)
  } else {
    throw new Error(`[build-native] Build artifact not found: ${built}`)
  }
}

try {
  if (PLATFORM === 'darwin') {
    build('tray', 'tray')
    build('touchbar', 'touchbar')
  } else {
    console.log('[build-native] No native addons needed for this platform')
  }
  console.log('[build-native] All native addons built successfully.')
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
