import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'

type TrackType = 'online' | 'local' | 'stream'

export const useNormalStateStore = defineStore('state', () => {
  const enableScrolling = ref(true)
  const virtualScrolling = ref(false)
  const showLyrics = ref(false)
  const searchTab = ref('track')
  const exploreTab = ref('playlist')
  const setConvolverModal = ref(false)
  const setPlaybackRateModal = ref(false)
  const extensionCheckResult = ref(false)
  const modalOpen = ref(false)
  const addTrackToPlaylistModal = ref({
    show: false,
    selectedTrackID: [0] as (number | string)[],
    type: 'online' as TrackType
  })
  const newPlaylistModal = ref({
    show: false,
    type: 'online' as TrackType,
    afterCreateAddTrackID: [0] as (number | string)[]
  })
  const accurateMatchModal = ref({
    show: false,
    selectedTrackID: 0
  })

  const toast = reactive({
    show: false,
    text: '',
    timer: null as any
  })
  const dailyTracks = ref<any[]>([])

  const showToast = (text: string) => {
    if (toast.timer !== null) {
      clearTimeout(toast.timer)
    }
    toast.show = true
    toast.text = text
    toast.timer = setTimeout(() => {
      toast.show = false
      toast.text = ''
      toast.timer = null
    }, 3200)
  }

  watch(enableScrolling, (value) => {
    document.documentElement.style.overflowY = value ? 'auto' : 'hidden'
  })

  return {
    enableScrolling,
    virtualScrolling,
    showLyrics,
    searchTab,
    exploreTab,
    setConvolverModal,
    setPlaybackRateModal,
    extensionCheckResult,
    addTrackToPlaylistModal,
    newPlaylistModal,
    accurateMatchModal,
    dailyTracks,
    toast,
    modalOpen,
    showToast
  }
})
