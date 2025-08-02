<template>
  <div v-if="show" class="user-page">
    <div class="artist-info">
      <div class="head">
        <img :src="image" loading="lazy" />
      </div>

      <div>
        <div class="name">{{ user.nickname }}</div>
        <div class="signature">{{ user.signature }}</div>
        <div class="follows">
          <span>{{ user.follows }} 关注</span>
          ·
          <span>{{ user.followeds }} 粉丝</span>
          ·
          <span>Lv.{{ user.level }} 等级</span>
        </div>
        <div class="buttons">
          <ButtonTwoTone color="grey">{{ followStatus }}</ButtonTwoTone>
          <ButtonTwoTone color="grey">
            <span>聊天</span>
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
    <div class="tabs">
      <div
        class="tab dropdown"
        :class="{ active: currentTab === 'playlist' }"
        @click="updateCurrentTab('playlist')"
      >
        <span class="text">{{
          {
            all: $t('contextMenu.allPlaylists'),
            mine: $t('contextMenu.minePlaylists'),
            liked: $t('contextMenu.likedPlaylists')
          }[playlistFilter]
        }}</span>
        <span class="icon" @click.stop="openPlaylistTabMenu"
          ><svg-icon icon-class="dropdown"
        /></span>
      </div>
      <div
        class="tab"
        :class="{ active: currentTab === 'history' }"
        @click="updateCurrentTab('history')"
        >TA的听歌排行</div
      >
      <div
        class="tab"
        :class="{ active: currentTab === 'event' }"
        @click="updateCurrentTab('event')"
        >动态</div
      >
      <div
        class="tab"
        :class="{ active: currentTab === 'voicelist' }"
        @click="updateCurrentTab('voicelist')"
        >播客</div
      >
    </div>
    <div class="content" style="padding-top: 20px">
      <div v-if="currentTab === 'playlist'">
        <CoverRow
          :items="filterPlaylists"
          type="playlist"
          :show-play-count="true"
          :is-end="true"
          :item-height="260"
          :colunm-number="5"
          :padding-bottom="64"
        />
      </div>
      <div v-if="currentTab === 'history'">
        <button
          :class="{
            'playHistory-button': true,
            'playHistory-button--selected': playHistoryMode === 'week'
          }"
          @click="playHistoryMode = 'week'"
        >
          {{ $t('library.playHistory.week') }}
        </button>
        <button
          :class="{
            'playHistory-button': true,
            'playHistory-button--selected': playHistoryMode === 'all'
          }"
          @click="playHistoryMode = 'all'"
        >
          {{ $t('library.playHistory.all') }}
        </button>
        <TrackList
          :items="playHistoryList"
          :colunm-number="1"
          :is-end="true"
          :item-height="60"
          :padding-bottom="96"
          type="tracklist"
        />
      </div>
    </div>
    <ContextMenu ref="userMenu">
      <div class="item" @click="copyURL">{{ $t('contextMenu.copyURL') }}</div>
      <div class="item" @click="openOnBrowser">{{ $t('contextMenu.openOnBrowser') }}</div>
    </ContextMenu>
    <ContextMenu ref="playlistTabMenu">
      <div class="item" @click="changePlaylistFilter('all')">{{
        $t('contextMenu.allPlaylists')
      }}</div>
      <hr />
      <div class="item" @click="changePlaylistFilter('mine')">{{
        $t('contextMenu.minePlaylists')
      }}</div>
      <div class="item" @click="changePlaylistFilter('liked')">{{
        $t('contextMenu.likedPlaylists')
      }}</div>
    </ContextMenu>
  </div>
</template>

<script lang="ts" setup>
import { computed, watch, onMounted, ref, inject, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, onBeforeRouteUpdate } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { userDetail, userPlayHistory } from '../api/user'
import { userPlaylist } from '../api/auth'
import { openExternal } from '../utils'
import { useNormalStateStore } from '../store/state'
import SvgIcon from '../components/SvgIcon.vue'
import TrackList from '../components/VirtualTrackList.vue'
import ButtonTwoTone from '../components/ButtonTwoTone.vue'
import ContextMenu from '../components/ContextMenu.vue'
import CoverRow from '../components/VirtualCoverRow.vue'

const show = ref(false)
const user = ref<{ [key: string]: any }>({})
const userMenu = ref()
const playlistTabMenu = ref()
const playHistoryMode = ref('week')
const currentTab = ref('playlist')
const playlistFilter = ref('all')
const playlists = ref<any[]>([])
const playlistHistory = ref<{ weekData: any[]; allData: any[] }>({
  weekData: [],
  allData: []
})

const image = computed(() => user.value?.avatarUrl + '?param=512y512')
const followStatus = computed(() => {
  let status = '关注'
  if (user.value.followed && user.value.followMe) {
    status = user.value.followTime as string
  } else if (user.value.followMe) {
    status = '回关'
  } else if (user.value.followed) {
    status = '已关注'
  }
  return status
})
const filterPlaylists = computed(() => {
  const userId = user.value.userId
  if (playlistFilter.value === 'mine') {
    return playlists.value?.filter((p) => p.creator.userId === userId)
  } else if (playlistFilter.value === 'liked') {
    return playlists.value?.filter((p) => p.creator.userId !== userId)
  } else {
    return playlists.value
  }
})
const playHistoryList = computed(() => {
  if (playHistoryMode.value === 'week') {
    return playlistHistory.value?.weekData
  } else if (playHistoryMode.value === 'all') {
    return playlistHistory.value?.allData
  }
  return []
})

const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { t } = useI18n()

const copyURL = () => {
  const url = `https://music.163.com/#/user?id=${user.value.userId}`
  navigator.clipboard.writeText(url).then(() => {
    showToast(t('toast.copySuccess'))
  })
}

const openOnBrowser = () => {
  const url = `https://music.163.com/#/user?id=${user.value.userId}`
  openExternal(url)
}

const route = useRoute()

const getUser = (id: string) => {
  if (!id) return
  Promise.all([
    userDetail({ uid: id }),
    userPlaylist({
      uid: Number(id),
      limit: 2000,
      timestamp: new Date().getTime()
    })
  ]).then((result) => {
    user.value = result[0].profile
    user.value.level = result[0].level
    user.value.peopleCanSeeMyPlayRecord = result[0].peopleCanSeeMyPlayRecord
    playlists.value = result[1].playlist
    show.value = true
  })
}

const updateCurrentTab = (tab: string) => {
  currentTab.value = tab
  nextTick(() => {
    updatePadding(0)
  })
}

const updatePadding = inject('updatePadding') as (padding: number) => void

const openMenu = (e: MouseEvent) => {
  userMenu.value?.openMenu(e)
}

const openPlaylistTabMenu = (e: MouseEvent) => {
  playlistTabMenu.value?.openMenu(e)
}

const changePlaylistFilter = (tab: string) => {
  playlistFilter.value = tab
}

watch(currentTab, (val) => {
  if (val === 'history') {
    if (playlistHistory.value.allData.length > 0 || !user.value.peopleCanSeeMyPlayRecord) return
    Promise.all([
      userPlayHistory({ uid: user.value.userId as number, type: 0 }),
      userPlayHistory({ uid: user.value.userId as number, type: 1 })
    ]).then((result) => {
      const data: { allData: any[]; weekData: any[] } = { allData: [], weekData: [] }
      const dataType = { 0: 'allData', 1: 'weekData' }
      if (result[0] && result[1]) {
        for (let i = 0; i < result.length; i++) {
          const songData = result[i][dataType[i]].map((item) => {
            const song = item.song
            song.playCount = item.playCount || 1
            return song
          })
          data[dataType[i] as 'weekData' | 'allData'] = songData
        }
        playlistHistory.value = data
      }
    })
  }
})

onBeforeRouteUpdate((to, from, next) => {
  show.value = false
  getUser(to.params.id as string)
  next()
})

onMounted(() => {
  nextTick(() => {
    updatePadding(0)
  })
  getUser(route.params.id as string)
})

onBeforeUnmount(() => {
  updatePadding(96)
})
</script>

<style lang="scss" scoped>
.user-page {
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

  .follows {
    font-size: 14px;
    opacity: 0.88;
    margin-top: 10px;
  }
  .signature {
    font-size: 14px;
    opacity: 0.88;
    margin-top: 2px;
  }

  .buttons {
    margin-top: 26px;
    display: flex;
  }
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  font-size: 18px;
  -webkit-app-region: no-drag;
  .tab {
    font-weight: 600;
    padding: 8px 14px;
    margin-right: 14px;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    transition: 0.2s;
    opacity: 0.68;
    &:hover {
      opacity: 0.88;
      background-color: var(--color-secondary-bg);
    }
  }
  .tab.active {
    opacity: 0.88;
    background-color: var(--color-secondary-bg);
  }
  .tab.dropdown {
    display: flex;
    align-items: center;
    padding: 0;
    overflow: hidden;
    .text {
      padding: 8px 3px 8px 14px;
    }
    .icon {
      height: 100%;
      display: flex;
      align-items: center;
      padding: 0 8px 0 3px;
      .svg-icon {
        height: 16px;
        width: 16px;
      }
    }
  }
}
button.playHistory-button {
  color: var(--color-text);
  border-radius: 8px;
  padding: 6px 8px;
  margin-bottom: 12px;
  margin-right: 4px;
  transition: 0.2s;
  opacity: 0.68;
  font-weight: 500;
  cursor: pointer;
  &:hover {
    opacity: 1;
    background: var(--color-secondary-bg);
  }
  &:active {
    transform: scale(0.95);
  }
}

button.playHistory-button--selected {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  opacity: 1;
  font-weight: 700;
  &:active {
    transform: none;
  }
}

button.tab-button {
  color: var(--color-text);
  border-radius: 8px;
  padding: 8px 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: 0.2s;
  opacity: 0.68;
  font-weight: 500;
  font-size: 14px;
  -webkit-app-region: no-drag;
  .svg-icon {
    width: 14px;
    height: 14px;
    margin-right: 8px;
  }
  &:hover {
    opacity: 1;
    background: var(--color-secondary-bg);
  }
  &:active {
    opacity: 1;
    transform: scale(0.92);
  }
}
</style>
