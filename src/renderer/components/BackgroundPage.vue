<template>
  <div class="bg-container">
    <div v-if="activeBG.type === 'gradient'" class="bg-color"></div>
    <div
      v-else-if="
        ['blur-image', 'dynamic-image', 'letter-image', 'custom-image', 'online-image'].includes(
          activeBG.type
        )
      "
      :class="cls"
    ></div>
    <template v-else-if="activeBG.type === 'custom-video'">
      <video
        ref="videoRef"
        class="bg-video"
        :src="srcValue"
        :autoplay="false"
        loop
        muted
        playsinline
      />
    </template>
    <template v-else-if="activeBG.type === 'lottie'">
      <Vue3Lottie
        ref="lottieContainer"
        class="lottie-container"
        :animation-link="srcValue"
        :auto-play="false"
        height="100%"
        width="100%"
        renderer="canvas"
        @on-animation-loaded="() => (playing ? play() : pause())"
      />
      <div class="lt-mask" :data-theme="theme"></div>
    </template>
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
const { activeBG, activeTheme } = storeToRefs(playerThemeStore)
const playerStore = usePlayerStore()
const { playing, pic } = storeToRefs(playerStore)

const videoRef = useTemplateRef('videoRef')
const lottieContainer = useTemplateRef('lottieContainer')

const primary = ref('')
const secondary = ref('')

const srcValue = computed(() => {
  if (activeBG.value.type === 'gradient') {
    return `linear-gradient(to top left, ${primary.value}, ${secondary.value})`
  } else if (['blur-image', 'dynamic-image', 'letter-image'].includes(activeBG.value.type)) {
    return `url(${pic.value})`
  } else if (activeBG.value.type === 'custom-video') {
    return ''
  } else if (activeBG.value.type === 'lottie') {
    let src = activeBG.value.src
    if (['snow', 'sunshine'].includes(src)) {
      src = new URL(`../assets/lottie/${src}.json`, import.meta.url).href
    } else {
      src = new URL(src, import.meta.url).href
    }
    return src
  }
  return ''
})

const cls = computed(() => {
  if (['blur-image', 'letter-image'].includes(activeBG.value.type)) {
    return 'bg-img cover-image'
  } else if (activeBG.value.type === 'dynamic-image') {
    return `bg-img cover-image dynamic${playing.value ? '' : ' paused'}`
  }
  return ''
})

const containerBGColor = computed(() => {
  if (activeBG.value.type === 'custom-video') {
    if (activeBG.value.useExtractedColor) {
      return `linear-gradient(to top left, ${primary.value}, ${secondary.value})`
    }
  }
  return `var(--color-body-bg)`
})

const theme = computed(() => {
  let appearance = activeBG.value.color
  if (appearance === 'auto' || appearance === undefined) {
    appearance = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return appearance
})

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
  playing,
  async (value) => {
    await nextTick()
    value ? play() : pause()
  },
  { immediate: true }
)

watch(
  () => activeTheme.value.theme.senses,
  () => {
    if (playing.value && activeBG.value.type === 'lottie') {
      lottieContainer.value?.play()
    }
  }
)

watch(
  () => activeBG.value.type,
  (value, oldValue) => {
    if (oldValue === 'lottie') {
      lottieContainer.value?.stop()
    }
  }
)

const play = () => {
  if (activeBG.value.type === 'custom-video' && videoRef.value) {
    videoRef.value?.play()
  } else if (activeBG.value.type === 'lottie' && lottieContainer.value) {
    lottieContainer.value?.play()
  }
}

const pause = () => {
  if (activeBG.value.type === 'custom-video' && videoRef.value) {
    videoRef.value.pause()
  } else if (activeBG.value.type === 'lottie' && lottieContainer.value) {
    lottieContainer.value.pause()
  }
}

onMounted(async () => {
  await nextTick()
  await getImage(pic.value)
  if (playing.value) play()
})

onUnmounted(() => {
  pause()
  lottieContainer.value?.destroy()
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
    width: 140vw;
    height: 140vw;
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

.lt-mask[data-theme='dark'] {
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
