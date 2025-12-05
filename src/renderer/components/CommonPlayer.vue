<template>
  <div class="play-page">
    <div class="lyric-container" :class="{ isMobile, 'no-lyric': noLyric && show === 'fullLyric' }">
      <div class="left-side">
        <div
          class="cover"
          :class="{
            rotate: senses[activeTheme.theme.activeLayout as 'Classic'].cover === 2,
            circle: senses[activeTheme.theme.activeLayout as 'Classic'].cover === 1,
            paused: !playing
          }"
        >
          <div class="img-wrap">
            <img :src="pic" loading="lazy" />
          </div>
          <div class="shadow" :style="{ backgroundImage: `url(${pic})` }"></div>
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
                  <label v-show="hasTLyric" :class="{ active: nTranslationMode === 'tlyric' }"
                    >译</label
                  >
                  <label v-if="hasTLyric && hasRLyric" class="m-label">|</label>
                  <label v-show="hasRLyric" :class="{ active: nTranslationMode === 'rlyric' }"
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
                <button-icon class="button" @click="addTrackToPlaylist"
                  ><SvgIcon icon-class="plus"
                /></button-icon>
                <button-icon class="button" :prevent-blur="true" @click="showContextMenu">
                  <SvgIcon icon-class="options" />
                </button-icon>
              </div>
            </div>
          </div>
          <div class="progress-bar">
            <div class="time">{{ formatTime(position) || '0:00' }}</div>
            <div class="slider">
              <vue-slider
                v-model="position"
                :min="0"
                :max="currentTrackDuration"
                :dot-size="12"
                :height="4"
                :marks="marks"
                :step-style="{
                  display: 'block',
                  height: '8px',
                  width: '8px',
                  transform: 'translateY(-2px)',
                  backgroundColor: 'var(--color-text)',
                  opacy: 0.8
                }"
                :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
                :process-style="{ backgroundColor: 'var(--color-text)', opacity: 0.8 }"
                tooltip="none"
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
                :dot-size="12"
                :height="4"
                :rail-style="{ backgroundColor: 'rgba(128, 128, 128, 0.18)' }"
                :process-style="{ backgroundColor: 'var(--color-text)', opacity: 0.8 }"
                tooltip="none"
              />
            </div>
            <div class="time">
              <button-icon> <svg-icon icon-class="volume" /></button-icon
            ></div>
          </div>
        </div>
      </div>
      <div class="right-side" @mouseenter="hover = true" @mouseleave="hover = false">
        <LyricPage
          v-if="show === 'fullLyric'"
          :text-align="isMobile ? 'center' : align"
          :container-width="isMobile ? '50vw' : '90%'"
          :container-margin="isMobile ? '0 auto' : '0 0 0 auto'"
          :hover="hover"
          :offset-padding="isMobile ? '10vw' : '0'"
          :margin="isMobile ? '4vh' : '40vh'"
        />
        <Comment
          v-else
          :id="currentTrack!.id"
          type="music"
          :style="{
            width: isMobile ? '50vw' : '100%',
            padding: isMobile ? '0' : '40px 0 10px 4vh'
          }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ButtonIcon from './ButtonIcon.vue'
import SvgIcon from './SvgIcon.vue'
import VueSlider from './VueSlider.vue'
import LyricPage from './LyricPage.vue'
import Comment from './CommentPage.vue'
import { usePlayerStore } from '../store/player'
import ContextMenu from './ContextMenu.vue'
import { useSettingsStore } from '../store/settings'
import { hasListSource, getListSourcePath } from '../utils/playlist'
import { useNormalStateStore } from '../store/state'
import { useStreamMusicStore } from '../store/streamingMusic'
import { useDataStore } from '../store/data'
import { usePlayerThemeStore } from '../store/playerTheme'
import { TranslationMode, TrackSourceType } from '@/types/music.d'

withDefaults(defineProps<{ show: 'fullLyric' | 'pickLyric' | 'comment' }>(), {
  show: 'fullLyric'
})

const router = useRouter()
const playPageContextMenu = inject('playPageContextMenu', ref<InstanceType<typeof ContextMenu>>())

const settingsStore = useSettingsStore()
const { general } = storeToRefs(settingsStore)

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
  source,
  chorus,
  repeatMode,
  pic
} = storeToRefs(playerStore)
const { playPrev, playOrPause, _playNextTrack, switchRepeatMode, moveToFMTrash } = playerStore

const playerTheme = usePlayerThemeStore()
const { activeTheme, senses } = storeToRefs(playerTheme)

const { likeATrack } = useDataStore()
const { likeAStreamTrack } = useStreamMusicStore()

const stateStore = useNormalStateStore()
const { showLyrics, addTrackToPlaylistModal } = storeToRefs(stateStore)

const isMobile = ref(false)

const align = computed(() => {
  const layout = activeTheme.value.theme.activeLayout
  const sense = senses.value[layout]
  return sense.align
})

const nTranslationMode = computed({
  get: () => {
    const layout = activeTheme.value.theme.activeLayout
    if (layout === 'Classic') {
      const sense = senses.value[layout]
      return sense.lyric.translation
    }
    return 'tlyric'
  },
  set: (value) => {
    const layout = activeTheme.value.theme.activeLayout
    if (layout !== 'Classic') return
    const sense = senses.value[layout]
    sense.lyric.translation = value
  }
})

const hasTLyric = computed(() => lyrics.value.some((l) => l.tlyric))
const hasRLyric = computed(() => lyrics.value.some((l) => l.rlyric))

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

const tags = computed(() => {
  const lst = ['none']
  if (hasTLyric.value) {
    lst.splice(1, 0, 'tlyric')
  }
  if (hasRLyric.value) {
    lst.push('rlyric')
  }
  return lst as TranslationMode[]
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
    seek.value = line?.start ?? value
  }
})

const idx = ref(tags.value.indexOf(nTranslationMode.value))
const hover = ref(false)

const formatTime = (time: number) => {
  time = Math.round(time)
  const minutes = Math.floor(time / 60)
  const remainingSeconds = Math.ceil(time % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const likeTrack = () => {
  if (currentTrack.value?.type === 'stream') {
    const op = currentTrack.value.starred ? 'unstar' : 'star'
    likeAStreamTrack(op, currentTrack.value)
  }
  if (currentTrack.value?.matched) {
    likeATrack(currentTrack.value.id)
  }
}

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

const aspect = window.matchMedia('(max-aspect-ratio: 9/10)')

aspect.addEventListener('change', (e) => (isMobile.value = e.matches))

onMounted(() => {
  isMobile.value = aspect.matches
})

onBeforeUnmount(() => {
  aspect.removeEventListener('change', (e) => (isMobile.value = e.matches))
})
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
  overflow: hidden;
  display: flex;
}

.lyric-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  padding: 0 calc((50vw - min(50vh, 33.33vw)) / 2.3);

  .left-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    transition: all 0.35s;
    z-index: 10;

    .cover {
      position: relative;
      .img-wrap img {
        height: min(50vh, 33.33vw);
        width: min(50vh, 33.33vw);
        user-select: none;
        object-fit: cover;
        border-radius: 0.75rem;
      }
      .shadow {
        position: absolute;
        top: 12px;
        height: min(50vh, 33.33vw);
        width: min(50vh, 33.33vw);
        filter: blur(16px) opacity(0.6);
        transform: scale(0.92, 0.96);
        z-index: -1;
        background-size: cover;
        border-radius: 0.75em;
      }
    }

    .cover.circle,
    .cover.rotate {
      img,
      .shadow {
        border-radius: 50%;
        will-change: transform;
      }
    }

    .cover.rotate .img-wrap {
      animation: circleRotate 15s linear infinite;
      will-change: transform;
    }

    .cover.rotate.paused .img-wrap {
      animation-play-state: paused;
    }

    .controls {
      color: var(--color-text);
      width: min(50vh, 33.33vw);
      margin-top: 3vh;
      position: relative;

      .top-part {
        display: flex;
        justify-content: space-between;
        margin-bottom: 18px;

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
      :deep(.progress-bar) {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .slider {
          flex: 1;
          padding: 0 10px;
          contain: content;
        }

        .time {
          font-size: 15px;
          font-weight: 600;
          opacity: 0.58;
          width: 34px;
          contain: content;
        }
      }
      .media-controls {
        display: flex;
        justify-content: center;
        margin: 1.9vh 0 1.1vh 0;
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
          padding: 0 2.2vw;
          display: flex;
          align-items: center;

          button {
            margin: 0 1.2vw;
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
    flex: 1;
    justify-self: center;
    align-items: center;
    height: 100vh;
    box-sizing: border-box;
    transition: all 0.35s;
  }
}

.left-side {
  padding: 0;
}
.right-side {
  flex: 0;
  padding: 0;
}

&.isMobile {
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  .left-side {
    flex: unset;
    justify-content: unset;
    padding: 0;
    margin-bottom: 4vh;

    .cover {
      img,
      .shadow {
        height: 50vw;
        width: 50vw;
      }
    }
    .controls {
      width: 50vw;
      max-width: 50vw;
    }
  }
  .right-side {
    flex: unset;
    padding: 0;
    height: max(calc(100vh - 105vw), 20vh);
    transition: all 0.35s;
  }
  &.no-lyric .right-side {
    height: 0;
    margin-top: 0;
    transition: all 0.35s;
  }
}

.lyric-container {
  &.no-lyric {
    justify-content: center;

    .left-side {
      padding: 0;
    }
    .right-side {
      flex: 0;
      padding: 0;
    }
  }

  &.isMobile {
    flex-direction: column;
    justify-content: center;
    box-sizing: border-box;
    .left-side {
      flex: unset;
      justify-content: unset;
      padding: 0;
      margin-bottom: 4vh;

      .cover {
        img,
        .shadow {
          height: 50vw;
          width: 50vw;
        }
      }
      .controls {
        width: 50vw;
        max-width: 50vw;
      }
    }
    .right-side {
      flex: unset;
      padding: 0;
      height: max(calc(100vh - 105vw), 20vh);
      transition: all 0.35s;
    }
    &.no-lyric .right-side {
      height: 0;
      margin-top: 0;
      transition: all 0.35s;
    }
  }
}

@keyframes circleRotate {
  from {
    transform: rotate(0deg) translateZ(0);
  }
  to {
    transform: rotate(360deg) translateZ(0);
  }
}
</style>
