<template>
  <div>
    <transition name="slide-up">
      <div
        v-if="showLyrics"
        class="play-page"
        :class="{ 'no-lyric': noLyric && show === 'lyric' }"
        :style="{ background }"
        data-theme="dark"
      >
        <div class="left-side">
          <div>
            <div class="cover">
              <img :src="pic" loading="lazy" />
            </div>
            <div class="controls">
              <div class="top-part">
                <div class="track-info">
                  <div
                    :class="['title', { haslist: hasListSource() }]"
                    :title="source"
                    @click="hasListSource() && goToList()"
                  >
                    <span>{{ currentTrack?.name }}</span>
                  </div>
                  <div class="subtitle">
                    <router-link
                      v-if="artist.matched !== false"
                      :to="`/artist/${artist.id}`"
                      @click="showLyrics = !showLyrics"
                      >{{ artist.name }}
                    </router-link>
                    <span v-else>{{ artist.name }}</span>
                    <span>
                      -
                      <router-link
                        v-if="album.matched !== false"
                        :to="`/album/${album.id}`"
                        @click="showLyrics = !showLyrics"
                        >{{ album.name }}
                      </router-link>
                      <span v-else>{{ album.name }}</span>
                    </span>
                  </div>
                </div>
                <div class="top-right">
                  <div class="buttons">
                    <div class="transPro" @click="switchTransitionMode">
                      <label
                        v-show="lyrics.tlyric.length"
                        :class="{ active: nTranslationMode === 'tlyric' }"
                        >译</label
                      >
                      <label v-if="lyrics.tlyric.length && lyrics.rlyric.length" class="m-label"
                        >|</label
                      >
                      <label
                        v-show="lyrics.rlyric.length"
                        :class="{ active: nTranslationMode === 'rlyric' }"
                        >音</label
                      >
                    </div>
                    <button-icon
                      :title="
                        currentTrack?.type === 'local' && currentTrack?.matched === false
                          ? $t('player.noAllowCauseLocal')
                          : $t('player.like')
                      "
                      class="button"
                      :class="{
                        disabled: currentTrack?.type === 'local' && currentTrack?.matched === false
                      }"
                      @click="likeTrack"
                    >
                      <SvgIcon :icon-class="isLiked ? 'heart-solid' : 'heart'" />
                    </button-icon>
                    <button-icon
                      class="button"
                      :title="
                        heartDisabled && show === 'lyric'
                          ? $t('player.noAllowCauseLocal')
                          : show === 'lyric'
                            ? $t('contextMenu.showComment')
                            : $t('contextMenu.showLyric')
                      "
                      :class="{ disabled: currentTrack?.matched === false && show === 'lyric' }"
                      @click="switchRightPage(show === 'lyric' ? 'comment' : 'lyric')"
                    >
                      <SvgIcon
                        class="comment"
                        :icon-class="show === 'lyric' ? 'comment' : 'lyric'"
                      />
                    </button-icon>
                    <button-icon class="button" @click="addTrackToPlaylist"
                      ><SvgIcon icon-class="plus"
                    /></button-icon>
                    <button-icon class="button" @click="showContextMenu">
                      <SvgIcon icon-class="options" />
                    </button-icon>
                  </div>
                </div>
              </div>
              <div class="progress-bar">
                <div class="time">{{ formatTime(seek) || '0:00' }}</div>
                <div class="slider">
                  <vue-slider
                    v-model="position"
                    :min="0"
                    :max="currentTrackDuration"
                    :interval="1"
                    :duration="0.5"
                    :dot-size="12"
                    :height="4"
                    :marks="marks"
                    :use-keyboard="false"
                    :drag-on-click="false"
                    :step-style="{
                      display: 'block',
                      height: '8px',
                      width: '8px',
                      transform: 'translateY(-2px)',
                      backgroundColor: 'white',
                      opacy: 0.8
                    }"
                    :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
                    :process-style="{ backgroundColor: '#eee', opacity: 0.8 }"
                    :dot-style="{ display: 'none' }"
                    tooltip="none"
                    :lazy="false"
                    :silent="true"
                  ></vue-slider>
                </div>
                <div class="time">{{ formatTime(currentTrackDuration) }}</div>
              </div>
              <div class="media-controls">
                <button-icon
                  :class="{ active: repeatMode !== 'off' }"
                  :title="repeatMode === 'one' ? $t('player.repeatTrack') : $t('player.repeat')"
                  @click="switchRepeatMode"
                >
                  <svg-icon v-show="repeatMode !== 'one'" icon-class="repeat" />
                  <svg-icon v-show="repeatMode === 'one'" icon-class="repeat-1" />
                </button-icon>
                <div class="middle">
                  <button-icon
                    v-show="!isPersonalFM"
                    :title="$t('player.previous')"
                    @click="playPrev"
                    ><svg-icon icon-class="previous"
                  /></button-icon>
                  <button-icon
                    v-show="isPersonalFM"
                    :title="$t('player.moveToFMTrash')"
                    @click="moveToFMTrash"
                    ><svg-icon icon-class="thumbs-down"
                  /></button-icon>
                  <button-icon
                    id="play"
                    :title="$t(playing ? 'player.play' : 'player.pause')"
                    @click="playOrPause"
                    ><svg-icon :icon-class="playing ? 'pause' : 'play'"
                  /></button-icon>
                  <button-icon :title="$t('player.next')" @click="_playNextTrack(isPersonalFM)"
                    ><svg-icon icon-class="next"
                  /></button-icon>
                </div>
                <button-icon :class="{ active: shuffle }" @click="shuffle = !shuffle"
                  ><svg-icon icon-class="shuffle"
                /></button-icon>
              </div>
              <div class="progress-bar">
                <div class="time"
                  ><button-icon> <svg-icon icon-class="volume-half" /></button-icon
                ></div>
                <div class="slider">
                  <VueSlider
                    v-model="volume"
                    :min="0"
                    :max="1"
                    :interval="0.01"
                    :duration="0.5"
                    :dot-size="12"
                    :height="4"
                    :use-keyboard="false"
                    :drag-on-click="false"
                    :tooltip-formatter="Math.round(volume * 100).toString()"
                    :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
                    :process-style="{ backgroundColor: '#eee', opacity: 0.8 }"
                    :dot-style="{
                      display: 'none',
                      backgroundColor: '#eee',
                      boxshadow: '0.5px 0.5px 2px 1px rgba(0, 0, 0, 0.18)'
                    }"
                    tooltip="none"
                    :silent="true"
                  />
                </div>
                <div class="time">
                  <button-icon> <svg-icon icon-class="volume" /></button-icon
                ></div>
              </div>
            </div>
          </div>
        </div>
        <div class="right-side">
          <LyricPage v-if="show === 'lyric'" />
          <Comment v-else :id="currentTrack!.id" type="music" />
        </div>
        <button-icon class="close-button" @click="showLyrics = !showLyrics">
          <SvgIcon icon-class="arrow-down" />
        </button-icon>
      </div>
    </transition>
  </div>
  <div>
    <ConvolverModal />
    <PlaybackModal />
    <ContextMenu ref="playPageContextMenu">
      <div class="item" @click="setPlaybackRateModal = true">{{
        $t('contextMenu.playBackSpeed')
      }}</div>
      <div class="item" @click="setConvolverModal = true">{{ $t('contextMenu.setConvolver') }}</div>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import ButtonIcon from '../components/ButtonIcon.vue'
import VueSlider from 'vue-3-slider-component'
import SvgIcon from '../components/SvgIcon.vue'
import ContextMenu from '../components/ContextMenu.vue'
import ConvolverModal from '../components/ConvolverModal.vue'
import PlaybackModal from '../components/PlaybackModal.vue'
import LyricPage from '../components/LyricPage.vue'
import Comment from '../components/CommentPage.vue'
import { hasListSource, getListSourcePath } from '../utils/playlist'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore, TranslationMode } from '../store/settings'
import { usePlayerStore } from '../store/player'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'
import { ref, computed, watch, provide, toRefs } from 'vue'
import { useRouter } from 'vue-router'
import { useStreamMusicStore } from '../store/streamingMusic'

const router = useRouter()
const playPageContextMenu = ref<InstanceType<typeof ContextMenu>>()
const show = ref('lyric')

const stateStore = useNormalStateStore()
const { showLyrics, setConvolverModal, setPlaybackRateModal, addTrackToPlaylistModal } =
  storeToRefs(stateStore)

const settingsStore = useSettingsStore()
const { normalLyric } = storeToRefs(settingsStore)
const { nTranslationMode } = toRefs(normalLyric.value)

const playerStore = usePlayerStore()
const {
  currentTrack,
  seek,
  noLyric,
  lyrics,
  volume,
  currentTrackDuration,
  isPersonalFM,
  playing,
  shuffle,
  isLiked,
  color,
  color2,
  pic,
  source,
  chorus,
  repeatMode
} = storeToRefs(playerStore)
const { playPrev, playOrPause, _playNextTrack, switchRepeatMode, moveToFMTrash } = playerStore
const { likeATrack } = useDataStore()

const { likeAStreamTrack } = useStreamMusicStore()

const tags = computed(() => {
  const lst = ['none']
  if (lyrics.value.tlyric.length) {
    lst.splice(1, 0, 'tlyric')
  }
  if (lyrics.value.rlyric.length) {
    lst.push('rlyric')
  }
  return lst as TranslationMode[]
})

const position = computed({
  get() {
    return seek.value
  },
  set(value) {
    const line = lyrics.value.lyric.find((l, index) => {
      const nextLine = lyrics.value.lyric[index + 1]
      if (nextLine) {
        return nextLine.time > value && l.time <= value
      } else {
        return value >= l.time && value < l.time + 10
      }
    })
    seek.value = line?.time ?? value
  }
})

const idx = ref(tags.value.indexOf(nTranslationMode.value))

const likeTrack = () => {
  if (currentTrack.value?.type === 'stream') {
    const op = currentTrack.value.starred ? 'unstar' : 'star'
    likeAStreamTrack(op, currentTrack.value.id)
  }
  if (currentTrack.value?.matched) {
    likeATrack(currentTrack.value.id)
  }
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60)
  const remainingSeconds = Math.ceil(time % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const background = computed(() => {
  return `linear-gradient(to top left, ${color.value}, ${color2.value})`
})

const heartDisabled = computed(() => {
  return currentTrack.value?.type !== 'online' && !currentTrack.value?.matched
})

const artist = computed(() => {
  return currentTrack.value?.artists ? currentTrack.value.artists[0] : currentTrack.value?.ar[0]
})

const album = computed(() => {
  return currentTrack.value?.album ?? currentTrack.value?.al
})

const marks = computed(() => {
  const result: Record<string, any> = {}
  if (chorus.value === 0) return result
  result[chorus.value.toString()] = { labelStyle: { display: 'none' } }
  return result
})

watch(showLyrics, (value) => {
  if (!value) {
    show.value = 'lyric'
  }
})

const addTrackToPlaylist = () => {
  if (!currentTrack.value) return
  addTrackToPlaylistModal.value = {
    show: true,
    selectedTrackID: [currentTrack.value.id],
    type: currentTrack.value.type!
  }
}

const switchTransitionMode = () => {
  idx.value = (idx.value + 1) % tags.value.length
  const value = tags.value[idx.value] as TranslationMode
  nTranslationMode.value = value
}

const goToList = () => {
  const path = getListSourcePath()
  router.push(path)
  showLyrics.value = false
}

const showContextMenu = (e: MouseEvent): void => {
  playPageContextMenu.value?.openMenu(e)
}

const switchRightPage = (name: string) => {
  if (show.value === 'comment' || currentTrack.value?.matched) {
    show.value = name
  }
}

provide('show', show)
</script>

<style scoped lang="scss">
.play-page {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: 100;
  color: var(--color-text);
  overflow-y: hidden;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.play-page.no-lyric {
  .left-side {
    transition: all 0.5s;
    transform: translateX(25vh);
    padding-right: 0;
  }
}

.left-side {
  display: flex;
  justify-content: flex-end;
  padding-right: 8vh;
  width: 50vw;
  align-items: center;
  transition: all 0.5s;
  z-index: 10;

  .cover {
    position: relative;
    img {
      height: 54vh;
      width: 54vh;
      user-select: none;
      object-fit: cover;
      border-radius: 0.75rem;
    }
  }

  .controls {
    color: var(--color-text);
    max-width: 54vh;
    margin-top: 20px;
    position: relative;

    .top-part {
      display: flex;
      justify-content: space-between;

      .title {
        // margin-top: 8px;
        font-size: 20px;
        font-weight: 600;
        opacity: 0.88;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 1;
        line-clamp: 1;
        overflow: hidden;
      }
      .haslist {
        cursor: pointer;
        &:hover {
          text-decoration: underline;
        }
      }
      .subtitle {
        // margin-top: 4px;
        font-size: 14px;
        opacity: 0.7;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 1;
        line-clamp: 1;
        overflow: hidden;
      }

      .top-right {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .buttons {
          height: 34px;
          display: flex;
          justify-content: space-between;
          button {
            margin: 0 0 0 4px;
          }
          .svg-icon {
            height: 18px;
            width: 18px;
          }
          .comment {
            height: 22px;
            width: 22px;
          }
        }

        .transPro {
          cursor: pointer;
          line-height: 34px;
          padding: 0 6px;
          margin: 0 2px;
          display: flex;

          label {
            cursor: pointer;
            opacity: 0.5;
          }
          .active {
            opacity: 0.95;
          }
          .m-label {
            margin: 0 2px;
          }
        }
      }
    }
    .progress-bar {
      margin-top: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .slider {
        flex: 1;
        padding: 0 10px;
      }

      .time {
        font-size: 15px;
        font-weight: 600;
        opacity: 0.58;
        width: 34px;
      }
    }
    .media-controls {
      display: flex;
      justify-content: center;
      margin-top: 18px;
      align-items: center;

      .svg-icon {
        opacity: 0.38;
        height: 14px;
        width: 14px;
      }

      .active .svg-icon {
        opacity: 0.88;
      }

      .middle {
        padding: 0 16px;
        display: flex;
        align-items: center;

        button {
          margin: 0 8px;
        }

        button#play .svg-icon {
          height: 28px;
          width: 28px;
          padding: 2px;
        }

        .svg-icon {
          opacity: 0.88;
          height: 22px;
          width: 22px;
        }
      }
    }
  }
}

.right-side {
  max-width: 50vw;
}

.close-button {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 300;
  border-radius: 0.75rem;
  height: 44px;
  width: 44px;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0.28;
  transition: 0.2s;
  -webkit-app-region: no-drag;

  .svg-icon {
    color: var(--color-text);
    // padding-top: 5px;
    height: 22px;
    width: 22px;
  }

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
    opacity: 0.88;
  }
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

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
