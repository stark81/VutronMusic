<template>
  <div
    ref="container"
    class="vue-slider"
    :class="containerClass"
    :style="containerStyle"
    @click="handleClick"
    @mouseenter="(e) => handleMounse(e, 'enter')"
    @mousemove="(e) => handleMounse(e, 'move')"
    @mouseleave="(e) => handleMounse(e, 'leave')"
  >
    <div class="vue-slider-rail" :style="railStyle" tabindex="-1">
      <div class="vue-slider-process" :style="processStyle"></div>
      <div v-if="marks.length" class="vue-slider-marks">
        <div
          v-for="mark of marks"
          :key="mark.toString()"
          class="vue-slider-mark"
          :style="mark.activeStyle"
        >
          <div class="vue-slider-mark-step" :style="stepStyle"></div>
          <div class="vue-slider-mark-label" :style="mark.labelStyle">{{ mark.label }}</div>
        </div>
      </div>
    </div>
    <div v-show="hover" class="vue-slider-tooltip" :data-tip="tooltip" :style="tooltipStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef, ref, toRefs } from 'vue'

type Value = number | string

interface Style {
  [value: string]: any
}

interface MarksOption {
  label?: Value
  style?: Style
  activeStyle?: Style
  labelStyle?: Style
  labelActiveStyle?: Style
}

type Direction = 'ltr' | 'rtl' | 'ttb' | 'btt'
type TooltipType = 'none' | 'hoverValue' | 'modelValue'

const containerRef = useTemplateRef('container')

const DEFAULT_SLIDER_SIZE = 4

const props = withDefaults(
  defineProps<{
    modelValue: number
    height: number
    dotSize: number
    min: number
    max: number
    direction?: Direction
    marks?: number[] | Record<number, MarksOption> // 进度条上需要标记的点
    railStyle: Style
    processStyle: Style
    stepStyle?: Style // 标记点的样式
    tooltipStyle?: { background: string }
    /**
     * 决定如何显示 tooltip：
     * - none时不显示
     * - hoverValue时显示位置跟随鼠标位置
     * - modelValue时只显示在v-model对应的位置
     */
    tooltipPos?: TooltipType
    /**
     * tooltip显示的内容：
     * - 鼠标移入组件时，组件触发 update:hoverPosition 事件告知当前hover位置的值；
     * - 其中，hover位置的值要么是 v-model 的值，要么是鼠标位置对应的值；
     * - 父组件拿到值后计算出需要显示的tooltip字符串，组件再进行显示
     */
    tooltip?: string
  }>(),
  {
    dotSize: 10,
    stepStyle: undefined,
    tooltipStyle: undefined,
    min: 0,
    tooltipPos: 'none',
    tooltip: '',
    marks: undefined,
    direction: 'ltr'
  }
)

const $emit = defineEmits(['update:modelValue', 'update:hoverPosition'])
const { modelValue } = toRefs(props)

const hover = ref(false)
const position = ref('0')
const background = ref(props.tooltipStyle?.background)
let hoverTimer: any = null
const modelPosition = computed(() => {
  const percent1 =
    (props.direction === 'rtl' || props.direction === 'btt'
      ? props.max - modelValue.value
      : modelValue.value - props.min) /
    (props.max - props.min)
  const pos =
    percent1 *
    (isVertical.value ? containerRef.value!.offsetHeight : containerRef.value!.offsetWidth)
  return pos + 'px'
})
const showPosition = computed(() => {
  return props.tooltipPos === 'modelValue' ? modelPosition.value : position.value
})
const transitionTime = computed(() => (props.tooltipPos === 'hoverValue' ? '0s' : '0.3s'))

const isVertical = computed(() => {
  return props.direction === 'btt' || props.direction === 'ttb'
})

const containerClass = computed(() => `${props.direction}`)

const containerStyle = computed(() => {
  const result: Record<string, string> = {}
  result.height = props.height + 'px'
  const padding = props.dotSize / 2
  result.padding = isVertical.value ? ` 0px ${padding}px` : `${padding}px 0px`
  result.width = isVertical.value ? `${DEFAULT_SLIDER_SIZE}px` : 'auto'
  return result
})

const processStyle = computed(() => {
  const result: Record<string, string> = {
    height: '100%',
    width: '100%',
    ...props.processStyle
  }
  const width = (modelValue.value - props.min) / (props.max - props.min)

  if (props.direction === 'ltr') {
    result.top = '0px'
    result.left = '0px'
    result.transform = `scaleX(${width})`
    result.transformOrigin = 'left'
  } else if (props.direction === 'rtl') {
    result.top = '0px'
    result.right = '0px'
    result.transform = `scaleX(${width})`
    result.transformOrigin = 'right'
  } else if (props.direction === 'btt') {
    result.bottom = '0px'
    result.left = '0px'
    result.transform = `scaleY(${width})`
    result.transformOrigin = 'bottom'
  } else {
    result.top = '0px'
    result.left = '0px'
    result.transform = `scaleY(${width})`
    result.transformOrigin = 'top'
  }
  return result
})

const marks = computed(() => {
  if (!props.marks) return []
  const list = Array.isArray(props.marks) ? props.marks : Object.entries(props.marks)

  return list.map((item: number | [string, MarksOption]) => {
    const result: Record<string, any> = typeof item === 'number' ? {} : item[1]
    if (typeof item === 'number') {
      result.label = item
    } else if (!('label' in item[1])) {
      result.label = item[0]
    }
    const activeStyle: Record<string, any> = {}
    const width = isVertical.value ? `${DEFAULT_SLIDER_SIZE}px` : props.height + 'px'
    activeStyle.height = width
    activeStyle.width = width

    const current = typeof item === 'number' ? item : Number(item[0])
    const pos = (current - props.min) / (props.max - props.min)

    if (props.direction === 'ltr') {
      activeStyle.left = `${pos * 100}%`
    } else if (props.direction === 'rtl') {
      activeStyle.right = `${pos * 100}%`
    } else if (props.direction === 'btt') {
      activeStyle.bottom = `${pos * 100}%`
    } else {
      activeStyle.top = `${pos * 100}%`
    }
    result.activeStyle = activeStyle
    return result
  })
})

const getPosition = (event: MouseEvent) => {
  let pos = 0
  let pos1 = 0
  const dom = containerRef.value!
  const rect = dom.getBoundingClientRect()

  if (props.direction === 'ltr') {
    const relativeX = event.clientX - rect.left
    pos = relativeX / rect.width
    pos1 = pos
  } else if (props.direction === 'rtl') {
    const relativeX = event.clientX - rect.left
    const posFromRight = rect.width - relativeX
    pos = posFromRight / rect.width
    pos1 = relativeX / rect.width
  } else if (props.direction === 'btt') {
    const relativeY = event.clientY - rect.top
    const posFromBottom = rect.height - relativeY
    pos = posFromBottom / rect.height
    pos1 = relativeY / rect.height
  } else {
    const relativeY = event.clientY - rect.top
    pos = relativeY / rect.height
    pos1 = pos
  }

  pos1 = Math.max(0, Math.min(1, pos1))
  pos = Math.max(0, Math.min(1, pos))

  const result = (props.max - props.min) * pos + props.min
  return { time: result, pos: pos1 }
}

const handleClick = (event: MouseEvent) => {
  const result = getPosition(event)
  $emit('update:modelValue', result.time)
}

let lastMoveTime = 0
const THROTTLE_RATE = 33.5

const handleMounse = (event: MouseEvent, type: 'enter' | 'move' | 'leave') => {
  if (props.tooltipPos === 'none') return

  if (type === 'leave') {
    hover.value = false
    if (hoverTimer) clearTimeout(hoverTimer)
    return
  }

  if (type === 'move') {
    const now = Date.now()

    if (now - lastMoveTime < THROTTLE_RATE) {
      return
    }

    lastMoveTime = now
    hover.value = true

    const result = getPosition(event)

    const pos =
      result.pos *
      (isVertical.value ? containerRef.value!.offsetHeight : containerRef.value!.offsetWidth)
    position.value = pos + 'px'
    $emit('update:hoverPosition', result.time)
    return
  }

  if (hoverTimer) clearTimeout(hoverTimer)

  hoverTimer = setTimeout(() => {
    hover.value = true
    let result: { time: number; pos: number } = { time: 0, pos: 0 }
    if (props.tooltipPos === 'modelValue') result.time = modelValue.value
    else result = getPosition(event)

    const pos =
      result.pos *
      (isVertical.value ? containerRef.value!.offsetHeight : containerRef.value!.offsetWidth)
    position.value = pos + 'px'
    $emit('update:hoverPosition', result.time)
    hoverTimer = undefined
  }, 100)
}
</script>

<style scoped lang="scss">
.vue-slider {
  position: relative;
  box-sizing: content-box;
  display: block;
  user-select: none;
}

.vue-slider-rail {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
}

.vue-slider-process {
  position: absolute;
  transition: all 0.3s;
}

.vue-slider-mark {
  position: relative;
}

.vue-slider-mark-step {
  border-radius: 50%;
  display: none;
}

.vue-slider-mark-label {
  left: 50%;
  transform: translateX(-50%);
}

.ltr .vue-slider-mark-label {
  top: 100%;
  margin-top: 10px;
}

.vue-slider-tooltip {
  position: absolute;
  font-size: 14px;
  color: white;
  white-space: nowrap;
  border-radius: 5px;
}

.ltr .vue-slider-tooltip,
.rtl .vue-slider-tooltip {
  left: 0;
  top: -40px;
  padding: 3px 8px;
  transform: translateX(calc(v-bind(showPosition) - 50%));
  transition: all v-bind(transitionTime);

  &::before {
    content: attr(data-tip);
  }

  &::after {
    content: '';
    border: 8px solid transparent;
    position: absolute;
    left: 50%;
    bottom: 0;
    border-top-color: v-bind(background);
    transform: translate(-50%, 100%);
  }
}

.ttb .vue-slider-tooltip,
.btt .vue-slider-tooltip {
  left: -30px;
  top: 0px;
  padding: 3px 12px;
  transform: translate(-50%, calc(v-bind(showPosition) - 50%));
  transition: all v-bind(transitionTime);

  &::before {
    content: attr(data-tip);
  }

  &::after {
    content: '';
    position: absolute;

    border: 8px solid transparent;
    border-left-color: v-bind(background);

    right: -15px;
    top: 50%;

    transform: translateY(-50%);
  }
}
</style>
