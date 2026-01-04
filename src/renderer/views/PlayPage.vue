<template>
  <div :data-theme="theme">
    <div>
      <transition name="slide-up">
        <div v-if="showLyrics" class="player-container">
          <BackgroundPage />
          <div
            class="buttons-icons"
            :class="{ opacity: activeTheme.theme.activeLayout === 'Creative' }"
          >
            <button-icon
              v-show="tabs[tabIdx] !== 'comment'"
              class="player-button theme-button"
              @click="setThemeModal = !setThemeModal"
            >
              <SvgIcon icon-class="theme" />
            </button-icon>
            <button-icon class="player-button close-button" @click="showLyrics = !showLyrics">
              <SvgIcon icon-class="arrow-down" />
            </button-icon>
            <button-icon
              title="换场景"
              class="player-button sense-button"
              @click="showSenseSelector = true"
            >
              <SvgIcon icon-class="sense" />
            </button-icon>
            <button-icon
              class="player-button lyric-button-1"
              :title="$t('contextMenu.showLyric')"
              @click="switchCurrentTab"
            >
              <SvgIcon :icon-class="getIcon()" />
            </button-icon>
          </div>
          <CommonPlayer v-if="activeTheme.theme.activeLayout === 'Classic'" :show="tabs[tabIdx]" />
          <CreativePlayer v-else :show="tabs[tabIdx]" />
        </div>
      </transition>
    </div>
    <div>
      <ConvolverModal />
      <PitchModal />
      <PlaybackModal />
      <PlayerFontModal />
      <PlayerThemeModal />
      <BGModal />
      <BackgroundModal />
      <transition name="slide-up">
        <div v-if="showSenseSelector" class="sense-modal" @click="showSenseSelector = false">
          <div class="sense-content" @click.stop>
            <div class="sense-title" :class="{ multi: activeSense.title.length === 2 }">
              <span
                v-for="(name, idx) in activeSense.title"
                :key="name"
                :class="{ active: idx === titleIdx }"
                @click="titleIdx = idx"
                >{{ name }}</span
              >
            </div>
            <div class="sense-list">
              <template v-if="activeSense.title[titleIdx] === '切换场景'">
                <div
                  v-for="(sense, idx) in activeSense.sense"
                  :key="idx"
                  :index="idx"
                  class="sense-item"
                  :class="{
                    active: idx === activeTheme.theme.senses[activeTheme.theme.activeLayout].active
                  }"
                  @click="updateSense(idx as 0 | 1 | 2)"
                >
                  <div class="sense-active">使用中</div>
                  <img :src="senseImg(idx)" loading="lazy" />
                  <div>{{ sense.name }}</div>
                </div>
              </template>
              <template v-else>
                <div
                  v-for="ani in animation"
                  :key="ani"
                  class="sense-item"
                  :class="{
                    active: currentThemeSense?.animation[currentThemeSense.active] === ani
                  }"
                  @click="updateAnimation(ani)"
                >
                  <div class="sense-active">使用中</div>
                  <div class="ani">
                    {{ aniMap[ani] }}
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </transition>
      <ContextMenu ref="playPageContextMenu">
        <div
          v-show="activeTheme.theme.activeLayout === 'Creative'"
          class="item"
          @click="addTrackToPlaylist"
          >{{ $t('player.addToPlaylist') }}</div
        >
        <div class="item" @click="setPlaybackRateModal = true">{{
          $t('contextMenu.playBackSpeed')
        }}</div>
        <div class="item" @click="setPitchModal = true">{{ $t('contextMenu.pitch') }}</div>
        <div class="item" @click="setConvolverModal = true">{{
          $t('contextMenu.setConvolver')
        }}</div>
        <hr />
        <div class="item" @click="() => (backgroundModal.show = true)">背景设置</div>
        <div class="item" @click="setFontModal = true">{{ $t('contextMenu.setFont') }}</div>
      </ContextMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import ContextMenu from '../components/ContextMenu.vue'
import ConvolverModal from '../components/ModalConvolver.vue'
import PlaybackModal from '../components/ModalPlayback.vue'
import PitchModal from '../components/ModalPitch.vue'
import PlayerThemeModal from '../components/ModalPlayerTheme.vue'
import PlayerFontModal from '../components/ModalPlayerFont.vue'
import BGModal from '../components/ModalCustomize.vue'
import BackgroundModal from '../components/ModalBackground.vue'
import CommonPlayer from '../components/CommonPlayer.vue'
import CreativePlayer from '../components/CreativePlayer.vue'
import BackgroundPage from '../components/BackgroundPage.vue'
import ButtonIcon from '../components/ButtonIcon.vue'
import SvgIcon from '../components/SvgIcon.vue'
import { useNormalStateStore } from '../store/state'
import { usePlayerStore } from '../store/player'
import { usePlayerThemeStore } from '../store/playerTheme'
import { storeToRefs } from 'pinia'
import { ref, provide, computed, watch } from 'vue'
import { TrackSourceType } from '@/types/music.d'
import { AniName } from '@/types/theme'

const playPageContextMenu = ref<InstanceType<typeof ContextMenu>>()

const stateStore = useNormalStateStore()
const {
  showLyrics,
  setThemeModal,
  setConvolverModal,
  setPitchModal,
  setFontModal,
  setPlaybackRateModal,
  backgroundModal,
  addTrackToPlaylistModal
} = storeToRefs(stateStore)

const playerStore = usePlayerStore()
const { currentTrack } = storeToRefs(playerStore)

const playerThemeStore = usePlayerThemeStore()
const { activeTheme, activeBG, senses } = storeToRefs(playerThemeStore)

const showSenseSelector = ref(false)
const tabIdx = ref(0)

const titleIdx = ref(0)

const sensesAndAni = {
  Classic: {
    title: ['切换场景'],
    sense: [
      { name: '默认', img: 'common' },
      { name: '圆形封面', img: 'circle' },
      { name: '旋转封面', img: 'rotate' }
    ]
  },
  Creative: {
    title: ['切换场景', '切换动画'],
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

const activeSense = computed(() => {
  return sensesAndAni[activeTheme.value.theme.activeLayout]
})

const currentThemeSense = computed(() => {
  if (activeTheme.value.theme.activeLayout === 'Classic') return null
  return senses.value[activeTheme.value.theme.activeLayout]
})

const theme = computed(() => {
  let appearance = activeBG.value.color
  if (appearance === 'auto' || appearance === undefined) {
    appearance = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return appearance
})

const animation: AniName[] = [
  'hingeFlyIn',
  'focusRise',
  'scatterThrow',
  'flipReveal',
  'waveDrift',
  'splitAndMerge'
]

const aniMap = {
  hingeFlyIn: '铰链翻入',
  focusRise: '聚焦上浮',
  scatterThrow: '抛散离场',
  flipReveal: '翻转显现',
  waveDrift: '波浪浮现',
  splitAndMerge: '双向聚拢'
}

const tabs = computed(() => {
  let result: ('fullLyric' | 'pickLyric' | 'comment')[] = []
  if (activeTheme.value.theme.activeLayout === 'Classic') {
    result = ['fullLyric']
  } else {
    result = ['pickLyric', 'fullLyric']
  }
  if (currentTrack.value?.matched) {
    result.push('comment')
  }
  return result
})

const addTrackToPlaylist = () => {
  if (!currentTrack.value) return
  addTrackToPlaylistModal.value = {
    show: true,
    selectedTrackID: [currentTrack.value.id],
    type:
      currentTrack.value.type === 'stream'
        ? (currentTrack.value.source as TrackSourceType)
        : (currentTrack.value.type as TrackSourceType)
  }
}

provide('playPageContextMenu', playPageContextMenu)

const switchCurrentTab = () => {
  tabIdx.value = (tabIdx.value + 1) % tabs.value.length
}

const getIcon = () => {
  if (tabs.value[tabIdx.value] === 'pickLyric') {
    return 'lyric-half'
  } else if (tabs.value[tabIdx.value] === 'fullLyric') {
    return 'lyric'
  } else {
    return 'comment'
  }
}

const updateSense = async (idx: 0 | 1 | 2) => {
  const theme = activeTheme.value.theme
  theme.senses[theme.activeLayout].active = idx
}

const senseImg = (index: number) => {
  return new URL(`../assets/images/${activeSense.value.sense[index].img}.png`, import.meta.url).href
}

const updateAnimation = (name: AniName) => {
  if (!currentThemeSense.value) return
  currentThemeSense.value.animation[currentThemeSense.value.active] = name
}

watch(showSenseSelector, () => {
  titleIdx.value = 0
})

watch(
  () => activeTheme.value.theme.activeLayout,
  () => {
    tabIdx.value = 0
    titleIdx.value = 0
  }
)
</script>
<style scoped lang="scss">
.player-container {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  background-color: var(--bg-color);
}

.buttons-icons {
  width: 100%;
  height: 100%;
  color: var(--color-text);

  .theme-button {
    position: fixed;
    top: 24px;
    right: 74px;
  }

  .close-button {
    position: fixed;
    top: 24px;
    right: 24px;
  }

  .sense-button {
    position: fixed;
    bottom: 124px;
    right: 24px;
  }

  .lyric-button-1 {
    position: fixed;
    bottom: 60px;
    right: 24px;
  }

  .player-button {
    z-index: 300;
    border-radius: 0.75rem;
    height: 44px;
    width: 44px;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0.48;
    transition: 0.2s;
    -webkit-app-region: no-drag;

    .svg-icon {
      color: var(--color-text);
      height: 22px;
      width: 22px;
    }

    &:hover {
      background: var(--color-secondary-bg-for-transparent);
      opacity: 0.88;
    }
  }
}

.buttons-icons.opacity {
  .player-button {
    opacity: 0.88;
  }
}

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

    &:first-child {
      margin-right: 20px;
      padding-right: 20px;
      border-right: 2px solid color-mix(in srgb, var(--color-text), transparent 40%);
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

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
