<template>
  <div class="lottie-page">
    <Vue3Lottie
      v-if="currentTheme.name === '歌词环游'"
      ref="lottieContainer"
      class="lottie-container"
      :animation-data="lottieList[currentTheme.senseIndex]"
      :auto-play="false"
      height="100%"
      width="100%"
      renderer="canvas"
      @on-animation-loaded="playLottie"
    />
    <div class="lt-background" data-theme="auto"></div>
    <div class="context-container" data-theme="dark">
      <div class="buttons-icons">
        <button-icon class="player-button theme-button" @click="setThemeModal = !setThemeModal">
          <SvgIcon icon-class="theme" />
        </button-icon>
        <button-icon class="player-button close-button" @click="showLyrics = !showLyrics">
          <SvgIcon icon-class="arrow-down" />
        </button-icon>
        <button-icon
          title="换场景"
          class="player-button sense-button"
          @click="showSenseSelector = true"
        >
          <SvgIcon icon-class="sense" />
        </button-icon>
        <button-icon
          class="player-button lyric-button-1"
          :title="$t('contextMenu.showLyric')"
          @click="switchCurrentTab"
        >
          <SvgIcon :icon-class="getIcon()" />
        </button-icon>
      </div>
      <div class="title-name" :class="{ right: currentTheme.senseIndex % 2 === 1 }">
        <span class="title">{{ currentTrack?.name }}</span>
        <span>&nbsp;-&nbsp;{{ artist.name }}</span>
      </div>
      <div class="play-bar">
        <div class="player-progress-bar">
          <div class="time">{{ formatTime(position) || '0:00' }}</div>
          <div class="slider">
            <vue-slider
              v-model="position"
              :min="0"
              :max="currentTrackDuration"
              :interval="1"
              :duration="0.5"
              :dot-size="12"
              :height="4"
              :use-keyboard="false"
              :drag-on-click="false"
              :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
              :process-style="{ backgroundColor: 'var(--color-text)', opacity: 0.8 }"
              :dot-style="{
                display: 'none',
                backgroundColor: 'var(--color-text)',
                boxshadow: '0.5px 0.5px 2px 1px rgba(0, 0, 0, 0.18)'
              }"
              tooltip="none"
              :lazy="false"
              :silent="true"
            ></vue-slider>
          </div>
          <div class="time">{{ formatTime(currentTrackDuration) }}</div>
        </div>
        <div class="player-media-control">
          <button-icon
            :class="{ active: repeatMode !== 'off' }"
            :title="repeatMode === 'one' ? $t('player.repeatTrack') : $t('player.repeat')"
            @click="switchRepeatMode"
          >
            <svg-icon v-show="repeatMode !== 'one'" icon-class="repeat" />
            <svg-icon v-show="repeatMode === 'one'" icon-class="repeat-1" />
          </button-icon>
          <button-icon :class="{ active: shuffle }" @click="shuffle = !shuffle"
            ><svg-icon icon-class="shuffle"
          /></button-icon>
          <div class="middle">
            <button-icon v-show="!isPersonalFM" :title="$t('player.previous')" @click="playPrev"
              ><svg-icon icon-class="previous"
            /></button-icon>
            <button-icon
              v-show="isPersonalFM"
              :title="$t('player.moveToFMTrash')"
              @click="moveToFMTrash"
              ><svg-icon icon-class="thumbs-down"
            /></button-icon>
            <button-icon
              id="play"
              :title="$t(playing ? 'player.play' : 'player.pause')"
              @click="playOrPause"
              ><svg-icon :icon-class="playing ? 'pause' : 'play'"
            /></button-icon>
            <button-icon :title="$t('player.next')" @click="_playNextTrack(isPersonalFM)"
              ><svg-icon icon-class="next"
            /></button-icon>
          </div>
          <button-icon
            :class="{ active: isLiked, disabled: heartDisabled }"
            :title="heartDisabled ? $t('player.noAllowCauseLocal') : $t('player.like')"
            @click.stop="likeTrack"
          >
            <svg-icon :icon-class="isLiked ? 'heart-solid' : 'heart'"></svg-icon>
          </button-icon>
          <button-icon class="button" :prevent-blur="true" @click="showContextMenu">
            <SvgIcon icon-class="options" />
          </button-icon>
        </div>
        <div class="player-progress-bar">
          <div class="time"
            ><button-icon> <svg-icon icon-class="volume-half" /></button-icon
          ></div>
          <div class="slider">
            <VueSlider
              v-model="volume"
              :min="0"
              :max="1"
              :interval="0.01"
              :duration="0.5"
              :dot-size="12"
              :height="4"
              :use-keyboard="false"
              :drag-on-click="false"
              :tooltip-formatter="Math.round(volume * 100).toString()"
              :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
              :process-style="{ backgroundColor: 'var(--color-text)', opacity: 0.8 }"
              :dot-style="{
                display: 'none',
                backgroundColor: 'var(--color-text)',
                boxshadow: '0.5px 0.5px 2px 1px rgba(0, 0, 0, 0.18)'
              }"
              tooltip="none"
              :silent="true"
            />
          </div>
          <div class="time"
            ><button-icon> <svg-icon icon-class="volume" /></button-icon
          ></div>
        </div>
      </div>
      <div
        v-if="tabs[index] === 'pickLyric'"
        ref="pickLyricRef"
        class="pick-lyric"
        :class="{ right: currentTheme.senseIndex % 2 === 1 }"
        :style="{ fontFamily: currentTheme.font }"
      />
      <div v-else class="full-lyric-container">
        <div class="lyric-container-1" @mouseenter="hover = true" @mouseleave="hover = false">
          <LyricPage
            v-if="tabs[index] === 'fullLyric'"
            text-align="center"
            unplay-color="var(--color-full-text-unplay)"
            :container-width="'100%'"
            :offset-padding="'0'"
            :hover="hover"
          />
          <Comment
            v-else-if="tabs[index] === 'comment'"
            :id="currentTrack!.id"
            type="music"
            padding-right="8vh"
          />
        </div>
      </div>
    </div>
    <Transition name="slide-up">
      <div v-if="showSenseSelector" class="sense-modal" @click="showSenseSelector = false">
        <div class="sense-content" @click.stop>
          <div class="sense-title">切换场景</div>
          <div class="sense-list">
            <div
              v-for="(sense, idx) in senses"
              :key="idx"
              :index="idx"
              class="sense-item"
              :class="{ active: idx === currentTheme.senseIndex }"
              @click="updateSense(idx)"
            >
              <div class="sense-active">使用中</div>
              <img :src="senseImg(idx)" loading="lazy" />
              <div>{{ sense.name }}</div></div
            ></div
          >
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed, onMounted, nextTick, inject } from 'vue'
import { Vue3Lottie } from 'vue3-lottie'
import { useDataStore } from '../store/data'
import { usePlayerStore } from '../store/player'
import { useSettingsStore } from '../store/settings'
import { useStreamMusicStore } from '../store/streamingMusic'
import { useNormalStateStore } from '../store/state'
import { storeToRefs } from 'pinia'
import { gsap } from 'gsap'
import VueSlider from 'vue-3-slider-component'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import LyricPage from './LyricPage.vue'
import Comment from './CommentPage.vue'
import ContextMenu from './ContextMenu.vue'
import snow from '../assets/lottie/snow.json'
import sunshine from '../assets/lottie/sunshine.json'

const playerStore = usePlayerStore()
const {
  playing,
  currentLyric,
  playbackRate,
  seek,
  currentTrack,
  currentTrackDuration,
  lyrics,
  repeatMode,
  isPersonalFM,
  isLiked,
  shuffle,
  volume
} = storeToRefs(playerStore)

const { playPrev, playOrPause, _playNextTrack, switchRepeatMode, moveToFMTrash } = playerStore

const settingsStore = useSettingsStore()
const { playerTheme, general } = storeToRefs(settingsStore)

const { likeATrack } = useDataStore()
const { likeAStreamTrack } = useStreamMusicStore()

const stateStore = useNormalStateStore()
const { showLyrics, setThemeModal } = storeToRefs(stateStore)

const lottieContainer = ref()
const index = ref(0)
const hover = ref(false)
const showSenseSelector = ref(false)
const pickLyricRef = ref<HTMLElement>()
const playPageContextMenu = inject('playPageContextMenu', ref<InstanceType<typeof ContextMenu>>())
const senses = [
  { name: '纯净雪域', img: 'creative_snow' },
  { name: '落日余晖', img: 'sunshine' }
]

let tl: gsap.core.Timeline | null = null

const tabs = computed(() => {
  const result = ['pickLyric', 'fullLyric']
  if (currentTrack.value?.matched) {
    result.push('comment')
  }
  return result
})

const switchCurrentTab = () => {
  index.value = (index.value + 1) % tabs.value.length
}

const senseImg = (index: number) => {
  return new URL(`../assets/images/${senses[index].img}.png`, import.meta.url).href
}

const getIcon = () => {
  if (tabs.value[index.value] === 'pickLyric') {
    return 'lyric-half'
  } else if (tabs.value[index.value] === 'fullLyric') {
    return 'lyric'
  } else {
    return 'comment'
  }
}

const pickedLyric = computed(() => {
  const result = [] as string[][]

  const lyric = splitWithSpaces(currentLyric.value.content)
  if (!lyric) return result
  const splitList = splitLine(lyric.length)
  lyric.forEach((char, index) => {
    for (let i = 0; i < splitList.length; i++) {
      if (index < splitList[i]) {
        result[i] = result[i] || []
        result[i].push(char)
        break
      }
    }
  })
  return result
})

const splitWithSpaces = (str: string) => {
  const tokens = str.match(/(\s+)|([a-zA-Z0-9_]+(?:'[a-zA-Z0-9_]+)*)|([^\s])/g) || []

  const result = [] as string[]
  let pendingSpaces = ''

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      pendingSpaces += token
    } else {
      if (pendingSpaces) {
        if (result.length > 0) {
          result[result.length - 1] += pendingSpaces
        } else {
          result.push(pendingSpaces)
        }
        pendingSpaces = ''
      }
      result.push(token)
    }
  }

  if (pendingSpaces) {
    if (result.length > 0) {
      result[result.length - 1] += pendingSpaces
    } else {
      result.push(pendingSpaces)
    }
  }

  return result
}

const currentTheme = computed(() => playerTheme.value.creative.find((theme) => theme.selected)!)
const lottieList = [snow, sunshine]

const updateSense = async (idx: number) => {
  currentTheme.value.senseIndex = idx
  tl?.kill()
  await nextTick()
  if (tabs.value[index.value] === 'pickLyric' && playing.value) {
    lottieContainer.value?.play()
    clearLyricElements()
    buildLyricElements()
    enterAnimation()
    if (playing.value) {
      const currentTime = (seek.value + 1 - currentLyric.value.start) / playbackRate.value
      tl?.play(currentTime)
    }
  } else {
    clearLyricElements()
  }
}

const artist = computed(() => {
  return currentTrack.value?.artists ? currentTrack.value.artists[0] : currentTrack.value?.ar[0]
})

const position = computed({
  get() {
    return seek.value
  },
  set(value) {
    if (!general.value.jumpToLyricBegin) {
      seek.value = value
      return
    }
    const line = lyrics.value.lyric.find((l, index) => {
      const nextLine = lyrics.value.lyric[index + 1]
      if (nextLine) {
        return nextLine.start > value && l.start <= value
      } else {
        return value >= l.start && value < l.start + 10
      }
    })
    seek.value = line?.start ?? value
  }
})

const heartDisabled = computed(() => {
  return currentTrack.value?.type === 'local' && !currentTrack.value?.matched
})

const likeTrack = () => {
  if (currentTrack.value?.type === 'stream') {
    const op = currentTrack.value.starred ? 'unstar' : 'star'
    likeAStreamTrack(op, currentTrack.value)
  } else if (currentTrack.value?.matched) {
    likeATrack(currentTrack.value.id)
  }
}

const showContextMenu = (e: MouseEvent): void => {
  playPageContextMenu.value?.openMenu(e)
}

const splitLine = (length: number) => {
  if (length <= 5) {
    return [length]
  } else if (length < 10) {
    const rate = (-2 / 15) * length + 1.5
    const secondLength = Math.random() < rate ? 2 : 3
    return [length - secondLength, length]
  } else if (length < 38) {
    const firstRatio = Math.random() < 0.6 ? 0.5 : 0.4
    const firstLength = Math.floor(length * firstRatio)
    const rate = (-4 / 300) * length + 254 / 300
    const secondRatio = Math.random() < rate ? 0.2 : 0.3
    const secondLength = Math.max(2, Math.floor(length * secondRatio))
    return [firstLength, firstLength + secondLength, length]
  } else {
    const n = Math.ceil(length / 19) + 1
    const minVal = 1 / (n + 1)

    const midCount = n - 2

    const maxMid = (1 - 2 * minVal) / midCount
    const midVal = minVal + Math.random() * (maxMid - minVal) * 0.8

    const endVal = (1 - midCount * midVal) / 2

    const original = new Array(n)
    original[0] = endVal
    original[n - 1] = endVal
    for (let i = 1; i < n - 1; i++) {
      original[i] = midVal
    }

    const cumulative = [] as number[]
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += original[i]
      cumulative.push((i === n - 1 ? 1.0 : sum) * length)
    }

    return cumulative
  }
}

const clearLyricElements = () => {
  if (pickLyricRef.value) {
    while (pickLyricRef.value.firstChild) {
      pickLyricRef.value.removeChild(pickLyricRef.value.firstChild)
    }
  }
}

const buildLyricElements = () => {
  const fragment = document.createDocumentFragment()
  pickedLyric.value.forEach((line) => {
    const item = document.createElement('div')
    item.className = 'lyric-item'
    line.forEach((word) => {
      const span = document.createElement('div')
      span.textContent = word
      span.className = 'ani-char'
      item.appendChild(span)
    })
    fragment.appendChild(item)
  })
  pickLyricRef.value?.appendChild(fragment)
}

const enterAnimation = () => {
  if (tl) {
    tl.kill()
    tl = null
  }
  const spanLength = pickLyricRef.value?.querySelectorAll('.ani-char').length || 0

  const duration0 = currentLyric.value.time / playbackRate.value - 0.5 - spanLength * 0.15
  if (duration0 < 0.45 || tabs.value[index.value] !== 'pickLyric') {
    pickLyricRef.value?.querySelectorAll('.ani-char').forEach((el) => {
      // @ts-ignore
      el.style.opacity = '1'
    })
    return
  }

  const duration =
    currentTheme.value.senseIndex % 2 === 0
      ? Math.min(currentLyric.value.time / playbackRate.value - 0.7 - spanLength * 0.15, 0.7)
      : 0.35
  tl = gsap.timeline({ paused: true })

  const enterAns = {
    snow: [
      {
        opacity: 0,
        x: 250,
        y: 10,
        rotateX: 90,
        rotateY: 45,
        filter: 'blur(0px)',
        transformPerspective: 400
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        rotateX: 0,
        rotateY: 0,
        filter: 'blur(0px)',
        duration,
        ease: 'power2.out',
        stagger: 0.1
      },
      {
        opacity: 0,
        filter: `blur(15px)`,
        y: -20,
        scale: 0.8,
        ease: 'power2.out',
        duration: 0.5,
        stagger: { amount: 0.25, from: 'random' }
      }
    ],
    sunshine: [
      {
        opacity: 0,
        x: -250,
        y: 10,
        filter: 'blur(15px)',
        transformPerspective: 400
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.5,
        stagger: { amount: 0.35, from: 'random' }
      },
      {
        opacity: 0,
        filter: `blur(0px)`,
        x: 300,
        y: -80,
        rotateX: -30,
        rotateY: 30,
        ease: 'power2.in',
        transformPerspective: 200,
        duration: 0.5,
        stagger: 0.5 / spanLength
      }
    ]
  }

  const aniType = currentTheme.value.senseIndex % 2 === 0 ? 'snow' : 'sunshine'
  // @ts-ignore
  tl.set('.ani-char', enterAns[aniType][0])
  const delay =
    currentTheme.value.senseIndex % 2 === 0
      ? currentLyric.value.time / playbackRate.value - 0.75
      : currentLyric.value.time / playbackRate.value - 1

  // @ts-ignore
  tl.to('.ani-char', enterAns[aniType][1]).to('.ani-char', enterAns[aniType][2], delay)
}

const formatTime = (time: number) => {
  time = Math.round(time)
  const minutes = Math.floor(time / 60)
  const remainingSeconds = Math.ceil(time % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

watch(
  () => tabs.value[index.value],
  async (value) => {
    lottieContainer.value?.pause()
    tl?.kill()
    await nextTick()
    if (value === 'pickLyric' && playing.value) {
      lottieContainer.value?.play()
      clearLyricElements()
      buildLyricElements()
      enterAnimation()
      if (playing.value) {
        const currentTime = (seek.value + 1 - currentLyric.value.start) / playbackRate.value
        tl?.play(currentTime)
      }
    } else {
      clearLyricElements()
    }
  }
)

watch(playing, (value) => {
  if (tabs.value[index.value] !== 'pickLyric') {
    if (tl) {
      tl.kill()
      tl = null
    }
    return
  }
  if (value) {
    lottieContainer.value?.play()
    tl?.play()
  } else {
    lottieContainer.value?.pause()
    tl?.pause()
  }
})

watch(pickedLyric, async (value) => {
  clearLyricElements()
  if (tabs.value[index.value] !== 'pickLyric') {
    tl?.kill()
    tl = null
    return
  }
  if (value.length > 0 && playing.value) {
    await nextTick()
    buildLyricElements()
    enterAnimation()
    if (playing.value) {
      tl?.play()
    }
  }
})

const playLottie = () => {
  if (playing.value && tabs.value[index.value] === 'pickLyric') lottieContainer.value?.play()
  enterAnimation()
  if (playing.value) {
    const currentTime = (seek.value + 1 - currentLyric.value.start) / playbackRate.value
    tl?.play(currentTime)
  }
}

onMounted(() => {
  buildLyricElements()
})

onBeforeUnmount(() => {
  if (tl) {
    tl.kill()
    tl = null
  }
  lottieContainer.value?.stop()
  setTimeout(() => {
    lottieContainer.value?.destroy()
  }, 390)
})
</script>

<style scoped lang="scss">
.lottie-page {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: 100;
  color: #fff;
  overflow: hidden;
  display: flex;
  background: var(--color-body-bg);
}

:deep(.lottie-container) {
  will-change: transform;
  z-index: -1;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;

  * {
    will-change: transform;
  }
}

.context-container {
  height: 100%;
  width: 100%;
  position: relative;
  z-index: 11;
}

.lt-background {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background-color: transparent;
  z-index: -1;
  transition: background-color 0.3s;
}

[data-theme='dark'] .lt-background {
  background-color: rgba(20, 20, 20, 0.25);
}

.full-lyric-container {
  backdrop-filter: blur(30px); // saturate(130%)
  height: 100%;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.2);
  position: absolute;
  z-index: 10;
}

.lyric-container-1 {
  width: 60vw;
  margin: 0 auto;
}

.title-name {
  position: fixed;
  top: 28px;
  left: 15vw;
  right: 15vw;
  font-weight: bold;
  line-height: 50px;

  span {
    font-size: 26px;
  }
  .title {
    font-size: 30px;
  }
}

.title-name.right {
  text-align: right;
}

.pick-lyric {
  position: absolute;
  top: 15vh;
  left: 15vw;
  right: 15vw;
  letter-spacing: 1px;
}

.pick-lyric.right {
  text-align: right;
}

:deep(.lyric-item) {
  container-type: inline-size;
  height: 10%;
  max-width: 70vw;
  font-size: 3.5cqw;
  will-change: transform;
}

:deep(.ani-char) {
  opacity: 0;
  display: inline-block;
  white-space: pre;
  will-change: transform;
}

:deep(.lyric-item *) {
  will-change: transform;
}

.theme-button {
  position: fixed;
  top: 24px;
  right: 74px;
}

.close-button {
  position: fixed;
  top: 24px;
  right: 24px;
}

.sense-button {
  position: fixed;
  bottom: 124px;
  right: 24px;
}

.lyric-button-1 {
  position: fixed;
  bottom: 60px;
  right: 24px;
}

.player-button {
  z-index: 300;
  border-radius: 0.75rem;
  height: 44px;
  width: 44px;
  display: flex;
  justify-content: center;
  align-items: center;
  // opacity: 0.88;
  transition: 0.2s;
  -webkit-app-region: no-drag;

  .svg-icon {
    color: var(--color-text);
    height: 22px;
    width: 22px;
  }

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
    opacity: 0.88;
  }
}

.play-bar {
  display: flex;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  height: 50px;
  position: absolute;
  bottom: 10px;
  padding: 0 24px;
}

.button-icon.disabled {
  cursor: default;
  opacity: 0.48;
  &:hover {
    background: none;
  }
  &:active {
    transform: unset;
  }
}
:deep(.player-progress-bar) {
  width: 22vw;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .slider {
    flex: 1;
    padding: 0 10px;
  }

  .time {
    font-size: 15px;
    font-weight: 600;
    width: 34px;
  }
}

.player-media-control {
  display: flex;
  justify-content: center;
  align-items: center;

  .svg-icon {
    height: 20px;
    width: 20px;
    opacity: 0.88;
  }

  .middle {
    display: flex;
    align-items: center;

    button {
      margin: 0 0.6vw;

      &:hover {
        background: var(--color-secondary-bg-for-transparent);
        opacity: 0.88;
      }
    }

    button#play .svg-icon {
      height: 30px;
      width: 30px;
      padding: 2px;
    }

    .svg-icon {
      height: 22px;
      width: 22px;
    }
  }
}

.sense-modal {
  position: fixed;
  transition: opacity 0.3s ease-in-out;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
}

.sense-content {
  position: fixed;
  bottom: 0;
  left: 0;
  padding-bottom: 10px;
  width: 100%;
  border-radius: 12px 12px 0 0;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(12px) opacity(1);
  color: var(--color-text);
}

[data-theme='dark'] .sense-content {
  background: rgba(36, 36, 36, 0.88);
}

.sense-title {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  padding: 20px 0;
}

.sense-list {
  display: flex;
  height: 200px;
  padding: 0 10px;
  overflow: auto hidden;
  scrollbar-width: none;
}

.sense-item {
  height: 100%;
  margin: 0 10px;
  border-radius: 8px;
  text-align: center;
  position: relative;

  img {
    height: 80%;
    border-radius: 8px;
    padding: 4px;
  }

  .sense-active {
    display: none;
    position: absolute;
    top: 0;
    left: 0;
    font-size: 16px;
    border-radius: 8px 0;
    padding: 4px 10px;
  }
}

.sense-item.active {
  .sense-active {
    display: block;
    background-color: var(--color-primary);
    color: white;
  }
  img {
    background-color: var(--color-primary);
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
