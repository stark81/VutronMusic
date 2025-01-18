import { defineStore } from 'pinia'
import { ref, onMounted } from 'vue'

export type Type = 'small' | 'normal'
export type Mode = 'oneLine' | 'twoLines'
export type TranslationMode = 'none' | 'tlyric' | 'romalrc'

export const useOsdLyricStore = defineStore(
  'osdLyric',
  () => {
    const show = ref(false)
    const type = ref<Type>('small')
    const mode = ref<Mode>('twoLines')
    const isLock = ref(false)
    const alwaysOnTop = ref(false)
    const fontSize = ref(26)
    const staticTime = ref(1500)
    const isWordByWord = ref(true)
    const translationMode = ref<TranslationMode>('tlyric')
    const backgroundColor = ref('rgba(0, 0, 0, 0)')
    const playedLrcColor = ref('#37cf88')
    const unplayLrcColor = ref('rgba(255, 255, 255, 0.55)')
    const textShadow = ref('rgba(210, 210, 210, 0.2)')

    window.addEventListener('storage', (event) => {
      if (event.key === 'osdLyric') {
        const newState = JSON.parse(event.newValue || '{}')
        if (Object.keys(newState).length === 0 && newState.constructor === Object) return
        show.value = newState.show
        type.value = newState.type
        mode.value = newState.mode
        isLock.value = newState.isLock
        alwaysOnTop.value = newState.alwaysOnTop
        fontSize.value = newState.fontSize
        staticTime.value = newState.staticTime
        isWordByWord.value = newState.isWordByWord
        backgroundColor.value = newState.backgroundColor
        playedLrcColor.value = newState.playedLrcColor
        unplayLrcColor.value = newState.unplayLrcColor
        textShadow.value = newState.textShadow
        translationMode.value = newState.translationMode
      }
    })

    onMounted(() => {
      window.mainApi.send('updateOsdState', { show: show.value })
    })

    return {
      show,
      type,
      mode,
      isLock,
      alwaysOnTop,
      fontSize,
      staticTime,
      isWordByWord,
      backgroundColor,
      playedLrcColor,
      unplayLrcColor,
      textShadow,
      translationMode
    }
  },
  {
    persist: true
  }
)
