/**
 * 安装依赖后的收尾工作（由 package.json 的 postinstall 调用）。
 *
 * 1. 修补 taglib-wasm 的 package.json —— 该修改会随 node_modules 一起被打进安装包，
 *    所以 CI 也必须执行；
 * 2. Linux 上给 chrome-sandbox 设置 setuid —— 只有本地跑 Electron 才需要；
 * 3. macOS 上编译 tray / touchbar 原生插件到 dist-native/ —— 只有 macOS 需要。
 *
 * 不再调用 electron-rebuild：
 *  - better-sqlite3 13+ 自带 Node-API 预编译二进制（prebuilds/<platform>-<arch>.node），
 *    Electron 与 Node 通用，无需按 ABI 重新编译；
 *  - sharp 也是预编译二进制；
 *  - 之前用 `electron rebuild.js`（启动 Electron GUI）来跑 electron-rebuild，
 *    在没有图形环境的 CI 上既慢又容易失败。
 *
 * CI 里传 SKIP_REBUILD=true 可跳过 2、3 两步（macOS 的原生插件由工作流单独执行 build:native）。
 */
const { execSync } = require('child_process')
const path = require('path')

function run(script) {
  console.log(`[rebuild] node ${script}`)
  execSync(`node "${path.join(__dirname, script)}"`, { stdio: 'inherit' })
}

run('fix-taglib-wasm.js')

if (process.env.SKIP_REBUILD === 'true') {
  console.log('[rebuild] SKIP_REBUILD=true，跳过 sandbox 设置与原生插件编译')
  process.exit(0)
}

run('fix-sandbox.js')
run('build-native.js')
