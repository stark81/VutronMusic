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
          :show-play-count="showPlayCount"
          :highlight-playing-track="highlightPlayingTrack"
          @dblclick="playThisList(item.id)"
          @click.right="openMenu($event, item, index)"
        />
      </div>
    </template>
  </VirtualScroll>
  <div v-show="showComment" class="comment" @click="closeComment">
    <div></div>
    <div class="comment-container-parent" @click.stop>
      <CommentPage
        v-if="showComment"
        :source-context="rightClickedTrackComputed.sourceContext"
        :plugin="rightClickedTrackComputed.pluginId"
        type="track"
      />
    </div>
  </div>
  <ContextMenu ref="trackListMenuRef" @close-menu="closeMenu">
    <div v-show="type !== 'CloudDisk'" class="item-info">
      <img v-if="image" :src="image" loading="lazy" />
      <div class="info">
        <div class="title">{{ rightClickedTrackComputed.name }}</div>
        <div class="subtitle">{{ rightClickedTrackComputed.artists[0].name }}</div>
      </div>
    </div>
    <hr v-show="type !== 'CloudDisk'" />
    <div class="item" @click="play">{{ $t('contextMenu.play') }}</div>
    <div
      class="item"
      @click="addToQueue([[rightClickedTrack.pluginId, rightClickedTrack.sourceContext]])"
      >{{ $t('contextMenu.addToQueue') }}</div
    >
    <div v-if="type !== 'CloudDisk'" class="item" @click="openComment">{{
      $t('contextMenu.showComment')
    }}</div>
    <div v-if="trackType !== 'library'" class="item" @click="accurateMatchTrack">{{
      $t('contextMenu.accurateMatch')
    }}</div>
    <hr v-show="type !== 'CloudDisk'" />
    <div v-if="trackType === 'library'" class="item" @click="copySourceContext">{{
      $t('contextMenu.copySourceContext')
    }}</div>
    <div v-show="type !== 'CloudDisk'" class="item" @click="addTrackToPlaylist">{{
      $t('player.addToPlaylist')
    }}</div>
    <div
      v-if="
        extraContextMenuItem.includes('removeTrackFromNext') ||
        extraContextMenuItem.includes('removeTrackFromInsert')
      "
      class="item"
      @click="
        removeFromQueue(
          extraContextMenuItem.includes('removeTrackFromNext') ? 'next' : 'insert',
          rightClickedTrackComputed.pluginId,
          rightClickedTrackComputed.sourceContext
        )
      "
      >{{ $t('contextMenu.removeFromQueue') }}</div
    >
    <div
      v-if="extraContextMenuItem.includes('removeTrackFromPlaylist')"
      class="item"
      @click="rmTrackFromPlaylist"
      >{{ $t('contextMenu.removeFromPlaylist') }}</div
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
import { usePluginMusic } from '../store/pluginMusic'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import CommentPage from './CommentPage.vue'
import { storeToRefs } from 'pinia'
import TrackListItem from './TrackListItem.vue'
import ContextMenu from './ContextMenu.vue'
import { useI18n } from 'vue-i18n'
import merge from 'lodash/merge'
import isEqual from 'lodash/isEqual'
import SvgIcon from './SvgIcon.vue'
import { PlaylistSourceInfo, SourceType } from '@/types/music.d'
import { PluginId, Track } from '@/types/plugin'

const props = withDefaults(
  defineProps<{
    items: Track[]
    allItems?: Track[]
    type: SourceType
    plugin: PluginId | 'all'
    isLyric?: boolean
    showPosition?: boolean
    showService?: boolean
    showTrackPosition?: boolean
    colunmNumber: number
    gap?: number
    extraContextMenuItem?: any[]
    sourceContext: Record<string, any>
    height?: number
    albumObject?: {
      artist: { name: string }
    }
    itemHeight?: number
    dbclickEnable?: boolean
    loadMore?: () => void
    highlightPlayingTrack?: boolean
    isEnd: boolean
    showPlayCount?: boolean
    paddingBottom?: number
    enableVirtualScroll?: boolean
  }>(),
  {
    allItems: () => [],
    isGroupBy: false,
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
    showPlayCount: false,
    highlightPlayingTrack: true,
    paddingBottom: 96,
    enableVirtualScroll: true
  }
)

const { items, colunmNumber } = toRefs(props)
const trackListMenuRef = ref<InstanceType<typeof ContextMenu>>()
const selectedList = ref<[PluginId, Record<string, any>][]>([])
const rightClickedTrackIndex = ref(-1)
const showComment = ref(false)
const rightClickedTrack = ref({
  id: 0,
  name: '',
  type: 'online',
  pluginId: '' as PluginId,
  source: '',
  filePath: '',
  mvid: 0,
  picUrl: '',
  artists: [{ name: '' }],
  album: { picUrl: '' },
  sourceContext: {}
})
const { t } = useI18n()
const playerStore = usePlayerStore()
const { playlistSource, currentTrack, list, playNextList } = storeToRefs(playerStore)
const { replacePlaylist, addTrackToPlayNext } = playerStore

const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { addTrackToPlaylistModal, accurateMatchModal } = storeToRefs(stateStore)

// const { addOrRemoveTrackFromStreamPlaylist } = useStreamMusicStore()

const pluginStore = usePluginMusic()
const { services } = storeToRefs(pluginStore)
const { pluginMethodCall, isAccountLoggedIn } = pluginStore

const isSelectAll = computed(() => {
  return selectedList.value.length === items.value.length
})

const currentSource = computed(() => ({
  type: props.type,
  plugin: props.plugin,
  sourceContext: props.sourceContext
}))

const trackType = computed(() => {
  const plugin = rightClickedTrackComputed.value.pluginId
  return services.value.find((item) => item.code === plugin)?.type
})

const rightClickedTrackComputed = computed(() => {
  return props.type === 'CloudDisk'
    ? {
        id: 0,
        name: '',
        matched: true,
        type: 'online',
        mvid: 0,
        filePath: '',
        source: '',
        picUrl: '',
        pluginId: '' as PluginId,
        artists: [{ name: '' }],
        album: { picUrl: '' },
        al: { picUrl: '' },
        sourceContext: {}
      }
    : rightClickedTrack.value
})

const image = computed(() => {
  let url: string
  const track = rightClickedTrackComputed.value

  if (!track.id) return ''
  if (track.type === 'library') {
    url = track.picUrl
    return url
  } else if (track.type === 'stream') {
    return track.picUrl
  } else {
    url = `http://localhost:41830/local-asset?trackId=${track.id}&size=64`
    return url
  }
})

const showScrollTo = computed(
  () =>
    currentTrack.value &&
    props.showTrackPosition &&
    playlistSource.value.plugin === props.plugin &&
    isEqual(playlistSource.value.sourceContext.id, currentSource.value.sourceContext.id)
)
const currentIndex = computed(() => {
  return items.value.findIndex((item) => item.id === currentTrack.value?.id)
})

const playThisList = (index: number | string) => {
  if (!props.dbclickEnable) return

  const source: PlaylistSourceInfo = {
    type: props.type,
    plugin: props.plugin,
    sourceContext: props.sourceContext
  }

  const sourceItems = props.allItems?.length ? props.allItems : items.value
  const sourceContext: [PluginId, Record<string, any>][] = sourceItems.map((track) => [
    track.pluginId,
    track.sourceContext
  ])
  const idx = sourceItems.findIndex((item) => item.id === index)
  replacePlaylist(source, sourceContext, idx)
}

const closeMenu = () => {
  if (showComment.value) return
  rightClickedTrack.value = {
    id: 0,
    name: '',
    type: 'online',
    pluginId: '' as PluginId,
    source: '',
    filePath: '',
    picUrl: '',
    mvid: 0,
    artists: [{ name: '' }],
    album: { picUrl: '' },
    sourceContext: {}
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
    selectedList.value = items.value.map((track) => [track.pluginId, track.sourceContext])
  } else {
    selectedList.value = []
  }
}
const doFinish = () => {
  selectedList.value = []
}

const play = () => {
  const { pluginId, sourceContext } = rightClickedTrack.value
  addTrackToPlayNext([[pluginId, sourceContext]], true, true)
}

const showInFolder = () => {
  if (!rightClickedTrackComputed.value.filePath) return
  window.mainApi?.send('msgShowInFolder', rightClickedTrackComputed.value.filePath)
}

const openMenu = (e: MouseEvent, track: { [key: string]: any }, index: number) => {
  merge(rightClickedTrack.value, track)
  rightClickedTrackIndex.value = index
  trackListMenuRef.value?.openMenu(e)
}

const rmTrackFromPlaylist = () => {
  if (props.plugin === 'all') {
    showToast('在聚合视图下无法进行操作，请先选择具体的音源服务')
    return
  }

  if (!isAccountLoggedIn(props.plugin)) {
    showToast(
      t('toast.needToLogin', {
        serviceName: services.value.find((s) => s.code === props.plugin)?.name || ''
      })
    )
    return
  }

  const pname = services.value.find((item) => item.code === props.plugin)!.name
  const source = rightClickedTrackComputed.value.sourceContext
  const idx = items.value.findIndex((item) => isEqual(item.sourceContext, source))

  if (
    confirm(
      t('playlist.rmTrackFromPlaylist', {
        name: pname,
        code: props.plugin,
        tname: rightClickedTrack.value.name
      })
    )
  ) {
    pluginMethodCall(props.plugin, 'addOrRemoveTracksToPlaylist', {
      op: 'del',
      playlist: props.sourceContext,
      tracks: [{ pluginId: props.plugin, sourceContext: source }]
    }).then((res) => {
      if (res.code === 200) {
        removeTrack(idx)
        showToast(t('toast.removedFromPlaylist'))
      }
    })
  }
}

const removeFromQueue = (
  playlist: 'insert' | 'next',
  pluginId: PluginId,
  sourceContext: Record<string, any>
) => {
  const item = [pluginId, sourceContext]
  if (playlist === 'insert') {
    const index = playNextList.value.findIndex(
      ([plugin, source]) => plugin === pluginId && isEqual(source, sourceContext)
    )
    if (index > -1) playNextList.value.splice(index, 1)
  } else {
    const index = list.value.findIndex(
      ([plugin, source]) => plugin === pluginId && isEqual(source, sourceContext)
    )
    if (index > -1) list.value.splice(index, 1)
  }
}

const copySourceContext = () => {
  const data = JSON.stringify({
    pluginId: rightClickedTrackComputed.value.pluginId,
    sourceContext: rightClickedTrackComputed.value.sourceContext
  })
  navigator.clipboard.writeText(data).then(() => {
    showToast(t('toast.copySuccess'))
  })
}

const addTrackToPlaylist = () => {
  let ids = [] as Record<string, any>[]
  let plugin: PluginId

  if (rightClickedTrackComputed.value.id === 0) {
    if (props.plugin === 'all') {
      showToast('在聚合视图下无法进行操作，请先选择具体的音源服务')
      return
    }
    ids = selectedList.value.map((it) => ({ pluginId: it[0], sourceContext: it[1] }))
    plugin = selectedList.value[0][0]
  } else {
    ids = [
      {
        pluginId: rightClickedTrackComputed.value.pluginId,
        sourceContext: rightClickedTrackComputed.value.sourceContext
      }
    ]
    plugin = rightClickedTrackComputed.value.pluginId
  }

  if (!isAccountLoggedIn(plugin)) {
    showToast(
      t('toast.needToLogin', {
        serviceName: services.value.find((s) => s.code === plugin)?.name || ''
      })
    )
    return
  }

  addTrackToPlaylistModal.value = {
    show: true,
    selectedTrackID: ids,
    plugin
  }
}

const openComment = () => {
  showComment.value = true
}

const closeComment = () => {
  showComment.value = false
  rightClickedTrack.value = {
    id: 0,
    name: '',
    type: 'online',
    pluginId: '' as PluginId,
    source: '',
    filePath: '',
    picUrl: '',
    mvid: 0,
    artists: [{ name: '' }],
    album: { picUrl: '' },
    sourceContext: {}
  }
  rightClickedTrackIndex.value = -1
}

const addToQueue = (ids: [PluginId, Record<string, any>][]) => {
  if (!ids) {
    ids = selectedList.value
  }
  addTrackToPlayNext(ids)
}
const updatePadding = inject('updatePadding') as (padding: number) => void
const removeTrack = inject('removeTrack', (idx: number) => {})

provide('playThisList', playThisList)
provide('selectedList', selectedList)
provide('rightClickedTrack', rightClickedTrack)
defineExpose({ selectAll, doFinish, addTrackToPlaylist, addToQueue })

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
