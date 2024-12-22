<template>
  <div
    class="lyrics-container"
    :class="{ active: isVisiable }"
    :style="{ overflowY: type === 'normal' ? 'scroll' : 'hidden' }"
    @mouseenter="isVisiable = true"
    @mouseleave="isVisiable = false"
  >
    <div class="line" :style="{ paddingTop: type === 'normal' ? '45vh' : '0px' }"></div>
    <div
      v-for="(line, index) in lyricWithTranslation"
      :id="`line${index}`"
      :key="index"
      class="line"
      :class="{ highlight: index === highlightIdx }"
      :style="lineStyle(index)"
    >
      <div class="content">
        <span v-if="line.contents[0]" :style="spanStyle">{{ line.contents[0] }}</span>
        <br />
        <span v-if="line.contents[1]" :style="spanStyle" class="translation">{{
          line.contents[1]
        }}</span>
      </div>
    </div>
    <div class="line" :style="{ paddingBottom: type === 'normal' ? '45vh' : '6px' }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useOsdLyricStore } from '../store/osdLyric'
import { storeToRefs } from 'pinia'

const osdLyricStore = useOsdLyricStore()
const { type, fontColor } = storeToRefs(osdLyricStore)

const lyrics = ref<{ lyric: any[]; tlyric: any[]; rlyric: any[] }>({
  lyric: [{ content: '暂无歌词', time: 0, rawTime: ['00:00.00'] }],
  rlyric: [],
  tlyric: []
})
const currentLyricIndex = ref(-1)
const isVisiable = ref(false)

const lyricWithTranslation = computed(() => {
  let ret: any[] = []

  const lyricFiltered = lyrics.value.lyric.filter(({ content }) => Boolean(content))
  if (lyricFiltered.length) {
    lyricFiltered.forEach((l) => {
      const { rawTime, time, content } = l
      const lyricItem = { time, content, contents: [content] }
      // 歌词翻译
      const sameTimeTLyric = lyrics.value.tlyric.find(
        ({ rawTime: tLyricRawTime }) => tLyricRawTime === rawTime
      )
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
      const sameTimeRLyric = lyrics.value.rlyric.find(
        ({ rawTime: rLyricRawTime }) => rLyricRawTime === rawTime
      )
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
      contents: [content]
    }))
  }

  const hasTranslation = ret[currentLyricIndex.value]?.contents[1]
  const idx = hasTranslation
    ? currentLyricIndex.value
    : currentLyricIndex.value + (currentLyricIndex.value % 2 === 0 ? 0 : -1)
  return type.value === 'normal' ? ret : ret.slice(idx, idx + (hasTranslation ? 1 : 2))
})

const highlightIdx = computed(() => {
  const idx = lyricWithTranslation.value.length === 1 ? 0 : currentLyricIndex.value % 2
  return type.value === 'normal' ? currentLyricIndex.value : idx
})

const spanStyle = computed(() => {
  return {
    textShadow: `2px 2px 2px ${fontColor.value === 'black' ? 'rgba(210, 210, 210, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`
  }
})

const lineStyle = (idx: number) => {
  const result: { [key: string]: any } = {}
  const colorMap = {
    black: '#222',
    white: '#eee',
    blue: '#335eea',
    green: '#37cf88',
    red: 'red'
  }
  result.color = colorMap[fontColor.value]
  let align: any = 'center'
  if (type.value === 'small' && !lyricWithTranslation.value[idx]?.contents[1]) {
    align = idx === 0 ? 'start' : 'end'
  }
  result.textAlign = align
  return result
}

// const spanStyle = (idx: number) => {
//   let size: number = 26
//   if (type.value === 'small' && lyricWithTranslation.value[idx].contents[1]) {
//     size = 24
//   }
//   return { fontSize: size + 'px' }
// }

// const translationStyle = (idx: number) => {
//   const size = type.value === 'normal' ? 24 : 20
//   return { fontSize: size + 'px' }
// }

window.mainApi.on(
  'updateLyric',
  (event: any, lrc: { lyric: any[]; tlyric: any[]; rlyric: any[] }) => {
    if (lrc.lyric.length === 0) {
      lyrics.value = {
        lyric: [],
        rlyric: [],
        tlyric: []
      }
    } else {
      lyrics.value = lrc
    }
  }
)

window.mainApi.on('updateLyricIndex', (event: any, idx: number) => {
  currentLyricIndex.value = idx
  const el = document.getElementById(`line${idx}`)
  if (type.value === 'normal' && el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})

onMounted(() => {
  const player = JSON.parse(localStorage.getItem('player') || '{}')
  if (!player.lyrics) return
  lyrics.value = player.lyrics
  currentLyricIndex.value = player.currentLyricIndex

  setTimeout(() => {
    const el = document.getElementById(`line${currentLyricIndex.value}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
})
</script>

<style lang="scss" scoped>
.lyrics-container {
  user-select: none;
  box-sizing: content-box;
  height: calc(100vh - 44px);
  scrollbar-width: none;
}
.line {
  margin: 2px 0;
  padding: 2px 18px;
  transition: 0.5s;
  font-weight: bold;
  width: 100vw;

  .content {
    transform-origin: center left;
    transform: scale(0.95);
    transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);

    span {
      opacity: 0.58;
      cursor: default;
      font-size: 26px;
      transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    span.translation {
      opacity: 0.5;
      font-size: 24px;
    }
  }
}
.highlight .content span {
  opacity: 0.98;
  display: inline-block;
}
.highlight .content span.translation {
  opacity: 0.8;
}
</style>
