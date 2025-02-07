const child = require('child_process')
const fs = require('fs');
const path = require('path');

// 处理Linux系统的chrome-sandbox权限问题
function configureChromeSandbox() {
  if (process.platform !== 'linux') {
    console.log('非Linux系统，跳过修复');
    return;
  }

  const chromeSandboxPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'chrome-sandbox');
  try {
    // 确保文件存在
    fs.accessSync(chromeSandboxPath, fs.constants.F_OK);

    // 设置文件权限为4755
    fs.chmodSync(chromeSandboxPath, 0o4755)
    // 尝试修改文件所有者为root
    child.execSync(`sudo chown root:root "${chromeSandboxPath}"`);
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
