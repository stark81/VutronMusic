const child = require('child_process');
const fs = require('fs');
const path = require('path');

// 处理Linux系统的chrome-sandbox权限问题
function configureChromeSandbox() {
  if (process.platform !== 'linux') {
    console.log('非Linux系统，跳过修复'); // 验证平台检测
    return;
  }

  const chromeSandboxPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'chrome-sandbox');
  
  try {
    // 确保文件存在
    fs.accessSync(chromeSandboxPath, fs.constants.F_OK);

    // 设置文件权限为4755
    fs.chmodSync(chromeSandboxPath, 0o4755)
    // 尝试修改文件所有者为root
    child.execSync(`chown root:root "${chromeSandboxPath}"`);
    console.log('已修改chrome-sandbox所有者为root，权限为4755');
  } catch (error) {
    console.warn('配置chrome-sandbox失败:', error.message);
    // console.warn('将禁用沙箱模式...');
    
    // 设置环境变量禁用沙箱（影响后续Electron进程）
    // process.env.ELECTRON_DISABLE_SANDBOX = '1';
    // 或者添加启动参数：args.push('--no-sandbox');
  }
}

// 执行权限修复
configureChromeSandbox();

// 原有electron-rebuild逻辑
const cp = child.spawn(
  process.platform === 'win32'
    ? '.\\node_modules\\.bin\\electron-rebuild.cmd'
    : './node_modules/.bin/electron-rebuild',
  ['--force', '--module-dir=node_modules/better-sqlite3'],
  {
    shell: true,
    stdio: 'inherit'
  }
);

cp.on('exit', (code) => {
  if (code === 0) {
    console.log('原生模块重建成功');
  }
  process.exit(code);
});
