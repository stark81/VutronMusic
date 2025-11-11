<template>
  <transition name="slide-fade">
    <div v-show="!noLyric" class="lyric-wrapper" :class="{ 'use-mask': useMask }">
      <div v-show="hover" class="offset">
        <button-icon title="提前0.5s" @click="setOffset(-0.5)">
          <svg-icon icon-class="back5s" />
        </button-icon>
        <button-icon class="recovery" :title="offset" @click="setOffset(0)">
          <svg-icon icon-class="recovery" />
        </button-icon>
        <button-icon title="后退0.5s" @click="setOffset(+0.5)">
          <svg-icon icon-class="forward5s" />
        </button-icon>
      </div>
      <div ref="lyricContainer" class="main-lyric-container" :class="{}" @wheel="handleWheel">
        <div id="line-1" class="lyric"></div>
        <div ref="hidden-measure" class="lyric hidden-measure">
          <div class="lyric-line"></div>
          <div v-if="isTWordMode" class="translation"></div>
        </div>
        <div
          v-for="(line, index) in lyrics"
          :id="`line${index}`"
          :key="line.start"
          ref="lyric"
          class="lyric"
          :class="{
            active: index === highlight,
            isZoom,
            'word-mode': isWordMode,
            'translation-mode': nTranslationMode
          }"
          @click="seek = line.start"
        >
          <div class="lyric-line">
            <span>{{ line.lyric.text }}</span>
          </div>
          <div v-if="isTWordMode" class="translation">
            <span>{{ line[nTranslationMode as 'tlyric' | 'rlyric']?.text }}</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, onMounted, toRefs, nextTick, ref, watch, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import { lyricLine } from '@/types/music.d'

const props = defineProps({
  hover: { type: Boolean, default: false },
  textAlign: { type: String, default: 'left' },
  unplayColor: { type: String, default: 'var(--color-wbw-text-unplay)' },
  containerWidth: { type: String, default: 'calc(min(50vh, 33.33vw))' },
  offsetPadding: { type: String, default: '3vw' }
})

const playerStore = usePlayerStore()
const { noLyric, currentTrack, lyrics, seek, playing, currentIndex } = storeToRefs(playerStore) // playbackRate, fadeDuration, lyricOffset

const stateStore = useNormalStateStore()
const { showToast } = stateStore

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nFontSize, useMask, nTranslationMode, isZoom, isNWordByWord } = toRefs(normalLyric.value)

const isWheeling = ref(false)
let scrollingTimer: any = null
const animations = new Map<number, { lyric: Animation; translation: Animation | null }>()
const lyricLines = useTemplateRef('lyric')
const measure = useTemplateRef('hidden-measure')

const offset = computed(() => {
  const lrcOffset = currentTrack.value!.offset || 0
  if (lrcOffset === 0) {
    return '未调整'
  } else if (lrcOffset > 0) {
    return `延后${lrcOffset}s`
  } else {
    return `提前${Math.abs(lrcOffset)}s`
  }
})

const isWordMode = computed(() => isNWordByWord.value && lyrics.value.some((l) => l.lyric.info))

const isTWordMode = computed(
  () =>
    isWordMode.value &&
    nTranslationMode.value !== 'none' &&
    lyrics.value.some((l) => l[nTranslationMode.value as 'tlyric' | 'rlyric'])
)

// const animations = computed(() => {
//   if (!isNWordByWord.value || !isWordMode.value) return null
//   return lyrics.value.map((line, index) => {
//     if (!line.lyric.info) return null
//     const result: Animation[] = []
//     const start = line.lyric.info[0].start
//     const end = line.lyric.info.at(-1)?.end || line.end
//     const duration = end - start

//     const keyframes = line.lyric.info.map((info) => {
//       const offset = (info.end - start) / duration
//       return { backgroundSize: `${offset * 100}% 100%`, offset }
//     })
//     keyframes.unshift({ backgroundSize: '0% 100%', offset: 0 })
//     const effect = new KeyframeEffect(font.value![index], keyframes, {
//       duration,
//       easing: 'linear',
//       fill: 'forwards'
//     })
//     const an = new Animation(effect, document.timeline)
//     result.push(an)

//     // if (isTWordMode.value) {
//     //   const mode = nTranslationMode.value as 'rlyric' | 'tlyric'
//     //   const info = line[mode]?.info
//     //   // 翻译/音译的info的列表都只有一个元素
//     //   if (info) {
//     //     const start = info[0].start
//     //     const end = info[0].end || line.end
//     //     const duration = end - start
//     //   }
//     // }
//     return an
//   })
// })

const map = {
  start: 'left',
  center: 'center',
  end: 'right'
}

const transformOrigin = computed(() => `center ${map[props.textAlign]}`)
const highlight = computed(() => {
  const idx = currentIndex.value
  if (idx >= lyrics.value.length) return lyrics.value.length - 1
  return idx
})

const setOffset = (offset: number) => {
  if (!currentTrack.value!.offset) {
    currentTrack.value!.offset = 0
  }
  if (currentTrack.value!.type === 'local') {
    window.mainApi
      ?.invoke('updateLocalTrackInfo', currentTrack.value!.id, {
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

const handleWheel = () => {
  clearTimeout(scrollingTimer)
  const line = document.getElementById(`line${currentIndex.value}`)
  if (!line || !playing.value) return
  if (!isWheeling.value) isWheeling.value = true
  scrollingTimer = setTimeout(() => {
    clearTimeout(scrollingTimer)
    isWheeling.value = false
  }, 1500)
}

const _createAnimation = async (
  type: 'lyric' | 'translation',
  dom: HTMLElement,
  line: lyricLine
) => {
  const map = {
    lyric: ['.lyric-line', 'lyric', '.lyric-line span'],
    translation: [
      '.translation',
      nTranslationMode.value as 'tlyric' | 'rlyric',
      '.translation span'
    ]
  }
  const lineContainer = measure.value!.querySelector(map[type][0]) as HTMLElement

  const a = map[type][1] as 'lyric' | 'tlyric' | 'rlyric'
  if (!line[a]?.info) return null
  for (const info of line[a].info) {
    const span = document.createElement('span')
    span.textContent = info.word
    lineContainer.appendChild(span)
  }
  await nextTick()
  const spans = lineContainer.querySelectorAll('span')
  const start = line[a]!.info![0].start
  const end = line[a]!.info!.at(-1)!.end

  const duration = end - start
  let width = 0
  let curWidth = 0
  spans.forEach((span) => (width += span.offsetWidth))

  const keyframes = line[a]!.info!.map((info, index) => {
    const span = spans[index]
    curWidth += span.offsetWidth
    const _end = info.end
    const offset = (_end - start) / duration
    return { backgroundSize: `${(100 * curWidth) / width}% 100%`, offset }
  })
  keyframes.unshift({ backgroundSize: '0% 100%', offset: 0 })
  lineContainer.innerHTML = ''

  const container = dom.querySelector(map[type][2]) as HTMLElement
  const effect = new KeyframeEffect(container, keyframes, {
    duration: end - start,
    easing: 'linear',
    fill: 'forwards'
  })
  const an = new Animation(effect, document.timeline)

  return an
}

const createLineAnimation = async (dom: HTMLElement, line: lyricLine) => {
  const hiddenEl = measure.value!
  hiddenEl.style.padding = '12px'

  const an = await _createAnimation('lyric', dom, line)
  let _an: Animation | null = null
  if (isTWordMode.value) {
    _an = await _createAnimation('translation', dom, line)
  }

  hiddenEl.style.padding = '0px'

  return { lyric: an!, translation: _an }
}

const createAllAnimation = async () => {
  for (let i = currentIndex.value + 1; i < lyrics.value.length; i++) {
    const dom = lyricLines.value![i]
    const line = lyrics.value[i]
    const result = await createLineAnimation(dom, line)
    animations.set(i, result)
  }

  for (let i = 0; i < currentIndex.value; i++) {
    const dom = lyricLines.value![i]
    const line = lyrics.value[i]
    const result = await createLineAnimation(dom, line)
    animations.set(i, result)
  }
}

watch(
  () => !isWheeling.value && currentIndex.value,
  (value) => {
    const line = document.getElementById(`line${value}`)
    line?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (playing.value) {
      const ans = animations.get(currentIndex.value)
      ans?.lyric.play()
      ans?.translation?.play()
    }
  }
)

watch(
  () => lyricLines.value && nTranslationMode.value,
  async (value) => {
    if (value && lyricLines.value) {
      const result = await createLineAnimation(
        lyricLines.value[currentIndex.value],
        lyrics.value[currentIndex.value]
      )
      animations.set(currentIndex.value, result)
      createAllAnimation()
    }
  }
)

onMounted(async () => {
  if (!currentTrack.value) return

  await nextTick()
  const line = document.getElementById(`line${highlight.value}`)
  line?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})
</script>

<style scoped lang="scss">
.lyric-wrapper {
  position: relative;
  height: 100vh;
  overflow: hidden;
  contain: strict;
}

.use-mask {
  mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
}

.offset {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 10px 6px;
  top: 50%;
  right: v-bind(offsetPadding);
  border-radius: 8px;
  transform: translate(0, -50%);
  z-index: 1;
  contain: content;

  .button-icon {
    margin: unset;
  }

  .recovery {
    margin: 10px 0;
  }
}

.main-lyric-container {
  height: 100vh;
  width: v-bind(containerWidth);
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  scrollbar-width: none;
  position: relative;
  margin: 0 auto;
  contain: content;

  &::-webkit-scrollbar {
    width: 0px;
  }

  .hidden-measure {
    // position: absolute;
  }

  .lyric {
    border-radius: 12px;
    margin: 2px 0;
    user-select: none;
    padding: 12px;
    font-weight: 600;

    &:hover {
      background: var(--color-secondary-bg-for-transparent);
    }

    &.active.isZoom {
      .lyric-line,
      :deep(.lyric-line) {
        transform: scale(1);
      }
    }

    &:not(.active) {
      .lyric-line span,
      .translation span {
        background-size: 0% 100% !important;
      }
    }

    .lyric-line {
      text-align: v-bind(textAlign);
      transform-origin: v-bind(transformOrigin);

      transform: scale(0.95);
      transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      span {
        font-size: v-bind('`${nFontSize}px`');
        background-repeat: no-repeat;
        background-color: v-bind('`${unplayColor}`');
        -webkit-text-fill-color: transparent;
        background-clip: text;
        background-image: -webkit-linear-gradient(
          top,
          var(--color-wbw-text-played),
          var(--color-wbw-text-played)
        );
        background-size: 0% 100%;
        overflow-wrap: break-word;
      }
    }

    .translation {
      text-align: v-bind(textAlign);
      transform-origin: v-bind(transformOrigin);

      transform: scale(0.95);
      span {
        font-size: v-bind('`${nFontSize - 2}px`');
        background-repeat: no-repeat;
        background-color: v-bind('`${unplayColor}`');
        -webkit-text-fill-color: transparent;
        background-clip: text;
        background-image: -webkit-linear-gradient(
          top,
          var(--color-wbw-text),
          var(--color-wbw-text)
        );
        background-size: 0% 100%;
        overflow-wrap: break-word;
      }
    }
  }

  .lyric:first-child {
    margin-top: 40vh;
    padding: 0;
  }

  .lyric:last-child {
    margin-bottom: 40vh;
  }
}

@media (max-aspect-ratio: 10/9) {
  .main-lyric-container {
    width: 100%;
    .lyric {
      :deep(.lyric-line),
      :deep(.translation) {
        text-align: center;
        transform-origin: center center;
      }
    }
  }
}

.slide-fade-enter-active {
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.slide-fade-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
}
</style>
