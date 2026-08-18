<template>
  <div
    ref="dndWrapperRef"
    class="dnd-wrapper"
    @dragover.prevent="reorderable ? onDragOver($event) : undefined"
    @drop="reorderable ? onDrop($event) : undefined"
    @dragleave="reorderable ? onDragLeave() : undefined"
  >
    <VirtualScroll
      ref="virtualScrollRef"
      :list="displayItems"
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
      :frozen="dragState.isDragging"
    >
      <template #position="{ scrollToCurrent }">
        <div v-show="showScrollTo" @click="scrollToCurrent(currentIndex)"
          ><svg-icon icon-class="target"></svg-icon
        ></div>
      </template>
      <template #default="{ item, index }">
        <div class="track-item" :data-index="index">
          <TrackListItem
            :track-prop="item"
            :track-no="item.no || index + 1"
            :type-prop="type"
            :is-lyric="isLyric"
            :show-service="showService"
            :album-object="albumObject"
            :show-play-count="showPlayCount"
            :highlight-playing-track="highlightPlayingTrack"
            :reorderable="reorderable"
            :drag-index="index"
            @dragstart="onDragStart(index)"
            @dragend="onDragEnd()"
            @dblclick="playThisList(item.id)"
            @click.right="openMenu($event, item, index)"
          />
        </div>
      </template>
    </VirtualScroll>
    <div
      v-if="reorderable && dropIndicatorVisible"
      class="drop-indicator"
      :style="{ top: dropIndicatorTop + 'px' }"
    ></div>
  </div>
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
  onMounted,
  watch,
  nextTick
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
    pluginSourceContexts?: Record<PluginId, Record<string, any>>
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
    reorderable?: boolean
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
    pluginSourceContexts: () => ({}),
    itemHeight: 64,
    dbclickEnable: true,
    loadMore: () => {},
    showPlayCount: false,
    highlightPlayingTrack: true,
    paddingBottom: 96,
    enableVirtualScroll: true,
    reorderable: false
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
const { showToast, showConfirm } = stateStore
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

const showScrollTo = computed(() => {
  if (!currentTrack.value || !props.showTrackPosition) return false
  const currentPlugin = currentTrack.value.pluginId
  if (props.plugin !== 'all' && currentPlugin !== props.plugin) return false
  return isEqual(playlistSource.value.sourceContext.id, currentSource.value.sourceContext.id)
})
const currentIndex = computed(() => {
  return items.value.findIndex((item) => item.id === currentTrack.value?.id)
})

const playThisList = (index: number | string) => {
  if (!props.dbclickEnable) return

  const source: PlaylistSourceInfo = {
    type: props.type,
    plugin: props.plugin,
    sourceContext: props.sourceContext,
    pluginSourceContexts: props.pluginSourceContexts
  }

  const sourceItems = props.allItems?.length ? props.allItems : items.value
  const sourceContext: [PluginId, Record<string, any>][] = sourceItems.map((track) => [
    track.pluginId,
    track.sourceContext
  ])
  const idx = sourceItems.findIndex((item) => item.id === index)
  replacePlaylist(source, sourceContext, idx)
}

const closeMenu = async () => {
  if (showComment.value) return
  await nextTick()
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

const rmTrackFromPlaylist = async () => {
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
    await showConfirm(
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
const removeTrack = inject<(idx: number) => void>('removeTrack', () => {})

// 排序持久化改为关闭排序模式时批量写入，每步拖拽不再 emit

// ── 拖拽排序 ──
const virtualScrollRef = ref<any>()
const dndWrapperRef = ref<HTMLElement>()

/** reorderable 时维护本地 items 副本，拖拽不依赖于只读 prop */
const localReorderItems = ref<Track[]>([])

/** 显示用的列表：reorderable 时用本地副本，否则用 prop */
const displayItems = computed(() => (props.reorderable ? localReorderItems.value : items.value))

/** 同步本地副本 */
watch(
  () => props.items,
  (newItems) => {
    if (props.reorderable) localReorderItems.value = [...newItems]
  },
  { deep: true }
)

watch(
  () => props.reorderable,
  (val) => {
    if (val) localReorderItems.value = [...items.value]
  },
  { immediate: true }
)

const dragState = ref<{
  sourceIndex: number
  targetIndex: number | null
  indicatorTop: number | null
  isDragging: boolean
  ghostY: number
}>({
  sourceIndex: -1,
  targetIndex: null,
  indicatorTop: null,
  isDragging: false,
  ghostY: 0
})

let autoScrollTimer: number | null = null
const SCROLL_EDGE = 50
const SCROLL_SPEED = 6

const dropIndicatorVisible = computed(
  () => dragState.value.isDragging && dragState.value.indicatorTop !== null
)
const dropIndicatorTop = computed(() => dragState.value.indicatorTop ?? 0)

function startAutoScroll(direction: -1 | 1) {
  if (autoScrollTimer !== null) return
  autoScrollTimer = window.setInterval(() => {
    const container = virtualScrollRef.value?.listRef
    if (!container) return
    container.scrollTop += direction * SCROLL_SPEED
  }, 16)
}

function stopAutoScroll() {
  if (autoScrollTimer !== null) {
    clearInterval(autoScrollTimer)
    autoScrollTimer = null
  }
}

/** 根据鼠标 Y 坐标计算落点索引（数据层索引） */
function getDropIndex(clientY: number): { index: number; top: number } | null {
  const vs = virtualScrollRef.value
  const container = vs?.listRef
  if (!container) return null

  const rect = container.getBoundingClientRect()
  const offsetInContainer = clientY - rect.top + container.scrollTop
  const rowIdx = vs.getStartIndex(offsetInContainer)

  if (rowIdx == null || rowIdx >= vs.position.length) {
    return { index: displayItems.value.length, top: container.scrollHeight }
  }

  const row = vs.position[rowIdx * colunmNumber.value]
  if (!row) return null

  const rowMid = row.top + row.height / 2
  const insertAfter = offsetInContainer > rowMid

  let dropIndex = insertAfter ? Math.min(rowIdx + 1, displayItems.value.length) : rowIdx
  const indicatorTop = insertAfter ? row.bottom : row.top

  // 拖拽源移除后目标索引偏移
  if (dragState.value.sourceIndex >= 0 && dragState.value.sourceIndex < dropIndex) {
    dropIndex--
  }

  return { index: dropIndex, top: indicatorTop }
}

function onDragStart(index: number) {
  dragState.value = {
    sourceIndex: index,
    targetIndex: null,
    indicatorTop: null,
    isDragging: true,
    ghostY: 0
  }
}

function onDragEnd() {
  stopAutoScroll()
  dragState.value = {
    sourceIndex: -1,
    targetIndex: null,
    indicatorTop: null,
    isDragging: false,
    ghostY: 0
  }
}

function onDragOver(e: DragEvent) {
  if (!dragState.value.isDragging) return
  dragState.value.ghostY = e.clientY

  const result = getDropIndex(e.clientY)
  if (!result) return

  dragState.value.targetIndex = result.index

  const container = virtualScrollRef.value?.listRef
  const wrapper = dndWrapperRef.value
  if (container && wrapper) {
    const containerRect = container.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()
    dragState.value.indicatorTop =
      result.top - container.scrollTop + (containerRect.top - wrapperRect.top)
  }

  // 边界自动滚动
  if (!container) return
  const rect = container.getBoundingClientRect()
  const relativeY = e.clientY - rect.top
  if (relativeY < SCROLL_EDGE) {
    startAutoScroll(-1)
  } else if (relativeY > rect.height - SCROLL_EDGE) {
    startAutoScroll(1)
  } else {
    stopAutoScroll()
  }
}

function onDragLeave() {
  stopAutoScroll()
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  stopAutoScroll()

  if (!dragState.value.isDragging) return
  const target = dragState.value.targetIndex
  const source = dragState.value.sourceIndex
  if (target == null || source < 0 || source === target) {
    onDragEnd()
    return
  }

  const sourceIdx = dragState.value.sourceIndex as number
  const targetIdx = dragState.value.targetIndex as number

  // 操作本地数组（本地副本 = 数据层，直接 splice）
  const newList = [...localReorderItems.value]
  const [moved] = newList.splice(sourceIdx, 1)
  newList.splice(targetIdx, 0, moved)
  localReorderItems.value = newList

  onDragEnd()
}

/**
 * 将拖拽后的本地排序一次性持久化到数据库
 * 由父组件在关闭排序模式时调用
 */
async function saveReorder() {
  if (props.plugin === 'all' || !localReorderItems.value.length) return
  const orderedIds = localReorderItems.value.map((t: Track) => String(t.sourceContext?.id ?? ''))
  await pluginStore.pluginMethodCall(props.plugin as PluginId, 'reorderPlaylistTracks', {
    id: props.sourceContext.id,
    orderedIds
  })
  return localReorderItems.value
}

provide('playThisList', playThisList)
provide('selectedList', selectedList)
provide('rightClickedTrack', rightClickedTrack)
defineExpose({ selectAll, doFinish, addTrackToPlaylist, addToQueue, saveReorder })

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
.dnd-wrapper {
  position: relative;
}

.track-item {
  width: 100%;
  // padding-bottom: 4px;
}

.drop-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-primary);
  z-index: 10;
  pointer-events: none;
  border-radius: 2px;
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
