<template>
  <div class="player">
    <div class="progress-bar">
      <vue-slider
        v-model="seek"
        :min="0"
        :max="currentTrackDuration"
        :interval="1"
        :drag-on-click="false"
        :use-keyboard="false"
        :tooltip-formatter="formatTime"
        :tooltip-style="{
          backgroundColor: 'var(--color-primary)',
          borderColor: 'var(--color-primary)'
        }"
        :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
        :process-style="{ background: 'var(--color-primary)' }"
        :dot-style="{ display: 'none' }"
        :height="2"
        :dot-size="10"
        :lazy="false"
        :silent="true"
      />
    </div>
    <div class="controls">
      <div class="left">
        <img :src="pic" loading="lazy" @click="goToAlbum" />
        <div class="track-info">
          <div
            :class="['title', { haslist: hasListSource() }]"
            :title="source"
            @click="hasListSource() && goToList()"
          >
            <span>{{ currentTrack?.name }}</span>
          </div>
          <div class="albumAndLyric">
            <span v-for="(ar, index) in artists" :key="ar.id" class="artist">
              <span :class="{ ar: ar.matched !== false }" @click="goToArtist(ar)">
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
            @click="likeTrack"
          >
            <svg-icon icon-class="heart-solid"></svg-icon>
          </button-icon>
          <button-icon v-show="!isPersonalFM" :title="$t('player.previous')" @click="playPrev"
            ><svg-icon icon-class="previous"
          /></button-icon>
          <button-icon
            v-show="isPersonalFM"
            :title="$t('player.moveToFMTrash')"
            @click="moveToFMTrash"
            ><svg-icon icon-class="thumbs-down"
          /></button-icon>
          <button-icon
            class="play"
            :title="playing ? $t('player.pause') : $t('player.play')"
            @click="playOrPause"
          >
            <svg-icon :icon-class="playing ? 'pause' : 'play'"
          /></button-icon>
          <button-icon :title="$t('player.next')" @click="_playNextTrack(isPersonalFM)"
            ><svg-icon icon-class="next"
          /></button-icon>
          <button-icon
            :title="$t('player.osdLyrics')"
            :class="{ active: show }"
            @click="show = !show"
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
          @click="goToNextTracksPage"
          ><svg-icon icon-class="list"
        /></button-icon>
        <button-icon
          :class="{
            active: repeatMode !== 'off',
            disabled: isPersonalFM
          }"
          :title="repeatMode === 'one' ? $t('player.repeatTrack') : $t('player.repeat')"
          @click="switchRepeatMode"
        >
          <svg-icon v-show="repeatMode !== 'one'" icon-class="repeat" />
          <svg-icon v-show="repeatMode === 'one'" icon-class="repeat-1" />
        </button-icon>
        <button-icon
          :class="{ active: shuffle, disabled: isPersonalFM }"
          :title="$t('player.shuffle')"
          @click="shuffle = !shuffle"
          ><svg-icon icon-class="shuffle"
        /></button-icon>
        <div class="volume">
          <div class="volume-slider">
            <vue-slider
              v-model="volume"
              :min="0"
              :max="1"
              :interval="0.01"
              direction="btt"
              :use-keyboard="false"
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
            ></vue-slider>
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
          @click="showLyrics = !showLyrics"
          ><svg-icon icon-class="arrow-up"
        /></button-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import VueSlider from 'vue-3-slider-component'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useDataStore } from '../store/data'
import { useOsdLyricStore } from '../store/osdLyric'
import { useNormalStateStore } from '../store/state'
import { hasListSource, getListSourcePath } from '../utils/playlist'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import { computed, watch } from 'vue'
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
  volume,
  isLiked,
  pic,
  source
} = storeToRefs(playerStore)

const osdLyric = useOsdLyricStore()
const { show } = storeToRefs(osdLyric)

const stateStore = useNormalStateStore()
const { showLyrics, enableScrolling } = storeToRefs(stateStore)

const dataStore = useDataStore()
const { liked } = storeToRefs(dataStore)
const { likeATrack } = dataStore

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60)
  const remainingSeconds = Math.ceil(seek.value % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const artists = computed(() => {
  return currentTrack.value?.artists ?? currentTrack.value?.ar
})

const likeTrack = () => {
  if (currentTrack.value?.matched) {
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

const goToNextTracksPage = () => {
  if (isPersonalFM.value) return
  route.name === 'next' ? router.go(-1) : router.push({ name: 'next' })
}

const formatVolume = computed(() => {
  return Math.round(volume.value * 100).toString()
})

const heartDisabled = computed(() => {
  return currentTrack.value?.type !== 'online' && !currentTrack.value?.matched
})

watch(showLyrics, (value) => {
  enableScrolling.value = !value
})

watch(
  () => liked.value.songs.includes(currentTrack.value?.id),
  (value) => {
    isLiked.value = value
  }
)
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
  z-index: 2;
}
.progress-bar {
  margin-top: -6px !important;
  margin-bottom: -6px !important;
  width: 100%;
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
        position: absolute;
        border-radius: 6px;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--color-secondary-bg);
        transition: all 0.3s;
        z-index: 10;
        font-size: 10px;
        padding: 12px 10px;
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
