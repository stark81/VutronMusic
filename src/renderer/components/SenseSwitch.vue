<template>
  <Transition name="slide-up">
    <div v-if="modelValue" class="sense-modal" @click="updateShow(false)">
      <div v-if="activeSense.title[titleIdx] === '区域设置'" class="pre-region">
        <div class="title" :style="titleStyle"></div>
        <div class="content" :style="contentStyle"></div>
      </div>
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
          <template v-if="['封面类型', '布局设置'].includes(activeSense.title[titleIdx])">
            <div
              v-for="(sense, idx) in activeSense.sense"
              :key="idx"
              :index="idx"
              class="sense-item"
              :class="{
                active: idx === currentSenses[type].active
              }"
              @click="updateSense(idx as 0 | 1 | 2)"
            >
              <div class="sense-active">使用中</div>
              <img :src="senseImg(idx)" loading="lazy" />
              <div>{{ sense.name }}</div>
            </div>
          </template>
          <template v-else-if="activeSense.title[titleIdx] === '切换动画'">
            <div
              v-for="ani in animations"
              :key="ani.ani"
              class="sense-item"
              :class="{
                active:
                  type !== 'Classic' &&
                  currentSenses[type].animation[currentSenses[type].active] === ani.ani
              }"
              @click="updateAnimation(ani.ani)"
            >
              <div class="sense-active">使用中</div>
              <div class="ani">{{ ani.name }}</div>
            </div>
          </template>
          <template v-else>
            <div v-if="type === 'Creative'" class="region-setting">
              <div class="sperate-line"></div>
              <div class="item-line">
                <div class="item">
                  <div class="title">歌名位置(上):</div>
                  <div class="right">
                    <input
                      v-model="currentSenses[type].region.titleTop"
                      type="text"
                      class="text-input"
                      placeholder="3.9vh"
                    />
                  </div>
                </div>
              </div>
              <div class="item-line">
                <div class="item">
                  <div class="title">歌词位置(上):</div>
                  <div class="right">
                    <input
                      v-model="currentSenses[type].region.top"
                      type="text"
                      class="text-input"
                      placeholder="15vh"
                    />
                  </div>
                </div>
                <div class="item">
                  <div class="title">歌词位置(下):</div>
                  <div class="right">
                    <input
                      v-model="currentSenses[type].region.bottom"
                      type="text"
                      class="text-input"
                      placeholder="15vh"
                    />
                  </div>
                </div>
                <div class="item">
                  <div class="title">歌词位置(左):</div>
                  <div class="right">
                    <input
                      v-model="currentSenses[type].region.left"
                      type="text"
                      class="text-input"
                      placeholder="15vw"
                    />
                  </div>
                </div>
                <div class="item">
                  <div class="title">歌词位置(右):</div>
                  <div class="right">
                    <input
                      v-model="currentSenses[type].region.right"
                      type="text"
                      class="text-input"
                      placeholder="15vw"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePlayerThemeStore } from '../store/playerTheme'
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
    title: ['布局设置', '切换动画', '区域设置'],
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

const animations: { name: string; img: ''; ani: AniName }[] = [
  { name: '铰链翻入', img: '', ani: 'hingeFlyIn' },
  { name: '聚焦上浮', img: '', ani: 'focusRise' },
  { name: '抛散离场', img: '', ani: 'scatterThrow' },
  { name: '翻转显现', img: '', ani: 'flipReveal' },
  { name: '波浪浮现', img: '', ani: 'waveDrift' },
  { name: '双向聚拢', img: '', ani: 'splitAndMerge' }
]

const activeSense = computed(() => {
  return senses[props.type]
})

const titleStyle = computed(() => {
  if (props.type !== 'Creative') return {}
  const sense = currentSenses.value[props.type]
  const pos = sense.region
  const result: Record<string, any> = {
    left: pos.left,
    right: pos.right,
    top: pos.titleTop
  }
  result.height = '50px'
  result.position = 'fixed'
  result.background = 'var(--color-primary)'
  result.opacity = 0.5
  return result
})

const contentStyle = computed(() => {
  if (props.type !== 'Creative') return {}
  const sense = currentSenses.value[props.type]
  const pos = sense.region
  const result: Record<string, any> = {
    left: pos.left,
    right: pos.right,
    top: pos.top,
    bottom: pos.bottom
  }
  result.position = 'fixed'
  result.background = 'var(--color-primary)'
  result.opacity = 0.5
  return result
})

const updateShow = (value: boolean) => {
  $emit('update:modelValue', value)
  titleIdx.value = 0
}

const updateSense = async (idx: 0 | 1 | 2) => {
  const theme = activeTheme.value.theme
  theme.senses[theme.activeLayout].active = idx
}

const updateAnimation = (name: AniName) => {
  if (props.type === 'Classic') return
  currentSenses.value[props.type].animation[currentSenses.value[props.type].active] = name
}

const senseImg = (index: number) => {
  return new URL(`../assets/images/${activeSense.value.sense[index].img}.png`, import.meta.url).href
}
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
