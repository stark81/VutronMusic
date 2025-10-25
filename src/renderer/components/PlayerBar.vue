<template>
  <div class="player">
    <div class="progress-bar">
      <vue-slider
        ref="playerBarRef"
        v-model="position"
        :min="0"
        tooltip-pos="hoverValue"
        :tooltip="hoverText"
        :max="currentTrackDuration"
        :marks="marks"
        :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
        :process-style="{ background: 'var(--color-primary)' }"
        :tooltip-style="{ background: 'var(--color-primary)' }"
        :step-style="{
          display: 'block',
          height: '6px',
          width: '6px',
          transform: 'translateY(-2px)',
          backgroundColor: 'var(--color-primary)',
          opacy: 0.8
        }"
        :height="2"
        :dot-size="10"
        @update:hover-position="handleHover"
      />
    </div>
    <div class="controls" @click="showLyrics = !showLyrics">
      <div class="left">
        <img :src="pic" loading="lazy" @click.stop="goToAlbum" />
        <div class="track-info">
          <div
            :class="['title', { haslist: hasListSource() }]"
            :title="source"
            @click.stop="hasListSource() && goToList()"
          >
            <span>{{ currentTrack?.name }}</span>
          </div>
          <div class="albumAndLyric">
            <span v-for="(ar, index) in artists" :key="ar.id" class="artist">
              <span :class="{ ar: ar.matched !== false }" @click.stop="goToArtist(ar)">
                {{ ar.name }}
              </span>
              <span v-if="index !== artists.length! - 1">, </span>
            </span>
          </div>
        </div>
      </div>
      <div class="middle">
        <div class="blank"></div>
        <div class="container">
          <button-icon
            :class="{ active: isLiked, disabled: heartDisabled }"
            :title="heartDisabled ? $t('player.noAllowCauseLocal') : $t('player.like')"
            @click.stop="likeTrack"
          >
            <svg-icon icon-class="heart-solid"></svg-icon>
          </button-icon>
          <button-icon v-show="!isPersonalFM" :title="$t('player.previous')" @click.stop="playPrev"
            ><svg-icon icon-class="previous"
          /></button-icon>
          <button-icon
            v-show="isPersonalFM"
            :title="$t('player.moveToFMTrash')"
            @click.stop="moveToFMTrash"
            ><svg-icon icon-class="thumbs-down"
          /></button-icon>
          <button-icon
            class="play"
            :title="playing ? $t('player.pause') : $t('player.play')"
            @click.stop="playOrPause"
          >
            <svg-icon :icon-class="playing ? 'pause' : 'play'"
          /></button-icon>
          <button-icon :title="$t('player.next')" @click.stop="_playNextTrack(isPersonalFM)"
            ><svg-icon icon-class="next"
          /></button-icon>
          <button-icon
            :title="$t('player.osdLyrics')"
            :class="{ active: show }"
            @click.stop="show = !show"
            ><svg-icon icon-class="osd-lyrics"
          /></button-icon>
        </div>
        <div class="blank"></div>
      </div>
      <div class="right">
        <button-icon
          :title="$t('player.nextUp')"
          :class="{
            active: route.name === 'next',
            disabled: isPersonalFM
          }"
          @click.stop="goToNextTracksPage"
          ><svg-icon icon-class="list"
        /></button-icon>
        <button-icon
          :class="{
            active: repeatMode !== 'off',
            disabled: isPersonalFM
          }"
          :title="repeatMode === 'one' ? $t('player.repeatTrack') : $t('player.repeat')"
          @click.stop="switchRepeatMode"
        >
          <svg-icon v-show="repeatMode !== 'one'" icon-class="repeat" />
          <svg-icon v-show="repeatMode === 'one'" icon-class="repeat-1" />
        </button-icon>
        <button-icon
          :class="{ active: shuffle, disabled: isPersonalFM }"
          :title="$t('player.shuffle')"
          @click.stop="shuffle = !shuffle"
          ><svg-icon icon-class="shuffle"
        /></button-icon>
        <div class="volume" @wheel="updateVolume">
          <div class="volume-slider" @click.stop>
            <slider-vue
              v-model="volume"
              :min="0"
              :max="1"
              :interval="0.01"
              direction="btt"
              :use-keyboard="true"
              :drag-on-click="false"
              :tooltip-formatter="formatVolume"
              :tooltip-style="{
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)'
              }"
              :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
              :process-style="{ background: 'var(--color-primary)' }"
              :dot-style="{ display: 'none' }"
              :height="130"
              :dot-size="12"
              :silent="true"
            ></slider-vue>
          </div>
          <button-icon
            ><svg-icon v-show="volume > 0.5" icon-class="volume" />
            <svg-icon v-show="volume === 0" icon-class="volume-mute" />
            <svg-icon v-show="volume <= 0.5 && volume !== 0" icon-class="volume-half"
          /></button-icon>
        </div>
        <button-icon
          class="lyrics-button"
          title="歌词"
          style="margin-left: 12px"
          @click.stop="showLyrics = !showLyrics"
          ><svg-icon icon-class="arrow-up"
        /></button-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SliderVue from 'vue-3-slider-component'
import VueSlider from './VueSlider.vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useDataStore } from '../store/data'
import { useOsdLyricStore } from '../store/osdLyric'
import { useNormalStateStore } from '../store/state'
import { hasListSource, getListSourcePath } from '../utils/playlist'
import { useStreamMusicStore } from '../store/streamingMusic'
import { useSettingsStore } from '../store/settings'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const playerStore = usePlayerStore()
const { _playNextTrack, moveToFMTrash, playPrev, playOrPause, switchRepeatMode } = playerStore
const {
  currentTrackDuration,
  currentTrack,
  playing,
  isPersonalFM,
  repeatMode,
  shuffle,
  seek,
  pic,
  volume,
  isLiked,
  lyrics,
  chorus,
  source
} = storeToRefs(playerStore)

const playerBarRef = ref()
const hoverX = ref('0')
const hoverText = ref('')

const osdLyric = useOsdLyricStore()
const { show } = storeToRefs(osdLyric)

const settingsStore = useSettingsStore()
const { general } = storeToRefs(settingsStore)

const stateStore = useNormalStateStore()
const { showLyrics, enableScrolling } = storeToRefs(stateStore)

const dataStore = useDataStore()
const { likeATrack } = dataStore

const streamMusicStore = useStreamMusicStore()
const { likeAStreamTrack } = streamMusicStore

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60)
  const remainingSeconds = Math.round(time % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const artists = computed(() => {
  return currentTrack.value?.artists ?? currentTrack.value?.ar
})

const position = computed({
  get() {
    return seek.value
  },
  set(value) {
    if (!general.value.jumpToLyricBegin) {
      seek.value = value
      return
    }
    const line = lyrics.value.find((l, index) => {
      const nextLine = lyrics.value[index + 1]
      if (nextLine) {
        return nextLine.start > value && l.start <= value
      } else {
        return value >= l.start && value < l.start + 10
      }
    })
    seek.value = line ? line?.start - (currentTrack.value?.offset || 0) : value
  }
})

const marks = computed(() => {
  const result: Record<string, any> = {}
  if (chorus.value === 0) return result
  result[chorus.value] = { labelStyle: { display: 'none' } }
  return result
})

const likeTrack = () => {
  if (currentTrack.value?.type === 'stream') {
    const op = currentTrack.value.starred ? 'unstar' : 'star'
    likeAStreamTrack(op, currentTrack.value)
  } else if (currentTrack.value?.matched) {
    likeATrack(currentTrack.value.id)
  }
}

const goToArtist = (artist: any) => {
  if (artist.matched !== false) {
    router.push(`/artist/${artist.id}`)
  }
}

const goToAlbum = () => {
  const album = currentTrack.value?.album || currentTrack.value?.al
  if (album.matched !== false) {
    router.push(`/album/${album.id}`)
  }
}

const goToList = () => {
  const path = getListSourcePath()
  router.push(path)
}

const updateVolume = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY < 0 ? -0.02 : +0.02
  volume.value = Math.min(Math.max(volume.value + delta, 0), 1)
}

const handleHover = (position: number) => {
  if (!lyrics.value.length) {
    hoverText.value = `${Math.round(position)}`
    return
  }
  const time = formatTime(position)
  const lyric = lyrics.value.find((line, index) => {
    const next = lyrics.value[index + 1]
    if (next) {
      return next.start > position && line.start <= position
    } else {
      return position >= line.start && position < currentTrackDuration.value
    }
  })
  hoverText.value = lyric ? `[${time}] ${lyric.lyric.text}` : `${Math.round(position)}`
}

const goToNextTracksPage = () => {
  if (isPersonalFM.value) return
  route.name === 'next' ? router.go(-1) : router.push({ name: 'next' })
}

const formatVolume = computed(() => {
  return Math.round(volume.value * 100).toString()
})

const heartDisabled = computed(() => {
  return currentTrack.value?.type === 'local' && !currentTrack.value?.matched
})

watch(showLyrics, (value) => {
  enableScrolling.value = !value
})
</script>

<style scoped lang="scss">
.player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  border-top: 1px solid var(--color-border);
  backdrop-filter: saturate(180%) blur(30px);
  background-color: var(--color-navbar-bg);
  z-index: 20;
}
:deep(.progress-bar) {
  margin-top: -6px !important;
  margin-bottom: -6px !important;
  width: 100%;
  position: relative;

  .progress-tooltip {
    position: absolute;
    top: 0;
    font-size: 14px;
    left: v-bind(hoverX);
    color: white;
  }

  .progress-tooltip::before {
    content: attr(data-tip);
    background-color: rgb(from var(--color-primary) r g b / 90%);
    position: absolute;
    border-radius: 5px;
    top: -36px;
    padding: 3px 8px;
    white-space: nowrap;
    transform: translate(-50%, 0);
  }

  .progress-tooltip::after {
    content: '';
    position: absolute;
    border: 8px solid transparent;
    border-top-color: rgb(from var(--color-primary) r g b / 90%);
    transform: translate(-50%, -81%);
  }
}

.controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: 100%;
  padding: 0 44px;
  align-items: center;

  .left {
    display: flex;
    align-items: center;
    img {
      border-radius: 5px;
      height: 46px;
      width: 46px;
      object-fit: cover;
      box-shadow: 0 6px 8px -2px rgba(0, 0, 0, 0.16);
      cursor: pointer;
    }
    .track-info {
      margin-left: 16px;
    }
    .track-info .title {
      font-weight: 600;
      opacity: 0.88;
      margin-bottom: 2px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
    }
    .track-info .haslist {
      cursor: pointer;
      &:hover {
        text-decoration: underline;
      }
    }
    .albumAndLyric {
      font-size: 12px;
      opacity: 0.66;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
      .artist .ar {
        cursor: pointer;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
  .middle {
    display: flex;
    .container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0 8px;

      .play {
        .svg-icon {
          width: 24px;
          height: 24px;
        }
      }
    }
    .active .svg-icon {
      color: var(--color-primary);
    }
  }
  .right {
    display: flex;
    align-items: center;
    justify-content: flex-end;

    .volume {
      position: relative;
      .volume-slider {
        display: none;
        height: 130px;
        position: absolute;
        border-radius: 6px;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--color-secondary-bg);
        z-index: 10;
        font-size: 10px;
        padding: 12px 10px;
        box-sizing: content-box;
      }
      &:hover .volume-slider {
        display: block;
      }
    }

    .active .svg-icon {
      color: var(--color-primary);
    }
  }
}
.blank {
  flex-grow: 1;
}

.button-icon.disabled {
  cursor: default;
  opacity: 0.48;
  &:hover {
    background: none;
  }
  &:active {
    transform: unset;
  }
}
</style>
