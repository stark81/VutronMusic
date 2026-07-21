import { defineStore } from 'pinia'
import { ref, reactive, computed, watch, watchEffect } from 'vue'
import { useSettingsStore } from './settings'
import eventBus from '../utils/eventBus'

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
  /** 直通路径增益（dry） */
  mainGain: number
  /** 混响路径增益（wet） */
  sendGain: number
}

// ─────────────────────────────────────────────
// 固定拓扑图示
//
//                        ┌─── (optional) soundtouch ───┐
//  audioSource ──────────┤                             ├──── eqChainIn
//                        └─────────────────────────────┘
//                                (pitch bypass)
//
//  eqChainIn ── [biquad×10] ── eqChainOut
//                                  │
//                    ┌─────────────┴──────────────┐
//                    │                            │
//              dryGain                      convolver
//                    │                            │
//                    │                       wetGain
//                    │                            │
//                    └──────────┬─────────────────┘
//                               │
//                          replayGain   ← 换曲时写入（ReplayGain 均衡），切歌带 50ms ramp
//                               │
//                            volume     ← 用户设置的音量（0-1），持久化
//                               │
//                             fade      ← 淡入/淡出专用，播放控制层，不污染 volume
//                               │
//                          destination
//
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useAudioEngineStore = defineStore('audioEngine', () => {
  const settingsStore = useSettingsStore()
  // const stateStore = useNormalStateStore()
  // const { showToast } = stateStore

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
  const ctxReady = ref(false)

  const convolverParams = reactive<ConvolverParams>({
    fileName: '',
    buffer: null,
    mainGain: 1,
    sendGain: 0
  })

  const retryCount = ref(0)
  const pitch = ref(1.0)
  const outputDevice = ref('')
  const progress = ref(0)

  // ── 运行时状态（不持久化）──────────────────
  let lastUpdateTime = 0
  let suspendTimer: ReturnType<typeof setTimeout> | null = null

  // ── 音频节点（不持久化）──────────────────
  //
  // 命名约定：
  //   pitch       = AudioWorkletNode (soundtouch)，可能不在 graph 中
  //   eqFilters   = BiquadFilterNode[]，始终在 graph 中
  //   dryGain     = 直通增益，始终在 graph 中
  //   convolver   = ConvolverNode，始终在 graph 中
  //   wetGain     = 混响增益，始终在 graph 中
  //   replayGain  = ReplayGain 均衡，换曲时写入，始终在 graph 中
  //   volume      = 用户音量（0-1），持久化，始终在 graph 中
  //   fade        = 淡入/淡出专用，播放控制层，不污染 volume.gain
  //
  const nodes = {
    audio: null as HTMLAudioElement | null,
    ctx: null as AudioContext | null,
    source: null as MediaElementAudioSourceNode | null,
    pitch: null as AudioWorkletNode | null,
    /** EQ 链入口（第一个 biquad） */
    eqEntry: null as BiquadFilterNode | null,
    /** EQ 链出口（最后一个 biquad） */
    eqExit: null as BiquadFilterNode | null,
    eqFilters: new Map<string, BiquadFilterNode>(),
    dryGain: null as GainNode | null,
    convolver: null as ConvolverNode | null,
    wetGain: null as GainNode | null,
    /** ReplayGain 均衡，换曲时写入，不受用户音量影响 */
    replayGain: null as GainNode | null,
    /** 用户音量（0-1），与 replayGain、fade 物理隔离 */
    volume: null as GainNode | null,
    /** 淡入/淡出专用，播放/暂停控制，不污染 volume.gain 的持久化值 */
    fade: null as GainNode | null
  }

  // ── 计算属性 ─────────────────────────────

  const biquadKeys = Object.keys(biquadParams) as unknown as Array<keyof BiquadParams>

  const useBiquad = computed(() => biquadKeys.some((k) => biquadParams[k] !== 0))

  const useConvolver = computed(() => convolverParams.fileName !== '')

  const usePitch = computed(() => pitch.value !== 1.0)

  const fadeDuration = computed(() => {
    const d = settingsStore.general.fadeDuration || 0.5
    return Math.max(0.1, Math.min(1, Number(d)))
  })

  const volumeNormalizationEnabled = computed(() => {
    return settingsStore.general.volumeNormalization !== false
  })

  /** 缓存最近一次曲目的 ReplayGain 值，供开关实时切换时重用 */
  let _lastReplayGain: { gain: number; peak: number } | null = null
  /** CUE 分轨偏移（ms），0 表示无分轨 */
  let _cueOffset = 0
  /** CUE 分轨时长（ms），0 表示无分轨 */
  let _cueDuration = 0
  /** 取 CUE 相对时间（秒），无分轨时返回当前时间 */
  const _cueRelative = (t: number) => (_cueOffset > 0 ? t - _cueOffset / 1000 : t)
  /** CUE 分轨起始位置的绝对时间（秒） */
  const _cueOffsetSec = () => _cueOffset / 1000
  /** 防止同一首 CUE 分轨结束时重复触发 playNext */
  let _cueEndHandled = false

  // 开关变化时立即生效
  watch(volumeNormalizationEnabled, (enabled) => {
    if (_lastReplayGain) {
      _applyReplayGain(_lastReplayGain.gain, _lastReplayGain.peak, enabled)
    }
  })

  // ── 响应式副作用 ─────────────────────────

  // EQ 参数实时生效（固定拓扑，20ms ramp 消除 zipper noise）
  watchEffect(() => {
    // 先无条件访问所有 biquadParams 属性，强制收集依赖
    const values = biquadKeys.map((key) => biquadParams[key])

    if (!ctxReady.value || !nodes.ctx) return

    const now = nodes.ctx.currentTime
    for (let i = 0; i < biquadKeys.length; i++) {
      const key = biquadKeys[i]
      const node = nodes.eqFilters.get(`hz${key}`)
      if (!node) continue
      node.gain.cancelScheduledValues(now)
      node.gain.setValueAtTime(node.gain.value, now)
      node.gain.linearRampToValueAtTime(values[i], now + 0.02)
    }
  })

  // Pitch 变化：动态 connect/disconnect soundtouch
  watch(pitch, (value) => {
    if (!nodes.source || !nodes.ctx) return

    if (value === 1.0) {
      _bypassPitch()
    } else {
      _engagePitch()
      // @ts-ignore
      const param = nodes.pitch?.parameters.get('pitch')
      if (param) {
        const now = nodes.ctx.currentTime
        param.cancelScheduledValues(now)
        param.setValueAtTime(param.value, now)
        param.linearRampToValueAtTime(value, now + 0.02)
      }
    }
  })

  // Convolver buffer 变化：同步到节点，保留尾音（不 disconnect）
  watch(
    () => convolverParams.buffer,
    (buffer) => {
      if (!nodes.ctx || !nodes.convolver) return
      nodes.convolver.buffer = buffer instanceof AudioBuffer ? buffer : null

      const now = nodes.ctx.currentTime
      const dry = nodes.dryGain!.gain
      const wet = nodes.wetGain!.gain

      dry.cancelScheduledValues(now)
      wet.cancelScheduledValues(now)
      dry.setValueAtTime(dry.value, now)
      wet.setValueAtTime(wet.value, now)

      if (buffer) {
        dry.linearRampToValueAtTime(convolverParams.mainGain, now + 0.05)
        wet.linearRampToValueAtTime(convolverParams.sendGain, now + 0.05)
      } else {
        // 无 IR：完全走 dry，wetGain 渐出（保留尾音自然衰减）
        dry.linearRampToValueAtTime(1, now + 0.05)
        wet.linearRampToValueAtTime(0, now + 0.05)
      }
    }
  )

  // mainGain / sendGain 实时生效（仅当有 buffer 时）
  watch(
    () => convolverParams.mainGain,
    (value) => {
      if (!convolverParams.buffer || !nodes.dryGain || !nodes.ctx) return
      const now = nodes.ctx.currentTime
      nodes.dryGain.gain.cancelScheduledValues(now)
      nodes.dryGain.gain.setValueAtTime(nodes.dryGain.gain.value, now)
      nodes.dryGain.gain.linearRampToValueAtTime(value, now + 0.02)
    }
  )

  watch(
    () => convolverParams.sendGain,
    (value) => {
      if (!convolverParams.buffer || !nodes.wetGain || !nodes.ctx) return
      const now = nodes.ctx.currentTime
      nodes.wetGain.gain.cancelScheduledValues(now)
      nodes.wetGain.gain.setValueAtTime(nodes.wetGain.gain.value, now)
      nodes.wetGain.gain.linearRampToValueAtTime(value, now + 0.02)
    }
  )

  watch(outputDevice, (device) => _setDevice(device))

  // ── 内部：Pitch 动态 bypass ───────────────

  function _bypassPitch() {
    if (!nodes.source || !nodes.eqEntry) return
    nodes.pitch?.disconnect()
    nodes.source.disconnect()
    nodes.source.connect(nodes.eqEntry)
  }

  function _engagePitch() {
    if (!nodes.source || !nodes.pitch || !nodes.eqEntry) return
    nodes.source.disconnect()
    nodes.source.connect(nodes.pitch)
    nodes.pitch.disconnect()
    nodes.pitch.connect(nodes.eqEntry)
  }

  function _setDevice(device: string) {
    if ('setSinkId' in AudioContext.prototype) {
      // @ts-ignore
      nodes.ctx?.setSinkId(device)
    }
  }

  // ── 公开 API ─────────────────────────────

  /**
   * 初始化音频引擎，一次性建好固定拓扑。
   * 应在组件 onMounted 调用一次。
   *
   * 固定部分（永不 disconnect）：
   *   eqEntry → ... → eqExit → dryGain ─────────────→ replayGain → volume → fade → destination
   *                          ↘ convolver → wetGain ↗
   *
   * 动态部分（pitch bypass）：
   *   usePitch=true  : source → soundtouch → eqEntry
   *   usePitch=false : source → eqEntry
   */
  async function setup(options?: { onTimeUpdate?: () => void; onEnded?: () => void }) {
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'metadata'
    audio.preservesPitch = true
    audio.volume = 1
    nodes.audio = audio

    audio.addEventListener('timeupdate', () => {
      if (Math.abs(audio.currentTime - lastUpdateTime) >= 1) {
        progress.value = _cueRelative(audio.currentTime)
        lastUpdateTime = audio.currentTime
        options?.onTimeUpdate?.()
      }
      if (_cueDuration > 0 && audio.currentTime >= (_cueOffset + _cueDuration) / 1000) {
        if (!_cueEndHandled) {
          _cueEndHandled = true
          eventBus.emit('playNext')
        }
      }
    })
    options?.onEnded && audio.addEventListener('ended', options.onEnded)

    const ctx = new AudioContext()
    nodes.ctx = ctx
    ctxReady.value = true
    nodes.source = ctx.createMediaElementSource(audio)
    await ctx.suspend()

    // ── Soundtouch worklet（pitch shifter，动态接入）
    await ctx.audioWorklet.addModule(new URL('../utils/soundtouch-worklet.js', import.meta.url))
    nodes.pitch = new AudioWorkletNode(ctx, 'soundtouch-processor')
    // @ts-ignore
    nodes.pitch.parameters.get('pitch')?.setValueAtTime(pitch.value, ctx.currentTime)
    // 注意：此时不 connect，由 _bypassPitch / _engagePitch 管理

    // ── EQ 链（固定拓扑）
    let prevFilter: BiquadFilterNode | null = null
    for (const key of biquadKeys) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'peaking'
      filter.frequency.value = Number(key)
      filter.Q.value = 1.4
      filter.gain.value = biquadParams[key]
      nodes.eqFilters.set(`hz${key}`, filter)

      if (prevFilter) prevFilter.connect(filter)
      prevFilter = filter
    }
    nodes.eqEntry = nodes.eqFilters.get(`hz${biquadKeys[0]}`)!
    nodes.eqExit = nodes.eqFilters.get(`hz${biquadKeys[biquadKeys.length - 1]}`)!

    // ── Dry/Wet 并联（固定拓扑）
    nodes.dryGain = ctx.createGain()
    nodes.wetGain = ctx.createGain()
    nodes.convolver = ctx.createConvolver()
    nodes.replayGain = ctx.createGain()
    nodes.volume = ctx.createGain()
    nodes.fade = ctx.createGain()

    // 初始状态：无 IR，全走 dry；replayGain/volume/fade 默认 1.0
    nodes.dryGain.gain.value = 1
    nodes.wetGain.gain.value = 0
    nodes.replayGain.gain.value = 1
    nodes.volume.gain.value = 0
    nodes.fade.gain.value = 1

    // eqExit → dryGain ──────────────────┐
    //                                    ├─→ replayGain → volume → fade → destination
    // eqExit → convolver → wetGain ──────┘
    nodes.eqExit.connect(nodes.dryGain)
    nodes.dryGain.connect(nodes.replayGain)

    nodes.eqExit.connect(nodes.convolver)
    nodes.convolver.connect(nodes.wetGain)
    nodes.wetGain.connect(nodes.replayGain)

    nodes.replayGain.connect(nodes.volume)
    nodes.volume.connect(nodes.fade)
    nodes.fade.connect(ctx.destination)

    // ── Source 初始路由（根据当前 pitch 值）
    if (usePitch.value) {
      _engagePitch()
    } else {
      _bypassPitch()
    }

    // ── 恢复持久化的 convolver（如有）
    if (convolverParams.fileName) {
      setConvolver({
        name: '',
        source: convolverParams.fileName,
        mainGain: convolverParams.mainGain,
        sendGain: convolverParams.sendGain
      })
    }

    _setDevice(outputDevice.value)
  }

  /** 销毁所有节点，在 onBeforeUnmount 调用 */
  async function destroy(options?: { onTimeUpdate?: () => void; onEnded?: () => void }) {
    if (!nodes.audio) return

    _clearSuspendTimer()

    options?.onTimeUpdate && nodes.audio.removeEventListener('timeupdate', options.onTimeUpdate)
    options?.onEnded && nodes.audio.removeEventListener('ended', options.onEnded)

    nodes.audio.pause()
    nodes.source?.disconnect()
    nodes.pitch?.disconnect()
    nodes.eqFilters.forEach((f) => f.disconnect())
    nodes.dryGain?.disconnect()
    nodes.convolver?.disconnect()
    nodes.wetGain?.disconnect()
    nodes.replayGain?.disconnect()
    nodes.volume?.disconnect()
    nodes.fade?.disconnect()

    nodes.audio = null
    nodes.source = null
    nodes.pitch = null
    nodes.eqEntry = null
    nodes.eqExit = null
    nodes.eqFilters.clear()
    nodes.dryGain = null
    if (nodes.convolver) nodes.convolver.buffer = null
    nodes.convolver = null
    nodes.wetGain = null
    nodes.replayGain = null
    nodes.volume = null
    nodes.fade = null

    await nodes.ctx?.close()
    nodes.ctx = null
  }

  /**
   * 淡入/淡出，写入 fade 节点。
   * 与 volume（用户音量）物理隔离，fade 完成后 fade.gain 回到 1 不会影响已持久化的 volume.gain。
   * context 挂起时直接跳变，运行时线性 ramp。
   */
  async function smoothGain(to: number, duration: number) {
    if (!nodes.ctx || !nodes.fade) return
    const now = nodes.ctx.currentTime
    nodes.fade.gain.cancelAndHoldAtTime(now)

    if (nodes.ctx.state === 'running') {
      nodes.fade.gain.linearRampToValueAtTime(to, now + duration)
      await _delay(duration * 1.2 * 1000)
    } else {
      nodes.fade.gain.setValueAtTime(to, now)
    }
  }

  /**
   * 加载 IR 文件并设置 convolver。
   * source 为空时关闭混响（wetGain → 0，保留尾音自然衰减）。
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
      // 不直接清 buffer，让 watch 处理，平滑过渡
      convolverParams.buffer = null
      return
    }

    const path = new URL(`../assets/medias/${data.source}`, import.meta.url).href
    fetch(path)
      .then((r) => r.arrayBuffer())
      .then((buf) => nodes.ctx?.decodeAudioData(buf))
      .then((buffer) => {
        if (buffer) convolverParams.buffer = buffer
      })
      .catch((err) => console.error('[audioEngine] setConvolver failed:', err))
  }

  /**
   * 将用户音量（0-1）写入 volume 节点。
   * 直接 ramp，不经过 smoothGain（smoothGain 操作的是 fade 节点）。
   */
  function applyVolume(value: number) {
    if (!nodes.ctx || !nodes.volume) return
    const now = nodes.ctx.currentTime
    nodes.volume.gain.cancelAndHoldAtTime(now)
    nodes.volume.gain.linearRampToValueAtTime(value, now + fadeDuration.value)
  }

  function setBalance(params: Record<string, any>) {
    console.log('[setBalance]', params)
  }

  /** 切换输出设备 */
  function setDevice(device: string) {
    outputDevice.value = device
  }

  /** 恢复 AudioContext（首次用户交互后调用） */
  async function resumeContext() {
    _clearSuspendTimer()
    if (nodes.ctx?.state === 'suspended') {
      await nodes.ctx.resume()
    }
  }

  /**
   * 暂停播放。
   *
   * 策略：
   *   - 立即 pause audio（停止解码/输出）
   *   - 30s 后才 suspend context（避免蓝牙重新握手、iOS Safari 抖动）
   *   - play() 时取消 suspend timer 并 resume
   */
  async function pause() {
    if (!nodes.audio) return
    await smoothGain(0, fadeDuration.value)
    nodes.audio.pause()
    progress.value = _cueRelative(nodes.audio.currentTime)

    _clearSuspendTimer()
    suspendTimer = setTimeout(async () => {
      await nodes.ctx?.suspend()
    }, 30_000)
  }

  async function suspendContext() {
    _clearSuspendTimer()
    await nodes.ctx?.suspend()
  }

  /**
   * 播放歌曲，应用音量均衡
   */
  function playAudioSource(
    sources: string[],
    gain: number,
    peak: number,
    autoPlay = true,
    cueOffset = 0,
    cueDuration = 0
  ) {
    if (!nodes.audio) return

    if (!sources.length && !retryCount.value) {
      eventBus.emit('loadCurrentTrack', [autoPlay, nodes.audio.currentTime])
      retryCount.value += 1
      return
    } else if (!sources.length) {
      _cueOffset = 0
      _cueDuration = 0
      eventBus.emit('playNext')
      return
    }

    _cueOffset = cueOffset
    _cueDuration = cueDuration
    _cueEndHandled = false
    _lastReplayGain = { gain, peak }
    _applyReplayGain(gain, peak, volumeNormalizationEnabled.value)
    let sourceIndex = 0
    nodes.audio.src = sources[sourceIndex]

    if (cueOffset > 0) {
      nodes.audio.addEventListener(
        'loadedmetadata',
        () => {
          nodes.audio!.currentTime = cueOffset / 1000
        },
        { once: true }
      )
    }

    nodes.audio.load()

    nodes.audio.onerror = async () => {
      if (!nodes.audio) return
      await pause()
      sourceIndex++
      if (sourceIndex < sources.length) {
        await _delay(500)
        nodes.audio.src = sources[sourceIndex]
        nodes.audio.load()
      } else if (!retryCount.value) {
        await _delay(500)
        eventBus.emit('loadCurrentTrack', [autoPlay, nodes.audio.currentTime])
        retryCount.value += 1
      } else {
        await _delay(500)
        _cueOffset = 0
        _cueDuration = 0
        eventBus.emit('playNext')
      }
    }

    if (autoPlay) play()
  }

  async function play() {
    if (!nodes.audio) return
    await resumeContext()

    nodes.fade!.gain.setValueAtTime(0, nodes.ctx!.currentTime)
    progress.value = _cueRelative(nodes.audio.currentTime)
    await nodes.audio.play()
    await smoothGain(1, fadeDuration.value)
    retryCount.value = 0
  }

  function setPosition(time: number) {
    if (!nodes.audio) return
    _cueEndHandled = false
    if (_cueDuration > 0) {
      // time 是分轨相对秒数，转成文件绝对秒数
      const absTime = _cueOffsetSec() + time
      const end = (_cueOffset + _cueDuration) / 1000
      if (absTime >= end) {
        eventBus.emit('playNext')
        return
      }
      nodes.audio.currentTime = absTime
    } else {
      nodes.audio.currentTime = time
    }
    progress.value = time
    lastUpdateTime = time
  }

  function setPlaybackRate(rate: number) {
    if (!nodes.audio) return
    nodes.audio.playbackRate = rate
  }

  // ── 内部 helpers ─────────────────────────

  /**
   * 换曲时设置 ReplayGain 均衡值，50ms ramp 避免切歌时的增益跳变 click。
   */
  function _applyReplayGain(gain: number, peak: number, normalize = true) {
    if (!nodes.replayGain || !nodes.ctx) return
    const now = nodes.ctx.currentTime
    const target = (() => {
      if (!normalize) return 1.0
      const HEADROOM = 10 ** (-1 / 20)
      const PREGAIN = 10 ** (6 / 20)
      const gainLinear = 10 ** (gain / 20) * PREGAIN
      const amplifiedPeak = peak * gainLinear
      return amplifiedPeak > HEADROOM ? HEADROOM / peak : gainLinear
    })()

    nodes.replayGain.gain.cancelAndHoldAtTime(now)
    nodes.replayGain.gain.linearRampToValueAtTime(target, now + 0.1)
  }

  function getCurrentTime(): number {
    return _cueRelative(nodes.audio?.currentTime ?? 0)
  }

  function _clearSuspendTimer() {
    if (suspendTimer !== null) {
      clearTimeout(suspendTimer)
      suspendTimer = null
    }
  }

  return {
    // 持久化状态
    biquadParams,
    biquadUser,
    convolverParams,
    pitch,
    outputDevice,
    progress,

    // 计算属性
    useBiquad,
    useConvolver,
    usePitch,
    fadeDuration,

    // 生命周期
    setup,
    destroy,

    // 操作
    smoothGain,
    setBalance,
    applyVolume,
    setConvolver,
    setDevice,
    resumeContext,
    suspendContext,
    playAudioSource,
    getCurrentTime,
    play,
    pause,
    setPosition,
    setPlaybackRate
  }
})

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function _delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
