<template>
  <Transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut">
    <div
      v-show="!noLyric"
      class="lyric-container"
      @mouseenter="hover = true"
      @mouseleave="hover = false"
    >
      <div v-show="hover" class="offset">
        <button-icon title="后退0.5s" @click="setOffset(-0.5)">
          <svg-icon icon-class="back5s" />
        </button-icon>
        <button-icon class="recovery" title="恢复" @click="setOffset(0)">
          <svg-icon icon-class="recovery" />
        </button-icon>
        <button-icon title="提前0.5s" @click="setOffset(0.5)">
          <svg-icon icon-class="forward5s" />
        </button-icon>
      </div>

      <div id="line-1" class="line"></div>
      <div
        v-for="(line, index) in lyricWithTranslation"
        :id="`line${index}`"
        :key="index"
        class="line"
        @click="seek = Number(line.time)"
      >
        <div v-if="line?.contents" class="content">
          <span
            v-for="(word, idx) in line.contents[0]"
            :key="idx"
            :style="labelStyle(index, idx)"
            >{{ word }}</span
          >
          <br />
          <span
            v-if="nTranslationMode === 'tlyric' && line.contents[1]"
            :style="translationStyle(index)"
            >{{ line.contents[1] }}</span
          >
          <span
            v-if="nTranslationMode === 'rlyric' && line.contents[2]"
            :style="translationStyle(index)"
            >{{ line.contents[2] }}</span
          >
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'

const playerStore = usePlayerStore()
const { noLyric, currentTrack, currentLyricIndex, lyrics, wBywLyricIndex, seek } =
  storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nFontSize, nTranslationMode, isNWordByWord } = toRefs(normalLyric.value)

const hover = ref(false)

const lyricWithTranslation = computed(() => {
  let ret: any[] = []
  const lyricFiltered = lyrics.value.lyric.filter(({ content }) => Boolean(content))
  if (lyricFiltered.length) {
    lyricFiltered.forEach((l) => {
      const { time, content, contentArray } = l
      const contentForUse = contentArray?.length ? contentArray : [content]
      const lyricItem = { time, content, contents: [contentForUse] }
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
      const sameTimeRLyric = lyrics.value.rlyric.find(({ time: rTime }) => rTime === time)
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
  return ret
})

const setOffset = (offset: number) => {
  if (!currentTrack.value!.offset) {
    currentTrack.value!.offset = 0
  }
  if (currentTrack.value!.isLocal) {
    window.mainApi
      .invoke('updateLocalTrackInfo', currentTrack.value!.id, {
        offset: currentTrack.value!.offset + offset
      })
      .then((isSussess: boolean) => {
        if (!isSussess) showToast('歌词延迟信息未保存至数据库，下次启动程序后需要重置歌词延迟')
      })
  }
  if (offset === 0) {
    currentTrack.value!.offset = 0
  } else {
    currentTrack.value!.offset += offset
  }
  showToast(
    `当前歌曲的歌词延迟为: ${currentTrack.value!.offset > 0 ? '延迟' : '提前'}${Math.abs(currentTrack.value!.offset)}s`
  )
}

const labelStyle = (lineIdx: number, wordIdx: number) => {
  const result: { [key: string]: any } = {
    fontSize: `${nFontSize.value}px`
  }
  if (
    lineIdx === currentLyricIndex.value &&
    ((isNWordByWord.value && wordIdx <= wBywLyricIndex.value) || !isNWordByWord.value)
  ) {
    result.opacity = 0.95
    result.transition = 'all 0.3s ease-in'
  }
  return result
}

const translationStyle = (lineIdx: number) => {
  const result: { [key: string]: any } = {
    fontSize: nFontSize.value - 4 + 'px'
  }
  if (
    lineIdx === currentLyricIndex.value &&
    wBywLyricIndex.value >=
      lyricWithTranslation.value[currentLyricIndex.value].contents[0]?.length - 2
  ) {
    result.opacity = 0.65
    result.transition = 'all 0.5s ease-in'
  }
  return result
}

watch(currentLyricIndex, (value) => {
  const el = document.getElementById(`line${value}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})

watch(showLyrics, (value) => {
  if (value)
    nextTick(() => {
      const el = document.getElementById(`line${currentLyricIndex.value}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
})

onMounted(() => {
  if (!currentTrack.value) return
  nextTick(() => {
    const el = document.getElementById(`line${currentLyricIndex.value}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
})
</script>

<style scoped lang="scss">
.lyric-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  scrollbar-width: none;
  padding: 0 6vw 0 3vw;
  transition: all 0.5s;

  .offset {
    display: flex;
    position: fixed;
    flex-direction: column;
    background-color: rgba(0, 0, 0, 0.05);
    padding: 10px 6px;
    top: 50%;
    right: 30px;
    border-radius: 8px;
    transform: translate(0, -50%);
    z-index: 1;

    .button-icon {
      margin: unset;
    }

    .recovery {
      margin: 10px 0;
    }
  }
}

.line {
  border-radius: 12px;
  margin: 2px 0;

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
  }

  &:first-child {
    margin-top: 40vh;
  }
}

.line#line-1 {
  margin-top: 40vh;
}

.line:last-child {
  margin-bottom: calc(50vh - 128px);
}

.content {
  font-weight: bold;
  padding: 12px;

  span {
    opacity: 0.28;
  }
}

.animated-fast {
  animation-duration: 0.5s;
  animation-fill-mode: both;
}

@keyframes fadeIn {
  from {
    width: 0;
    transform: translateX(25vh);
    opacity: 0;
  }
  to {
    width: 100%;
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    width: 100%;
    transform: translateX(0);
    opacity: 1;
  }
  to {
    width: 0;
    transform: translateX(25vh);
    opacity: 0;
  }
}

.fadeIn {
  animation-name: fadeIn;
}

.fadeOut {
  animation-name: fadeOut;
}

.word {
  opacity: 0.28;
  transition: opacity 0.3s ease-in-out;
  // white-space: pre;
}

.word.highlight {
  opacity: 0.98;
  animation: highlightAnimation 0.3s ease-in-out forwards;
}

@keyframes coverFromLeft {
  from {
    clip-path: polygon(0 0, 0 100%, 0 100%, 0 0);
  }
  to {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
  }
}

@keyframes highlightAnimation {
  from {
    opacity: 0.28;
  }
  to {
    opacity: 0.98;
  }
}
</style>
