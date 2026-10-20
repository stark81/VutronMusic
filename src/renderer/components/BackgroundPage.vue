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
        ['blur-image', 'dynamic-image', 'letter-image', 'custom-image'].includes(typeValue)
      "
      :class="cls"
    ></div>
    <div v-if="typeValue === 'api'" class="bg-img customize-image api-bg" :style="apiBgStyle"></div>
    <div v-if="typeValue === 'lottie' || activeBG.useExtractedColor" class="lt-mask"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, useTemplateRef, onMounted, nextTick, onUnmounted } from 'vue'
import { Vue3Lottie } from 'vue3-lottie'
import { usePlayerThemeStore } from '../store/playerTheme'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { storeToRefs } from 'pinia'
import { Vibrant } from 'node-vibrant/browser'
import Color from 'color'
import { useI18n } from 'vue-i18n'

const playerThemeStore = usePlayerThemeStore()
const { activeBG } = storeToRefs(playerThemeStore)
const playerStore = usePlayerStore()
const { playing, pic, currentTrack } = storeToRefs(playerStore)
const { showToast } = useNormalStateStore()
const { t } = useI18n()

const videoRef = useTemplateRef('videoRef')
const lottieContainer = useTemplateRef('lottieContainer')

const primary = ref('')
const secondary = ref('')
const tempSrc = ref('')
const tempType = ref<'custom-image' | 'custom-video'>('custom-image')
let apiRefreshTimer: ReturnType<typeof setInterval> | null = null
/**
 * api 背景：`apiSrc` 是当前已上屏的图片地址（带 `_t=` 的原始地址）。
 * 用 `new Image()` 预加载 + 预解码，而不是 `fetch`：图床普遍不返回
 * `Access-Control-Allow-Origin`，`fetch` 会被 CORS 直接拦掉，而 `Image`/CSS
 * 背景图的加载不受 CORS 限制。预加载用的地址与最终交给 `background-image`
 * 的地址完全一致，因此可以直接复用浏览器已下载的缓存。
 * 不使用双层交叉淡入：两层半透明图叠加会产生明显重影，这里只做「ready 后原子替换」。
 */
const apiSrc = ref('')
/** CSS url() 里的字符串需要转义，避免地址中的引号/反斜杠破坏样式 */
const escapeCssUrl = (src: string) => src.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const apiBgStyle = computed(() => ({
  backgroundImage: apiSrc.value ? `url("${escapeCssUrl(apiSrc.value)}")` : 'none'
}))
/**
 * 载入令牌：只有最后一次请求的结果会被写入画面。
 * 定时切换与切歌几乎同时触发时，旧结果不会覆盖新结果。
 */
let apiLoadToken = 0
let apiLoadController: AbortController | null = null
const API_IMAGE_TIMEOUT = 8_000

const srcValue = computed(() => {
  if (activeBG.value.type === 'gradient') {
    return `linear-gradient(to top left, ${primary.value}, ${secondary.value})`
  } else if (['blur-image', 'dynamic-image', 'letter-image'].includes(activeBG.value.type)) {
    return `url(${pic.value})`
  } else if (activeBG.value.type === 'custom-image') {
    if (!activeBG.value.src) return ''
    const image = `vutron://local-resource/${encodeURIComponent(activeBG.value.src)}`
    return `url(${image})`
  } else if (activeBG.value.type === 'custom-video') {
    if (!activeBG.value.src) return ''
    return `vutron://local-asset?type=stream&path=${encodeURIComponent(activeBG.value.src)}`
  } else if (activeBG.value.type === 'lottie') {
    let src = activeBG.value.src
    if (!src) return ''
    if (['snow', 'sunshine'].includes(src)) {
      src = new URL(`../assets/lottie/${src}.json`, import.meta.url).href
    } else {
      src = `vutron://local-asset?type=json&path=${encodeURIComponent(activeBG.value.src)}`
    }
    return src
  } else if (activeBG.value.type === 'random-folder') {
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
  let files: string[] | undefined
  try {
    files = await window.mainApi?.invoke('getFilesInFolder', activeBG.value.src, filters)
  } catch (error) {
    // main 侧只会对「用户未显式授权过的目录」抛错：安全策略升级后需要重新选择
    if (error instanceof Error && error.message.includes('FOLDER_NOT_AUTHORIZED')) {
      showToast(t('toast.reauthRequired'))
    } else {
      console.error('读取背景文件夹失败:', error)
    }
    return
  }
  if (files && files.length > 0) {
    const randomFile = files[Math.floor(Math.random() * files.length)]
    const type = randomFile.match(/\.(mp4|webm)$/i) ? 'custom-video' : 'custom-image'
    const url = `vutron://local-resource/${encodeURIComponent(randomFile)}`
    tempSrc.value = type === 'custom-image' ? `url(${url})` : url
    tempType.value = type
  }
}

/**
 * 自定义背景资源（图片 / 视频 / lottie 配置文件）需要用户显式授权才能读取。
 * 安全策略升级后，历史选择过的文件不再被授权，这里主动提示用户重新选择，
 * 避免背景静默失效。
 */
const reauthorizeCustomSource = async () => {
  const { type, src } = activeBG.value
  if (!['custom-image', 'custom-video', 'lottie'].includes(type) || !src) return
  // lottie 内置动画不是本地文件
  if (['snow', 'sunshine'].includes(src)) return
  try {
    const authorized = await window.mainApi?.invoke('check-local-resource', src)
    if (authorized === false) {
      activeBG.value.src = ''
      showToast(t('toast.reauthRequired'))
    }
  } catch (error) {
    console.error('校验背景资源授权失败:', error)
  }
}

watch([() => activeBG.value.type, () => activeBG.value.src], reauthorizeCustomSource, {
  immediate: true
})

const getImage = async (pic: string) => {
  if (!pic) return
  try {
    const palette = await Vibrant.from(pic).getPalette()
    let swatch = activeBG.value.useExtractedColor ? palette.Vibrant : palette.DarkMuted
    const dark = activeBG.value.useExtractedColor ? 0.2 : 0.1
    const light = activeBG.value.useExtractedColor ? 0 : 0.2
    swatch = swatch || palette.Vibrant

    if (swatch) {
      const base = Color.rgb(swatch.rgb)
      primary.value = base.darken(dark).rgb().string()
      secondary.value = base.lighten(light).rotate(-30).rgb().string()
    }
  } catch (e) {
    console.error('Vibrant failed', e)
  }
}

watch(pic, (value) => {
  getImage(value)
})

watch(
  () => activeBG.value.useExtractedColor,
  () => {
    getImage(pic.value)
  }
)

watch(
  () => currentTrack.value?.id,
  () => {
    if (activeBG.value.type === 'api' && activeBG.value.switchMode === 'track') {
      stopApiRefreshTimer()
      switchApiBackground()
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
    switchApiBackground()
  }, time)
}

/** 切歌/换源时彻底丢弃当前 api 背景，避免旧图残留在屏幕上 */
const clearApiSource = () => {
  apiLoadToken++
  apiLoadController?.abort()
  apiLoadController = null
  apiSrc.value = ''
}

/**
 * 用 `new Image()` 预加载并预解码，返回是否 ready。
 * 不走 `fetch`：图床基本都不返回 CORS 头，`fetch` 会被拦掉；`Image` 不受此限制，
 * 且与最终 `background-image` 使用完全相同的地址，可直接复用浏览器缓存。
 * signal 只用于取消「等待」——超时或已有更新的切换时提前返回，图片本身仍留在缓存里，
 * 因此即便这里返回 false，调用方退回直连地址也能立刻命中缓存。
 */
const preloadImage = (src: string, signal: AbortSignal) =>
  new Promise<boolean>((resolve) => {
    const image = new Image()
    let settled = false
    const settle = (ready: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(ready)
    }
    const onAbort = () => settle(false)
    const timer = setTimeout(() => settle(false), API_IMAGE_TIMEOUT)
    signal.addEventListener('abort', onAbort)
    image.onerror = () => settle(false)
    image.onload = async () => {
      // decode() 失败不代表图片不可用（例如响应缺少 CORS 头），忽略即可
      try {
        await image.decode()
      } catch {
        /* noop */
      }
      settle(true)
    }
    image.src = src
  })

const switchApiBackground = async () => {
  if (activeBG.value.type !== 'api' || !activeBG.value.src) return

  // 追加时间戳：图床/其 CDN 对同一地址有 30 天缓存，不换地址就永远是同一张图
  const rawSrc = `${activeBG.value.src}${activeBG.value.src.includes('?') ? '&' : '?'}_t=${Date.now()}`
  const token = ++apiLoadToken
  apiLoadController?.abort()
  const controller = new AbortController()
  apiLoadController = controller

  try {
    // 新图 ready 之前不碰画面，旧背景保持可见
    const ready = await preloadImage(rawSrc, controller.signal)
    if (!ready || token !== apiLoadToken) return

    apiSrc.value = rawSrc
  } finally {
    if (apiLoadController === controller) apiLoadController = null
  }
}

/**
 * 对于lottie动画需要十分注意，否则可能会导致lottie组件不断尝试恢复动画而导致cpu占用异常
 * 1. 从lottie切换到其他类型，需要停止lottie并destroy；
 * 2. lottie动画的src从有变成了无、从A切换到了B，都需要先停止
 *
 * 这个监听同时是 api 背景的**唯一加载入口**（immediate）：切到 api 时拉第一张，
 * 之后改地址也由它重新拉。切歌、定时刷新则分别由 currentTrack 监听与定时器负责，
 * 三者互不重叠——任意两处同时触发都会互相 abort，导致首张图迟迟不上屏。
 */
watch(
  () => [activeBG.value.type, activeBG.value.src],
  (newType, oldType = ['', '']) => {
    tempSrc.value = ''
    tempType.value = 'custom-image'
    stopApiRefreshTimer()
    // 类型或地址一旦变化，当前 api 背景图即失效
    clearApiSource()

    if (oldType[0] === 'lottie' && newType[0] !== 'lottie') {
      lottieContainer.value?.stop()
      lottieContainer.value?.destroy()
    } else if (oldType[0] === 'custom-video' && newType[0] !== 'custom-video') {
      videoRef.value?.pause()
      videoRef.value?.removeAttribute('src')
      videoRef.value?.load()
    }

    if (newType[0] === 'lottie') {
      if (!newType[1] || newType[1] !== oldType[1]) {
        lottieContainer.value?.stop()
        lottieContainer.value?.destroy()
      }
    }

    if (newType[0] === 'random-folder' && newType[1]) {
      loadRandomFolderSource()
    } else if (newType[0] === 'api') {
      startApiRefreshTimer()
      switchApiBackground()
    }
  },
  { flush: 'pre', immediate: true }
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
  await nextTick()
  if (!lottieContainer.value) return

  if (value) {
    lottieContainer.value.play()
  } else {
    if (activeBG.value.type === 'lottie') {
      lottieContainer.value.pause()
    } else {
      lottieContainer.value.stop()
      lottieContainer.value.destroy()
    }
  }
})

const onLottieLoaded = async () => {
  if (!shouldPlayLottie.value) return
  await nextTick()
  lottieContainer.value?.play()
}

onMounted(async () => {
  lottieContainer.value?.stop()
  lottieContainer.value?.destroy()
  // 推迟 Vibrant 颜色提取到首帧后，避免阻塞首次渲染
  setTimeout(() => getImage(pic.value), 0)
  if (activeBG.value.type === 'random-folder') {
    await loadRandomFolderSource()
  }
  // 注意：api 背景的首次加载由下面那个 [type, src] 监听（immediate）负责，
  // 这里不要再调用 switchApiBackground，否则两处会互相 abort，首张图要等两轮才出现
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
  clearApiSource()
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

/**
 * api 背景：单层渲染，直接由内联 style 给出 background-image（objectURL）。
 * 刻意不加任何透明度过渡——两层半透明图叠加会看到重影，
 * 这里只在预加载 + 预解码完成后原子替换，切换观感是「立即生效」。
 */
.api-bg {
  position: absolute;
  top: 0;
  left: 0;
  transition: none;
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
  mix-blend-mode: overlay;
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
