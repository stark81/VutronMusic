import { customRef } from 'vue'

export function debounceRef(value: any, delay = 500) {
  let timer: any
  return customRef((track, trigger) => {
    return {
      get() {
        track() // 通知Vue追踪value的变化
        return value
      },
      set(val) {
        clearTimeout(timer)
        timer = setTimeout(() => {
          value = val
          trigger() // 通知Vue去重新解析模板
        }, delay)
      }
    }
  })
}
