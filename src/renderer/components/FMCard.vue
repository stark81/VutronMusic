<template>
  <div class="fm" :style="{ background }" data-theme="dark">
    <img class="cover" :src="image" loading="lazy" @click="goToAlbum" />
    <div class="right-part">
      <div class="info">
        <div class="title">{{ track?.name }}</div>
        <div class="artist"><ArtistsInLine :artists="artists" /></div>
      </div>
      <div class="controls">
        <div class="buttons">
          <button-icon title="不喜欢" @click="moveToFMTrash">
            <svg-icon id="thumbs-down" icon-class="thumbs-down" />
          </button-icon>
          <button-icon
            :title="$t(isPlaying ? 'player.pause' : 'player.play')"
            class="play"
            @click="handlePlay"
          >
            <svg-icon :icon-class="isPlaying ? 'pause' : 'play'" />
          </button-icon>
          <button-icon :title="$t('player.next')" @click="playNext(true)">
            <svg-icon icon-class="next" />
          </button-icon>
        </div>
        <div class="card-name"><svg-icon icon-class="fm" />私人FM</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ButtonIcon from './ButtonIcon.vue'
import ArtistsInLine from './ArtistsInLine.vue'
import SvgIcon from './SvgIcon.vue'
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { usePluginMusic } from '../store/pluginMusic'
import { useRouter } from 'vue-router'
import { Vibrant } from 'node-vibrant/browser'
import Color from 'color'
import { Track } from '@/types/plugin'

const router = useRouter()
const playerStore = usePlayerStore()
const { moveToFMTrash, playPersonalFM, playNext, playOrPause } = playerStore
const { currentTrack, fmTracks, playing, isPersonalFM } = storeToRefs(playerStore)

const { pluginMethodCall } = usePluginMusic()

const handlePlay = () => {
  if (isPersonalFM.value && playing.value) {
    playOrPause()
  } else {
    playPersonalFM(true)
  }
}

const background = ref<string>()

const track = computed(() => {
  if (isPersonalFM.value) {
    return currentTrack.value
  }
  return fmTracks.value[0]
})
const isPlaying = computed(() => playing.value && isPersonalFM.value)
const artists = computed(() => track.value?.artists || [])
const image = ref(track.value?.picUrl || '')

const getColor = async (track: Track) => {
  const { data: cover } = await pluginMethodCall(track.pluginId, 'resizePicUrl', {
    url: track.picUrl,
    size: 512
  })
  image.value = cover

  Vibrant.from(cover)
    .getPalette()
    .then((palette) => {
      const swatch = palette.DarkMuted
      if (swatch) {
        const originColor = Color.rgb(swatch.rgb)
        const color = originColor.darken(0.1).rgb().string()
        const color2 = originColor.lighten(0.28).rotate(-30).rgb().string()
        background.value = `linear-gradient(to top left, ${color}, ${color2})`
      } else {
        console.log('未找到 DarkMuted 颜色')
      }
    })
}

const goToAlbum = () => {
  if (!track.value) return
  if (track.value.album.id === 0) return
  router.push({ path: `/album/${track.value.album.id}` })
}

watch(
  track,
  (val) => {
    if (val) {
      getColor(val)
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.fm {
  padding: 1rem;
  background: var(--color-secondary-bg);
  border-radius: 1rem;
  display: flex;
  height: 198px;
  box-sizing: border-box;
}
.cover {
  height: 100%;
  clip-path: border-box;
  border-radius: 0.75rem;
  margin-right: 1.2rem;
  cursor: pointer;
  user-select: none;
}
.right-part {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: var(--color-text);
  width: 100%;
  .title {
    font-size: 1.6rem;
    font-weight: 600;
    margin-bottom: 0.6rem;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    word-break: break-all;
  }
  .artist {
    opacity: 0.68;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    word-break: break-all;
  }
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-left: -0.4rem;
    .buttons {
      display: flex;
    }
    .button-icon {
      margin: 0 8px 0 0;
    }
    .svg-icon {
      width: 24px;
      height: 24px;
    }
    .svg-icon#thumbs-down {
      width: 22px;
      height: 22px;
    }
    .card-name {
      font-size: 1rem;
      opacity: 0.18;
      display: flex;
      align-items: center;
      font-weight: 600;
      user-select: none;
      .svg-icon {
        width: 18px;
        height: 18px;
        margin-right: 6px;
      }
    }
  }
}
</style>
