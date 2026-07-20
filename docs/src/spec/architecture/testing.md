---
title: 测试
order: 5
last-reviewed: 2025-07-21
---

# 测试

## 测试框架

项目使用 **Playwright** 进行 E2E 测试，支持 Electron 应用的自动化测试。当前未配置单元测试框架（无 vitest/jest）。

| 工具       | 用途                                | 配置文件               |
| ---------- | ----------------------------------- | ---------------------- |
| Playwright | E2E 测试（Electron 启动、窗口交互） | `playwright.config.ts` |

## 配置

`playwright.config.ts` 关键配置：

| 配置项           | 值                | 说明             |
| ---------------- | ----------------- | ---------------- |
| `outputDir`      | `tests/results`   | 测试结果输出目录 |
| `retries`        | CI: 2, 本地: 0    | 失败重试次数     |
| `workers`        | CI: 1, 本地: 不限 | 并发 worker 数   |
| `timeout`        | 60000ms           | 单个测试超时     |
| `expect.timeout` | 10000ms           | 断言超时         |

## 现有测试

`tests/app.spec.ts` — 应用启动检测：

```typescript
test('Environment check', async () => {
  const isPackaged = await appElectron.evaluate(async ({ app }) => {
    return app.isPackaged
  })
  expect(isPackaged, 'Confirm that is in development mode').toBe(false)
})
```

验证 Electron 应用能正常启动且处于开发模式（`isPackaged = false`）。

## 运行测试

| 命令              | 说明                                                          |
| ----------------- | ------------------------------------------------------------- |
| `yarn test`       | 先执行 `build:pre`（类型检查 + Vite 构建），再运行 Playwright |
| `yarn test:linux` | Linux 下通过 `xvfb-run` 运行（需要虚拟帧缓冲）                |

**注意**：测试依赖构建产物（`dist/main/index.js`），不是直接测试源码。

## 编写新测试

1. 在 `tests/` 目录下创建 `*.spec.ts` 文件
2. 使用 `electron.launch()` 启动应用：

```typescript
import { _electron as electron } from 'playwright'

let appWindow: Page
let appElectron: ElectronApplication

test.beforeAll(async () => {
  appElectron = await electron.launch({
    args: ['dist/main/index.js'],
    locale: 'en-US',
    colorScheme: 'light',
    env: { ...process.env, NODE_ENV: 'production' }
  })
  appWindow = await appElectron.firstWindow()
  await appWindow.waitForEvent('load')
})

test.afterAll(async () => {
  await appElectron.close()
})
```

3. 使用 Playwright API 操作窗口元素（与 Web E2E 测试一致）

## 平台注意事项

| 平台            | 说明                                                 |
| --------------- | ---------------------------------------------------- |
| Windows / macOS | 直接运行 `yarn test`                                 |
| Linux           | 需要 `xvfb`（虚拟帧缓冲），CI 中通过 `xvfb-run` 包装 |
| CI              | 自动重试 2 次，单 worker 串行执行                    |
