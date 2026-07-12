/**
 * 构建原生 Node 插件（macOS only）
 * 运行 node-gyp rebuild 并拷贝产物到 dist-native/
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = __dirname
const DIST_NATIVE = path.join(ROOT, 'dist-native')

function build(name, subdir) {
  const srcDir = path.join(ROOT, 'src/native', subdir)
  const buildDir = path.join(srcDir, 'build/Release')
  const target = `${name}_addon.node`
  const output = path.join(DIST_NATIVE, `vutron_${name}_addon_darwin_${process.arch}.node`)

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

// 仅 macOS
if (process.platform !== 'darwin') {
  console.log('[build-native] Skipping native addon build (not macOS)')
  process.exit(0)
}

try {
  // build('tray', 'tray')
  build('touchbar', 'touchbar')
  console.log('[build-native] All native addons built successfully.')
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
