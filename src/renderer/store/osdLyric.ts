import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useOsdLyricStore = defineStore(
  'osdLyric',
  () => {
    const isLock = ref(false)
    const alwaysOnTop = ref(false)
    const isHoverHide = ref(true)
    return { isLock, alwaysOnTop, isHoverHide }
  },
  {
    persist: true
  }
)
