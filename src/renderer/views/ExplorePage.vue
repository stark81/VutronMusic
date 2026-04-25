<template>
  <div class="explore-page">
    <div v-if="exploreTab === 'playlist'">
      <div class="buttons">
        <div
          v-for="category in staticTags"
          :key="category?.name"
          class="button"
          :class="{ active: category.name === activeTags.playlist && !showCatOptions }"
          @click="updatePlistCat(category?.name ?? '')"
        >
          {{ category.name }}
        </div>
        <div
          class="button more"
          :class="{ active: showCatOptions }"
          @click="showCatOptions = !showCatOptions"
        >
          <svg-icon icon-class="more"></svg-icon>
        </div>
      </div>

      <div v-show="showCatOptions" class="panel">
        <div v-for="bigCat in tagLists" :key="bigCat.name" class="big-cat">
          <div class="name">{{ bigCat.name }}</div>
          <div class="cats">
            <div
              v-for="cat in getCatsByBigCat(bigCat.name)"
              :key="cat.name"
              class="cat"
              :class="{
                active: staticTags.map((it) => it.name).includes(cat.name)
              }"
              @click="togglePlaylistCategory(cat.name)"
              ><span>{{ cat.name }}</span></div
            >
          </div>
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'chart'" class="chart-list">
      <div v-for="(lst, index) in data.chart.showList" :key="index" class="chart-item">
        <div class="img">
          <Cover
            :id="lst?.id"
            :type="'Playlist'"
            :plugin-id="pluginId"
            :source-context="lst.sourceContext"
            :image-url="lst?.picUrl"
            class="cover"
          />
          <div class="update">{{ lst?.copywriter }}</div>
        </div>
        <div class="track">
          <div v-for="track in lst?.tracks" :key="track.name" class="track-item"
            >{{ `${track.name}  -  ${track.artist}` }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'artist'">
      <div class="panel" style="background-color: unset">
        <div
          v-for="bigCat in artistCategory[pluginId]"
          :key="bigCat.name"
          class="big-cat"
          style="margin-bottom: 10px"
        >
          <div class="name">{{ bigCat.name }}</div>
          <div class="cats">
            <!-- active: activeArtistCat.includes(cat) -->
            <div
              v-for="cat in getArtistCatsByBigCat(bigCat.name)"
              :key="cat.name"
              class="cat unset"
              :class="{
                active:
                  cat.name === activeTags?.artist.find(([big, _cat]) => big === bigCat.name)?.[1]
              }"
              @click="toggleArtistCategory(bigCat.name, cat.name)"
              ><span>{{ cat.name }}</span></div
            >
          </div>
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'newTrack'">
      <div class="buttons">
        <div
          v-for="category in trackTags"
          :key="category.name"
          class="button"
          :class="{ active: category.name === activeTags.track }"
          @click="updateTrackCat(category.name)"
        >
          {{ category.name }}
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'newAlbum'" class="albumsTab">
      <div class="buttons">
        <div
          v-for="category in albumCategory[pluginId]"
          :key="category.name"
          class="button"
          :class="{ active: category.name === activeTags.album }"
          @click="updateAlbumCat(category.name)"
        >
          {{ category.name }}
        </div>
      </div>
    </div>

    <div v-if="exploreTab === 'newTrack'" class="playlists">
      <TrackList
        :items="data.newTrack"
        :plugin="pluginId"
        :source-context="{ id: 'newTrack' }"
        :colunm-number="1"
        :type="'Playlist'"
        :is-end="true"
      />
    </div>
    <div v-else-if="exploreTab === 'newAlbum'" class="playlists">
      <CoverRow
        v-if="show"
        :items="data.newAlbum"
        :type="'Album'"
        :sub-text="'artist'"
        :show-play-button="false"
        :show-play-count="false"
        :show-position="true"
        :padding-bottom="0"
        :colunm-number="5"
        :is-end="true"
        :load-more="loadMore"
      />
    </div>
    <div v-else class="playlists">
      <CoverRow
        v-if="show"
        :items="exploreTab === 'playlist' ? data.playlist : data[exploreTab].data"
        :type="exploreTab === 'artist' ? 'Artist' : 'Playlist'"
        :sub-text="'copywriter'"
        :show-play-button="true"
        :show-position="true"
        :padding-bottom="0"
        :is-end="true"
        :show-play-count="exploreTab !== 'chart' && exploreTab !== 'artist' ? true : false"
        :item-height="exploreTab === 'artist' ? 224 : 270"
        :colunm-number="5"
        :load-more="loadMore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount, reactive, inject, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import { usePluginMusic } from '../store/pluginMusic'
import SvgIcon from '../components/SvgIcon.vue'
import CoverRow from '../components/VirtualCoverRow.vue'
import Cover from '../components/CoverBox.vue'
import TrackList from '../components/VirtualTrackList.vue'
import { tricklingProgress } from '../utils/tricklingProgress'
import { Playlist, Track, Album, Artist } from '@/types/plugin'

const { exploreTab } = storeToRefs(useNormalStateStore())
const pluginMusicStore = usePluginMusic()
const {
  services,
  playlistCategory,
  artistCategory,
  albumCategory,
  trackCategory,
  additionalTags,
  activeCats
} = storeToRefs(pluginMusicStore)
const { pluginMethodCall, getExploreBtn } = pluginMusicStore

const showCatOptions = ref(false)
const show = ref(false)

const data = reactive({
  playlist: [] as Playlist[],
  artist: {
    data: [] as Artist[],
    sourceContext: {} as Record<string, any>
  },
  chart: {
    showList: [] as Playlist[],
    data: [] as Playlist[],
    sourceContext: {} as Record<string, any>
  },
  newAlbum: [] as Album[],
  newTrack: [] as Track[]
})

const pluginId = computed(() => {
  const active = services.value.find((item) => item.active)!
  return active.code
})

const activeTags = computed(() => activeCats.value[pluginId.value])

const staticTags = computed(() => {
  return playlistCategory.value[pluginId.value].static
})

const tagLists = computed(() => {
  return playlistCategory.value[pluginId.value].tagList
})

const trackTags = computed(() => trackCategory.value[pluginId.value])
const albumTags = computed(() => albumCategory.value[pluginId.value])
const artistTags = computed(() => artistCategory.value[pluginId.value])

const updatePlistCat = (cat: string) => {
  show.value = false
  showCatOptions.value = false
  activeTags.value.playlist = cat

  getPlaylist()
}

const updateTrackCat = (cat: string) => {
  show.value = false
  showCatOptions.value = false
  activeTags.value.track = cat

  getNewTrack()
}

const updateAlbumCat = (cat: string) => {
  show.value = false
  showCatOptions.value = false
  activeTags.value.album = cat

  getNewAlbum()
}

const toggleArtistCategory = (bigCat: string, category: string) => {
  const tag = activeTags.value.artist.find(([big]) => big === bigCat)!
  tag[1] = category

  getArtists()
}

const getCatsByBigCat = (bigCat: string) => {
  return tagLists.value.find((item) => item.name === bigCat)?.sub || []
}

const togglePlaylistCategory = (name: string) => {
  const idx = (additionalTags.value[pluginId.value] || []).findIndex((item) => item.name === name)
  if (idx === -1) {
    const cat = tagLists.value
      .map((it) => it.sub)
      .flat()
      .find((item) => item.name === name)!
    additionalTags.value[pluginId.value].push(cat)
    activeTags.value.playlist = cat.name
  } else {
    const item = additionalTags.value[pluginId.value][idx]
    if (activeTags.value.playlist === item.name)
      activeTags.value.playlist = staticTags.value[0].name
    additionalTags.value[pluginId.value].splice(idx, 1)
  }

  getPlaylist()
}

const getArtistCatsByBigCat = (bigCat: string) => {
  return artistCategory.value[pluginId.value]
    .filter((cat) => cat.name === bigCat)
    .map((item) => item.sub)
    .flat()
}

const getTopLists = (reset = true) => {
  pluginMethodCall(pluginId.value, 'rankList', { ...data.chart.sourceContext, reset }).then(
    (result) => {
      if (!result.data.length) {
        show.value = true
        return
      }
      const res = result.data.map((item) => ({ ...item, pluginId: pluginId.value }))
      data.chart.showList = res.slice(0, 4)
      data.chart.data = res.slice(4)
      data.chart.sourceContext = { ...data.chart.sourceContext, ...result.sourceContext }
      show.value = true
    }
  )
}

const getNewTrack = (reset = true) => {
  if (reset) data.newTrack = []
  const tag =
    trackTags.value.find((item) => item.name === activeTags.value.track) || trackTags.value[0]

  pluginMethodCall(pluginId.value, 'topSong', { ...tag.sourceContext, reset }).then((result) => {
    if (!result.data.length) {
      show.value = true
      return
    }
    data.newTrack.push(...result.data.map((item) => ({ ...item, pluginId: pluginId.value })))
    tag.sourceContext = result.sourceContext
    show.value = true
  })
}

const getNewAlbum = (reset = true) => {
  if (reset) data.newAlbum = []

  const tag =
    albumTags.value.find((item) => item.name === activeTags.value.album) || albumTags.value[0]

  pluginMethodCall(pluginId.value, 'newAlbums', { ...tag.sourceContext, reset }).then((result) => {
    if (!result.data.length) {
      show.value = true
      return
    }
    data.newAlbum.push(...result.data.map((item) => ({ ...item, pluginId: pluginId.value })))
    tag.sourceContext = result.sourceContext
    show.value = true
  })
}

const getPlaylist = (reset = true) => {
  if (reset) data.playlist = []
  const tag =
    staticTags.value.find((item) => item.name === activeTags.value.playlist) || staticTags.value[0]

  pluginMethodCall(pluginId.value, 'getCategoryPlaylist', { ...tag?.sourceContext, reset }).then(
    (result) => {
      if (!result.data.length) {
        show.value = true
        return
      }
      data.playlist.push(...result.data.map((it) => ({ ...it, pluginId: pluginId.value })))
      tag.sourceContext = { ...tag.sourceContext, ...result.sourceContext }
      show.value = true
    }
  )
}

const getArtists = (reset = true) => {
  if (reset) {
    data.artist.data = []
    data.artist.sourceContext = {}
  }

  const cats = activeCats.value[pluginId.value].artist
  const query = artistTags.value.map((item) => {
    const { sub, ...rest } = item
    const result: Record<string, any> = { ...rest }
    const cat = cats.find(([big]) => big === rest.name)!
    const tag = sub.find((it) => it.name === cat[1])!
    result.tag = tag
    return result
  })

  if (data.artist.sourceContext && Object.keys(data.artist.sourceContext).length === 0) {
    data.artist.sourceContext = { query, reset, isFull: true }
  }

  pluginMethodCall(pluginId.value, 'artistsList', data.artist.sourceContext).then((result) => {
    show.value = true
    if (!result.data.length) return
    data.artist.data.push(...result.data.map((item) => ({ ...item, pluginId: pluginId.value })))
    data.artist.sourceContext = { ...query, ...result.sourceContext }
  })
}

const loadData = async (reset = true) => {
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)

  const tab = exploreTab.value
  switch (tab) {
    case 'playlist':
      getPlaylist(reset)
      break
    case 'chart':
      getTopLists(reset)
      break
    case 'newTrack':
      getNewTrack(reset)
      break
    case 'newAlbum':
      getNewAlbum(reset)
      break
    case 'artist':
      getArtists(reset)
      break
    default:
      break
  }
}

const loadMore = () => {
  loadData(false)
}

const updatePadding = inject('updatePadding') as (val: number) => void

watch(exploreTab, () => {
  show.value = false
  updatePadding(0)
  loadData(true)
})

onMounted(() => {
  updatePadding(0)
  getExploreBtn(pluginId.value).then(() => {
    loadData()
  })
})

onBeforeUnmount(() => {
  updatePadding(96)
  exploreTab.value = 'playlist'
  activeCats.value[pluginId.value] = { playlist: '', track: '', album: '', artist: [] }
})
</script>

<style scoped lang="scss">
.albumsTab {
  display: flex;
  justify-content: space-between;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
}
.button {
  user-select: none;
  cursor: pointer;
  padding: 8px 16px;
  margin: 10px 16px 6px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 600;
  font-size: 18px;
  border-radius: 10px;
  background-color: var(--color-secondary-bg);
  color: var(--color-secondary);
  transition: 0.2s;

  &:hover {
    background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
    color: var(--color-primary);
  }
}
.button.active {
  background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
  color: var(--color-primary);
}
.panel {
  margin-top: 10px;
  background: var(--color-secondary-bg);
  border-radius: 10px;
  padding: 8px;
  color: var(--color-text);

  .big-cat {
    display: flex;
    margin-bottom: 32px;
  }

  .name {
    font-size: 24px;
    font-weight: 700;
    opacity: 0.68;
    margin-left: 24px;
    min-width: 80px;
    margin-top: 8px;
  }
  .cats {
    margin-left: 24px;
    display: flex;
    flex-wrap: wrap;
  }
  .cat {
    user-select: none;
    margin: 4px 0px 0 0;
    display: flex;
    // justify-content: center;
    align-items: center;
    font-weight: 500;
    font-size: 16px;
    transition: 0.2s;
    min-width: 98px;

    span {
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      padding: 6px 12px;
      height: 26px;
      border-radius: 10px;
      opacity: 0.88;
      &:hover {
        opacity: 1;
        background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
        color: var(--color-primary);
      }
    }
  }
  .cat.unset {
    span {
      &:hover {
        background-color: unset;
      }
    }
  }
  .cat.active {
    color: var(--color-primary);
  }
}

.chart-list {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-gap: 20px;
}

.chart-item {
  // width: 100%;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;

  .img {
    flex: 0.8;
    justify-content: center;
    position: relative;
    .update {
      font-size: 14px;
      font-weight: 500;
      color: white;
      position: absolute;
      top: 68%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  }

  .track {
    flex: 1.2;
    flex-direction: column;
    justify-content: center;
    font-size: 12px;
    padding-left: 10px;
    display: flex;

    .track-item {
      height: 40px;
      line-height: 40px;
      align-items: center;
      overflow: hidden;
      text-overflow: ellipsis;
      // margin-bottom: 10px;
      padding: 0 10px;
      border-radius: 8px;
      user-select: none;
    }

    .track-item:nth-child(odd) {
      background-color: var(--color-secondary-bg);
    }
  }
}

.playlists {
  margin-top: 24px;
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

.button.more {
  .svg-icon {
    height: 24px;
    width: 24px;
  }
}
</style>
