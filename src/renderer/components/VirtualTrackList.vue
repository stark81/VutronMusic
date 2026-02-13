<template>
  <VirtualScroll
    :list="items"
    :item-size="itemHeight"
    :column-number="colunmNumber"
    :show-position="showPosition"
    :height="height"
    :is-end="isEnd"
    :padding-bottom="paddingBottom"
    :load-more="loadMore"
    :above-value="5"
    :below-value="5"
    :gap="gap"
    :pid="id"
    :enable-virtual-scroll="enableVirtualScroll"
  >
    <template #position="{ scrollToCurrent }">
      <div v-show="showScrollTo" @click="scrollToCurrent(currentIndex)"
        ><svg-icon icon-class="target"></svg-icon
      ></div>
    </template>
    <template #default="{ item, index }">
      <div class="track-item">
        <TrackListItem
          :track-prop="item"
          :track-no="item.no || index + 1"
          :type-prop="type"
          :is-lyric="isLyric"
          :show-service="showService"
          :album-object="albumObject"
          :highlight-playing-track="highlightPlayingTrack"
          @dblclick="playThisList(item.id || item.songId)"
          @click.right="openMenu($event, item, index)"
        />
      </div>
    </template>
  </VirtualScroll>
  <div v-show="showComment" class="comment" @click="closeComment">
    <div></div>
    <div class="comment-container-parent" @click.stop>
      <CommentPage v-if="showComment" :id="rightClickedTrackComputed.id" type="music" />
    </div>
  </div>
  <ContextMenu ref="trackListMenuRef" @close-menu="closeMenu">
    <div v-show="type !== 'cloudDisk'" class="item-info">
      <img v-if="image" :src="image" loading="lazy" />
      <div class="info">
        <div class="title">{{ rightClickedTrackComputed.name }}</div>
        <div class="subtitle">{{ rightClickedTrackComputed.artists[0].name }}</div>
      </div>
    </div>
    <hr v-show="type !== 'cloudDisk'" />
    <div class="item" @click="play">{{ $t('contextMenu.play') }}</div>
    <div class="item" @click="addToQueue(rightClickedTrack.id)">{{
      $t('contextMenu.addToQueue')
    }}</div>
    <div
      v-if="type !== 'cloudDisk' && rightClickedTrackComputed.matched"
      class="item"
      @click="openComment"
      >{{ $t('contextMenu.showComment') }}</div
    >
    <div
      v-if="extraContextMenuItem.includes('accurateMatch')"
      class="item"
      @click="accurateMatchTrack"
      >{{ $t('contextMenu.accurateMatch') }}</div
    >
    <hr v-show="type !== 'cloudDisk' && type !== 'localTracks'" />
    <div v-if="!type.includes('local') && !type.includes('stream')" class="item" @click="copyId">{{
      $t('contextMenu.copyId')
    }}</div>
    <div
      v-show="type !== 'cloudDisk' && rightClickedTrack.matched"
      class="item"
      @click="addTrackToPlaylist"
      >{{ $t('player.addToPlaylist') }}</div
    >
    <div
      v-if="
        extraContextMenuItem.includes('removeTrackFromNext') ||
        extraContextMenuItem.includes('removeTrackFromInsert')
      "
      class="item"
      @click="
        removeFromQueue(
          extraContextMenuItem.includes('removeTrackFromNext') ? 'next' : 'insert',
          rightClickedTrackComputed.id
        )
      "
      >{{ $t('contextMenu.removeFromQueue') }}</div
    >
    <div
      v-show="extraContextMenuItem.includes('addToStreamList')"
      class="item"
      @click="addToSteamPlaylist([rightClickedTrackComputed.id])"
      >{{ $t('streamMusic.playlist.addToPlaylist') }}</div
    >
    <div
      v-if="extraContextMenuItem.includes('removeTrackFromPlaylist')"
      class="item"
      @click="rmTrackFromPlaylist"
      >{{ $t('contextMenu.removeFromPlaylist') }}</div
    >
    <div
      v-if="extraContextMenuItem.includes('addToLocalList')"
      class="item"
      @click="addToLocalPlaylist([rightClickedTrackComputed.id])"
      >{{ $t('contextMenu.addToLocalPlaylist') }}</div
    >
    <div v-if="extraContextMenuItem.includes('showInFolder')" class="item" @click="showInFolder">{{
      $t('contextMenu.showInFolder')
    }}</div>
  </ContextMenu>
</template>

<script setup lang="ts">
import {
  toRefs,
  provide,
  ref,
  computed,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted
} from 'vue'
import { usePlayerStore } from '../store/player'
import { useNormalStateStore } from '../store/state'
import { useLocalMusicStore } from '../store/localMusic'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import CommentPage from './CommentPage.vue'
import { storeToRefs } from 'pinia'
import TrackListItem from './TrackListItem.vue'
import ContextMenu from './ContextMenu.vue'
import { useI18n } from 'vue-i18n'
import { addOrRemoveTrackFromPlaylist } from '../api/playlist'
import _ from 'lodash'
import { isAccountLoggedIn } from '../utils/auth'
import { useStreamMusicStore } from '../store/streamingMusic'
import SvgIcon from './SvgIcon.vue'
import { serviceName, Track } from '@/types/music.d'

const props = withDefaults(
  defineProps<{
    items: Track[]
    allItems?: Track[]
    type: string
    groupBy?: '' | 'all' | serviceName
    isLyric?: boolean
    showPosition?: boolean
    showService?: boolean
    showTrackPosition?: boolean
    colunmNumber: number
    gap?: number
    extraContextMenuItem?: any[]
    id?: number | string
    height?: number
    albumObject?: {
      artist: { name: string }
    }
    itemHeight?: number
    dbclickEnable?: boolean
    loadMore?: () => void
    highlightPlayingTrack?: boolean
    isEnd: boolean
    paddingBottom?: number
    enableVirtualScroll?: boolean
  }>(),
  {
    allItems: () => [],
    groupBy: '',
    isLyric: false,
    showPosition: true,
    showService: false,
    showTrackPosition: true,
    gap: 20,
    extraContextMenuItem: () => [],
    id: 0,
    height: 0,
    albumObject: () => ({
      artist: { name: '' }
    }),
    itemHeight: 64,
    dbclickEnable: true,
    loadMore: () => {},
    highlightPlayingTrack: true,
    paddingBottom: 96,
    enableVirtualScroll: true
  }
)

const { items, colunmNumber, id } = toRefs(props)
const trackListMenuRef = ref<InstanceType<typeof ContextMenu>>()
const selectedList = ref<number[]>([])
const rightClickedTrackIndex = ref(-1)
const showComment = ref(false)
const rightClickedTrack = ref({
  id: 0,
  name: '',
  matched: true,
  type: 'online',
  source: '',
  playlistItemId: null,
  mvid: 0,
  filePath: '',
  artists: [{ name: '' }],
  album: { picUrl: '' },
  al: { picUrl: '' }
})
const { t } = useI18n()
const playerStore = usePlayerStore()
const { playlistSource, currentTrack, list, _playNextList } = storeToRefs(playerStore)
const { replacePlaylist, addTrackToPlayNext } = playerStore

const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { addTrackToPlaylistModal, accurateMatchModal } = storeToRefs(stateStore)

const { addOrRemoveTrackFromStreamPlaylist } = useStreamMusicStore()

const isSelectAll = computed(() => {
  return selectedList.value.length === items.value.length
})
const rightClickedTrackComputed = computed(() => {
  return props.type === 'cloudDisk'
    ? {
        id: 0,
        name: '',
        matched: true,
        type: 'online',
        mvid: 0,
        filePath: '',
        source: '',
        playlistItemId: null,
        artists: [{ name: '' }],
        album: { picUrl: '' },
        al: { picUrl: '' }
      }
    : rightClickedTrack.value
})

const image = computed(() => {
  let url: string
  if (rightClickedTrackComputed.value.type === 'online') {
    url =
      rightClickedTrackComputed.value.al?.picUrl || rightClickedTrackComputed.value.album?.picUrl
    if (url && url.startsWith('http')) url = url.replace('http:', 'https:')
    if (url) url += '?param=64y64'
    return url
  } else if (rightClickedTrackComputed.value.type === 'stream') {
    url =
      rightClickedTrackComputed.value.al?.picUrl || rightClickedTrackComputed.value.album?.picUrl
    return url
  } else {
    url = `atom://local-asset?type=pic&id=${rightClickedTrackComputed.value.id}&size=64`
    return url
  }
})

const typeType = computed(() => {
  if (props.type.includes('local')) return 'local'
  else if (props.type.includes('stream')) return 'stream'
  return 'online'
})
const showScrollTo = computed(() => {
  return (
    currentTrack.value &&
    props.showTrackPosition &&
    ((playlistSource.value.type === props.type && playlistSource.value.id === props.id) ||
      (playlistSource.value.type === 'localPlaylist' &&
        playlistSource.value.type === props.type &&
        props.id === 0) ||
      (playlistSource.value.type === 'streamPlaylist' &&
        playlistSource.value.type === props.type &&
        props.id === 0))
  )
})
const currentIndex = computed(() => {
  return items.value.findIndex((item) => (item.id || item.songId) === currentTrack.value?.id)
})

const playThisList = (index: number) => {
  if (!props.dbclickEnable) return
  const IDs = (props.allItems?.length ? props.allItems : items.value).map(
    (track) => track.id || track.songId
  )
  const idx = items.value.findIndex((item) => (item.id || item.songId) === index)
  replacePlaylist(props.type, id.value, IDs, idx)
}

const closeMenu = () => {
  if (showComment.value) return
  rightClickedTrack.value = {
    id: 0,
    name: '',
    matched: true,
    type: 'online',
    source: '',
    playlistItemId: null,
    mvid: 0,
    filePath: '',
    artists: [{ name: '' }],
    album: { picUrl: '' },
    al: { picUrl: '' }
  }
  rightClickedTrackIndex.value = -1
}

const accurateMatchTrack = () => {
  accurateMatchModal.value = {
    show: true,
    selectedTrackID: rightClickedTrack.value.id
  }
}

const selectAll = () => {
  if (!isSelectAll.value) {
    selectedList.value = items.value.map((track) => track.id)
  } else {
    selectedList.value = []
  }
}
const doFinish = () => {
  selectedList.value = []
}

const play = () => {
  addTrackToPlayNext(rightClickedTrack.value.id, true, true)
}

const showInFolder = () => {
  window.mainApi?.send('msgShowInFolder', rightClickedTrackComputed.value.filePath)
}

const openMenu = (e: MouseEvent, track: { [key: string]: any }, index: number) => {
  _.merge(rightClickedTrack.value, track)
  rightClickedTrack.value.matched = typeType.value === 'online' || track.matched || false
  rightClickedTrackIndex.value = index
  trackListMenuRef.value?.openMenu(e)
}

const { removeTrackFromPlaylist } = useLocalMusicStore()
const rmTrackFromPlaylist = () => {
  if (typeType.value === 'local') {
    if (confirm(`确定要从歌单删除 ${rightClickedTrack.value.name}？`)) {
      const idx = rightClickedTrackIndex.value
      removeTrackFromPlaylist(props.id as number, rightClickedTrackComputed.value.id).then(
        (result) => {
          if (result) {
            removeTrack(idx)
            showToast(t('toast.removedFromPlaylist'))
          }
        }
      )
    }
  } else if (typeType.value === 'online') {
    if (!isAccountLoggedIn()) {
      showToast(t('toast.needToLogin'))
      return
    }
    if (confirm(`确定要从歌单删除 ${rightClickedTrackComputed.value.name}？`)) {
      const idx = rightClickedTrackIndex.value
      addOrRemoveTrackFromPlaylist({
        op: 'del',
        pid: props.id,
        tracks: rightClickedTrackComputed.value.id
      }).then((result) => {
        if (result.body.code === 200) {
          showToast(t('toast.removedFromPlaylist'))
          removeTrack(idx)
        } else {
          showToast(result.body.message)
        }
      })
    }
  } else {
    if (props.groupBy === 'all') {
      showToast('在聚合视图下无法进行操作，请先选择具体的流媒体服务')
      return
    }
    if (confirm(`确定要从${props.groupBy}歌单删除 ${rightClickedTrackComputed.value.name}？`)) {
      const idx = rightClickedTrackIndex.value
      const playlistItemId = rightClickedTrackComputed.value.playlistItemId
      addOrRemoveTrackFromStreamPlaylist(
        'del',
        props.groupBy as serviceName,
        props.id as string,
        [
          rightClickedTrackComputed.value.source === 'navidrome' ? idx : playlistItemId
        ] as unknown as string[]
      ).then((res) => {
        if (res) {
          removeTrack(idx)
          showToast(t('toast.removedFromPlaylist'))
        }
      })
    }
  }
}

const addToLocalPlaylist = (trackIDs: number[] = []) => {
  // 设置延迟执行，保证contextMenu的滚动效果生效后再打开弹窗，以避免两者的滚动效果冲突
  if (!trackIDs.length) {
    trackIDs = selectedList.value
  }
  setTimeout(() => {
    addTrackToPlaylistModal.value = {
      show: true,
      selectedTrackID: trackIDs,
      type: 'local'
    }
  })
}

const removeFromQueue = (playlist: 'insert' | 'next', id: string | number) => {
  if (playlist === 'insert') {
    const index = _playNextList.value.findIndex((idx) => idx === id)
    if (index > -1) _playNextList.value.splice(index, 1)
  } else {
    const index = list.value.findIndex((idx) => idx === id)
    if (index > -1) list.value.splice(index, 1)
  }
}

const addToSteamPlaylist = (trackIDs: number[] = []) => {
  if (props.groupBy === 'all') {
    showToast('在聚合视图下无法进行操作，请先选择具体的流媒体服务')
    return
  }
  if (!trackIDs.length) {
    trackIDs = selectedList.value
  }
  setTimeout(() => {
    addTrackToPlaylistModal.value = {
      show: true,
      selectedTrackID: trackIDs,
      type: props.groupBy as serviceName
    }
  })
}

const copyId = () => {
  navigator.clipboard.writeText(rightClickedTrackComputed.value.id.toString()).then(() => {
    showToast(t('toast.copySuccess'))
  })
}

const addTrackToPlaylist = () => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  const trackIDs = [rightClickedTrack.value?.id]
  setTimeout(() => {
    addTrackToPlaylistModal.value = {
      show: true,
      selectedTrackID: trackIDs,
      type: 'online'
    }
  })
}

const openComment = () => {
  showComment.value = true
}

const closeComment = () => {
  showComment.value = false
  rightClickedTrack.value = {
    id: 0,
    name: '',
    matched: true,
    type: 'online',
    source: '',
    playlistItemId: null,
    mvid: 0,
    filePath: '',
    artists: [{ name: '' }],
    album: { picUrl: '' },
    al: { picUrl: '' }
  }
  rightClickedTrackIndex.value = -1
}

const addToQueue = (ids: number | number[] | null = null) => {
  if (!ids) {
    ids = selectedList.value
  }
  addTrackToPlayNext(ids)
}
const updatePadding = inject('updatePadding') as (padding: number) => void
const removeTrack = inject('removeTrack', () => {})

provide('playThisList', playThisList)
provide('selectedList', selectedList)
provide('rightClickedTrack', rightClickedTrack)
defineExpose({ selectAll, doFinish, addToLocalPlaylist, addToSteamPlaylist, addToQueue })

onActivated(() => {
  if (props.isEnd) updatePadding(0)
})
onDeactivated(() => {
  if (props.isEnd) updatePadding(96)
})

onMounted(() => {
  if (props.isEnd) updatePadding(0)
})
onBeforeUnmount(() => {
  if (props.isEnd) updatePadding(96)
})
</script>

<style scoped lang="scss">
.track-item {
  width: 100%;
  // padding-bottom: 4px;
}
.comment {
  background-color: rgba(0, 0, 0, 0.38);
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.comment-container-parent {
  background-color: var(--color-body-bg);
  padding: 40px 4vw 10px 4vw;
  height: 100vh;
  box-sizing: border-box;
}
</style>
