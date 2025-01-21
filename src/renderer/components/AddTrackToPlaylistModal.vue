<template>
  <BaseModal
    class="add-track-to-playlist-modal"
    :show="show"
    :title="isLocal ? $t('localMusic.playlist.addToPlaylist') : $t('player.addToPlaylist')"
    :show-footer="false"
    :close-fn="closeFn"
    width="25vw"
  >
    <template #default>
      <div class="new-playlist-button" @click="newPlaylist"
        ><svg-icon icon-class="plus" />新建歌单</div
      >
      <div
        v-for="playlist in ownPlaylists"
        :key="playlist?.id"
        class="playlist"
        @click="addTrackToPlaylist(playlist?.id)"
      >
        <img :src="playlist?.coverImgUrl" loading="lazy" />
        <div class="info">
          <div class="title">{{ playlist?.name }}</div>
          <div class="track-count">{{ playlist?.trackCount }} 首</div>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SvgIcon from './SvgIcon.vue'
import { useNormalStateStore } from '../store/state'
import { useLocalMusicStore, Playlist } from '../store/localMusic'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'
import { computed, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addOrRemoveTrackFromPlaylist } from '../api/playlist'

const { t } = useI18n()

const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { addTrackToPlaylistModal, newPlaylistModal, modalOpen } = storeToRefs(stateStore)

const localMusicStore = useLocalMusicStore()
const { sortPlaylistsIDs, playlists } = storeToRefs(localMusicStore)
const { addTrackToLocalPlaylist } = localMusicStore

const { liked, user, likedSongPlaylistID } = storeToRefs(useDataStore())

const show = computed({
  get: () => addTrackToPlaylistModal.value.show,
  set: (value) => {
    addTrackToPlaylistModal.value.show = value
  }
})
const isLocal = computed({
  get: () => addTrackToPlaylistModal.value.isLocal,
  set: (value) => {
    addTrackToPlaylistModal.value.isLocal = value
  }
})

const ids = computed({
  get: () => toRaw(addTrackToPlaylistModal.value.selectedTrackID),
  set: (value) => {
    addTrackToPlaylistModal.value.selectedTrackID = value
  }
})

const ownPlaylists = computed(() => {
  if (isLocal.value) {
    return sortPlaylistsIDs.value.map(
      (id: number) => playlists.value.find((playlist) => playlist.id === id) as Playlist
    )
  } else {
    return liked.value.playlists.filter(
      (playlist) =>
        playlist.creator.userId === user.value.userId && playlist.id !== likedSongPlaylistID.value
    )
  }
})

watch(show, (value) => {
  modalOpen.value = value
})

const close = () => {
  isLocal.value = false
  show.value = false
  ids.value = []
}

const closeFn = () => {
  show.value = false
}

const newPlaylist = () => {
  show.value = false
  newPlaylistModal.value = {
    isLocal: isLocal.value,
    afterCreateAddTrackID: ids.value,
    show: true
  }
}

const addTrackToPlaylist = (playlistId: number) => {
  if (isLocal.value) {
    addTrackToLocalPlaylist(playlistId, ids.value).then((result) => {
      close()
      if (result) {
        showToast(t('toast.savedToPlaylist'))
      } else {
        showToast(t('toast.tracksAlreadyInPlaylist'))
      }
    })
  } else {
    const id = ids.value.join(',')
    addOrRemoveTrackFromPlaylist({
      op: 'add',
      pid: playlistId,
      tracks: id
    }).then((result) => {
      show.value = false
      if (result?.body?.code === 200) {
        showToast(t('toast.savedToPlaylist'))
      } else {
        showToast(result.message)
      }
    })
  }
}
</script>

<style scoped lang="scss">
.new-playlist-button {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text);
  background: var(--color-secondary-bg-for-transparent);
  border-radius: 8px;
  height: 48px;
  margin-bottom: 16px;
  margin-right: 6px;
  margin-left: 6px;
  cursor: pointer;
  transition: 0.2s;
  .svg-icon {
    width: 16px;
    height: 16px;
    margin-right: 8px;
  }
  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-bg-for-transparent);
  }
}
.playlist {
  display: flex;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background: var(--color-secondary-bg-for-transparent);
  }
  img {
    border-radius: 8px;
    height: 42px;
    width: 42px;
    margin-right: 12px;
    border: 1px solid rgba(0, 0, 0, 0.04);
  }
  .info {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .title {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text);
    padding-right: 16px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    word-break: break-all;
  }
  .track-count {
    margin-top: 2px;
    font-size: 13px;
    opacity: 0.68;
    color: var(--color-text);
  }
}
</style>
