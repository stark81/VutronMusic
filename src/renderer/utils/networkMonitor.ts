import { ref } from 'vue'

const consecutiveFailures = ref(0)
const isOfflineMode = ref(false)

let initDone = false

function recordFailure() {
  consecutiveFailures.value++
  if (consecutiveFailures.value >= 2 || !navigator.onLine) {
    isOfflineMode.value = true
  }
}

function recordSuccess() {
  consecutiveFailures.value = 0
  if (isOfflineMode.value) {
    isOfflineMode.value = false
  }
}

async function retryConnection(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const response = await fetch('/netease/banner?timestamp=' + Date.now(), {
      signal: controller.signal,
      cache: 'no-cache'
    })
    clearTimeout(timeout)
    if (response.ok) {
      recordSuccess()
      return true
    }
    return false
  } catch {
    return false
  }
}

function init() {
  if (initDone) return
  initDone = true

  if (!navigator.onLine) {
    isOfflineMode.value = true
  }

  window.addEventListener('online', () => {
    retryConnection()
  })

  window.addEventListener('offline', () => {
    isOfflineMode.value = true
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && isOfflineMode.value) {
      retryConnection()
    }
  })
}

export const networkMonitor = {
  init,
  consecutiveFailures,
  isOfflineMode,
  recordFailure,
  recordSuccess,
  retryConnection
}
