# AGENTS.md

## Project overview

VutronMusic — third-party NetEase Cloud Music desktop player. Electron app scaffolded from [Vutron](https://github.com/jooy2/vutron).

- **Stack**: Vue 3 + TypeScript + Pinia + Fastify + better-sqlite3
- **Package manager**: Yarn 1.22.22 (enforced via `packageManager` field)
- **Node requirement**: `>=22.6.0` (CI still tests 18/20 — may be stale)
- **Path alias**: `@/*` → `./src/*`

## Architecture

Three-process Electron layout:

```
src/
  main/          → Electron main process (entry: src/main/index.ts)
  preload/       → Preload scripts (src/preload/index.ts, src/preload/osdWin.ts)
  renderer/      → Vue 3 frontend (entry: src/renderer/main.ts, root: src/renderer/)
  types/         → Shared TypeScript types
```

**Two separate tsconfigs** — this is critical:
- `tsconfig.json` → includes `src/renderer` + `src/types` only (renderer)
- `tsconfig.node.json` → includes `src/main` + `src/preload` + `package.json` + `buildAssets/builder` (main/preload)

Running `vue-tsc --noEmit` only checks renderer code. Main/preload are **not** typechecked in the standard workflow.

## Commands

```bash
# Install (auto-rebuilds native modules via postinstall)
yarn install

# Development
yarn dev              # Vite dev server on port 41830 (strictPort)

# Lint & format
yarn lint             # ESLint (src/)
yarn lint:fix         # ESLint with autofix
yarn format:fix       # Prettier autoformat (runs as part of build:pre)

# Typecheck
vue-tsc --noEmit      # Renderer only (part of build:pre)

# Build (must run in order)
yarn build:pre        # format:fix → vue-tsc --noEmit → vite build
yarn build            # build:pre → electron-builder

# Test (requires full build first!)
yarn test             # build:pre → playwright test (Windows/macOS)
yarn test:linux       # xvfb-wrapped playwright test (Linux)

# Native module rebuild (also runs on every yarn install)
yarn rebuild          # fix-sandbox + fix-taglib-wasm + electron-rebuild
```

## Build gotchas

- **`rmSync('dist', ...)`** runs at Vite config load time — `dist/` is wiped on every `vite build` or `yarn dev`.
- **postinstall auto-rebuilds**: `yarn install` triggers `npm run rebuild` which runs `fix-sandbox.js` + `fix-taglib-wasm.js` + `electron-rebuild`. On Linux, `fix-sandbox.js` runs `sudo chown root` on chrome-sandbox.
- **taglib-wasm patch**: `fix-taglib-wasm.js` adds `"type": "module"` to taglib-wasm's package.json — this is required for the app to work.
- **Tests require production build**: Playwright launches from `dist/main/index.js` with `NODE_ENV=production`. You must run `yarn build:pre` before `yarn test`.
- **Dev proxy**: `/netease` requests proxy to `http://127.0.0.1:40001` (NetEase Cloud Music API server — must be running separately).

## Code style

- **Prettier**: no semicolons, single quotes, no trailing commas, LF line endings, 2-space indent
- **ESLint**: `vue3-recommended` + `standard` + `prettier`; unused vars are warnings only
- **TypeScript**: `noImplicitAny: false`, `strict: true` (mixed — implicit any is allowed)

## Testing

- Single test file: `tests/app.spec.ts`
- Framework: Playwright with Electron support
- Tests launch the built app from `dist/main/index.js` and verify basic functionality
- CI runs on Node 18/20 across Windows, macOS, Ubuntu
- On Linux, tests need `xvfb` (use `yarn test:linux`)
