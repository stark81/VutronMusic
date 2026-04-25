import { defineStore } from 'pinia'
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useNormalStateStore } from './state'
import { useSettingsStore } from './settings'
import { useOsdLyricStore } from './osdLyric'
import { LyricLine, Track } from '@/types/plugin'

export const useLyricStore = defineStore(
  'lyric',
  () => {
    const stateStore = useNormalStateStore()
    const settingsStore = useSettingsStore()
    const osdLyricStore = useOsdLyricStore()

    let timer: ReturnType<typeof setTimeout>
    const lyrics = ref<LyricLine[]>([])
    const currentIndex = ref(-1)
    const offset = ref(0)
    const rate = ref(1)
    const isEnd = ref(false)

    let _getTime: () => number = () => 0
    let _getPlayling: () => boolean = () => false
    let _getRate: () => number = () => rate.value
    let _getTrack: () => Track | undefined = () => undefined

    const noLyric = computed(() => !lyrics.value.length)
    const shouldGetLrcIndex = computed(() => {
      return (
        stateStore.showLyrics ||
        osdLyricStore.show ||
        (window.env?.isMac && settingsStore.tray.showLyric) ||
        (window.env?.isLinux && settingsStore.tray.enableExtension)
      )
    })

    watch(shouldGetLrcIndex, (value) => {
      if (value) {
        updateIndex()
      } else {
        clearTimeout(timer)
      }
    })

    watch(offset, () => {
      updateIndex()
    })

    watch(isEnd, (value) => {
      if (value) return
      updateIndex()
    })

    function setTimeGetter(fn: () => number) {
      _getTime = fn
    }

    function setPlayingGetter(fn: () => boolean) {
      _getPlayling = fn
    }

    function setRateGetter(fn: () => number) {
      _getRate = fn
    }

    function setTrackGetter(fn: () => Track | undefined) {
      _getTrack = fn
    }

    function getLyricIndex(list: Pick<LyricLine, 'start' | 'end'>[], start = 0, rate: 1 | 1000) {
      if (!list.length) return -1
      start = Math.max(start, 0)

      for (let i = start; i < list.length; i++) {
        if (list[i]?.start && list[i]?.start / rate > _getTime() + offset.value) {
          return i - 1
        }
      }

      return list.length - 1
    }

    function refreshLineIdx() {
      if (!lyrics.value.length || !shouldGetLrcIndex.value) return

      currentIndex.value = getLyricIndex(lyrics.value, 0, 1)
      const nextLine = lyrics.value[currentIndex.value + 1]

      if (nextLine) {
        const driftTime = nextLine.start - (_getTime() + offset.value)
        if (!_getPlayling()) return
        timer = setTimeout(
          () => {
            if (!_getPlayling()) return
            refreshLineIdx()
          },
          (driftTime * 1000) / _getRate()
        )
      }
    }

    function updateIndex() {
      clearTimeout(timer)
      if (!lyrics.value.length || !shouldGetLrcIndex.value) return
      currentIndex.value = getLyricIndex(lyrics.value, 0, 1)
      if (!_getPlayling() || isEnd.value) return
      refreshLineIdx()
    }

    function clearTimer() {
      clearTimeout(timer)
      timer = undefined as any
    }

    function updateRate(_rate: number) {
      rate.value = _rate
    }

    /** 设置歌词偏移并持久化到数据库 */
    async function setOffset(value: number) {
      offset.value = value
      const track = _getTrack()
      if (track) {
        try {
          await window.mainApi?.invoke('set-lyric-offset', {
            pluginId: track.pluginId,
            trackId: String(track.id),
            offset: value
          })
        } catch {
          console.error('[lyricStore] 保存歌词偏移失败')
        }
      }
    }

    onBeforeUnmount(() => {
      clearTimeout(timer)
    })

    return {
      lyrics,
      offset,
      noLyric,
      currentIndex,
      isEnd,

      getLyricIndex,
      clearTimer,
      updateIndex,
      updateRate,
      setOffset,

      setTimeGetter,
      setRateGetter,
      setPlayingGetter,
      setTrackGetter
      // sendToSelf
    }
  },
  { persist: true }
)
