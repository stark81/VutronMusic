<template>
  <Transition name="slide-up">
    <div v-if="modelValue" class="sense-modal" @click="updateShow(false)">
      <div class="sense-content" :class="{ creative: type === 'Creative' }" @click.stop>
        <div class="sense-title" :class="{ multi: activeSense.title.length > 1 }">
          <span
            v-for="(name, idx) in activeSense.title"
            :key="name"
            :class="{ active: idx === titleIdx }"
            @click="titleIdx = idx"
            >{{ name }}</span
          >
        </div>
        <div class="sense-list">
          <template v-if="type === 'Classic'">
            <div
              v-for="(sense, idx) in activeSense.sense"
              :key="idx"
              :index="idx"
              class="sense-item"
              :class="{
                active: idx === currentSenses[type].cover
              }"
              @click="updateSense(idx as 0 | 1 | 2)"
            >
              <div class="sense-active">使用中</div>
              <img :src="senseImg(idx)" loading="lazy" />
              <div>{{ sense.name }}</div>
            </div>
          </template>
          <template v-else>
            <div class="ani-select">
              <div
                v-for="ani in animations"
                :key="ani.ani"
                class="sense-item"
                @click="updateAnimation(ani.ani)"
                @mouseenter="tempAni = ani.ani"
                @mouseleave="resetTempAni"
              >
                <div
                  class="ani"
                  :class="{
                    active: currentSenses[type].lyric.align[currentSenses[type].align] === ani.ani
                  }"
                  >{{ ani.name }}</div
                >
              </div>
            </div>
            <div ref="previewRef" class="preview" />
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePlayerThemeStore } from '../store/playerTheme'
import { gsap } from 'gsap'
import { storeToRefs } from 'pinia'
import { AniName } from '@/types/theme'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    type: 'Classic' | 'Creative' | 'Letter'
  }>(),
  {}
)

const $emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const titleIdx = ref(0)
const lyricArray = ref('不见桐花万里路，故园外，拂去怀中一缕芳'.split(''))
const previewRef = ref<HTMLElement>()
let tl: gsap.core.Timeline | null = null

const playerTheme = usePlayerThemeStore()
const { senses: currentSenses, activeTheme } = storeToRefs(playerTheme)

const senses = {
  Classic: {
    title: ['封面类型'],
    sense: [
      { name: '默认', img: 'common' },
      { name: '圆形封面', img: 'circle' },
      { name: '旋转封面', img: 'rotate' }
    ]
  },
  Creative: {
    title: ['切换动画'],
    sense: [
      { name: '靠左', img: 'creative_snow' },
      { name: '居中', img: 'sunshine' },
      { name: '靠右', img: 'sunshine' }
    ]
  },
  Letter: {
    title: ['切换动画'],
    sense: [] as { name: string; img: string }[]
  }
} as const

const tempAni = ref<AniName>(
  props.type === 'Classic'
    ? ''
    : currentSenses.value[props.type].lyric.align[currentSenses.value[props.type].align]
)

const animations: { name: string; ani: AniName }[] = [
  { name: '铰链翻入', ani: 'hingeFlyIn' },
  { name: '聚焦上浮', ani: 'focusRise' },
  { name: '抛散离场', ani: 'scatterThrow' },
  { name: '翻转显现', ani: 'flipReveal' },
  { name: '波浪浮现', ani: 'waveDrift' },
  { name: '双向聚拢', ani: 'splitAndMerge' }
]

const preAnimation = computed(() => ({
  // 1.75s
  splitAndMerge: {
    enter: 1.25,
    leave: 0.75,
    ani: [
      {
        opacity: 0,
        x: (i: number) => (i - (lyricArray.value.length - 1) / 2) * 30,
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
        duration: 1,
        ease: 'power3.out'
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
    ]
  },
  // 1.75s
  hingeFlyIn: {
    enter: 0.7 + 0.1 * 7,
    leave: 0.75,
    ani: [
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
        duration: 1,
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
    ]
  },
  // 0.75
  focusRise: {
    enter: 0.7 + 0.05 * 7,
    leave: 0.75,
    ani: [
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
        duration: 1,
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
    ]
  },
  // 1s
  scatterThrow: {
    enter: 0.85,
    leave: 1.05,
    ani: [
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
        stagger: 0.5 / (lyricArray.value.length - 1)
      }
    ]
  },
  // 0.75s
  flipReveal: {
    enter: 0.9 + 0.1 * 7,
    leave: 0.8,
    ani: [
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
    ]
  },
  // 0.75
  waveDrift: {
    enter: 0.9 + 0.06 * 7,
    leave: 0.8,
    ani: [
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
  }
}))

const activeSense = computed(() => {
  return senses[props.type]
})

const buildAnimation = () => {
  if (tl) {
    tl.kill()
    tl = null
  }
  tl = gsap.timeline({ repeat: -1, repeatDelay: 1, paused: true })
  const currentAni = preAnimation.value[tempAni.value]
  // @ts-ignore
  tl.set('.view-char', currentAni.ani[0])
    // @ts-ignore
    .to('.view-char', currentAni.ani[1])
    // @ts-ignore
    .to('.view-char', currentAni.ani[2], 4)
  tl.time(0).play()
}

const resetTempAni = () => {
  if (props.type === 'Classic') return
  tempAni.value = currentSenses.value[props.type].lyric.align[currentSenses.value[props.type].align]
}

const updateShow = (value: boolean) => {
  $emit('update:modelValue', value)
  titleIdx.value = 0
}

const updateSense = async (idx: 0 | 1 | 2) => {
  const theme = activeTheme.value.theme
  if (theme.activeLayout !== 'Classic') return
  theme.senses[theme.activeLayout].cover = idx
}

const updateAnimation = (name: AniName) => {
  if (props.type === 'Classic') return
  const theme = currentSenses.value[props.type]
  theme.lyric.align[theme.align] = name
}

const senseImg = (index: number) => {
  return new URL(`../assets/images/${activeSense.value.sense[index].img}.png`, import.meta.url).href
}

const buildElement = () => {
  if (!previewRef.value) return
  while (previewRef.value.firstChild) {
    previewRef.value.removeChild(previewRef.value.firstChild)
  }

  lyricArray.value.forEach((w) => {
    const span = document.createElement('div')
    span.textContent = w
    span.className = 'view-char'
    previewRef.value?.appendChild(span)
  })
}

watch(
  () => props.modelValue && props.type !== 'Classic' && tempAni.value,
  (value) => {
    tl?.kill()
    tl = null
    if (value) {
      setTimeout(() => {
        buildElement()
        buildAnimation()
      }, 200)
    }
  }
)
</script>

<style scoped lang="scss">
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
  color: color-mix(in srgb, var(--color-text), transparent 40%);

  .active {
    color: var(--color-text);
  }

  &.multi span {
    cursor: pointer;
    border-right: 2px solid color-mix(in srgb, var(--color-text), transparent 40%);
    margin-right: 20px;
    padding-right: 20px;

    &:last-child {
      border-right: none;
    }
  }
}

.sense-list {
  display: flex;
  justify-content: center;
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

  .ani {
    display: flex;
    height: 100%;
    width: 150px;
    box-sizing: border-box;
    justify-content: center;
    align-items: center;
    border: 2px solid var(--color-primary);
    border-radius: 8px;
    user-select: none;
    cursor: pointer;
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

.ani-select {
  width: 40%;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 0;

  .ani {
    display: flex;
    box-sizing: border-box;
    justify-content: center;
    align-items: center;
    height: 50px;
    border: 2px solid var(--color-primary);
    border-radius: 8px;
    user-select: none;
    cursor: pointer;

    &.active {
      background-color: var(--color-primary);
      color: white;
    }
  }
}

.preview {
  width: 60%;
  display: flex;
  box-sizing: border-box;
  justify-content: center;
  align-items: center;
  border-radius: 8px;
  font-size: 24px;
  font-weight: 600;
  user-select: none;
  cursor: pointer;
}

.region-setting {
  width: 80%;
  margin: auto 0;
  align-items: center;

  .item-line {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px 6vw;
    margin-bottom: 15px;
  }
  .item {
    display: flex;
    height: 34px;
    align-items: center;
    justify-content: space-between;

    .right input.text-input {
      background: var(--color-secondary-bg);
      border: none;
      padding: 0 12px;
      border-radius: 6px;
      color: var(--color-text);
      font-weight: 600;
      font-size: 16px;
      width: 164px;
      height: 34px;
      text-align: center;
      box-sizing: border-box;
    }
  }

  .sperate-line {
    position: fixed;
    height: 132px;
    width: 2px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-text);
    opacity: 0.25;
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
