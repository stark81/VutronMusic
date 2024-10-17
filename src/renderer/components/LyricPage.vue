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
        :ref="`lyricRef${index}`"
        :key="index"
        class="line"
        :class="{ highlight: currentLyricIndex === index }"
        @click="seek = Number(line.time)"
      >
        <div class="content">
          <span v-if="line.contents[0]">{{ line.contents[0] }}</span>
          <br />
          <span v-if="true && line.contents[1]" class="translation">{{ line.contents[1] }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'

const playerStore = usePlayerStore()
const { noLyric, currentTrack, currentLyricIndex, seek, lyrics } = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

const hover = ref(false)

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
  padding-left: 4vh;
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

  .line {
    width: 60vh;
    margin: 2px 0;
    padding: 12px 18px;
    transition: 0.5s;
    border-radius: 12px;

    .content {
      width: 100%;
      transform-origin: center left;
      transform: scale(0.95);
      transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);

      span {
        width: 100%;
        overflow-wrap: break-word;
        opacity: 0.28;
        cursor: default;
        font-size: 28px;
        font-weight: 600;
      }

      span.translation {
        opacity: 0.2;
        font-size: 26px;
      }
    }

    &:hover {
      background: var(--color-secondary-bg-for-transparent);
    }
  }

  .line#line-1:hover {
    background: unset;
  }

  .highlight div.content {
    span {
      opacity: 0.98;
      display: inline-block;
    }
    span.translation {
      opacity: 0.65;
    }
  }
}

.lyric-container .line#line-1 {
  margin-top: 40vh;
}
.lyric-container .line:last-child {
  margin-bottom: calc(50vh - 128px);
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
</style>
