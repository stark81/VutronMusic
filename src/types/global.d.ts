// CSS / SCSS
declare module '*.css'
declare module '*.scss'

// 虚拟模块
declare module 'virtual:svg-icons-register'

// 兼容第三方样式库
declare module 'vscode-codicons/dist/codicon.css'
declare module 'trickling/lib/style.css'

// dotLottie：主包类型只覆盖包根，子路径后端（webgl/webgpu）在 moduleResolution: node 下解析不到，
// 这里手动补上（运行时由 Vite 按 package.json exports 正常解析）
declare module '@lottiefiles/dotlottie-web/webgl' {
  export * from '@lottiefiles/dotlottie-web'
}
declare module '@lottiefiles/dotlottie-web/webgpu' {
  export * from '@lottiefiles/dotlottie-web'
}

// Vite 的 ?url 资源导入（wasm 需要本地打包，不能走 CDN）
declare module '*?url' {
  const src: string
  export default src
}
