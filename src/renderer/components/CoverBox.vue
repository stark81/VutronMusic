<template>
  <div
    class="cover"
    :class="{ 'cover-hover': coverHover }"
    @mouseover="doHover(true)"
    @mouseleave="doHover(false)"
    @click="clickCoverToPlay ? play() : goTo()"
  >
    <div class="cover-container">
      <div v-if="coverHover" class="shade">
        <button v-show="focus" class="play-button" :style="playButtonStyles" @click.stop="play()"
          ><svg-icon icon-class="play" />
        </button>
      </div>
      <img :src="imageUrl" :style="imageStyles" loading="lazy" />
      <Transition v-if="coverHover || alwaysShowShadow" name="fade">
        <div v-show="focus || alwaysShowShadow" class="shadow" :style="shadowStyles"></div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import { ref, computed, PropType } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../store/player'
import { useLocalMusicStore } from '../store/localMusic'
import { useStreamMusicStore, serviceName } from '../store/streamingMusic'
import { storeToRefs } from 'pinia'
import { getPlaylistDetail } from '../api/playlist'
import { getArtist } from '../api/artist'
import { getAlbum } from '../api/album'

const props = defineProps({
  id: { type: [Number, String], required: true },
  type: { type: String, required: true },
  service: { type: String as PropType<serviceName>, default: '' },
  imageUrl: { type: String, required: true },
  fixedSize: { type: Number, default: 0 },
  playButtonSize: { type: Number, default: 22 },
  coverHover: { type: Boolean, default: true },
  alwaysShowPlayButton: { type: Boolean, default: true },
  alwaysShowShadow: { type: Boolean, default: false },
  clickCoverToPlay: { type: Boolean, default: false },
  shadowMargin: { type: Number, default: 12 },
  radius: { type: Number, default: 12 }
})

const focus = ref(false)
const router = useRouter()
const playerStore = usePlayerStore()
const { _shuffle } = storeToRefs(playerStore)
const { replacePlaylist } = playerStore
const localMusic = storeToRefs(useLocalMusicStore())
const streamMusic = storeToRefs(useStreamMusicStore())

const playButtonStyles = computed(() => {
  const styles = {
    width: props.playButtonSize + '%',
    height: props.playButtonSize + '%'
  }
  return styles
})

const imageStyles = computed(() => {
  const styles: { [key: string]: string } = {}
  if (props.fixedSize !== 0) {
    styles.width = props.fixedSize + 'px'
    styles.height = props.fixedSize + 'px'
  }
  if (props.type === 'artist') styles.borderRadius = '50%'
  return styles
})

const shadowStyles = computed(() => {
  const styles = {
    backgroundImage: `url(${props.imageUrl})`,
    borderRadius: props.type === 'artist' ? '50%' : '0'
  }
  return styles
})

const doHover = (isHover: boolean) => {
  if (props.type === 'user') return
  focus.value = isHover
}

const play = () => {
  if (props.type === 'playlist') {
    getPlaylistDetail(props.id as number, false).then((data) => {
      const trackIDs = data.playlist.trackIds.map((t: any) => t.id)
      const idx = _shuffle.value ? Math.floor(Math.random() * trackIDs.length) : 0
      replacePlaylist(props.type, props.id, trackIDs, idx)
    })
  } else if (props.type === 'localPlaylist') {
    const playlist = localMusic.playlists.value.find((p) => p.id === props.id)!
    const trackIDs = playlist.trackIds
    const idx = _shuffle.value ? Math.floor(Math.random() * trackIDs.length) : trackIDs.length - 1
    replacePlaylist('localPlaylist', props.id, trackIDs, idx)
  } else if (props.type === 'streamPlaylist') {
    const playlist = streamMusic.playlists.value[props.service].find((p) => p.id === props.id)!
    const trackIDs = playlist.trackIds
    const idx = _shuffle.value ? Math.floor(Math.random() * trackIDs.length) : trackIDs.length - 1
    replacePlaylist('streamPlaylist', props.id, trackIDs, idx)
  } else if (props.type === 'artist') {
    getArtist(props.id as number).then((data) => {
      const trackIDs = data.hotSongs.map((t) => t.id)
      const idx = _shuffle.value ? Math.floor(Math.random() * trackIDs.length) : 0
      replacePlaylist(props.type, props.id, trackIDs, idx)
    })
  } else if (props.type === 'album') {
    getAlbum(Number(props.id)).then((data) => {
      const trackIDs = data.songs.map((t) => t.id)
      const idx = _shuffle.value ? Math.floor(Math.random() * trackIDs.length) : 0
      replacePlaylist(props.type, props.id, trackIDs, idx)
    })
  }
}

const goTo = () => {
  const url = props.service
    ? `/${props.type}/${props.service}/${props.id}`
    : `/${props.type}/${props.id}`
  router.push(url)
}
</script>

<style scoped lang="scss">
.cover {
  position: relative;
  transition: transform 0.3s;
}
.cover-container {
  position: relative;
}
img {
  border-radius: 0.75em;
  width: 100%;
  user-select: none;
  aspect-ratio: 1 / 1;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.cover-hover {
  &:hover {
    cursor: pointer;
    /* transform: scale(1.02); */
  }
}

.shade {
  position: absolute;
  top: 0;
  height: calc(100% - 3px);
  width: 100%;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
}
.play-button {
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  backdrop-filter: blur(8px);
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.08);
  height: 22%;
  width: 22%;
  border-radius: 50%;
  cursor: default;
  transition: 0.2s;
  .svg-icon {
    height: 44%;
    margin: {
      left: 4px;
    }
  }
  &:hover {
    background: rgba(255, 255, 255, 0.28);
  }
  &:active {
    transform: scale(0.94);
  }
}

.shadow {
  position: absolute;
  top: 12px;
  height: 100%;
  width: 100%;
  filter: blur(16px) opacity(0.6);
  transform: scale(0.92, 0.96);
  z-index: -1;
  background-size: cover;
  border-radius: 0.75em;
  aspect-ratio: 1 / 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
