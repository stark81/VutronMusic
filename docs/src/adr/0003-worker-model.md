---
title: ADR-0003 Worker 线程模型
order: 4
---

# ADR-0003：Worker 线程模型

---

**状态**：已实施  
**日期**：v3.3.0  
**决策者**：stark81

---

## Context

选定 Worker 线程作为插件执行沙箱（ADR-0001）后，需要决定主进程与 Worker 之间的通信模型。核心问题：

1. **调用模式**：同步调用还是异步调用？
2. **超时处理**：插件卡住了怎么办？
3. **消息队列**：多个调用到达时如何处理？
4. **错误传播**：Worker 线程的异常如何传递给主进程？

## 考虑的方案

### 方案 A：主进程直接调用 Worker 方法（不可能）

Worker 线程没有 `exports.fn()` — Worker 通过 `postMessage` 通信，不能直接调用。此方案不可行。

### 方案 B：简单的请求-响应（基础方案）

```typescript
// 主进程
worker.postMessage({ type: 'CALL', method, args })

// Worker 监听
worker.on('message', (msg) => {
  if (msg.type === 'CALL') {
    const result = exports[msg.method](...msg.args)
    worker.postMessage({ type: 'RESULT', result })
  }
})
```

- **优点**：简单，容易理解
- **缺点**：没有 callId，并发调用无法匹配请求和响应
- **缺点**：没有超时处理

### 方案 C：callId + Promise 映射（选定方案 🏆）

```typescript
// 主进程
class PluginInstance {
  callResolvers = new Map()
  nextCallId = 0

  call(method, args) {
    const callId = this.nextCallId++
    return new Promise((resolve, reject) => {
      // 存储 Promise 控制器
      this.callResolvers.set(callId, { resolve, reject })

      // 12 秒超时
      const timer = setTimeout(() => {
        this.callResolvers.delete(callId)
        reject(new Error('插件响应超时'))
      }, 12000)

      // 发送消息
      this.worker.postMessage({ type: 'CALL_METHOD', method, args, callId })
    })
  }
}
```

```
Worker 响应流：
  POST { type: 'CALL_METHOD', callId: 0, method: 'search', args: {...} }
  RECV { type: 'CALL_RESULT', callId: 0, result: { code: 200, ... } }
  → callResolvers.get(0).resolve(result)
```

- **优点**：支持并发调用（每个调用有独立 ID）
- **优点**：超时可单独设置（不同方法可有不同超时）
- **优点**：Promise 化，调用方可以用 async/await
- **缺点**：需要维护 callResolvers Map 的状态

### 方案 D：Streaming 模式（探索后放弃）

Worker 可以边处理边返回中间结果（如进度更新）。

- **放弃原因**：当前插件方法没有需要流式返回的场景，增加复杂性但无实际收益。未来如果需要（如大文件处理进度），可以在当前架构上扩展。

## Decision

选择 **方案 C：callId + Promise 映射**。

## Consequences

### 正面

- 并发支持：一个 Worker 可以同时处理多个调用（Worker 内部异步执行）
- 超时控制：12 秒默认超时，防止恶意或有问题的插件挂起
- 清晰的错误处理：超时、方法不存在、执行异常都有对应的错误类型
- Promise 接口：调用方可以用 await，代码简洁

### 负面

- callResolvers Map 可能内存泄漏（如果插件长期不返回且超时未触发）— 通过 WeakRef 增强安全性（TODO）
- 单个 Worker 线程的并发实际受 JavaScript 事件循环限制，真正的并行有限
- 调试时需要追踪 callId 来匹配请求-响应对

### 后续影响

- 超时时间可配置（某些场景需要更长时间，如图片上传）
- HTTP 请求（`api.http`）也有自己的超时机制（20 秒），与插件调用超时独立
- 未来可考虑添加健康检查（ping/pong）检测 Worker 是否存活
