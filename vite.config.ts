import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite' // normalizePath
import ElectronPlugin, { ElectronOptions } from 'vite-plugin-electron' // ElectronPlugin
import RendererPlugin from 'vite-plugin-electron-renderer'
import EslintPlugin from 'vite-plugin-eslint'
// import VuetifyPlugin from 'vite-plugin-vuetify'
import VueJsx from '@vitejs/plugin-vue-jsx'
import Vue from '@vitejs/plugin-vue'
import { rmSync } from 'fs' // fs
import { resolve, dirname } from 'path' // join， posix
import { builtinModules } from 'module'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'

const isDevEnv = process.env.NODE_ENV === 'development'

export default defineConfig(({ mode }) => {
  process.env = {
    ...(isDevEnv
      ? {
          ELECTRON_ENABLE_LOGGING: 'true'
        }
      : {}),
    ...process.env,
    ...loadEnv(mode, process.cwd())
  }

  rmSync('dist', { recursive: true, force: true })

  const electronPluginConfigs: ElectronOptions[] = [
    {
      entry: 'src/main/index.ts',
      onstart({ startup }) {
        startup()
      },
      vite: {
        root: resolve('.'),
        build: {
          assetsDir: '.',
          outDir: 'dist/main',
          rollupOptions: {
            external: ['electron', ...builtinModules, 'better-sqlite3']
          },
          commonjsOptions: {
            ignoreDynamicRequires: true
          }
        }
      }
    },
    {
      entry: 'src/preload/index.ts',
      onstart({ reload }) {
        reload()
      },
      vite: {
        root: resolve('.'),
        build: {
          outDir: 'dist/preload'
        }
      }
    },
    {
      entry: 'src/preload/osdWin.ts',
      vite: {
        root: resolve('.'),
        build: {
          outDir: 'dist/preload'
        }
      }
    }
  ]

  if (isDevEnv) {
    electronPluginConfigs.push({
      entry: 'src/main/index.dev.ts',
      vite: {
        root: resolve('.'),
        build: {
          outDir: 'dist/main'
        }
      }
    })
  }

  return {
    define: {
      __VUE_I18N_FULL_INSTALL__: true,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.vue', '.json', '.scss'],
      alias: {
        '@': resolve(dirname(fileURLToPath(import.meta.url)), 'src')
      }
    },
    base: './',
    root: resolve('./src/renderer'),
    publicDir: resolve('./src/public'),
    clearScreen: false,
    build: {
      sourcemap: isDevEnv,
      minify: !isDevEnv,
      outDir: resolve('./dist'),
      rollupOptions: {
        input: {
          main: resolve('./src/renderer/index.html'),
          lyricWin: resolve('./src/renderer/osdlyric.html')
        }
      }
    },
    plugins: [
      // bindingSqlite3(),
      Vue(),
      createSvgIconsPlugin({
        iconDirs: [resolve(process.cwd(), 'src/renderer/assets/icons')],
        symbolId: 'icon-[dir]-[name]'
      }),
      VueJsx(),
      // Docs: https://github.com/vuetifyjs/vuetify-loader
      // VuetifyPlugin({
      //   autoImport: true
      //   // styles: {
      //   //   configFile: 'assets/css/global.scss'
      //   // }
      // }),
      // Docs: https://github.com/gxmari007/vite-plugin-eslint
      EslintPlugin(),
      // Docs: https://github.com/electron-vite/vite-plugin-electron
      ElectronPlugin(electronPluginConfigs),
      RendererPlugin()
    ],
    server: {
      port: 41830,
      strictPort: true,
      proxy: {
        '/netease': {
          target: `http://127.0.0.1:40001`,
          changeOrigin: true
        },
        '/local-asset': {
          target: `http://127.0.0.1:40001`,
          changeOrigin: true
        },
        '/stream-asset': {
          target: `http://127.0.0.1:40001`,
          changeOrigin: true
        }
      }
    }
  }
})

// function bindingSqlite3(
//   options: {
//     output?: string
//     better_sqlite3_node?: string
//     command?: string
//   } = {}
// ) {
//   const TAG = '[vite-plugin-binding-sqlite3]'
//   options.output ??= 'dist-native'
//   options.better_sqlite3_node ??= 'better_sqlite3.node'
//   options.command ??= 'build'

//   return {
//     name: 'vite-plugin-binding-sqlite3',
//     config(config) {
//       const arch = process.env.ARCH || process.arch
//       const destination = `better_sqlite3-${arch}.node`

//       const resolvedRoot = normalizePath(process.cwd())
//       const output = normalizePath(resolve(resolvedRoot, options.output as string))
//       const betterSqlite3 = normalizePath(require.resolve('better-sqlite3'))
//       const betterSqlite3Root = posix.join(
//         betterSqlite3.slice(0, betterSqlite3.lastIndexOf('node_modules')),
//         'node_modules/better-sqlite3'
//       )
//       const betterSqlite3Node = normalizePath(
//         posix.join(betterSqlite3Root, 'build/Release', options.better_sqlite3_node as string)
//       )
//       const betterSqlite3Copy = normalizePath(posix.join(output, destination))

//       if (!fs.existsSync(betterSqlite3Node)) {
//         throw new Error(`${TAG} Can not found "${betterSqlite3Node}".`)
//       }

//       console.log(
//         fs.existsSync(betterSqlite3Copy)
//           ? `Found "${betterSqlite3Copy}"`
//           : `Copy "${betterSqlite3Node}" to "${betterSqlite3Copy}"`
//       )

//       if (!fs.existsSync(betterSqlite3Copy)) {
//         if (!fs.existsSync(output)) {
//           fs.mkdirSync(output, { recursive: true })
//         }
//         fs.copyFileSync(betterSqlite3Node, betterSqlite3Copy)
//       }

//       // 使用 path.join 而不是 posix.join，这样会使用系统默认的路径分隔符
//       // const BETTER_SQLITE3_BINDING = join(options.output, destination)

//       // fs.writeFileSync(
//       //   join(resolvedRoot, '.env'),
//       //   `VITE_BETTER_SQLITE3_BINDING_${process.arch}=${BETTER_SQLITE3_BINDING}`
//       // )
//       // console.log(TAG, `binding to ${BETTER_SQLITE3_BINDING}`)
//     }
//   }
// }
