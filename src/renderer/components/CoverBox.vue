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
import { usePluginMusic } from '../store/pluginMusic'
// import { useLocalMusicStore } from '../store/localMusic'
// import { useStreamMusicStore } from '../store/streamingMusic'
import { storeToRefs } from 'pinia'
// import { getPlaylistDetail } from '../api/playlist'
// import { getArtist } from '../api/artist'
// import { getAlbum } from '../api/album'
import { serviceName, CoverType, playlistSourceInfo } from '@/types/music.d'
import { PluginId, Track } from '@/types/plugin'

const props = defineProps({
  id: { type: [Number, String], required: true },
  sourceContext: { type: Object as PropType<Record<string, any>>, required: true },
  pluginId: { type: String, required: true },
  type: { type: String as PropType<CoverType>, required: true },
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
const { isShuffle } = storeToRefs(playerStore)
const { replacePlaylist } = playerStore

const pluginStore = usePluginMusic()
const { getPlaylistDetail, pluginMethodCall } = pluginStore

// const localMusic = storeToRefs(useLocalMusicStore())
// const streamMusic = storeToRefs(useStreamMusicStore())

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
  if (props.type === 'Artist') styles.borderRadius = '50%'
  return styles
})

const shadowStyles = computed(() => {
  const styles = {
    backgroundImage: `url(${props.imageUrl})`,
    borderRadius: props.type === 'Artist' ? '50%' : '0'
  }
  return styles
})

const doHover = (isHover: boolean) => {
  if (props.type === 'User') return
  focus.value = isHover
}

const play = async () => {
  const plugin = props.pluginId as PluginId

  let tracks = [] as Track[]
  if (props.type === 'Playlist') {
    tracks = await getPlaylistDetail(plugin, { ...props.sourceContext, reset: true }).then(
      (result) => result.data?.tracks || []
    )
  } else if (props.type === 'Album') {
    tracks = await pluginMethodCall(plugin, 'albumDetail', props.sourceContext).then(
      (result) => result.data?.songs || []
    )
  } else if (props.type === 'Artist') {
    tracks = await pluginMethodCall(plugin, 'artistDetail', props.sourceContext).then(
      (result) => result.songs
    )
  }

  const source: playlistSourceInfo = {
    type: props.type as Exclude<typeof props.type, 'User'>,
    plugin,
    sourceContext: props.sourceContext
  }

  const ids = tracks.map((item) => [plugin, item.sourceContext]) as [
    PluginId,
    Record<string, any>
  ][]
  const idx = isShuffle.value ? Math.floor(Math.random() * tracks.length) : 0
  replacePlaylist(source, ids, idx)
}

const goTo = () => {
  const url = `/${props.type}/${props.pluginId}/${JSON.stringify(props.sourceContext)}`
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
