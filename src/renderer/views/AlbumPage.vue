<template>
  <div v-show="show" class="album-page">
    <div class="playlist-info">
      <Cover
        :id="album?.id || 0"
        :plugin-id="album?.pluginId || ''"
        :source-context="album?.sourceContext || {}"
        :image-url="album?.picUrl || ''"
        :show-play-button="true"
        :always-show-shadow="true"
        :click-cover-to-play="true"
        :fixed-size="288"
        type="Album"
        :cover-hover="true"
        :play-button-size="18"
      />
      <div class="info">
        <div class="title" :title="title"> {{ album?.name || '' }}</div>
        <div v-if="subtitle !== ''" class="subtitle">{{ subtitle }}</div>
        <div class="artist">
          <span v-if="album?.artists?.[0]?.id !== 104700">
            <span>{{ album?.type }} by </span
            ><router-link
              :to="`/artist/${album?.pluginId}/${JSON.stringify(album?.artists?.[0].sourceContext)}`"
              >{{ album?.artists?.[0].name }}</router-link
            ></span
          >
          <span v-else>Compilation by Various Artists</span>
        </div>
        <div class="date-and-count">
          <span v-if="album?.isExplicit" class="explicit-symbol"><ExplicitSymbol /></span>
          <span :title="`${album?.publishTime}`">{{
            new Date(album?.publishTime || 0).getFullYear()
          }}</span>
          <span> · {{ album?.size }} {{ $t('common.songs') }}</span
          >,
          {{ formatTime(albumTime, 'Human') }}
        </div>
        <div class="description" @click="toggleFullDescription">
          {{ album?.description }}
        </div>
        <div class="buttons" style="margin-top: 32px">
          <ButtonTwoTone icon-class="play" @click="play">
            {{ $t('common.play') }}
          </ButtonTwoTone>
          <ButtonTwoTone icon-class="floor-comment" @click="openComment">
            {{ '评论' }}
          </ButtonTwoTone>
          <ButtonTwoTone
            :icon-class="album?.subscribed ? 'heart-solid' : 'heart'"
            :icon-button="true"
            :horizontal-padding="0"
            :color="album?.subscribed ? 'var(--color-primary)' : 'grey'"
            :text-color="album?.subscribed ? 'var(--color-primary)' : ''"
            :background-color="album?.subscribed ? 'var(--color-secondary-bg)' : ''"
            @click="likeAlbum"
          >
          </ButtonTwoTone>
          <ButtonTwoTone
            icon-class="more"
            :icon-button="true"
            :horizontal-padding="0"
            color="grey"
            @click="openMenu"
          >
          </ButtonTwoTone>
        </div>
      </div>
    </div>

    <div v-if="tracksByDisc.length > 1">
      <div v-for="item in tracksByDisc" :key="item.disc" :style="{ marginBottom: '20px' }">
        <h2 class="disc">Disc {{ item.disc }}</h2>
        <TrackList
          :items="item.tracks"
          :all-items="tracks"
          :item-height="48"
          :plugin="pluginId"
          :source-context="sourceContext"
          :colunm-number="1"
          :is-end="false"
          :type="'Album'"
          :album-object="{ artist: album?.artists[0] || { name: '' } }"
          :enable-virtual-scroll="false"
        />
      </div>
    </div>
    <div v-else>
      <TrackList
        :items="tracks"
        :plugin="pluginId"
        :source-context="sourceContext"
        :colunm-number="1"
        :item-height="48"
        :is-end="false"
        type="Album"
        :album-object="{ artist: album?.artists[0] || { name: '' } }"
        :enable-virtual-scroll="false"
      />
    </div>
    <div class="extra-info">
      <div class="album-time"></div>
      <div class="release-date">
        {{ $t('album.released') }}
        {{ formatDate(album?.publishTime, 'MMMM D, YYYY') }}
      </div>
      <div v-if="album?.company" class="copyright"> © {{ album?.company }} </div>
    </div>

    <div v-if="moreAlbums.data.length !== 0" class="more-by">
      <div class="section-title">
        More by
        <router-link
          :to="`/artist/${album?.pluginId}/${JSON.stringify(album?.artists[0].sourceContext)}`"
          >{{ album?.artists[0].name }}</router-link
        >
      </div>
      <div>
        <CoverRow
          type="Album"
          :items="moreAlbums.data"
          :colunm-number="5"
          :is-end="true"
          :padding-bottom="0"
          :show-position="false"
          :item-height="260"
          sub-text="copywriter"
        ></CoverRow>
      </div>
    </div>

    <Modal
      :show="showFullDescription"
      :close-fn="toggleFullDescription"
      :show-footer="false"
      :click-outside-hide="true"
      :title="$t('album.albumDesc')"
    >
      <p class="description-fulltext">
        {{ album?.description }}
      </p>
    </Modal>

    <ContextMenu ref="albumMenu">
      <div class="item" @click="copyURL">{{ $t('contextMenu.copyURL') }}</div>
      <div class="item" @click="openOnBrowser">{{ $t('contextMenu.openOnBrowser') }}</div>
    </ContextMenu>
  </div>
  <div v-show="showComment" class="comment" @click="closeComment">
    <div></div>
    <div class="comment-container" @click.stop>
      <CommentPage
        v-if="showComment && album"
        :id="album.id"
        :plugin="album.pluginId"
        :source-context="album.sourceContext"
        type="album"
        :style="{ width: '100%', padding: '40px 4vh 10px 4vh' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, inject, reactive } from 'vue'
import { useRoute, onBeforeRouteUpdate } from 'vue-router'
import { tricklingProgress } from '../utils/tricklingProgress'
import Cover from '../components/CoverBox.vue'
import Modal from '../components/BaseModal.vue'
import ButtonTwoTone from '../components/ButtonTwoTone.vue'
import ContextMenu from '../components/ContextMenu.vue'
import { formatTime, formatDate, openExternal } from '../utils'
import { groupBy, toPairs, sortBy } from 'lodash'
import TrackList from '../components/VirtualTrackList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import CommentPage from '../components/CommentPage.vue'
import ExplicitSymbol from '../components/ExplicitSymbol.vue'
import { useI18n } from 'vue-i18n'
import { useNormalStateStore } from '../store/state'
import { usePluginMusic } from '../store/pluginMusic'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import { Album, AlbumDetail, PluginId, Track } from '@/types/plugin'

const show = ref(false)
const album = ref<AlbumDetail>()
const tracks = ref<Track[]>([])

const moreAlbums = reactive<{ data: Album[]; sourceContext: Record<string, any> }>({
  data: [],
  sourceContext: {}
})
const title = ref('')
const subtitle = ref('')
const albumMenu = ref()
const showComment = ref(false)
const showFullDescription = ref(false)
const pluginId = ref('' as PluginId)
const sourceContext = ref<Record<string, any>>({})

const { t } = useI18n()
const { showToast } = useNormalStateStore()

const pluginStore = usePluginMusic()
const { pluginMethodCall, isAccountLoggedIn } = pluginStore

const albumTime = computed(() => {
  let time = 0
  tracks.value.map((t) => (time = time + t.duration))
  return time
})

const tracksByDisc = computed(() => {
  if (tracks.value.length <= 1) return []
  const pairs = toPairs(groupBy(tracks.value, 'cd'))
  return sortBy(pairs, (p) => p[0]).map((items) => ({
    disc: items[0],
    tracks: items[1]
  }))
})

const toggleFullDescription = () => {
  showFullDescription.value = !showFullDescription.value
}

const playerStore = usePlayerStore()
const { isShuffle } = storeToRefs(playerStore)
const { replacePlaylist } = playerStore

const play = () => {
  const ids = tracks.value.map((t) => [t.pluginId, t.sourceContext]) as [
    PluginId,
    Record<string, any>
  ][]
  const idx = isShuffle.value ? Math.floor(Math.random() * ids.length) : 0
  replacePlaylist(
    { type: 'Album', plugin: pluginId.value, sourceContext: album.value?.sourceContext || {} },
    ids,
    idx
  )
}

const likeAlbum = () => {
  if (!isAccountLoggedIn(pluginId.value)) {
    showToast(t('toast.needToLogin'))
    return
  }

  const op = album.value?.subscribed ? 'del' : 'add'
  pluginMethodCall(pluginId.value, 'subscribeAlbum', {
    op,
    name: album.value?.name,
    ...album.value?.sourceContext
  }).then((result) => {
    if (result.code !== 200 || !album.value) return
    album.value.subscribed = !album.value.subscribed
  })
}

const openMenu = (e: MouseEvent) => {
  albumMenu.value.openMenu(e)
}

const copyURL = () => {
  if (!album.value) return
  const url = `https://music.163.com/#/album?id=${album.value.id}`
  navigator.clipboard.writeText(url).then(() => {
    showToast(t('toast.copySuccess'))
  })
}

const openOnBrowser = () => {
  if (!album.value) return
  const url = `https://music.163.com/#/album?id=${album.value.id}`
  openExternal(url)
}

const openComment = () => {
  showComment.value = true
}

const closeComment = () => {
  showComment.value = false
}

const loadData = (plugin: PluginId, params: Record<string, any>) => {
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)

  pluginMethodCall(plugin, 'albumDetail', params).then((result) => {
    if (!result.data) return
    album.value = { ...result.data, pluginId: plugin }
    tracks.value = (result.data || { songs: [] }).songs.map((song) => ({
      ...song,
      album: {
        ...song.album,
        artists: song.album.artists?.map((it) => ({ ...it, pluginId: plugin })),
        pluginId: plugin
      },
      artists: song.artists.map((it) => ({ ...it, pluginId: plugin })),
      pluginId: plugin
    }))
    tricklingProgress.done()
    show.value = true

    pluginMethodCall(plugin, 'artistAlbums', {
      id: album.value.artists?.[0].id
    }).then((res) => {
      moreAlbums.data = res.data
        .filter((item) => String(item.id) !== String(album.value?.id))
        .slice(0, 5)
        .map((item) => ({
          ...item,
          artists: item.artists?.map((it) => ({ ...it, pluginId: plugin })),
          pluginId: plugin
        }))
      moreAlbums.sourceContext = res.sourceContext
    })
  })
}
const route = useRoute()

const updatePadding = inject('updatePadding') as (padding: number) => void

onBeforeRouteUpdate((to, from, next) => {
  show.value = false
  const { pluginId: plugin, sourceContext: source } = to.params
  pluginId.value = plugin as PluginId
  sourceContext.value = JSON.parse(source as string)
  loadData(plugin as PluginId, sourceContext.value)
  next()
})

onMounted(() => {
  show.value = false
  updatePadding(96)
  const { pluginId: plugin, sourceContext: source } = route.params
  pluginId.value = plugin as PluginId
  sourceContext.value = JSON.parse(source as string)
  loadData(plugin as PluginId, sourceContext.value)
})
</script>

<style scoped lang="scss">
.album-page {
  margin-top: 32px;
}
.playlist-info {
  display: flex;
  width: 78vw;
  margin-bottom: 72px;
  .info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1;
    margin-left: 56px;
    color: var(--color-text);
    .title {
      font-size: 52px;
      font-weight: 700;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      line-clamp: 1;
      overflow: hidden;
    }
    .subtitle {
      font-size: 22px;
      font-weight: 600;
    }
    .artist {
      font-size: 18px;
      opacity: 0.88;
      margin-top: 20px;
      a {
        font-weight: 600;
      }
    }
    .date-and-count {
      font-size: 14px;
      opacity: 0.68;
      margin-top: 2px;
    }
    .description {
      user-select: none;
      font-size: 14px;
      opacity: 0.68;
      margin-top: 24px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      cursor: pointer;
      white-space: pre-line;
      &:hover {
        transition: opacity 0.3s;
        opacity: 0.88;
      }
    }
    .buttons {
      margin-top: 30px;
      display: flex;
      button {
        margin-right: 16px;
      }
    }
  }
}
.disc {
  color: var(--color-text);
}

.explicit-symbol {
  opacity: 0.28;
  color: var(--color-text);
  margin-right: 4px;
  .svg-icon {
    margin-bottom: -3px;
  }
}

.extra-info {
  margin-top: 36px;
  margin-bottom: 36px;
  font-size: 12px;
  opacity: 0.48;
  color: var(--color-text);
  div {
    margin-bottom: 4px;
  }
  .album-time {
    opacity: 0.68;
  }
}

.more-by {
  border-top: 1px solid rgba(128, 128, 128, 0.18);

  padding: 22px 0;
  .section-title {
    font-size: 22px;
    font-weight: 600;
    opacity: 0.88;
    color: var(--color-text);
    margin-bottom: 20px;
  }
}
.description-fulltext {
  font-size: 16px;
  margin-top: 24px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-line;
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

.comment-container {
  height: 100vh;
  box-sizing: border-box;
  background-color: var(--color-body-bg);
}
</style>
