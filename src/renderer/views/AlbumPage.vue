<template>
  <div v-show="show" class="album-page">
    <div class="playlist-info">
      <Cover
        :id="album?.id || 0"
        :image-url="album?.picUrl + '?param=512y512'"
        :show-play-button="true"
        :always-show-shadow="true"
        :click-cover-to-play="true"
        :fixed-size="288"
        type="album"
        :cover-hover="true"
        :play-button-size="18"
      />
      <div class="info">
        <div class="title" :title="title"> {{ title }}</div>
        <div v-if="subtitle !== ''" class="subtitle">{{ subtitle }}</div>
        <div class="artist">
          <span v-if="album?.artist?.id !== 104700">
            <span>{{ album?.type }} by </span
            ><router-link :to="`/artist/${album?.artist?.id}`">{{
              album?.artist?.name
            }}</router-link></span
          >
          <span v-else>Compilation by Various Artists</span>
        </div>
        <div class="date-and-count">
          <span v-if="album?.mark === 1056768" class="explicit-symbol"><ExplicitSymbol /></span>
          <span :title="album?.publishTime">{{ new Date(album?.publishTime).getFullYear() }}</span>
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
            :icon-class="dynamicDetail.isSub ? 'heart-solid' : 'heart'"
            :icon-button="true"
            :horizontal-padding="0"
            :color="dynamicDetail?.isSub ? 'var(--color-primary)' : 'grey'"
            :text-color="dynamicDetail?.isSub ? 'var(--color-primary)' : ''"
            :background-color="dynamicDetail?.isSub ? 'var(--color-secondary-bg)' : ''"
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
          :id="album.id"
          :items="item.tracks"
          :item-height="48"
          :colunm-number="1"
          :is-end="false"
          :type="'album'"
          :album-object="album"
          :enable-virtual-scroll="false"
        />
      </div>
    </div>
    <div v-else>
      <TrackList
        :id="album.id"
        :items="tracks"
        :colunm-number="1"
        :item-height="48"
        :is-end="false"
        type="album"
        :album-object="album"
        :enable-virtual-scroll="false"
      />
    </div>
    <div class="extra-info">
      <div class="album-time"></div>
      <div class="release-date">
        {{ $t('album.released') }}
        {{ formatDate(album.publishTime, 'MMMM D, YYYY') }}
      </div>
      <div v-if="album.company" class="copyright"> © {{ album.company }} </div>
    </div>

    <div v-if="filteredMoreAlbums.length !== 0" class="more-by">
      <div class="section-title">
        More by
        <router-link :to="`/artist/${album.artist.id}`">{{ album.artist.name }}</router-link>
      </div>
      <div>
        <CoverRow
          type="album"
          :items="filteredMoreAlbums"
          :colunm-number="5"
          :is-end="true"
          :padding-bottom="0"
          :show-position="false"
          :item-height="260"
          sub-text="albumType+releaseYear"
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
        {{ album.description }}
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
      <CommentPage v-if="showComment" :id="album.id" type="album" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, inject } from 'vue'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'
import { tricklingProgress } from '../utils/tricklingProgress'
import Cover from '../components/CoverBox.vue'
import Modal from '../components/BaseModal.vue'
import ButtonTwoTone from '../components/ButtonTwoTone.vue'
import ContextMenu from '../components/ContextMenu.vue'
import { getAlbum, albumDynamicDetail, likeAAlbum } from '../api/album'
import { getTrackDetail } from '../api/track'
import { getArtistAlbum } from '../api/artist'
import { splitSoundtrackAlbumTitle, splitAlbumTitle } from '../utils/common'
import { formatTime, formatDate, openExternal } from '../utils'
import { groupBy, toPairs, sortBy } from 'lodash'
import TrackList from '../components/VirtualTrackList.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import CommentPage from '../components/CommentPage.vue'
import ExplicitSymbol from '../components/ExplicitSymbol.vue'
import { useI18n } from 'vue-i18n'
import { useNormalStateStore } from '../store/state'
import { usePlayerStore } from '../store/player'
import { isAccountLoggedIn } from '../utils/auth'
import { storeToRefs } from 'pinia'

const show = ref(false)
const album = ref<{ [key: string]: any }>({})
const tracks = ref<any[]>([])
const dynamicDetail = ref<{ [key: string]: any }>({})
const moreAlbums = ref<any[]>([])
const title = ref('')
const subtitle = ref('')
const albumMenu = ref()
const showComment = ref(false)
const showFullDescription = ref(false)

const { t } = useI18n()
const { showToast } = useNormalStateStore()

const albumTime = computed(() => {
  let time = 0
  tracks.value.map((t) => (time = time + t.dt))
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

const filteredMoreAlbums = computed(() => {
  const mAlbums = moreAlbums.value.filter((a) => a.id !== album.value.id)
  const realAlbums = mAlbums.filter((a) => a.type === '专辑')
  const eps = mAlbums.filter((a) => a.type === 'EP' || (a.type === 'EP/Single' && a.size > 1))
  const restItems = mAlbums.filter(
    (a) =>
      realAlbums.find((al) => al.id === a.id) === undefined &&
      eps.find((a1) => a1.id === a.id) === undefined
  )
  if (realAlbums.length === 0) {
    return [...realAlbums, ...eps, ...restItems].slice(0, 5)
  } else {
    return [...realAlbums, ...restItems].slice(0, 5)
  }
})

const formatTitle = () => {
  const splitTitle = splitSoundtrackAlbumTitle(album.value.name)
  const splitTitle2 = splitAlbumTitle(splitTitle.title)
  title.value = splitTitle2.title

  if (splitTitle.subtitle !== '' && splitTitle2.subtitle !== '') {
    subtitle.value = `${splitTitle.subtitle} · ${splitTitle2.subtitle}`
  } else {
    subtitle.value = splitTitle.subtitle === '' ? splitTitle2.subtitle : splitTitle.subtitle
  }
}

const toggleFullDescription = () => {
  showFullDescription.value = !showFullDescription.value
}

const playerStore = usePlayerStore()
const { _shuffle } = storeToRefs(playerStore)
const { replacePlaylist } = playerStore

const play = () => {
  const ids = tracks.value.map((t) => t.id)
  const idx = _shuffle.value ? Math.floor(Math.random() * ids.length) : 0
  replacePlaylist('album', album.value.id, ids, idx)
}

const likeAlbum = (toast = false) => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  likeAAlbum({ id: album.value.id, t: dynamicDetail.value.isSub ? 0 : 1 }).then((data) => {
    if (data.code === 200) {
      dynamicDetail.value.isSub = !dynamicDetail.value.isSub
      if (toast) {
        showToast(dynamicDetail.value.isSub ? '已保存到音乐库' : '已从音乐库删除')
      }
    }
  })
}

const openMenu = (e: MouseEvent) => {
  albumMenu.value.openMenu(e)
}

const copyURL = () => {
  const url = `https://music.163.com/#/album?id=${album.value.id}`
  navigator.clipboard.writeText(url).then(() => {
    showToast(t('toast.copySuccess'))
  })
}

const openOnBrowser = () => {
  const url = `https://music.163.com/#/album?id=${album.value.id}`
  openExternal(url)
}

const openComment = () => {
  showComment.value = true
}

const closeComment = () => {
  showComment.value = false
}

const loadData = (id: string) => {
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)

  getAlbum(Number(id)).then((data) => {
    album.value = data.album
    tracks.value = data.songs
    formatTitle()
    tricklingProgress.done()
    show.value = true

    const trackIDs = tracks.value.map((t) => t.id)
    getTrackDetail(trackIDs.join(',')).then((data) => {
      tracks.value = data.songs
    })

    getArtistAlbum({ id: album.value.artist.id, limit: 100 }).then((data) => {
      moreAlbums.value = data.hotAlbums
    })
  })

  albumDynamicDetail(Number(id)).then((data) => {
    dynamicDetail.value = data
  })
}
const route = useRoute()

const updatePadding = inject('updatePadding') as (padding: number) => void

onBeforeRouteUpdate((to, from, next) => {
  show.value = false
  loadData(to.params.id as string)
  next()
})

onMounted(() => {
  show.value = false
  updatePadding(96)
  loadData(route.params.id as string)
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
  background-color: var(--color-body-bg);
}
</style>
