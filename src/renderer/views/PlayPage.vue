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
                    <button-icon
                      :title="heartDisabled ? $t('player.noAllowCauseLocal') : $t('player.like')"
                      class="button"
                      :class="{ disabled: currentTrack?.matched === false }"
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
                <span>{{ formatTime(seek) || '0:00' }}</span>
                <div class="slider">
                  <vue-slider
                    v-model="seek"
                    :min="0"
                    :max="currentTrackDuration"
                    :interval="1"
                    :duration="0.5"
                    :dot-size="12"
                    :height="4"
                    :use-keyboard="false"
                    :drag-on-click="false"
                    :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
                    :process-style="{ backgroundColor: '#eee', opacity: 0.8 }"
                    :dot-style="{
                      display: 'none',
                      backgroundColor: '#eee',
                      boxshadow: '0.5px 0.5px 2px 1px rgba(0, 0, 0, 0.18)'
                    }"
                    tooltip="none"
                    :lazy="true"
                    :silent="true"
                  ></vue-slider>
                </div>
                <span>{{ formatTime(currentTrackDuration) }}</span>
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
                <button-icon> <svg-icon icon-class="volume-half" /></button-icon>
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
                <button-icon> <svg-icon icon-class="volume" /></button-icon>
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
import { usePlayerStore } from '../store/player'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'
import { ref, computed, watch, provide } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const playPageContextMenu = ref<InstanceType<typeof ContextMenu>>()
const show = ref('lyric')

const stateStore = useNormalStateStore()
const { showLyrics, setConvolverModal, setPlaybackRateModal, addTrackToPlaylistModal } =
  storeToRefs(stateStore)

const playerStore = usePlayerStore()
const {
  currentTrack,
  seek,
  noLyric,
  volume,
  currentTrackDuration,
  isPersonalFM,
  playing,
  shuffle,
  isLiked,
  color,
  color2,
  pic,
  repeatMode,
  playlistSource
} = storeToRefs(playerStore)
const { playPrev, playOrPause, _playNextTrack, switchRepeatMode, moveToFMTrash } = playerStore
const { likeATrack } = useDataStore()

const likeTrack = () => {
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
  return currentTrack.value?.isLocal && !currentTrack.value?.matched
})

const artist = computed(() => {
  return currentTrack.value?.artists ? currentTrack.value.artists[0] : currentTrack.value?.ar[0]
})

const source = computed(() => {
  const sourceMap = {
    localTrack: '本地音乐',
    netease: '网易云音乐',
    qq: 'QQ音乐',
    kugou: '酷狗音乐',
    kuwo: '酷我音乐',
    bilibili: '哔哩哔哩',
    pyncmd: '第三方网易云音乐',
    migu: '咪咕音乐'
  }
  return currentTrack.value
    ? `${currentTrack.value.name}, 音源：${sourceMap[currentTrack.value.source!]}`
    : ''
})

const album = computed(() => {
  return currentTrack.value?.album ?? currentTrack.value?.al
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
    isLocal: playlistSource.value.type.includes('local')
  }
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

  img {
    height: 54vh;
    width: 54vh;
    user-select: none;
    object-fit: cover;
    border-radius: 0.75rem;
  }
  .controls {
    color: var(--color-text);
    margin-top: 20px;
    position: relative;
  }
  .top-part {
    width: 54vh;
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
    }
  }
  .progress-bar {
    margin-top: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .slider {
      width: 100%;
      flex-grow: grow;
      padding: 0 10px;
    }

    span {
      font-size: 15px;
      font-weight: 600;
      opacity: 0.58;
      // min-width: 28px;
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
  transition: all 0.4s;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
