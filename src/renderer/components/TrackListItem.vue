<template>
  <div class="trackitem" :class="trackClass" @mouseover="hover = true" @mouseleave="hover = false">
    <div class="track">
      <input v-if="isBatchOp" v-model="isSelected" type="checkbox" />
      <img
        v-if="!isAlbum && !isLyric"
        :src="image"
        loading="lazy"
        :class="{ hover: focus }"
        @click="goToAlbum"
      />
      <div v-if="showOrderNumber" class="no">
        <button v-show="focus && !isPlaying" @click="playThisList(track.id)">
          <svg-icon icon-class="play" style="height: 14px; width: 14px"></svg-icon>
        </button>
        <span v-show="!focus && !isPlaying">{{ trackNo }}</span>
        <button v-show="isPlaying">
          <svg-icon icon-class="volume" style="height: 16px; width: 16px"></svg-icon>
        </button>
      </div>
      <div class="title-and-artist">
        <div class="container">
          <div class="title">
            {{ track.name }}
            <span v-if="isSubTitle" :title="subTitle" class="sub-title"> ({{ subTitle }}) </span>
            <span v-if="isAlbum" class="featured">
              <ArtistsInLine
                :artists="track.ar || track.artists"
                :exclude="albumObject.artist.name"
                prefix="-"
            /></span>
            <span v-if="isAlbum && track.mark === 1318912" class="explicit-symbol"
              ><ExplicitSymbol
            /></span>
          </div>
          <div v-if="!isAlbum" class="artist">
            <span v-if="track.mark === 1318912" class="explicit-symbol before-artist"
              ><ExplicitSymbol :size="15"
            /></span>
            <ArtistsInLine :artists="artists" />
            <span v-if="track.mvid && track.mvid !== 0" class="mv-icon" @click="goToMv"
              ><svg-icon icon-class="mv" :style="{ height: '16px' }"
            /></span>
          </div>
        </div>
        <div></div>
      </div>

      <div v-if="showAlbumName" class="album">
        <div v-if="album && album.matched !== false && album.id && album.name"
          ><router-link :to="`/album/${album.id}`">{{ album.name }}</router-link></div
        >
        <div v-else> {{ album.name || '未知专辑' }}</div>
      </div>

      <div v-if="showTrackTime" class="createTime">
        {{
          track.createTime
            ? getPublishTime(track.createTime)
            : getPublishTime(track.album?.publishTime ?? track.publishTime)
        }}
      </div>
      <div v-if="showLikeButton" class="actions">
        <button @click="likeThisSong">
          <svg-icon
            icon-class="heart"
            :style="{
              visibility: focus && !isLiked && !isLyric ? 'visible' : 'hidden'
            }"
          ></svg-icon>
          <svg-icon v-show="isLiked" icon-class="heart-solid"></svg-icon>
        </button>
      </div>
      <div v-if="showTrackTime && showTrackTimeOrID === 'ID'" class="time">
        {{ track.id }}
      </div>
      <div v-if="showTrackTime && showTrackTimeOrID === 'time'" class="time">
        {{ formatedTime }}
      </div>

      <div v-if="track.playCount" class="count"> {{ track.playCount }}</div>
    </div>
    <div v-show="isLyric && lyrics.length > 0" class="lyric-container">
      <div
        ><div v-for="(lyric, index) in lyrics" :key="index" class="lyric">{{ lyric }}</div></div
      >
      <!-- <button>复制歌词</button> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import ArtistsInLine from './ArtistsInLine.vue'
import ExplicitSymbol from './ExplicitSymbol.vue'
import { PropType, computed, ref, toRefs, inject } from 'vue'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import { useStreamMusicStore } from '../store/streamingMusic'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const props = defineProps({
  trackProp: {
    type: Object as PropType<Record<string, any>>,
    required: true
  },
  trackNo: {
    type: Number,
    required: true
  },
  typeProp: {
    type: String,
    required: true
  },
  isLyric: { type: Boolean, default: false },
  albumObject: {
    type: Object,
    default: () => {
      return {
        artist: {
          name: ''
        }
      }
    }
  },
  highlightPlayingTrack: {
    type: Boolean,
    default: true
  }
})

const settingsStore = useSettingsStore()
const { general, localMusic } = storeToRefs(settingsStore)
const { subTitleDefault, showTrackTimeOrID } = toRefs(general.value)

const streamingMusicStore = useStreamMusicStore()
const { likeAStreamTrack } = streamingMusicStore

const playerStore = usePlayerStore()
const { currentTrack, enabled } = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
const { showToast } = stateStore

const { t } = useI18n()

const dataStore = useDataStore()
const { liked } = storeToRefs(dataStore)
const { likeATrack } = dataStore

const type = ref(props.typeProp)
const track = computed(
  () =>
    (type.value === 'cloudDisk' ? props.trackProp.simpleSong : props.trackProp) as {
      [key: string]: any
    }
)

const image = computed(() => {
  if (stateStore.virtualScrolling) {
    if (track.value.type === 'stream') {
      if (track.value.source === 'navidrome') {
        return new URL(`../assets/images/navidrome.webp`, import.meta.url).href
      } else if (track.value.source === 'emby') {
        return 'https://p2.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg'
      }
    }
  }
  let url =
    track.value.type === 'local'
      ? localMusic.value.scanning && !track.value.matched
        ? `atom://get-pic-path/${track.value.filePath}`
        : `atom://get-pic/${track.value.id}`
      : track.value.al?.picUrl ||
        track.value.album?.picUrl ||
        track.value.picUrl ||
        `https://p2.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg`
  if (url && url.startsWith('http')) {
    url = url.replace('http:', 'https:')
  }
  if (url.startsWith('https')) {
    url += '?param=128y128'
  }
  return url
})

const hover = ref(false)

const showOrderNumber = computed(() => type.value === 'album')

const isPlaying = computed(() => {
  return enabled.value && currentTrack.value && currentTrack.value.id === track.value.id
})

const trackClass = computed(() => {
  const clsList: string[] = [type.value]
  if (props.isLyric && props.trackNo % 2 === 1) clsList.push('odd')
  if (isPlaying.value && props.highlightPlayingTrack) clsList.push('playing')
  if (focus.value) clsList.push('focus')
  return clsList
})

const artists = computed(() => {
  const { ar, artists } = track.value
  const useAr = ar || artists
  useAr.map((artist: any) => {
    if (artist && !artist.name) {
      artist.name = '未知歌手'
    }
  })
  return useAr
})

const album = computed(() => {
  return track.value.album || track.value.al || track.value.simpleSong?.al
})

const showAlbumName = computed(() => {
  return type.value !== 'tracklist' && type.value !== 'album'
})

const showTrackTime = computed(() => {
  return type.value !== 'tracklist'
})

const formatedTime = computed(() => {
  const dt = (track.value.dt || track.value.duration) / 1000
  const minutes = Math.floor(dt / 60)
  const seconds = Math.floor(dt % 60)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
})

const showLikeButton = computed(() => {
  return showTrackTime.value && type.value !== 'cloudDisk'
})

const isLiked = computed(() => {
  return liked.value.songs.includes(track.value.id) || track.value.starred
})

const isSubTitle = computed(() => {
  return (
    (track.value.tns?.length > 0 && track.value.name !== track.value.tns[0]) ||
    track.value.alias?.length > 0 ||
    track.value.alia?.length > 0
  )
})

const isAlbum = computed(() => {
  return type.value === 'album'
})

const subTitle = computed(() => {
  let tn: any
  if (track.value.tns?.length > 0 && track.value.name !== track.value.tns[0]) {
    tn = track.value.tns[0]
  }

  // 优先显示alia
  if (subTitleDefault.value) {
    return track.value.alias?.length > 0
      ? track.value.alias[0]
      : track.value.alia?.length > 0
        ? track.value.alia[0]
        : tn
  } else {
    return tn === undefined
      ? track.value.alias[0]
      : track.value.alia?.length > 0
        ? track.value.alia[0]
        : tn
  }
})

const lyrics = computed(() => {
  const lyrics = track.value.lyrics?.txt.split('\n')
  const start = track.value.lyrics?.range[0].first
  const end = track.value.lyrics?.range[0].second
  const selectedLyric = track.value.lyrics?.txt.slice(start, end)
  const index = lyrics?.findIndex((l) => l.includes(selectedLyric))
  const result = lyrics?.slice(index, index + 4)
  if (result && result[0]?.includes(';')) {
    result[0] = result[0]?.split(';')[1]
  }
  return result
})

const isSelected = computed({
  get: () => selectedList.value.includes(track.value.id),
  set: (value) => {
    if (value) {
      selectedList.value.push(track.value.id)
    } else {
      selectedList.value = selectedList.value.filter((id) => id !== track.value.id)
    }
  }
})

const isMenuOpened = computed(() => {
  return rightClickedTrack.value.id === track.value.id
})

const focus = computed(() => {
  return (hover.value && rightClickedTrack.value.id === 0) || isMenuOpened.value
})

const getPublishTime = (date: any) => {
  date = new Date(date)
  const year = isNaN(date.getFullYear()) ? '1970' : date.getFullYear()
  const month = isNaN(date.getMonth()) ? '01' : (date.getMonth() + 1).toString().padStart(2, '0')
  const day = isNaN(date.getDate()) ? '01' : date.getDate().toString().padStart(2, '0')
  return date === 0 ? null : `${year}-${month}-${day}`
}

const goToAlbum = () => {
  if (album.value.id === 0) return
  if (album.value.matched === false) return
  router.push(`/album/${album.value.id}`)
}

const goToMv = () => {
  router.push(`/mv/${track.value.mvid}`)
}

const likeThisSong = () => {
  if (track.value.type === 'local' && !track.value.matched) {
    showToast(t('player.noAllowCauseLocal'))
  } else if (track.value.type === 'stream') {
    const op = track.value.starred ? 'unstar' : 'star'
    likeAStreamTrack(op, track.value.id)
  } else {
    likeATrack(track.value.id)
  }
}

const isBatchOp = inject('isBatchOp', ref(false))
const selectedList = inject('selectedList', ref<number[]>([]))
const rightClickedTrack = inject('rightClickedTrack', ref({ id: 0 }))
const playThisList = inject('playThisList') as (id: number) => void
</script>

<style scoped lang="scss">
button {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
  background: transparent;
  border-radius: 25%;
  transition: transform 0.2s;
  .svg-icon {
    height: 16px;
    width: 16px;
    color: var(--color-primary);
  }
  &:hover {
    transform: scale(1.12);
  }
  &:active {
    transform: scale(0.96);
  }
}

.trackitem.odd {
  background: var(--color-secondary-bg);
}

.trackitem {
  padding: 8px 10px;
  border-radius: 12px;
  user-select: none;
}

.trackitem.focus {
  transition: all 0.3s;
  background: var(--color-secondary-bg);
}

.track {
  display: flex;
  align-items: center;
  border-radius: 12px;
  user-select: none;

  input[type='checkbox'] {
    height: 18px;
    width: 18px;
    margin-right: 10px;
    accent-color: var(--color-primary);
  }

  .no {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 8px;
    margin: 0 20px 0 10px;
    width: 12px;
    color: var(--color-text);
    cursor: default;
    span {
      opacity: 0.58;
    }
  }

  .explicit-symbol {
    opacity: 0.28;
    color: var(--color-text);
    .svg-icon {
      margin-bottom: -3px;
    }
  }

  .explicit-symbol.before-artist {
    .svg-icon {
      margin-bottom: -3px;
    }
  }

  img {
    border-radius: 8px;
    height: 46px;
    width: 46px;
    margin-right: 20px;
    border: 1px solid rgba(0, 0, 0, 0.04);
    cursor: pointer;
  }

  img.hover {
    filter: drop-shadow(100 200 0 black);
  }

  .title-and-artist {
    flex: 1;
    display: flex;
    .container {
      display: flex;
      flex-direction: column;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text);
      cursor: default;
      padding-right: 16px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
      .featured {
        margin-right: 2px;
        font-weight: 500;
        font-size: 14px;
        opacity: 0.72;
      }
      .sub-title {
        color: #7a7a7a;
        opacity: 0.7;
        margin-left: 4px;
      }
    }
    .artist {
      margin-top: 2px;
      font-size: 13px;
      opacity: 0.68;
      color: var(--color-text);
      display: flex;
      align-items: center;
      -webkit-box-orient: vertical;
      vertical-align: top;
      -webkit-line-clamp: 1;
      line-clamp: 1;
      overflow: hidden;
      .artist-in-line {
        display: -webkit-box;
      }
      a {
        span {
          margin-right: 3px;
          opacity: 0.8;
        }
        &:hover {
          text-decoration: underline;
          cursor: pointer;
        }
      }
      .mv-icon {
        margin-left: 8px;
        color: var(--color-primary);
        font-size: 13px;
        cursor: pointer;
      }
    }
  }
  .album {
    flex: 1;
    display: flex;
    font-size: 16px;
    opacity: 0.88;
    padding: 0 30px;
    color: var(--color-text);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .createTime {
    flex: 0.8;
    font-size: 16px;
    justify-content: flex-end;
    margin-right: 10px;
    font-variant-numeric: tabular-nums;
    opacity: 0.88;
    color: var(--color-text);
  }
  .time,
  .count {
    font-size: 16px;
    width: 50px;
    cursor: default;
    display: flex;
    justify-content: flex-end;
    margin-right: 10px;
    font-variant-numeric: tabular-nums;
    opacity: 0.88;
    color: var(--color-text);
  }
  .count {
    font-weight: bold;
    font-size: 22px;
    line-height: 22px;
  }
}

.lyric-container {
  display: flex;
  justify-content: space-between;
  padding: 4px 0 4px 4px;
  .lyric {
    font-size: 14px;
    opacity: 0.68;
  }
  .lyric:first-child {
    opacity: 1;
    color: var(--color-primary);
  }
}

.trackitem.disable {
  .track {
    img {
      filter: grayscale(1) opacity(0.6);
    }
    .title,
    .artist,
    .album,
    .createTime,
    .time,
    .no,
    .featured {
      opacity: 0.28 !important;
    }
    &:hover {
      background: none;
    }
  }
}

.trackitem.tracklist {
  .track {
    img {
      height: 42px;
      width: 42px;
      border-radius: 6px;
      margin-right: 14px;
      cursor: pointer;
    }
    .title {
      font-size: 16px;
    }
    .artist {
      font-size: 12px;
    }
  }
}

.actions {
  width: 80px;
  display: flex;
  justify-content: flex-end;
}

.trackitem.playing {
  background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
  color: var(--color-primary);
  .track {
    .title,
    .album,
    .createTime,
    .time,
    .title-and-artist .sub-title {
      color: var(--color-primary);
    }
    .title .featured,
    .artist,
    .explicit-symbol,
    .count {
      color: var(--color-primary);
      opacity: 0.88;
    }
    .no span {
      color: var(--color-primary);
      opacity: 0.78;
    }
  }
}
</style>
