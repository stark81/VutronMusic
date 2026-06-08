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
          <div class="title" :title="track.name">
            {{ track.name }}
            <span v-if="isSubTitle" :title="subTitle" class="sub-title"> ({{ subTitle }}) </span>
            <span v-if="isAlbum" class="featured">
              <ArtistsInLine
                :artists="track.artists"
                :exclude="albumObject.artist.name"
                prefix="-"
              />
            </span>
            <!-- <span v-if="isAlbum && track.mark === 1318912" class="explicit-symbol"
              ><ExplicitSymbol
            /></span> -->
          </div>
          <div v-if="!isAlbum" class="artist">
            <!-- <span v-if="track.mark === 1318912" class="explicit-symbol before-artist"
              ><ExplicitSymbol :size="15"
            /></span> -->
            <ArtistsInLine :artists="artists" />
            <span v-if="track.mvid && track.mvid !== 0" class="mv-icon" @click="goToMv"
              ><svg-icon icon-class="mv" :style="{ height: '16px' }"
            /></span>
          </div>
        </div>
        <div></div>
      </div>

      <div v-if="showAlbumName" class="album">
        <div v-if="album && album.id && album.name" :title="album.name || '未知专辑'"
          ><router-link :to="`/album/${album.pluginId}/${JSON.stringify(album.sourceContext)}`">{{
            album.name
          }}</router-link></div
        >
        <div v-else :title="album.name || '未知专辑'"> {{ album.name || '未知专辑' }}</div>
      </div>

      <div v-if="showService" class="service">{{ track.pluginId }}</div>

      <div v-if="showTrackTime" class="createTime">
        {{ getPublishTime(track.createTime) }}
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

      <div v-if="track.playCount >= 0" class="count"> {{ track.playCount }}</div>
    </div>
    <div v-show="isLyric && lyrics.length > 0" class="lyric-container">
      <div>
        <div v-for="(lyric, index) in lyrics" :key="index" class="lyric">{{ lyric }}</div>
      </div>
      <!-- <button>复制歌词</button> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import ArtistsInLine from './ArtistsInLine.vue'
// import ExplicitSymbol from './ExplicitSymbol.vue'
import { computed, ref, toRefs, inject } from 'vue'
import { useNormalStateStore } from '../store/state'
import { useSettingsStore } from '../store/settings'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../store/player'
import { usePluginMusic } from '../store/pluginMusic'
import { useRouter } from 'vue-router'
// import { useI18n } from 'vue-i18n'
import { PluginId, Track } from '@/types/plugin'
import { SourceType } from '@/types/music'
import isEqual from 'lodash/isEqual'

const router = useRouter()
const props = withDefaults(
  defineProps<{
    trackProp: Track
    trackNo: number
    typeProp: SourceType
    isLyric?: boolean
    showService?: boolean
    albumObject?: { artist: { name: string } }
    highlightPlayingTrack?: boolean
  }>(),
  {
    isLyric: false,
    showService: false,
    albumObject: () => ({ artist: { name: '' } }),
    highlightPlayingTrack: true
  }
)

const settingsStore = useSettingsStore()
const { general } = storeToRefs(settingsStore)
const { subTitleDefault, showTrackTimeOrID } = toRefs(general.value)

const pluginStore = usePluginMusic()
const { likedTracks } = storeToRefs(pluginStore)
const { likeATrack } = pluginStore

const playerStore = usePlayerStore()
const { currentTrack, enabled } = storeToRefs(playerStore)

const stateStore = useNormalStateStore()
// const { showToast } = stateStore

// const { t } = useI18n()

const type = computed(() => props.typeProp)
const track = computed(() => props.trackProp)

const image = computed(() => {
  // let url: string = ''
  if (track.value.type === 'library') {
    return track.value.picUrl
  } else if (track.value.type === 'stream') {
    const url = track.value.picUrl || track.value.album?.picUrl
    return stateStore.virtualScrolling ? 'vutron://get-default-pic' : url
  } else {
    // url = localMusic.value.scanning
    //   ? `vutron://get-pic-path/${track.value.filePath}`
    //   : `vutron://local-asset?type=pic&id=${track.value.id}&size=64`
    return ''
  }
})

const hover = ref(false)

const showOrderNumber = computed(() => type.value === 'Album')

const isPlaying = computed(() => {
  return (
    enabled.value &&
    currentTrack.value &&
    isEqual(currentTrack.value.sourceContext.id, track.value.sourceContext.id)
  )
})

const trackClass = computed(() => {
  const clsList: string[] = [type.value]
  if (props.isLyric && props.trackNo % 2 === 1) clsList.push('odd')
  if (isPlaying.value && props.highlightPlayingTrack) clsList.push('playing')
  if (focus.value) clsList.push('focus')
  return clsList
})

const artists = computed(() => {
  const useAr = track.value?.artists || []
  useAr.forEach((artist: any) => {
    if (artist && !artist.name) {
      artist.name = '未知歌手'
    }
  })
  return useAr
})

const album = computed(() => track.value.album)

const showAlbumName = computed(() => {
  return !['TrackList', 'Artist', 'Album'].includes(type.value)
  // return type.value !== 'TrackList' && type.value !== 'Album'
})

// const showService = computed(() => {
//   return ['navidrome', 'emby', 'jellyfin'].includes(track.value.source)
// })

const showTrackTime = computed(() => {
  return !['TrackList', 'Artist'].includes(type.value)
})

const formatedTime = computed(() => {
  const dt = track.value.duration / 1000
  const minutes = Math.floor(dt / 60)
  const seconds = Math.floor(dt % 60)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
})

const showLikeButton = computed(() => {
  return showTrackTime.value && type.value !== 'CloudDisk'
})

const isLiked = computed(() => {
  const plugin = track.value.pluginId
  return (likedTracks.value[plugin]?.data ?? []).map((track) => track.id).includes(track.value.id)
})

const isSubTitle = computed(() => track.value.alias?.length > 0)

const isAlbum = computed(() => {
  return type.value === 'Album'
})

const subTitle = computed(() => track.value.alias[0])

const lyrics = computed(() => {
  // const lyrics = track.value.lyrics?.txt.split('\n')
  // const start = track.value.lyrics?.range[0].first
  // const end = track.value.lyrics?.range[0].second
  // const selectedLyric = track.value.lyrics?.txt.slice(start, end)
  // const index = lyrics?.findIndex((l) => l.includes(selectedLyric))
  // const result = lyrics?.slice(index, index + 4)
  // if (result && result[0]?.includes(';')) {
  //   result[0] = result[0]?.split(';')[1]
  // }
  // return result
  return []
})

const isSelected = computed({
  get: () => {
    return selectedList.value.some((id) =>
      isEqual(id, [track.value.pluginId, track.value.sourceContext])
    )
  },
  set: (value) => {
    if (value) {
      selectedList.value.push([track.value.pluginId, track.value.sourceContext])
    } else {
      selectedList.value = selectedList.value.filter((id) =>
        isEqual(id, [track.value.pluginId, track.value.sourceContext])
      )
    }
  }
})

const isMenuOpened = computed(() => {
  return rightClickedTrack.value?.id === track.value.id
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
  // if (album.value.matched === false) return
  router.push(`/album/${album.value.pluginId}/${JSON.stringify(album.value.sourceContext)}`)
}

const goToMv = () => {
  const sourceContext = { id: track.value.mvid }
  router.push(`/mv/${track.value.pluginId}/${JSON.stringify(sourceContext)}`)
}

const likeThisSong = () => {
  likeATrack(track.value)
}

const isBatchOp = inject('isBatchOp', ref(false))
const selectedList = inject('selectedList', ref<[PluginId, Record<string, any>][]>([]))
const rightClickedTrack = inject('rightClickedTrack', ref({ id: 0 }))
const playThisList = inject('playThisList') as (id: number | string) => void
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
    flex: 0.8;
    display: flex;
    font-size: 16px;
    opacity: 0.88;
    padding: 0 30px;
    color: var(--color-text);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
  }

  .service {
    flex: 0.8;
    font-size: 16px;
    opacity: 0.88;
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
    font-weight: 600;
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

.trackitem.TrackList,
.trackitem.Artist {
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
  flex: 0.3;
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
