# 代码规范

## Prettier 配置

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "none",
  "endOfLine": "lf",
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "htmlWhitespaceSensitivity": "strict"
}
```

**关键规则**：

- 不使用分号
- 使用单引号
- 不使用尾逗号
- LF 换行符
- 2 空格缩进

## ESLint 规则

- **扩展**: `vue3-recommended` + `standard` + `prettier`
- **解析器**: `vue-eslint-parser` + `@typescript-eslint/parser`
- **未使用变量**: 仅警告（`no-unused-vars: 0`）

## TypeScript 配置

### 渲染进程 (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": false,
    "allowJs": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/renderer", "src/types"]
}
```

### 主进程/Preload (`tsconfig.node.json`)

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "node"
  },
  "include": ["src/main", "src/preload", "package.json", "vite.config.ts", "buildAssets/builder"]
}
```

**注意**：`strict: true` 但 `noImplicitAny: false`，意味着允许隐式 any 类型。

## 路径别名

```typescript
// 使用 @/ 前缀引用 src/ 下的文件
import { db } from '@/main/db'
import { usePlayerStore } from '@/renderer/store/player'
```

## 代码风格示例

```typescript
// ✅ 正确
const name = 'VutronMusic'
const items = ref<string[]>([])
const count = computed(() => items.value.length)

function addItem(item: string) {
  items.value.push(item)
}

// ❌ 错误
const name = 'VutronMusic' // 应使用单引号
const items = ref<string[]>([]) // 不应有分号
```
