import { ref } from 'vue'

const FAILURE_THRESHOLD = 3
const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000]

const consecutiveFailures = ref(0)
const isOfflineMode = ref(false)

let initDone = false
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryAttempt = 0

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = undefined
  retryAttempt = 0
}

function scheduleRetry() {
  if (retryTimer || !navigator.onLine) return
  const delay = RETRY_DELAYS[Math.min(retryAttempt++, RETRY_DELAYS.length - 1)]
  retryTimer = setTimeout(() => {
    retryTimer = undefined
    retryConnection().catch(() => undefined)
  }, delay)
}

function enterOfflineMode() {
  isOfflineMode.value = true
  scheduleRetry()
}

function isTransportFailure(error?: unknown) {
  // HTTP responses (including 4xx/5xx) prove that the configured service was
  // reached. They are application failures, not evidence of being offline.
  const axiosError = error as { response?: unknown; code?: string } | undefined
  return !axiosError?.response
}

function recordFailure(error?: unknown) {
  if (!isTransportFailure(error)) return
  consecutiveFailures.value++
  if (!navigator.onLine || consecutiveFailures.value >= FAILURE_THRESHOLD) {
    enterOfflineMode()
  }
}

function recordSuccess(confirmed = false) {
  consecutiveFailures.value = 0
  // A successful health check is sufficient to recover. Regular API traffic is
  // deliberately not allowed to flip the mode after a single transient result.
  if (isOfflineMode.value && confirmed) {
    isOfflineMode.value = false
    clearRetry()
  }
}

async function retryConnection(): Promise<boolean> {
  if (!navigator.onLine) {
    enterOfflineMode()
    return false
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3_000)
    const response = await fetch('/netease/banner?timestamp=' + Date.now(), {
      signal: controller.signal,
      cache: 'no-cache'
    })
    clearTimeout(timeout)
    if (response.ok) {
      recordSuccess(true)
      return true
    }
  } catch {
    // A failed probe while already offline should keep the retry loop alive.
  }

  enterOfflineMode()
  return false
}

function init() {
  if (initDone) return
  initDone = true

  if (!navigator.onLine) enterOfflineMode()

  window.addEventListener('online', () => {
    retryConnection().catch(() => undefined)
  })

  window.addEventListener('offline', () => {
    enterOfflineMode()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && isOfflineMode.value) {
      retryConnection().catch(() => undefined)
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
