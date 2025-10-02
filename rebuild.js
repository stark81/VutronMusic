const child = require('child_process')

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
  }
  process.exit(code)
})
