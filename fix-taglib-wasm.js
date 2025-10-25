const fs = require('fs')
const path = require('path')

try {
  const taglibPkgPath = path.resolve(__dirname, './node_modules/taglib-wasm/package.json')
  if (fs.existsSync(taglibPkgPath)) {
    const pkgText = fs.readFileSync(taglibPkgPath, 'utf8')
    if (!pkgText.includes('"type": "module"')) {
      console.log('🔧 Patching taglib-wasm package.json to add "type": "module"...')
      const pkg = JSON.parse(pkgText)
      pkg.type = 'module'
      fs.writeFileSync(taglibPkgPath, JSON.stringify(pkg, null, 2))
      console.log('✅ taglib-wasm patched successfully.')
    }
  } else {
    console.warn('⚠️ taglib-wasm not found under node_modules.')
  }
} catch (err) {
  console.error('❌ Failed to patch taglib-wasm:', err)
}
