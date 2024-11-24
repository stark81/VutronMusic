import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Type = 'small' | 'normal'

export const useOsdLyricStore = defineStore(
  'osdLyric',
  () => {
    const type = ref<Type>('small')
    const isLock = ref(false)
    const alwaysOnTop = ref(false)
    const fontColor = ref('black')
    const entered = ref(false)
    return { type, isLock, alwaysOnTop, fontColor, entered }
  },
  {
    persist: true
  }
)
