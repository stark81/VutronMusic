# Main vs Renderer Process

A **Vutron** application is divided into code into a Main process and a Renderer process.

**"Main"** is the code of `src/main` and is mainly the process code handled by Electron. **"Renderer"** is the code of `src/renderer`, mainly for front-end rendering process like Vue.

In general, **NodeJS** scripts cannot be run in the renderer process. Examples include modules that contain APIs used by NodeJS, or native modules of **NodeJS** such as `path` or `net`, `os` or `crypto`.

Preload scripts are run before the renderer is loaded. It creates a bridge to the main process to keep the execution of NodeJS scripts in the renderer area separate and isolated for security reasons.

For secure script execution, it is recommended that the main process executes the Node scripts, and the renderer receives the execution results via messaging. This can be implemented via **IPC communication**.

For more information on this, see the following articles: https://www.electronjs.org/docs/latest/tutorial/ipc

### How to run NodeJS on a renderer?

If you want to skip the security issues and use NodeJS scripts in your renderer, you need to set `nodeIntegration` to `true` in your `vite.config.ts` file.

```javascript
rendererPlugin({
  nodeIntegration: true
})
```

For more information on this, see the following articles: https://github.com/electron-vite/vite-plugin-electron-renderer
