<template>
  <canvas ref="canvasRef" class="lottie-canvas"></canvas>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSettingsStore } from '../store/settings'

/**
 * Lottie 背景播放器（dotlottie-web）。
 *
 * 渲染后端由「设置 → 通用设置 → Lottie 渲染」决定：
 *   · webgl（默认）：WebGL2 光栅化到 GPU；拿不到 webgl2 上下文时回退软件渲染
 *   · webgpu：优先 WebGPU（上游仍标 experimental），无 adapter / 初始化失败时
 *     逐级回退 WebGL2 → 软件
 *   · software：强制 ThorVG 软件渲染（CPU 画到 2D canvas），兼容性最好但更吃 CPU
 *
 * 三个后端的 API 完全一致，切换只是换一个 import 子路径 + 对应的一份 wasm。
 * WASM 必须本地化：dotLottie 默认从 jsdelivr/unpkg 拉取，桌面端离线场景要用
 * `setWasmUrl()` 指向 `?url` 打包出来的本地文件。
 */

type LottieBackend = 'webgpu' | 'webgl' | 'software'

type DotLottieInstance = {
  play: () => void
  pause: () => void
  stop: () => void
  destroy: () => void
  resize: () => void
  isLoaded: boolean
  addEventListener: (type: string, listener: (event: any) => void) => void
  removeEventListener: (type: string, listener: (event: any) => void) => void
}

type DotLottieCtor = new (config: Record<string, any>) => DotLottieInstance

const props = withDefaults(
  defineProps<{
    /** 动画地址：内置动画的打包 URL，或 vutron:// 协议地址 */
    src: string
    /** 是否播放（背景动画跟随播放状态） */
    playing?: boolean
    loop?: boolean
    /** 与 CSS object-fit 同义的填充方式 */
    fit?: 'contain' | 'cover' | 'fill'
  }>(),
  {
    playing: false,
    loop: true,
    fit: 'contain'
  }
)

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error', error: Error): void
}>()

const settingsStore = useSettingsStore()
const rendererSetting = computed<LottieBackend>(
  () => settingsStore.general.lottieRenderer || 'webgl'
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let player: DotLottieInstance | null = null
/** 组件已卸载：异步回来的加载结果要丢弃 */
let disposed = false
/** 初始化令牌：连续切换 src / 后端时只让最后一次创建的结果生效 */
let initToken = 0
/** 当前规划的后端链与游标（运行期加载失败时沿链回退） */
let backendPlan: LottieBackend[] = []
let planIndex = 0
/** 当前实际生效的后端（调试用） */
let activeBackend: LottieBackend | null = null

const supportsWebGL2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

const supportsWebGPU = async () => {
  // 不引入 @webgpu/types：这里只需要探测 adapter 是否存在
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> }
    }
  ).gpu
  if (!gpu) return false
  try {
    return !!(await gpu.requestAdapter())
  } catch {
    return false
  }
}

const loadWebGL = async (): Promise<{ Ctor: DotLottieCtor; backend: LottieBackend }> => {
  const [{ DotLottie }, wasm] = await Promise.all([
    import('@lottiefiles/dotlottie-web/webgl'),
    import('@lottiefiles/dotlottie-web/webgl/dotlottie-player.wasm?url')
  ])
  DotLottie.setWasmUrl(wasm.default)
  return { Ctor: DotLottie as unknown as DotLottieCtor, backend: 'webgl' }
}

const loadWebGPU = async (): Promise<{ Ctor: DotLottieCtor; backend: LottieBackend }> => {
  const [{ DotLottie }, wasm] = await Promise.all([
    import('@lottiefiles/dotlottie-web/webgpu'),
    import('@lottiefiles/dotlottie-web/webgpu/dotlottie-player.wasm?url')
  ])
  DotLottie.setWasmUrl(wasm.default)
  return { Ctor: DotLottie as unknown as DotLottieCtor, backend: 'webgpu' }
}

const loadSoftware = async (): Promise<{ Ctor: DotLottieCtor; backend: LottieBackend }> => {
  const [{ DotLottie }, wasm] = await Promise.all([
    import('@lottiefiles/dotlottie-web'),
    import('@lottiefiles/dotlottie-web/dotlottie-player.wasm?url')
  ])
  DotLottie.setWasmUrl(wasm.default)
  return { Ctor: DotLottie as unknown as DotLottieCtor, backend: 'software' }
}

/** 按设置规划候选后端链（能力检测在真正尝试时做） */
const planBackends = (): LottieBackend[] => {
  switch (rendererSetting.value) {
    case 'software':
      return ['software']
    case 'webgpu':
      return ['webgpu', 'webgl', 'software']
    default:
      return ['webgl', 'software']
  }
}

const loadBackend = (backend: LottieBackend) => {
  if (backend === 'webgpu') return loadWebGPU()
  if (backend === 'webgl') return loadWebGL()
  return loadSoftware()
}

const backendUsable = async (backend: LottieBackend) => {
  if (backend === 'software') return true
  if (backend === 'webgl') return supportsWebGL2()
  return await supportsWebGPU()
}

const handleLoaded = () => {
  emit('loaded')
  if (props.playing) player?.play()
}

const handleError = async (event: { error?: Error }) => {
  const error = event?.error ?? new Error('Lottie 加载失败')

  // 运行期失败（驱动/上下文问题）时沿候选链回退一级；
  // 注意 loadError 也会因为动画文件本身有问题而触发，所以链走完就报错，不循环
  if (planIndex + 1 < backendPlan.length) {
    planIndex += 1
    const next = backendPlan[planIndex]
    console.warn(`[lottie] ${activeBackend ?? 'GPU'} 渲染失败，回退到 ${next}:`, error.message)
    destroyPlayer()
    await startFromPlan()
    return
  }

  console.error('[lottie] 动画加载失败:', error)
  emit('error', error)
}

const destroyPlayer = () => {
  initToken++
  if (!player) return
  try {
    player.removeEventListener('load', handleLoaded)
    player.removeEventListener('loadError', handleError)
    player.destroy()
  } catch {
    // 忽略销毁过程中的异常（wasm 已释放等）
  }
  player = null
}

/**
 * 换一个全新的 canvas。
 * 一个 canvas 只能提供一种上下文类型：WebGPU 初始化过的 canvas 不能再拿 WebGL2
 * 上下文（反之亦然），后端回退时必须换元素，否则回退一定失败。
 */
const replaceCanvas = () => {
  const old = canvasRef.value
  if (!old || !old.parentElement) return
  const fresh = document.createElement('canvas')
  fresh.className = old.className
  old.replaceWith(fresh)
  canvasRef.value = fresh
}

/** 从当前 planIndex 开始，找到第一个可用的后端并创建播放器 */
const startFromPlan = async (): Promise<void> => {
  if (!canvasRef.value || !props.src) return
  disposed = false
  const token = ++initToken

  // 已经创建过播放器（切换后端 / 回退）：用干净 canvas，避免上下文类型冲突
  if (activeBackend) replaceCanvas()

  while (planIndex < backendPlan.length) {
    const candidate = backendPlan[planIndex]
    if (await backendUsable(candidate)) {
      if (token !== initToken || disposed || !canvasRef.value) return
      const { Ctor, backend } = await loadBackend(candidate)
      if (token !== initToken || disposed || !canvasRef.value) return

      activeBackend = backend
      console.info(`[lottie] 渲染后端: ${backend}`)
      player = new Ctor({
        canvas: canvasRef.value,
        src: props.src,
        autoplay: false,
        loop: props.loop,
        layout: { fit: props.fit, align: [0.5, 0.5] },
        renderConfig: {
          autoResize: true,
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          freezeOnOffscreen: true
        },
        // 背景动画对帧间插值不敏感：关闭后只按动画自身帧率重绘（30fps 而非 60fps）
        useFrameInterpolation: false
      })
      player.addEventListener('load', handleLoaded)
      player.addEventListener('loadError', handleError)
      return
    }
    planIndex += 1
  }

  // 所有后端都不可用（理论上不会发生：软件后端总是可用）
  emit('error', new Error('没有可用的 Lottie 渲染后端'))
}

const restart = async () => {
  destroyPlayer()
  backendPlan = planBackends()
  planIndex = 0
  await startFromPlan()
}

onMounted(async () => {
  await restart()
})

watch(
  () => props.src,
  async () => {
    await restart()
  }
)

watch(rendererSetting, async () => {
  // 切换渲染后端：重建播放器，动画进度会从头开始（设置页操作，可接受）
  await restart()
})

watch(
  () => props.playing,
  (value) => {
    if (!player?.isLoaded) return
    if (value) player.play()
    else player.pause()
  }
)

watch(
  () => props.loop,
  async () => {
    // loop 只在构造时生效，改动时重建
    if (player) await restart()
  }
)

onBeforeUnmount(() => {
  disposed = true
  destroyPlayer()
})

defineExpose({
  play: () => player?.play(),
  pause: () => player?.pause(),
  stop: () => player?.stop(),
  resize: () => player?.resize(),
  destroy: () => {
    disposed = true
    destroyPlayer()
  }
})
</script>

<style scoped>
.lottie-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
