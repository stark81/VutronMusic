const child = require('child_process')
const fs = require('fs')
const { resolve, posix, join } = require('path')

const normalizePath = (path) => {
  return path.replace(/\\/g, '/')
}

const cp = child.spawn(
  process.platform === 'win32'
    ? '.\\node_modules\\.bin\\electron-rebuild.cmd' // Windows
    : './node_modules/.bin/electron-rebuild', // Mac/Linux
  ['--force', '--module-dir=node_modules/better-sqlite3'],
  {
    shell: true, // 这很重要，允许shell语法执行
    stdio: 'inherit'
  }
)

cp.on('exit', (code) => {
  if (code === 0) {
    console.log('Rebuild native modules success.')
    const out = 'dist-native'
    const denstination = `better_sqlite3-${process.arch}.node`

    const resolvedRoot = normalizePath(process.cwd())
    const output = normalizePath(resolve(resolvedRoot, out))
    const betterSqlite3 = normalizePath(require.resolve('better-sqlite3'))
    const betterSqlite3Root = posix.join(
      betterSqlite3.slice(0, betterSqlite3.lastIndexOf('node_modules')),
      'node_modules/better-sqlite3'
    )
    const betterSqlite3Node = normalizePath(
      posix.join(betterSqlite3Root, 'build/Release/better_sqlite3.node')
    )
    const betterSqlite3Copy = normalizePath(posix.join(output, denstination))
    if (!fs.existsSync(output)) {
      fs.mkdirSync(output, { recursive: true })
    }
    fs.copyFileSync(betterSqlite3Node, betterSqlite3Copy)

    const BETTER_SQLITE3_BINDING = join(out, denstination)
    fs.writeFileSync(
      join(resolvedRoot, '.env'),
      `VITE_BETTER_SQLITE3_BINDING_${process.arch}=${BETTER_SQLITE3_BINDING}`
    )
    console.log(`binding to ${BETTER_SQLITE3_BINDING}`)
  }
  process.exit(code)
})
