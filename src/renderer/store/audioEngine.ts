import { defineStore } from 'pinia'
import { ref, reactive, computed, watch, watchEffect, nextTick } from 'vue'
import { useSettingsStore } from './settings'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface BiquadParams {
  31: number
  62: number
  125: number
  250: number
  500: number
  1000: number
  2000: number
  4000: number
  8000: number
  16000: number
}

export interface ConvolverParams {
  fileName: string
  buffer: AudioBuffer | null
  mainGain: number
  sendGain: number
}

/** usePlaybackStore 通过这个接口与音频引擎交互，不直接访问 audioNodes */
export interface AudioEngineAPI {
  readonly audio: HTMLAudioElement | null
  readonly audioContext: AudioContext | null
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useAudioEngineStore = defineStore(
  'audioEngine',
  () => {
    const settingsStore = useSettingsStore()

    // ── 持久化参数 ──────────────────────────────
    const biquadParams = reactive<BiquadParams>({
      31: 0,
      62: 0,
      125: 0,
      250: 0,
      500: 0,
      1000: 0,
      2000: 0,
      4000: 0,
      8000: 0,
      16000: 0
    })

    const biquadUser = ref<Record<string, BiquadParams>[]>([])

    const convolverParams = reactive<ConvolverParams>({
      fileName: '',
      buffer: null,
      mainGain: 1,
      sendGain: 0
    })

    const pitch = ref(1.0)
    const outputDevice = ref('')

    // ── 运行时音频节点（不持久化）──────────────
    const audioNodes = {
      audio: null as HTMLAudioElement | null,
      audioContext: null as AudioContext | null,
      audioSource: null as MediaElementAudioSourceNode | null,
      soundtouch: null as AudioWorkletNode | null,
      biquads: new Map<string, BiquadFilterNode>(),
      dynamics: null as DynamicsCompressorNode | null,
      convolverSourceGain: null as GainNode | null,
      convolverOutputGain: null as GainNode | null,
      convolver: null as ConvolverNode | null,
      masterGain: null as GainNode | null
    }

    // ── 计算属性 ────────────────────────────────
    const biquadKeys = Object.keys(biquadParams) as unknown as Array<keyof BiquadParams>

    const useBiquad = computed(() => biquadKeys.some((k) => biquadParams[k] !== 0))

    const useConvolver = computed(() => convolverParams.fileName !== '')

    const usePitch = computed(() => pitch.value !== 1.0)

    const fadeDuration = computed(() => {
      const d = settingsStore.general.fadeDuration || 0.5
      return Math.max(0.1, Math.min(1, Number(d)))
    })

    // ── 节点路由：当拓扑依赖项变化时重新连接 ────
    watch(
      () => [audioNodes.audioSource, useBiquad.value, useConvolver.value, usePitch.value] as const,
      ([source, biq, conv, pit]) => {
        if (!source) return
        _reconnectChain(!!pit, biq, conv)
      },
      { immediate: true }
    )

    // EQ 参数实时生效
    watchEffect(() => {
      for (const key of biquadKeys) {
        const node = audioNodes.biquads.get(`hz${key}`)
        if (node) node.gain.value = biquadParams[key]
      }
    })

    // Pitch 实时生效
    watch(pitch, (value) => {
      nextTick(() => {
        const st = audioNodes.soundtouch
        // @ts-ignore
        if (st) st.parameters.get('pitch').value = value
      })
    })

    // Convolver buffer 变化时同步到节点
    watch(
      () => convolverParams.buffer,
      (buffer) => {
        if (!audioNodes.audioContext || !audioNodes.convolver) return
        const ctx = audioNodes.audioContext
        audioNodes.convolver.buffer = buffer instanceof AudioBuffer ? buffer : null
        audioNodes.convolverSourceGain?.gain.setValueAtTime(
          convolverParams.mainGain,
          ctx.currentTime
        )
        audioNodes.convolverOutputGain?.gain.setValueAtTime(
          convolverParams.sendGain,
          ctx.currentTime
        )
      }
    )

    watch(
      () => convolverParams.mainGain,
      (value) => {
        if (!convolverParams.buffer || !audioNodes.convolverSourceGain) return
        audioNodes.convolverSourceGain.gain.setValueAtTime(
          value,
          audioNodes.audioContext?.currentTime ?? 0
        )
      }
    )

    watch(
      () => convolverParams.sendGain,
      (value) => {
        if (!convolverParams.buffer || !audioNodes.convolverOutputGain) return
        audioNodes.convolverOutputGain.gain.setValueAtTime(
          value,
          audioNodes.audioContext?.currentTime ?? 0
        )
      }
    )

    watch(outputDevice, (device) => _setDevice(device))

    // ── 内部：节点连接拓扑 ──────────────────────

    function _connectToSoundtouch(src: AudioNode): AudioNode {
      src.connect(audioNodes.soundtouch!)
      return audioNodes.soundtouch!
    }

    function _connectToBiquad(src: AudioNode): AudioNode {
      const first = biquadKeys[0]
      src.connect(audioNodes.biquads.get(`hz${first}`)!)
      return audioNodes.biquads.get(`hz${biquadKeys[biquadKeys.length - 1]}`)!
    }

    function _connectToConvolver(src: AudioNode): AudioNode {
      src.connect(audioNodes.convolverSourceGain!)
      src.connect(audioNodes.convolver!)
      return audioNodes.dynamics!
    }

    function _reconnectChain(pit: boolean, biq: boolean, conv: boolean) {
      audioNodes.audioSource?.disconnect()
      audioNodes.soundtouch?.disconnect()
      audioNodes.biquads.get(`hz${biquadKeys[biquadKeys.length - 1]}`)?.disconnect()
      audioNodes.masterGain?.disconnect()

      const steps: Array<(n: AudioNode) => AudioNode> = []
      if (pit) steps.push(_connectToSoundtouch)
      if (biq) steps.push(_connectToBiquad)
      if (conv) steps.push(_connectToConvolver)

      let node: AudioNode = audioNodes.audioSource!
      for (const step of steps) node = step(node)
      node.connect(audioNodes.masterGain!)
      audioNodes.masterGain!.connect(audioNodes.audioContext!.destination)
    }

    function _setDevice(device: string) {
      if ('setSinkId' in AudioContext.prototype) {
        // @ts-ignore
        audioNodes.audioContext?.setSinkId(device)
      }
    }

    // ── 公开 API ────────────────────────────────

    /**
     * 初始化所有 Web Audio 节点。
     * 应在组件 onMounted 阶段调用一次。
     */
    async function setup(options?: { onTimeUpdate?: () => void; onEnded?: () => void }) {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preload = 'metadata'
      audio.preservesPitch = true
      audio.volume = 1
      audioNodes.audio = audio

      if (options?.onTimeUpdate) {
        audio.addEventListener('timeupdate', options.onTimeUpdate)
      }
      if (options?.onEnded) {
        audio.addEventListener('ended', options.onEnded)
      }

      const ctx = new AudioContext()
      audioNodes.audioContext = ctx
      audioNodes.audioSource = ctx.createMediaElementSource(audio)
      await ctx.suspend()

      // Biquad 滤波器链
      for (const key of biquadKeys) {
        const filter = ctx.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value = Number(key)
        filter.Q.value = 1.4
        filter.gain.value = biquadParams[key]
        audioNodes.biquads.set(`hz${key}`, filter)
      }
      for (let i = 1; i < biquadKeys.length; i++) {
        audioNodes.biquads
          .get(`hz${biquadKeys[i - 1]}`)!
          .connect(audioNodes.biquads.get(`hz${biquadKeys[i]}`)!)
      }

      // Convolver 子图
      audioNodes.dynamics = ctx.createDynamicsCompressor()
      audioNodes.convolver = ctx.createConvolver()
      audioNodes.convolverOutputGain = ctx.createGain()
      audioNodes.convolverSourceGain = ctx.createGain()

      audioNodes.convolver.connect(audioNodes.convolverOutputGain)
      audioNodes.convolverSourceGain.connect(audioNodes.dynamics)
      audioNodes.convolverOutputGain.connect(audioNodes.dynamics)
      audioNodes.convolverSourceGain.gain.value = convolverParams.mainGain
      audioNodes.convolverOutputGain.gain.value = convolverParams.sendGain

      // Master gain（初始静音，由 smoothGain 淡入）
      audioNodes.masterGain = ctx.createGain()
      audioNodes.masterGain.gain.setValueAtTime(0, ctx.currentTime)

      // Soundtouch worklet（变调）
      await ctx.audioWorklet.addModule(new URL('../utils/soundtouch-worklet.js', import.meta.url))
      audioNodes.soundtouch = new AudioWorkletNode(ctx, 'soundtouch-processor')
      // @ts-ignore
      audioNodes.soundtouch.parameters.get('pitch').value = pitch.value

      // 初始路由
      _reconnectChain(usePitch.value, useBiquad.value, useConvolver.value)

      // 恢复持久化的 convolver
      setConvolver({
        name: '',
        source: convolverParams.fileName,
        mainGain: convolverParams.mainGain,
        sendGain: convolverParams.sendGain
      })

      _setDevice(outputDevice.value)
    }

    /** 销毁所有节点，在 onBeforeUnmount 调用 */
    async function destroy(options?: { onTimeUpdate?: () => void; onEnded?: () => void }) {
      if (!audioNodes.audio) return

      if (options?.onTimeUpdate) {
        audioNodes.audio.removeEventListener('timeupdate', options.onTimeUpdate)
      }
      if (options?.onEnded) {
        audioNodes.audio.removeEventListener('ended', options.onEnded)
      }
      audioNodes.audio.pause()

      audioNodes.audioSource?.disconnect()
      audioNodes.biquads.forEach((f) => f.disconnect())
      audioNodes.soundtouch?.disconnect()
      audioNodes.dynamics?.disconnect()
      audioNodes.convolver?.disconnect()
      audioNodes.convolverOutputGain?.disconnect()
      audioNodes.convolverSourceGain?.disconnect()
      audioNodes.masterGain?.disconnect()

      audioNodes.audio = null
      audioNodes.audioSource = null
      audioNodes.soundtouch = null
      audioNodes.biquads.clear()
      audioNodes.dynamics = null
      if (audioNodes.convolver) audioNodes.convolver.buffer = null
      audioNodes.convolver = null
      audioNodes.convolverOutputGain = null
      audioNodes.convolverSourceGain = null
      audioNodes.masterGain = null
      await audioNodes.audioContext?.close()
      audioNodes.audioContext = null
    }

    /**
     * 音量淡入/淡出。
     * 在 audioContext 挂起时直接跳变，运行时则线性 ramp。
     */
    async function smoothGain(to: number, duration: number) {
      if (!audioNodes.audioContext || !audioNodes.masterGain) return
      const now = audioNodes.audioContext.currentTime
      audioNodes.masterGain.gain.cancelAndHoldAtTime(now)

      if (audioNodes.audioContext.state === 'running') {
        audioNodes.masterGain.gain.linearRampToValueAtTime(to, now + duration)
        await _delay(duration * 1.2 * 1000)
      } else {
        audioNodes.masterGain.gain.setValueAtTime(to, now)
      }
    }

    /**
     * 加载 IR 文件并设置 convolver。
     * source 为空字符串时关闭混响。
     */
    function setConvolver(data: {
      name: string
      source: string
      mainGain: number
      sendGain: number
    }) {
      convolverParams.fileName = data.source
      convolverParams.mainGain = data.mainGain
      convolverParams.sendGain = data.sendGain

      if (!data.source) {
        convolverParams.buffer = null
        return
      }

      const path = new URL(`../assets/medias/${data.source}`, import.meta.url).href
      fetch(path)
        .then((res) => res.arrayBuffer())
        .then((buf) => audioNodes.audioContext?.decodeAudioData(buf))
        .then((buffer) => {
          if (buffer) convolverParams.buffer = buffer
        })
        .catch((err) => console.error('[audioEngine] setConvolver failed:', err))
    }

    /** 将 volume（0-1）写入 masterGain，由 usePlaybackStore 在 watch(volume) 里调用 */
    function applyVolume(value: number) {
      smoothGain(value, fadeDuration.value)
    }

    /** 切换输出设备 */
    function setDevice(device: string) {
      outputDevice.value = device
    }

    /** 恢复 AudioContext（首次用户交互后调用） */
    async function resumeContext() {
      if (audioNodes.audioContext?.state === 'suspended') {
        await audioNodes.audioContext.resume()
      }
    }

    /** 挂起 AudioContext（暂停时节省 CPU） */
    async function suspendContext() {
      await audioNodes.audioContext?.suspend()
    }

    // ── 只读暴露 audio 元素供 usePlaybackStore 访问 ──
    const audio = computed(() => audioNodes.audio)
    const audioContext = computed(() => audioNodes.audioContext)

    return {
      // 持久化状态
      biquadParams,
      biquadUser,
      convolverParams,
      pitch,
      outputDevice,

      // 计算属性
      useBiquad,
      useConvolver,
      usePitch,
      fadeDuration,
      audio,
      audioContext,

      // 生命周期
      setup,
      destroy,

      // 操作
      smoothGain,
      applyVolume,
      setConvolver,
      setDevice,
      resumeContext,
      suspendContext
    }
  },
  {
    persist: {
      // audio/audioContext 是 computed，不会被持久化
      // convolverParams.buffer 是 AudioBuffer，无法序列化，pinia-plugin-persistedstate
      // 默认只序列化 JSON 安全的字段，buffer 会被忽略——但为了明确，在此 omit 掉
      omit: ['convolverParams.buffer']
    }
  }
)

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function _delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
