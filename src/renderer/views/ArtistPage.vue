<template>
  <div v-if="show" class="artist-page">
    <div class="artist-info">
      <div class="head">
        <img :src="image" loading="lazy" />
      </div>
      <div>
        <div class="name">{{ artist.name }}</div>
        <div class="artist">{{ $t('artist.artist') }}</div>
        <div class="statistics">
          <a @click="scrollTo('popularTracks')">{{ artist.musicSize }} {{ $t('common.songs') }}</a>
          ·
          <a @click="scrollTo('seeMore', 'start')"
            >{{ artist.albumSize }} {{ $t('artist.withAlbums') }}</a
          >
          ·
          <a @click="scrollTo('mvs')">{{ artist.mvSize }} {{ $t('artist.videos') }}</a>
        </div>
        <div class="description" @click="toggleFullDescription">
          {{ artist.briefDesc }}
        </div>
        <div class="buttons">
          <ButtonTwoTone icon-class="play" @click="playPopularSongs()">
            {{ $t('common.play') }}
          </ButtonTwoTone>
          <ButtonTwoTone color="grey" @click="followArtist">
            <span v-if="artist.followed">{{ $t('artist.following') }}</span>
            <span v-else>{{ $t('artist.follow') }}</span>
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

    <div v-if="latestRelease !== undefined" class="latest-release">
      <div class="section-title">{{ $t('artist.latestRelease') }}</div>
      <div class="release">
        <div class="container">
          <Cover
            :id="latestRelease.id"
            :image-url="latestRelease.picUrl"
            type="album"
            :fixed-size="128"
            :play-button-size="30"
          />
          <div class="info">
            <div class="name">
              <router-link :to="`/album/${latestRelease.id}`">{{ latestRelease.name }}</router-link>
            </div>
            <div class="date">
              {{ formatDate(latestRelease.publishTime) }}
            </div>
            <div class="type">
              {{ formatAlbumType(latestRelease.type, latestRelease) }} · {{ latestRelease.size }}
              {{ $t('common.songs') }}
            </div>
          </div>
        </div>
        <div v-show="latestMV.id" class="container latest-mv">
          <div
            class="cover"
            @mouseover="mvHover = true"
            @mouseleave="mvHover = false"
            @click="goToMv(latestMV.id)"
          >
            <img :src="latestMV.coverUrl" loading="lazy" />
            <transition name="fade">
              <div
                v-show="mvHover"
                class="shadow"
                :style="{
                  background: 'url(' + latestMV.coverUrl + ')'
                }"
              ></div>
            </transition>
          </div>
          <div class="info">
            <div class="name">
              <router-link :to="'/mv/' + latestMV.id">{{ latestMV.name }}</router-link>
            </div>
            <div class="date">
              {{ formatDate(latestMV.publishTime) }}
            </div>
            <div class="type">{{ $t('artist.latestMV') }}</div>
          </div>
        </div>
        <!-- <div v-show="!latestMV.id"></div> -->
      </div>
    </div>

    <div id="popularTracks" class="popular-tracks">
      <div class="section-title">{{ $t('artist.popularSongs') }}</div>
      <TrackList
        :items="popularTracks.slice(0, showMorePopTracks ? 24 : 12)"
        :type="'tracklist'"
        :colunm-number="4"
        :item-height="60"
        :is-end="false"
        :gap="4"
        :show-position="true"
        :highlight-playing-track="false"
      />
      <div id="seeMore" class="show-more">
        <button @click="showMorePopTracks = !showMorePopTracks">
          <span v-show="!showMorePopTracks">{{ $t('artist.showMore') }}</span>
          <span v-show="showMorePopTracks">{{ $t('artist.showLess') }}</span>
        </button>
      </div>
    </div>

    <div v-if="albums.length !== 0" id="albums" class="albums">
      <div class="section-title">{{ $t('artist.albums') }}</div>
      <CoverRow
        :type="'album'"
        :items="albums"
        :item-height="240"
        :show-position="false"
        :colunm-number="5"
        :is-end="false"
        :sub-text="'releaseYear'"
        :show-play-button="true"
      />
    </div>

    <div v-if="MVs.length !== 0" id="mvs" class="mvs">
      <div class="section-title"
        >MVs
        <router-link v-show="hasMoreMV" :to="`/artist/${artist.id}/mv`">{{
          $t('home.seeMore')
        }}</router-link>
      </div>
      <MvRow :mvs="MVs" subtitle="publishTime" />
    </div>

    <div v-if="eps.length !== 0" class="eps">
      <div class="section-title">{{ $t('artist.EPsSingles') }}</div>
      <CoverRow
        :type="'album'"
        :items="eps"
        :colunm-number="5"
        :item-height="240"
        :container-height="600"
        :is-end="false"
        :sub-text="'albumType+releaseYear'"
        :show-play-button="true"
      />
    </div>

    <div v-if="simiArtists.length !== 0" class="similar-artists">
      <div class="section-title">{{ $t('artist.similarArtists') }}</div>
      <CoverRow
        type="artist"
        :colunm-number="6"
        :is-end="true"
        :padding-bottom="0"
        :items="simiArtists.slice(0, 12)"
        :item-height="194"
      />
    </div>

    <Modal
      :show="showFullDescription"
      :close-fn="toggleFullDescription"
      :show-footer="false"
      :title="$t('artist.artistDesc')"
    >
      <p class="description-fulltext">{{ artist.briefDesc }}</p>
    </Modal>

    <ContextMenu ref="artistMenu">
      <div class="item" @click="copyURL">{{ $t('contextMenu.copyURL') }}</div>
      <div class="item" @click="openOnBrowser">{{ $t('contextMenu.openOnBrowser') }}</div>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { ref, onActivated, onDeactivated, onMounted, onBeforeUnmount, computed, inject } from 'vue'
import ButtonTwoTone from '../components/ButtonTwoTone.vue'
import Modal from '../components/BaseModal.vue'
import MvRow from '../components/MvRow.vue'
import TrackList from '../components/VirtualTrackList.vue'
import ContextMenu from '../components/ContextMenu.vue'
import Cover from '../components/CoverBox.vue'
import CoverRow from '../components/CoverRow.vue'
import { usePlayerStore } from '../store/player'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'
import { tricklingProgress } from '../utils/tricklingProgress'
import { getArtist, getArtistAlbum, artistMv, similarArtists, followAnArtist } from '../api/artist'
import { getTrackDetail } from '../api/track'
import { formatDate, formatAlbumType, openExternal } from '../utils'
import { isAccountLoggedIn } from '../utils/auth'
import { useNormalStateStore } from '../store/state'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

const show = ref(false)
const artist = ref<{ [key: string]: any }>({})
const popularTracks = ref<any[]>([])
const albumsData = ref<any[]>([])
const latestRelease = ref<{ [key: string]: any }>({
  picUrl: '',
  publishTime: 0,
  id: 0,
  name: '',
  type: '',
  size: ''
})
const simiArtists = ref<any[]>([])
const MVs = ref<any[]>([])
const mvHover = ref(false)
const hasMoreMV = ref(false)
const showMorePopTracks = ref(false)
const showFullDescription = ref(false)
const artistMenu = ref()

const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { t } = useI18n()

const image = computed(() => artist.value?.img1v1Url + '?param=512y512')
const latestMV = computed(() => {
  const mv = MVs.value[0] || {}
  return {
    id: mv.id || mv.vid,
    name: mv.name || mv.title,
    coverUrl: `${mv.imgurl16v9 || mv.cover || mv.coverUrl}?param?464y260`,
    publishTime: mv.publishTime
  }
})
const albums = computed(() => albumsData.value.filter((a) => a.type === '专辑'))
const eps = computed(() =>
  albumsData.value.filter((a) => ['EP/Single', 'EP', 'Single'].includes(a.type))
)

const playerStore = usePlayerStore()
const { _shuffle } = storeToRefs(playerStore)
const { replacePlaylist } = playerStore

const route = useRoute()
const loadData = (id: string, next: any = undefined) => {
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)
  show.value = false

  getArtist(Number(id)).then((res) => {
    artist.value = res.artist
    const ids = res.hotSongs.map((t) => t.id)
    getTrackDetail(ids.join(',')).then((data) => {
      popularTracks.value = data.songs
    })
    if (next !== undefined) next()
    tricklingProgress.done()
    show.value = true
  })

  getArtistAlbum({ id: Number(id), limit: 200 }).then((data) => {
    albumsData.value = data.hotAlbums
    latestRelease.value = data.hotAlbums[0]
  })

  artistMv({ id: Number(id) }).then((data) => {
    MVs.value = data.mvs
    hasMoreMV.value = data.hasMore
  })

  similarArtists(Number(id)).then((data) => {
    simiArtists.value = data.artists
  })
}

const goToMv = (id: string) => {}
const updatePadding = inject('updatePadding') as (padding: number) => void

const scrollTo = (div: string, block = 'center') => {}

const playPopularSongs = () => {
  const ids = popularTracks.value.map((t) => t.id)
  const idx = _shuffle.value ? Math.floor(Math.random() * ids.length) : 0
  replacePlaylist('artist', artist.value.id, ids, idx)
}

const toggleFullDescription = () => {
  showFullDescription.value = !showFullDescription.value
}

const followArtist = () => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  followAnArtist({
    id: artist.value.id,
    t: artist.value.followed ? 0 : 1
  }).then((data) => {
    if (data.code === 200) artist.value.followed = !artist.value.followed
  })
}

const copyURL = () => {
  const url = `https://music.163.com/#/artist?id=${artist.value.id}`
  navigator.clipboard.writeText(url).then(() => {
    showToast(t('toast.copySuccess'))
  })
}

const openOnBrowser = () => {
  const url = `https://music.163.com/#/artist?id=${artist.value.id}`
  openExternal(url)
}

const openMenu = (e: MouseEvent) => {
  artistMenu.value.openMenu(e)
}

onBeforeRouteUpdate((to, from, next) => {
  artist.value.img1v1Url = 'https://p1.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg'
  loadData(to.params.id as string, next)
})

onActivated(() => {
  if (artist.value?.id?.toString() !== route.params.id) {
    loadData(route.params.id as string)
  }
  setTimeout(() => {
    updatePadding(96)
  }, 100)
})

onDeactivated(() => {
  setTimeout(() => {
    updatePadding(96)
  }, 100)
})

onMounted(() => {
  loadData(route.params.id as string)
  setTimeout(() => {
    updatePadding(96)
  }, 100)
})

onBeforeUnmount(() => {
  updatePadding(96)
})
</script>

<style scoped>
.artist-page {
  margin-top: 32px;
}

.artist-info {
  display: flex;
  align-items: center;
  margin-bottom: 26px;
  color: var(--color-text);
  img {
    height: 248px;
    width: 248px;
    border-radius: 50%;
    margin-right: 56px;
    box-shadow: rgba(0, 0, 0, 0.2) 0px 12px 16px -8px;
  }
  .name {
    font-size: 56px;
    font-weight: 700;
  }

  .artist {
    font-size: 18px;
    opacity: 0.88;
    margin-top: 24px;
  }

  .statistics {
    font-size: 14px;
    opacity: 0.68;
    margin-top: 2px;
  }

  .buttons {
    margin-top: 26px;
    display: flex;
    .shuffle {
      padding: 8px 11px;
      .svg-icon {
        margin: 0;
      }
    }
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
}

.section-title {
  font-weight: 600;
  font-size: 22px;
  opacity: 0.88;
  color: var(--color-text);
  margin-bottom: 16px;
  padding-top: 26px;

  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  a {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.68;
  }
}

.latest-release {
  color: var(--color-text);
  .release {
    display: flex;
  }
  .container {
    display: flex;
    flex: 1;
    align-items: center;
    border-radius: 12px;
  }
  img {
    height: 96px;
    border-radius: 8px;
  }
  .info {
    margin-left: 24px;
  }
  .name {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .date {
    font-size: 14px;
    opacity: 0.78;
  }
  .type {
    margin-top: 2px;
    font-size: 12px;
    opacity: 0.68;
  }
}

.similar-artists {
  /* margin-bottom: 20px; */
  .section-title {
    margin-bottom: 24px;
  }
}

.popular-tracks {
  .show-more {
    display: flex;

    button {
      padding: 4px 8px;
      margin-top: 8px;
      border-radius: 6px;
      font-size: 12px;
      opacity: 0.78;
      color: var(--color-secondary);
      font-weight: 600;
      &:hover {
        opacity: 1;
      }
    }
  }
}

/* .albums {
  margin-bottom: 20px;
} */

.mvs {
  padding-bottom: 20px;
}

.latest-mv {
  .cover {
    position: relative;
    transition: transform 0.3s;
    &:hover {
      cursor: pointer;
    }
  }
  img {
    border-radius: 0.75em;
    height: 128px;
    object-fit: cover;
    user-select: none;
  }

  .shadow {
    position: absolute;
    top: 6px;
    height: 100%;
    width: 100%;
    filter: blur(16px) opacity(0.4);
    transform: scale(0.9, 0.9);
    z-index: -1;
    background-size: cover;
    border-radius: 0.75em;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s;
  }
  .fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
    opacity: 0;
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
</style>
