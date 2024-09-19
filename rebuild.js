const path = require('path')
const child = require('child_process')

const betterSqlite3 = require.resolve('better-sqlite3')
const betterSqlite3Root = path.posix.join(
  betterSqlite3.slice(0, betterSqlite3.lastIndexOf('node_modules')),
  'node_modules/better-sqlite3'
)

const cp = child.spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  [
    'run',
    'build-release',
    `--target=${process.versions.electron}`,
    // https://github.com/electron/electron/blob/v26.1.0/docs/tutorial/using-native-node-modules.md#manually-building-for-electron
    '--dist-url=https://electronjs.org/headers'
  ],
  {
    cwd: betterSqlite3Root,
    stdio: 'inherit'
  }
)

cp.on('exit', (code) => {
  if (code === 0) {
    console.log('Rebuild better-sqlite3 success.')
  }
  process.exit(code)
})
