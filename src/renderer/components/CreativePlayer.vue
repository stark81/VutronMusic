<template>
  <div
    class="creative-page"
    :class="{ letter: activeTheme.theme.activeLayout === 'Letter' }"
    :data-theme="activeBG.color"
  >
    <div class="context-container" :class="{ 'is-full': show !== 'pickLyric' }">
      <img class="post-mark" src="../assets/images/postmark.png" loading="lazy" />
      <div class="title-name" :style="titleStyle">
        <div v-if="activeTheme.theme.activeLayout === 'Letter'" class="fan-container">
          <img
            v-for="track in selectedTracks"
            :key="track.name"
            :src="getImg(track)"
            :alt="track.name"
            loading="lazy"
          />
        </div>
        <span class="title">{{ currentTrack?.name }}&nbsp;-&nbsp;{{ artist.name }}</span>
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
      <div v-if="show === 'pickLyric'" ref="pickLyricRef" class="pick-lyric" :style="style" />
      <div v-else class="full-lyric-container">
        <div class="lyric-container-1" @mouseenter="hover = true" @mouseleave="hover = false">
          <LyricPage
            v-if="show === 'fullLyric'"
            text-align="center"
            unplay-color="var(--color-full-text-unplay)"
            :container-width="'90%'"
            :offset-padding="'0'"
            :hover="hover"
          />
          <Comment
            v-else-if="show === 'comment'"
            :id="currentTrack!.id"
            type="music"
            padding-right="0vh"
            :style="{ width: '90%', paddingTop: '4vw' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed, onMounted, nextTick, inject } from 'vue'
import { useDataStore } from '../store/data'
import { usePlayerStore } from '../store/player'
import { useSettingsStore } from '../store/settings'
import { useStreamMusicStore } from '../store/streamingMusic'
import { useLocalMusicStore } from '../store/localMusic'
import { usePlayerThemeStore } from '../store/playerTheme'
import { storeToRefs } from 'pinia'
import { gsap } from 'gsap'
import VueSlider from './VueSlider.vue'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import LyricPage from './LyricPage.vue'
import Comment from './CommentPage.vue'
import ContextMenu from './ContextMenu.vue'
import { Track } from '@/types/music'
import { getTrackDetail } from '../api/track'
import { AniName } from '@/types/theme'

const props = withDefaults(defineProps<{ show: 'fullLyric' | 'pickLyric' | 'comment' }>(), {
  show: 'fullLyric'
})

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
  list,
  _playNextList,
  currentTrackIndex,
  volume
} = storeToRefs(playerStore)

const { playPrev, playOrPause, _playNextTrack, switchRepeatMode, moveToFMTrash } = playerStore

const settingsStore = useSettingsStore()
const { general } = storeToRefs(settingsStore)

const localMusicStore = useLocalMusicStore()
const { getALocalTrack } = localMusicStore

const streamMusicStore = useStreamMusicStore()
const { likeAStreamTrack, getAStreamTrack } = streamMusicStore

const playerTheme = usePlayerThemeStore()
const { activeTheme, senses, activeBG } = storeToRefs(playerTheme)

const { likeATrack } = useDataStore()

const hover = ref(false)
const pickLyricRef = ref<HTMLElement>()
const playPageContextMenu = inject('playPageContextMenu', ref<InstanceType<typeof ContextMenu>>())
const selectedTracks = ref<Track[]>([])
const loading = ref(false)

let tl: gsap.core.Timeline | null = null

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

const senseMap = {
  0: 'left',
  1: 'center',
  2: 'right'
}

const titleStyle = computed(() => {
  if (activeTheme.value.theme.activeLayout === 'Creative') {
    const sense = senses.value[activeTheme.value.theme.activeLayout]
    const pos = sense.region
    const result: Record<string, any> = { left: pos.left, right: pos.right }
    result.textAlign = senseMap[sense.active]
    return result
  }
  return { left: '15vw', right: '15vw', top: '10vh', bottom: '55vh', textAlign: 'center' }
})

const style = computed(() => {
  if (activeTheme.value.theme.activeLayout === 'Creative') {
    const sense = senses.value[activeTheme.value.theme.activeLayout]
    const pos = sense.region
    const result: Record<string, any> = { ...pos }
    result.textAlign = senseMap[sense.active]
    result.fontFamily = sense.font
    return result
  }
  const sense = senses.value[activeTheme.value.theme.activeLayout]
  return {
    fontFamily: sense.font,
    textAlign: 'center',
    left: '15vw',
    right: '15vw',
    top: '55vh',
    bottom: '20vh'
  }
})

const selectedIdx = computed(() => {
  const pre = list.value.slice(-2)
  const next = list.value.slice(0, 2)

  const index = currentTrackIndex.value
  const list1 = list.value.slice(0, index + 1)
  const list2 = list.value.slice(index + 1)

  const result = pre.concat(list1).concat(_playNextList.value).concat(list2).concat(next)
  const idx = currentTrackIndex.value + 2
  return result.slice(idx - 2, idx + 3)
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
    const line = lyrics.value.find((l, index) => {
      const nextLine = lyrics.value[index + 1]
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

/**
 * 判断当句歌词是否存在文字进入/退出动画
 */
const shouldAni = computed(() => {
  const position = 'left' as 'left' | 'center' | 'right'
  const length = pickedLyric.value.flat().length
  if (position === 'left') {
    // 0.7s动画进入时间，0.1 * (length - 1)是这些字依次间隔0.1s
    // 0.5s是动画退场时间，0.25s是这些字在着个时间段内随机退场完成
    const duration = 0.7 + 0.1 * (length - 1) + 0.5 + 0.25 // + 0.35
    return currentLyric.value.time > duration
  } else if (position === 'center') {
    //
    return true
  } else {
    // 0.5s动画进入时间，0.35s是这些字在这个时间段内随机进入完成
    // 0.5s是动画退场时间，0.5 / (length - 1)是这些字依次间隔退场
    const duration = 0.5 + 0.35 + 0.5 + 0.5 / (length - 1) // + 0.35
    return currentLyric.value.time > duration
  }
})

const animations = computed(() => ({
  // 0.75s
  splitAndMerge: [
    {
      opacity: 0,
      x: (i: number) => {
        const totalChars = pickedLyric.value.flat().length
        const midIndex = Math.floor(totalChars / 2)
        return i < midIndex ? -150 : 150
      },
      y: 0,
      scale: 0.8,
      filter: 'blur(10px)',
      transformPerspective: 600
    },
    {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: 0.8,
      ease: 'power3.out',
      stagger: {
        each: 0.07,
        from: 'edges'
      }
    },
    {
      opacity: 0,
      z: -200,
      scale: 0.5,
      rotateX: 30,
      rotateY: 60,
      filter: 'blur(10px)',
      duration: 0.5,
      ease: 'power2.in',
      stagger: { amount: 0.25, from: 'random' }
    }
  ],
  // 0.75s
  hingeFlyIn: [
    {
      opacity: 0,
      x: 250,
      y: 20,
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
      duration: 0.7,
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
  // 0.75
  focusRise: [
    {
      opacity: 0,
      y: 100,
      scale: 0.9,
      filter: 'blur(10px)',
      transformPerspective: 500
    },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: 0.7,
      ease: 'back.out(1.7)',
      stagger: 0.05
    },
    {
      opacity: 0,
      y: -80,
      scaleY: 1.2,
      filter: 'blur(20px)',
      duration: 0.5,
      ease: 'power3.in',
      stagger: { amount: 0.25, from: 'center' }
    }
  ],
  // 1s
  scatterThrow: [
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
      y: -150,
      rotateX: -45,
      rotateY: 30,
      ease: 'power2.in',
      transformPerspective: 200,
      duration: 0.5,
      stagger: 0.5 / (pickedLyric.value.flat().length - 1)
    }
  ],
  // 0.75s
  flipReveal: [
    {
      opacity: 0,
      rotateY: -90,
      x: -50,
      transformPerspective: 800,
      transformOrigin: '50% 50% -100px'
    },
    {
      opacity: 1,
      rotateY: 0,
      x: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.1
    },
    {
      opacity: 0,
      rotateX: 45,
      y: 50,
      filter: 'blur(10px)',
      duration: 0.5,
      ease: 'power2.in',
      stagger: { amount: 0.25, from: 'random' }
    }
  ],
  // 0.75
  waveDrift: [
    {
      opacity: 0,
      y: 30,
      filter: 'blur(8px)'
    },
    {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 0.9,
      ease: 'sine.out',
      stagger: {
        each: 0.06,
        from: 'start'
      }
    },
    {
      opacity: 0,
      y: -20,
      filter: 'blur(12px)',
      duration: 0.75,
      ease: 'sine.in'
    }
  ]
}))

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
  switch (activeTheme.value.theme.activeLayout) {
    case 'Creative': {
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
    case 'Letter': {
      if (length <= 6) {
        return [length]
      } else {
        const numb = Math.ceil(length / 2)
        return [numb, length]
      }
    }
    default:
      return []
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

/**
 * 创建动画。需要定义三种动画：
 * 1. 依次进入、随机同时退出：每个字的动画时长为0.7s，依次间隔0.1s开始，所需时间为0.7 + 0.1 * (wordLength - 1)，退出的动画时长为0.5s，随机间隔时间为0.25s；
 * 2. 随机同时进入，依次退出：每个字的动画时长为0.5s，随机间隔时间为0.35s，所需的总时间为0.5 + 0.35 = 0.85s，退出动画时长为0.5s，依次间隔0.5 / wordLength开始退出；
 * 3. 从上到下再回到中间，然后透明度降到0
 *
 * 所以，在创建动画的时候需要：
 * 1. 在不同场景的动画下，本句歌词持续时间是否大于动画进入+退出的时长，如果不大于的话则直接不创建，大于才创建；
 * 2. 播放时直接把(当前播放进度 - 本句歌词开始时间)传入
 */
const enterAnimation = () => {
  if (tl) {
    tl.kill()
    tl = null
  }

  if (!shouldAni.value || props.show !== 'pickLyric') {
    pickLyricRef.value?.querySelectorAll('.ani-char').forEach((el) => {
      // @ts-ignore
      el.style.opacity = '1'
    })
    return
  }

  if (activeTheme.value.theme.activeLayout === 'Classic') return

  tl = gsap.timeline({ paused: true })

  const sense = senses.value[activeTheme.value.theme.activeLayout]

  const enterAns = animations.value
  const aniType = sense.animation[sense.active] as AniName
  // @ts-ignore
  tl.set('.ani-char', enterAns[aniType][0])
  const delay =
    aniType === 'scatterThrow'
      ? currentLyric.value.time / playbackRate.value - 1.05
      : currentLyric.value.time / playbackRate.value - 0.8

  // @ts-ignore
  tl.to('.ani-char', enterAns[aniType][1]).to('.ani-char', enterAns[aniType][2], delay)

  const currentTime = Math.max((seek.value - currentLyric.value.start) / playbackRate.value, 0)
  tl.time(currentTime)
}

const formatTime = (time: number) => {
  time = Math.round(time)
  const minutes = Math.floor(time / 60)
  const remainingSeconds = Math.ceil(time % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const loadTracks = async () => {
  const tracks: Track[] = []
  const onlineIDs: number[] = []

  for (const id of selectedIdx.value) {
    let track = getALocalTrack({ id })
    if (track) {
      tracks.push(track)
      continue
    }
    track = getAStreamTrack(id)
    if (track) {
      tracks.push(track)
      continue
    }
    onlineIDs.push(id)
  }

  if (onlineIDs.length) {
    const data = await getTrackDetail(onlineIDs.join(','))
    tracks.push(...data.songs)
  }

  selectedTracks.value = selectedIdx.value.map((id) => tracks.find((track) => track.id === id)!)
}

const getImg = (track: Track) => {
  let url: string
  if (track.type === 'online') {
    url = track.al?.picUrl || track.album?.picUrl || track.picUrl
    if (url && url.startsWith('http')) url = url.replace('http:', 'https:')
    url += '?param=256y256'
    return url
  } else if (track.type === 'stream') {
    url = track.al?.picUrl || track.album?.picUrl || track.picUrl
    return url
  } else {
    url = `atom://local-asset?type=pic&id=${track.id}&size=256`
    return url
  }
}

watch(
  () => props.show,
  async (value) => {
    if (loading.value) return
    loading.value = true
    tl?.kill()
    await nextTick()
    if (value === 'pickLyric') {
      buildLyricElements()
      enterAnimation()
      if (playing.value) {
        tl?.play()
      }
    } else {
      clearLyricElements()
    }
    loading.value = false
  }
)

watch(playing, (value) => {
  if (props.show !== 'pickLyric') {
    if (tl) {
      tl.kill()
      tl = null
    }
    return
  }
  if (value) {
    tl?.play()
  } else {
    tl?.pause()
  }
})

watch(
  () => [
    activeTheme.value.theme.activeLayout,
    senses.value[activeTheme.value.theme.activeLayout].active
  ],
  async (value, oldValue) => {
    if (value[0] !== oldValue[0]) return
    if (props.show !== 'pickLyric') {
      tl?.kill()
      tl = null
      return
    }
    if (loading.value) return
    loading.value = true
    clearLyricElements()
    if (pickedLyric.value.length > 0) {
      await nextTick()
      buildLyricElements()
      enterAnimation()
      if (playing.value) {
        tl?.play()
      }
    }
    loading.value = false
  }
)

watch(pickedLyric, async (value) => {
  if (loading.value) return
  clearLyricElements()
  if (props.show !== 'pickLyric') {
    tl?.kill()
    tl = null
    return
  }
  loading.value = true
  if (value.length > 0) {
    await nextTick()
    buildLyricElements()
    enterAnimation()
    if (playing.value) {
      tl?.play()
    }
  }
  loading.value = false
})

watch(
  () => [currentTrack.value, activeTheme.value.theme.activeLayout],
  async (value) => {
    if (value[1] === 'Letter') {
      loadTracks()
    }
  }
)

onMounted(async () => {
  loadTracks()
  if (!loading.value) {
    loading.value = true
    buildLyricElements()
    enterAnimation()
    loading.value = false
  }
  if (playing.value) {
    tl?.play()
  }
})

onBeforeUnmount(() => {
  if (tl) {
    tl.kill()
    tl = null
  }
})
</script>

<style scoped lang="scss">
@use 'sass:math';
$count: 5;
$step: 10deg;
$mid: math.ceil(math.div($count, 2));

.creative-page {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: 100;
  color: var(--color-text);
  overflow: hidden;
  display: flex;

  .context-container {
    height: 100%;
    width: 100%;
    position: relative;
    z-index: 11;

    .post-mark {
      position: absolute;
      left: 50%;
      top: 30%;
      height: 0px;
      width: 0px;
      z-index: 12;
      opacity: 0.8;
      transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
    }
  }

  .full-lyric-container {
    backdrop-filter: blur(30px) saturate(130%);
    height: 100%;
    width: 100%;
    background-color: rgba(0, 0, 0, 0.2);
    position: absolute;
    z-index: 10;
  }

  .lyric-container-1 {
    width: 60vw;
    margin: 0 auto;
    height: 100vh;
    padding-bottom: 10px;
    box-sizing: border-box;
  }

  .title-name {
    position: fixed;
    top: 28px;
    font-weight: 600;
    line-height: 50px;

    span {
      font-size: 26px;
    }
    .title {
      display: block;
      font-size: 30px;
    }
  }

  .title-name.right {
    text-align: right;
  }

  .pick-lyric {
    position: absolute;
    letter-spacing: 1px;
  }

  :deep(.lyric-item) {
    container-type: inline-size;
    font-size: 3.4cqw;
    user-select: none;
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
  .player-progress-bar {
    width: 22vw;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .slider {
      flex: 1;
      padding: 0 10px;
      contain: content;
    }

    .time {
      font-size: 15px;
      font-weight: 600;
      width: 34px;
      contain: content;
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
}

.letter {
  .title-name {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 11;
    transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);

    .fan-container {
      position: relative;
      width: 150px;
      height: 150px;
      margin-bottom: 150px;
      transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);

      img {
        width: 100%;
        position: absolute;
        inset: 0;
        scale: 1;
        border-radius: 12px;
        border: 8px solid white;
        box-sizing: border-box;
        transform-origin: 50% 600%;
        transition:
          transform 1s cubic-bezier(0.16, 1, 0.3, 1),
          z-index 0.1s;

        @for $i from 1 through $count {
          &:nth-child(#{$i}) {
            $distance: abs($i - $mid);
            $angle: ($i - $mid) * $step;

            z-index: $mid - $distance;
            transform: rotate($angle);
            opacity: max(1 - $distance * 0.4, 0.2);
          }
        }
      }
    }
  }

  .is-full {
    .post-mark {
      left: 10%;
      top: 2%;
      height: 120px;
      width: 120px;
    }
    .title-name {
      top: 40px !important;
      left: 0px !important;
      bottom: calc(100vh - 230px) !important;
      right: calc(100vw - 230px) !important;

      .title {
        display: none;
      }
      .fan-container {
        margin-bottom: 60px;
        height: 100px;
        width: 100px;
        background-image: url(../assets/images/stamp.png);

        img {
          margin: 2px;
          height: 96%;
          width: 96%;
          border-radius: 0;
          border: 4px solid white;
          @for $i from 1 through $count {
            &:nth-child(#{$i}) {
              transform: rotate(0);
            }
          }
        }
      }
    }
  }
}
</style>
