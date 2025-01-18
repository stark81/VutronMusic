<template>
  <div ref="containerRef" class="container" :style="containerStyle">
    <div
      v-if="type === 'normal'"
      class="line"
      :style="{ paddingTop: type === 'normal' ? '45vh' : '0px' }"
    ></div>
    <div
      v-for="(line, index) in lyricWithTranslation"
      :id="`line${index}`"
      :key="index"
      class="line"
      :style="lineStyle(index)"
    >
      <div ref="contentRef" class="content" :style="contentStyle">
        <span v-if="line?.contents">
          <label
            v-for="(word, idx) in line.contents[0]"
            :key="idx"
            :style="isWordByWord ? labelStyle(index, idx) : labelStyleWithNoWordByWord(index)"
            class="word"
            >{{ word }}</label
          >
        </span>
        <br />
        <span
          v-if="translationMode === 'tlyric' && line?.contents && line.contents[1]"
          :style="spanStyle"
          class="translation"
        >
          <label
            :style="
              isWordByWord ? translationStyle(index) : labelStyleWithNoWordByWord(index, true)
            "
            >{{ line.contents[1] }}</label
          >
        </span>
        <span
          v-if="translationMode === 'romalrc' && line?.contents && line.contents[2]"
          :style="spanStyle"
          class="translation"
        >
          <label
            :style="
              isWordByWord ? translationStyle(index) : labelStyleWithNoWordByWord(index, true)
            "
            >{{ line.contents[2] }}</label
          >
        </span>
      </div>
    </div>
    <div
      v-if="type === 'normal'"
      class="line"
      :style="{ paddingBottom: type === 'normal' ? '45vh' : '6px' }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'

const osdLyricStore = useOsdLyricStore()
const {
  type,
  playedLrcColor,
  unplayLrcColor,
  fontSize,
  textShadow,
  translationMode,
  mode,
  isWordByWord
} = storeToRefs(osdLyricStore)

const lyrics = ref<{ lyric: any[]; tlyric: any[]; rlyric: any[] }>({
  lyric: [{ content: '暂无歌词', time: 0, rawTime: ['00:00.00'] }],
  rlyric: [],
  tlyric: []
})
const currentLyricIndex = ref(-1)
const wBywLyricIndex = ref(0)
const contentRef = ref()
const containerRef = ref()

const containerStyle = computed(() => {
  const result: { [key: string]: any } = {}
  if (lyricWithTranslation.value.length === 1) {
    result.display = 'flex'
    result.alignItems = 'center'
    result.justifyContent = 'center'
  }
  result.overflowY = type.value === 'normal' ? 'scroll' : 'hidden'
  return result
})

const lyricWithTranslation = computed(() => {
  let ret: any[] = []
  const lyricFiltered = lyrics.value.lyric.filter(({ content }) => Boolean(content))
  if (lyricFiltered?.length) {
    lyricFiltered.forEach((l) => {
      const { time, content, contentArray, contentTimes } = l
      const contentForUse = contentArray?.length ? contentArray : [content]
      const lyricItem = { time, content, contentTimes, contents: [contentForUse] }
      // 歌词翻译
      const sameTimeTLyric = lyrics.value.tlyric.find(({ time: tTime }) => tTime === time)
      if (sameTimeTLyric) {
        const { content: tLyricContent } = sameTimeTLyric
        if (content) {
          lyricItem.contents.push(tLyricContent)
        } else {
          lyricItem.contents.push(null)
        }
      } else {
        lyricItem.contents.push(null)
      }
      // 歌词音译
      const sameTimeRLyric = lyrics.value.rlyric.find(({ time: tTime }) => tTime === time)
      if (sameTimeRLyric) {
        const { content: rLyricContent } = sameTimeRLyric
        if (content) {
          lyricItem.contents.push(rLyricContent)
        } else {
          lyricItem.contents.push(null)
        }
      }
      ret.push(lyricItem)
    })
  } else {
    ret = lyricFiltered.map(({ time, content }) => ({
      time,
      content,
      contents: [[content]]
    }))
  }
  const idx = Math.max(currentLyricIndex.value, 0)
  if (type.value === 'normal') {
    return ret
  } else if (mode.value === 'oneLine') {
    return ret.slice(idx, idx + 1)
  } else {
    const index = idx + (idx % 2 === 0 ? 0 : -1) || 0
    return ret.slice(index, index + 2)
  }
})

const spanStyle = computed(() => {
  return {
    textShadow: `2px 2px 2px ${textShadow.value}`
  }
})

const lineStyle = (idx: number) => {
  const result: { [key: string]: any } = {}
  if (!lyricWithTranslation.value?.length) return result
  let align: any = 'center'
  if (type.value === 'small' && lyricWithTranslation.value?.length === 2) {
    align = idx === 0 ? 'start' : 'end'
  }
  result.textAlign = align
  if (type.value === 'normal') {
    result.paddingBottom = '10px'
  } else {
    result.paddingBottom = lyricWithTranslation.value.length === 2 ? '6px' : '0'
  }
  return result
}

const highlight = computed(() => {
  if (currentLyricIndex.value < 0) return currentLyricIndex.value
  const idx = lyricWithTranslation.value.length === 1 ? 0 : currentLyricIndex.value % 2
  const result = type.value === 'normal' ? currentLyricIndex.value : idx
  return result
})

const contentStyle = computed(() => {
  if (type.value === 'normal') return {}
  const result = { width: '100%', overflow: 'hidden', whiteSpace: 'nowrap' }
  return result
})

const labelStyleWithNoWordByWord = (lyricIndex: number, isTranslation = false) => {
  const result: { [key: string]: any } = {
    color: unplayLrcColor.value,
    fontSize: `${fontSize.value - (isTranslation ? 4 : 0)}px`,
    textShadow: `2px 2px 2px ${textShadow.value}`
  }
  if (lyricIndex === highlight.value) {
    result.color = playedLrcColor.value
  }
  return result
}

const labelStyle = (lyricIndex: number, wordIndex: number) => {
  const result: { [key: string]: any } = {
    color: unplayLrcColor.value,
    fontSize: `${fontSize.value}px`,
    textShadow: `2px 2px 2px ${textShadow.value}`
  }
  // lyricIndex < highlight.value
  if (lyricWithTranslation.value[lyricIndex].contentTimes && lyricIndex < highlight.value) {
    result.color = playedLrcColor.value
    result.transition = 'unset'
  } else if (lyricIndex === highlight.value && wordIndex <= wBywLyricIndex.value) {
    result.color = playedLrcColor.value
    result.transition = 'all 0.3s ease-in'
  }
  return result
}

const translationStyle = (index: number) => {
  const result: { [key: string]: any } = {
    fontSize: fontSize.value - 4 + 'px',
    color: unplayLrcColor.value
  }
  if (lyricWithTranslation.value[index].contentTimes?.length && index < highlight.value) {
    result.color = playedLrcColor.value
  } else if (
    index === highlight.value &&
    wBywLyricIndex.value >= lyricWithTranslation.value[highlight.value].contents[0]?.length - 2
  ) {
    result.color = playedLrcColor.value
    result.transition = 'all 0.5s ease-in'
  }
  return result
}

const scrollPosition = ref(0)

const adjustScorllPosition = (index: number) => {
  const container = contentRef.value
  if (!container) return
  const words = container[highlight.value]?.querySelectorAll('.word')
  if (!words || index >= words.length) return

  const containerWidth = container[highlight.value]?.offsetWidth || 0
  const targetWord = words[index] as HTMLElement
  const wordWidth = targetWord.offsetWidth
  const wordLeft = targetWord.offsetLeft

  const targetScrollPosition = wordLeft + wordWidth / 2 - containerWidth / 2
  const maxScrollPosition = container[highlight.value]?.scrollWidth ?? 0 - containerWidth
  scrollPosition.value = Math.max(0, Math.min(targetScrollPosition, maxScrollPosition))

  container[highlight.value]?.scrollTo({
    left: scrollPosition.value,
    behavior: 'smooth'
  })
}
watch(wBywLyricIndex, (idx) => {
  if (type.value === 'normal' || idx < 0) return
  adjustScorllPosition(idx)
})

const containerHeight = ref(200)
watch(containerHeight, (value) => {
  if (!value || type.value === 'normal') return
  window.mainApi.send('osd-resize', value)
})

window.mainApi.on('updateLyricInfo', (event, data) => {
  const [key, value] = Object.entries(data)[0] as [string, any]
  if (key === 'lyrics') {
    lyrics.value = value.lyric.length ? value : { lyric: [], rlyric: [], tlyric: [] }
    if (lyrics.value.lyric.length) {
      const el = document.getElementById(`line0`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // containerHeight.value = 200
  } else if (key === 'currentLyricIndex') {
    currentLyricIndex.value = value
    const el = document.getElementById(`line${value}`)
    if (type.value === 'normal' && el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // setTimeout(() => {
    if (type.value === 'normal' || !containerRef.value?.offsetHeight) return
    containerHeight.value = containerRef.value?.offsetHeight + 40
    // })
  } else if (key === 'wBywLyricIndex') {
    wBywLyricIndex.value = value
    // setTimeout(() => {
    if (type.value === 'normal' || !containerRef.value?.offsetHeight) return
    containerHeight.value = containerRef.value?.offsetHeight + 40
    // }, 50)
  }
})

onMounted(() => {
  const player = JSON.parse(localStorage.getItem('player') || '{}')
  if (!player.lyrics) return
  lyrics.value = player.lyrics
  currentLyricIndex.value = player.currentLyricIndex
  wBywLyricIndex.value = player.wBywLyricIndex

  setTimeout(() => {
    const el = document.getElementById(`line${currentLyricIndex.value}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    if (type.value === 'normal' || !containerRef.value?.offsetHeight) return
    containerHeight.value = containerRef.value?.offsetHeight + 40
    // window.mainApi.send('osd-resize', containerRef.value?.offsetHeight + 40)
  })
})
</script>

<style lang="scss" scoped>
.container {
  user-select: none;
  padding: 0 18px;
  max-height: calc(100vh - 40px);
  scrollbar-width: none;
}
.line {
  transition: 0.5s;
  font-weight: bold;
}
</style>
