<template>
  <div class="lyrics-container">
    <div id="line-1" class="line"></div>
    <div
      v-for="(line, index) in lyricWithTranslation"
      :id="`line${index}`"
      :key="index"
      class="line"
      :class="{ highlight: index === currentLyricIndex }"
    >
      <div class="content">
        <span v-if="line.contents[0]">{{ line.contents[0] }}</span>
        <br />
        <span v-if="line.contents[1]">{{ line.contents[1] }}</span>
      </div>
    </div>
    <div class="line"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const lyrics = ref<{ lyric: any[]; tlyric: any[]; rlyric: any[] }>({
  lyric: [{ content: '暂无歌词', time: 0, rawTime: ['00:00.00'] }],
  rlyric: [],
  tlyric: []
})
const currentLyricIndex = ref(-1)

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
  return ret
})

window.mainApi.on(
  'updateLyric',
  (event: any, lrc: { lyric: any[]; tlyric: any[]; rlyric: any[] }) => {
    if (lrc.lyric.length === 0) {
      lyrics.value = {
        lyric: [{ content: '暂无歌词', time: 0, rawTime: ['00:00.00'] }],
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
  if (el) {
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
  color: #fff;
  user-select: none;
}
.line {
  margin: 2px 0;
  padding: 2px 18px;
  transition: 0.5s;
  border-radius: 12px;
  color: white;
  text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.5);
  font-weight: bold;
  text-align: center;

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
.line:first-child {
  margin-top: 45vh;
}
.line:last-child {
  margin-bottom: 50vh;
}
.highlight .content span {
  opacity: 0.98;
  display: inline-block;
}
.highlight .content span.translation {
  opacity: 0.8;
}
</style>
