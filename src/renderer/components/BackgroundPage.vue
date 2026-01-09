<template>
  <div class="bg-container">
    <div v-if="typeValue === 'gradient'" class="bg-color"></div>
    <video
      v-else-if="typeValue === 'custom-video'"
      ref="videoRef"
      :key="srcValue"
      class="bg-video customize-image"
      :class="{ 'mix-blend': activeBG.useExtractedColor }"
      :src="srcValue"
      preload="metadata"
      :autoplay="false"
      loop
      muted
      playsinline
    />
    <Vue3Lottie
      v-else-if="typeValue === 'lottie' && srcValue"
      :key="`${srcValue}-1`"
      ref="lottieContainer"
      class="lottie-container customize-image"
      :animation-link="srcValue"
      :auto-play="false"
      height="100%"
      width="100%"
      renderer="canvas"
      @on-animation-loaded="onLottieLoaded"
    />
    <div
      v-else-if="
        ['none', 'blur-image', 'dynamic-image', 'letter-image', 'custom-image', 'api'].includes(
          typeValue
        )
      "
      :class="cls"
    ></div>
    <div v-if="typeValue === 'lottie'" class="lt-mask"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, useTemplateRef, onMounted, nextTick, onUnmounted } from 'vue'
import { Vue3Lottie } from 'vue3-lottie'
import { usePlayerThemeStore } from '../store/playerTheme'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import { Vibrant } from 'node-vibrant/browser'
import Color from 'color'

const playerThemeStore = usePlayerThemeStore()
const { activeBG } = storeToRefs(playerThemeStore)
const playerStore = usePlayerStore()
const { playing, pic, currentTrack } = storeToRefs(playerStore)

const videoRef = useTemplateRef('videoRef')
const lottieContainer = useTemplateRef('lottieContainer')

const primary = ref('')
const secondary = ref('')
const tempSrc = ref('')
const tempType = ref<'custom-image' | 'custom-video'>('custom-image')
let apiRefreshTimer: ReturnType<typeof setInterval> | null = null

const srcValue = computed(() => {
  if (activeBG.value.type === 'gradient') {
    return `linear-gradient(to top left, ${primary.value}, ${secondary.value})`
  } else if (['blur-image', 'dynamic-image', 'letter-image'].includes(activeBG.value.type)) {
    return `url(${pic.value})`
  } else if (activeBG.value.type === 'custom-image') {
    const image = `atom://local-resource/${encodeURIComponent(activeBG.value.src)}`
    return `url(${image})`
  } else if (activeBG.value.type === 'custom-video') {
    return `atom://local-asset?type=stream&path=${encodeURIComponent(activeBG.value.src)}`
  } else if (activeBG.value.type === 'lottie') {
    let src = activeBG.value.src
    if (['snow', 'sunshine'].includes(src)) {
      src = new URL(`../assets/lottie/${src}.json`, import.meta.url).href
    } else {
      src = new URL(src, import.meta.url).href
    }
    return src
  } else if (activeBG.value.type === 'random-folder') {
    return tempSrc.value
  } else if (activeBG.value.type === 'api') {
    return tempSrc.value
  }
  return ''
})

const typeValue = computed(() => {
  return activeBG.value.type === 'random-folder' ? tempType.value : activeBG.value.type
})

const cls = computed(() => {
  if (['blur-image', 'letter-image'].includes(activeBG.value.type)) {
    return 'bg-img cover-image'
  } else if (activeBG.value.type === 'dynamic-image') {
    return `bg-img cover-image dynamic${playing.value ? '' : ' paused'}`
  } else if (['custom-image', 'api'].includes(activeBG.value.type)) {
    return 'bg-img customize-image'
  } else if (activeBG.value.type === 'random-folder' && tempType.value === 'custom-image') {
    return 'bg-img customize-image'
  }
  return ''
})

const imgWidth = computed(() => {
  return ['blur-image', 'dynamic-image'].includes(activeBG.value.type) ? '140vw' : '100vw'
})

const bgBlur = computed(() => `${activeBG.value.blur}px`)
const bgOpacity = computed(() => `${activeBG.value.opacity / 100}`)

const containerBGColor = computed(() => {
  if (activeBG.value.type === 'custom-video') {
    if (activeBG.value.useExtractedColor) {
      return `linear-gradient(to top left, ${primary.value}, ${secondary.value})`
    }
  }
  return `var(--color-body-bg)`
})

const shouldPlayVideo = computed(() => {
  return (
    playing.value &&
    (activeBG.value.type === 'custom-video' ||
      (activeBG.value.type === 'random-folder' && tempType.value === 'custom-video'))
  )
})

const shouldPlayLottie = computed(() => {
  return playing.value && activeBG.value.type === 'lottie'
})

const loadRandomFolderSource = async () => {
  if (activeBG.value.type !== 'random-folder' || !activeBG.value.src) return
  const filters = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm']
  const files = await window.mainApi?.invoke('getFilesInFolder', activeBG.value.src, filters)
  if (files && files.length > 0) {
    const randomFile = files[Math.floor(Math.random() * files.length)]
    const type = randomFile.match(/\.(mp4|webm)$/i) ? 'custom-video' : 'custom-image'
    const url = `atom://local-resource/${encodeURIComponent(randomFile)}`
    tempSrc.value = type === 'custom-image' ? `url(${url})` : url
    tempType.value = type
  }
}

const getImage = async (pic: string) => {
  if (!pic) return
  try {
    const palette = await Vibrant.from(pic).getPalette()
    const swatch = palette.DarkMuted || palette.Vibrant
    if (swatch) {
      const base = Color.rgb(swatch.rgb)
      primary.value = base.darken(0.1).rgb().string()
      secondary.value = base.lighten(0.2).rotate(-30).rgb().string()
    }
  } catch (e) {
    console.error('Vibrant failed', e)
  }
}

watch(pic, (value) => {
  getImage(value)
})

watch(
  () => currentTrack.value?.id,
  () => {
    stopApiRefreshTimer()
    if (activeBG.value.type === 'api' && activeBG.value.switchMode === 'track') {
      tempSrc.value = `url(${activeBG.value.src}${activeBG.value.src.includes('?') ? '&' : '?'}t=${Date.now()})`
    }
  }
)

const stopApiRefreshTimer = () => {
  if (apiRefreshTimer) {
    clearInterval(apiRefreshTimer)
    apiRefreshTimer = null
  }
}

const startApiRefreshTimer = () => {
  stopApiRefreshTimer()
  if (activeBG.value.type !== 'api' || activeBG.value.switchMode !== 'time') return
  const time = (activeBG.value.timer || 5) * 60 * 1000
  apiRefreshTimer = setInterval(() => {
    tempSrc.value = `url(${activeBG.value.src}${activeBG.value.src.includes('?') ? '&' : '?'}t=${Date.now()})`
  }, time)
}

watch(
  () => [activeBG.value.type, activeBG.value.src],
  (newType, oldType) => {
    tempSrc.value = ''
    tempType.value = 'custom-image'
    stopApiRefreshTimer()

    if (oldType[0] === 'lottie' && newType[0] !== 'lottie') {
      lottieContainer.value?.stop()
      lottieContainer.value?.destroy()
    } else if (oldType[0] === 'custom-video' && newType[0] !== 'custom-video') {
      videoRef.value?.pause()
      videoRef.value?.removeAttribute('src')
      videoRef.value?.load()
    }

    if (newType[0] === 'lottie' && !newType[1]) {
      lottieContainer.value?.stop()
      lottieContainer.value?.destroy()
    }

    if (newType[0] === 'random-folder' && newType[1]) {
      loadRandomFolderSource()
    } else if (newType[0] === 'api') {
      tempSrc.value = `url(${activeBG.value.src}${activeBG.value.src.includes('?') ? '&' : '?'}t=${Date.now()})`
      startApiRefreshTimer()
    }
  },
  { flush: 'pre' }
)

watch(
  () => [
    activeBG.value.type === 'api' && activeBG.value.switchMode,
    activeBG.value.type === 'api' && activeBG.value.timer
  ],
  async (value) => {
    await nextTick()
    stopApiRefreshTimer()
    if (!value[0]) return
    if (value[0] === 'time') {
      startApiRefreshTimer()
    }
  }
)

watch(
  () => shouldPlayVideo.value && srcValue.value,
  async (value) => {
    if (value) {
      await nextTick()
      videoRef.value?.play()
    } else {
      videoRef.value?.pause()
    }
  }
)

watch(shouldPlayLottie, async (value) => {
  if (!lottieContainer.value) return

  if (value) {
    await nextTick()
    lottieContainer.value.play()
  } else {
    lottieContainer.value.pause()
  }
})

const onLottieLoaded = async () => {
  if (!shouldPlayLottie.value) return
  await nextTick()
  lottieContainer.value?.play()
}

onMounted(async () => {
  await nextTick()
  await getImage(pic.value)
  if (activeBG.value.type === 'random-folder') {
    await loadRandomFolderSource()
  } else if (activeBG.value.type === 'api') {
    tempSrc.value = `url(${activeBG.value.src}${activeBG.value.src.includes('?') ? '&' : '?'}t=${Date.now()})`
    startApiRefreshTimer()
  }
  if (playing.value) {
    if (shouldPlayLottie.value) {
      lottieContainer.value?.play()
    } else if (shouldPlayVideo.value) {
      videoRef.value?.play()
    }
  }
})

onUnmounted(() => {
  lottieContainer.value?.stop()
  lottieContainer.value?.destroy()
  videoRef.value?.pause()
  videoRef.value?.removeAttribute('src')
  videoRef.value?.load()
  tempSrc.value = ''
  tempType.value = 'custom-image'
  stopApiRefreshTimer()
})
</script>

<style scoped lang="scss">
.bg-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: -1;
  background: v-bind(containerBGColor);
}

.bg-color {
  width: 100%;
  height: 100%;
  background: v-bind(srcValue);
}

.bg-img {
  height: 100vh;
  width: 100vw;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-image: v-bind(srcValue);
}

.bg-img.cover-image {
  --contrast-lyrics-background: 50%;
  --brightness-lyrics-background: 130%;

  position: relative;
  filter: blur(50px) contrast(var(--contrast-lyrics-background))
    brightness(var(--brightness-lyrics-background));

  &::before,
  &::after {
    content: '';
    display: block;
    position: absolute;
    width: v-bind(imgWidth);
    height: v-bind(imgWidth);
    background-image: v-bind(srcValue);
    background-size: cover;
    opacity: 0.6;
    will-change: transform;
  }

  &::before {
    top: 0;
    right: 0;
    mix-blend-mode: luminosity;
  }

  &::after {
    bottom: 0;
    left: 0;
    animation-direction: reverse;
    animation-delay: 10s;
  }
}

[data-theme='dark'] .bg-img.cover-image {
  --contrast-lyrics-background: 105%;
  --brightness-lyrics-background: 60%;
}

.customize-image {
  filter: blur(v-bind(bgBlur));
  opacity: v-bind(bgOpacity);
}

.dynamic {
  &::before,
  &::after {
    animation: rotate 90s linear infinite;
    will-change: transform;
  }

  &.paused::before,
  &.paused::after {
    animation-play-state: paused;
  }
}

.bg-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(v-bind(bgBlur));
  opacity: v-bind(bgOpacity);
}

.mix-blend {
  mix-blend-mode: screen;
}

.lottie-container {
  width: 100%;
  height: 100%;
}

.lt-mask {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: transparent;
  transition: background-color 0.3s;
}

[data-theme='dark'] .lt-mask {
  background-color: rgba(20, 20, 20, 0.25);
}

@keyframes rotate {
  from {
    transform: rotate(0deg) translateZ(0);
  }
  to {
    transform: rotate(360deg) translateZ(0);
  }
}
</style>
