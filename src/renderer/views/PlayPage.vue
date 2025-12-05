<template>
  <div>
    <transition name="slide-up">
      <div v-if="showLyrics" class="player-container">
        <CommonPlayer v-if="currentPlayerTheme === 'common'" />
        <LottiePlayer v-else-if="currentPlayerTheme === 'creative'" />
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
    <ContextMenu ref="playPageContextMenu">
      <div v-show="currentPlayerTheme === 'creative'" class="item" @click="addTrackToPlaylist">{{
        $t('player.addToPlaylist')
      }}</div>
      <div v-show="currentPlayerTheme === 'creative'" class="item" @click="setFontModal = true">{{
        $t('contextMenu.setFont')
      }}</div>
      <div class="item" @click="setPlaybackRateModal = true">{{
        $t('contextMenu.playBackSpeed')
      }}</div>
      <div class="item" @click="setPitchModal = true">{{ $t('contextMenu.pitch') }}</div>
      <div class="item" @click="setConvolverModal = true">{{ $t('contextMenu.setConvolver') }}</div>
      <div v-if="lyricBackground === 'customize'" class="item" @click="setBGModal = true">{{
        $t('contextMenu.setLyricBG')
      }}</div>
    </ContextMenu>
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
import CommonPlayer from '../components/CommonPlayer.vue'
import LottiePlayer from '../components/CreativePlayer.vue'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import { ref, watch, provide, computed } from 'vue'
import { TrackSourceType } from '@/types/music.d'

const playPageContextMenu = ref<InstanceType<typeof ContextMenu>>()
const show = ref('lyric')

const stateStore = useNormalStateStore()
const {
  showLyrics,
  setConvolverModal,
  setPitchModal,
  setFontModal,
  setPlaybackRateModal,
  setBGModal,
  addTrackToPlaylistModal
} = storeToRefs(stateStore)

const settingsStore = useSettingsStore()
const { playerTheme, general, normalLyric } = storeToRefs(settingsStore)

const playerStore = usePlayerStore()
const { currentTrack } = storeToRefs(playerStore)

const currentPlayerTheme = computed(
  () =>
    Object.entries(playerTheme.value).find(([_, items]) => items.some((item) => item.selected))?.[0]
)

const currentBG = computed(() => normalLyric.value.customBackground.find((bg) => bg.active)!)

const lyricBackground = computed(() => {
  if (general.value.lyricBackground === 'customize') {
    return currentBG.value.source ? general.value.lyricBackground : general.value.savedBackground
  }
  return general.value.lyricBackground
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

watch(showLyrics, (value) => {
  if (value) {
    show.value = 'lyric'
  }
})

provide('playPageContextMenu', playPageContextMenu)
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

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
