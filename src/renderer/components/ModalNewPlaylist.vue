<template>
  <BaseModal
    class="add-playlist-modal"
    :show="show"
    :title="modelTitle"
    :close-fn="close"
    width="25vw"
  >
    <template #default>
      <input v-model="title" type="text" :placeholder="$t('library.playlist.title')" />
      <div v-show="type === 'online'" class="checkbox">
        <input
          id="checkbox-private"
          v-model="isPrivate"
          type="checkbox"
          class="input"
          @input="checked = !checked"
        />
        <label for="checkbox-private" class="label-content">
          <span class="label">{{ $t('library.playlist.setPrivate') }}</span>
        </label>
      </div>
    </template>
    <template #footer>
      <button class="primary block" @click="createAPlaylist">创建</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import BaseModal from './BaseModal.vue'
import { useNormalStateStore } from '../store/state'
import { useLocalMusicStore } from '../store/localMusic'
import { serviceName, useStreamMusicStore } from '../store/streamingMusic'
import { useDataStore } from '../store/data'
import { createPlaylist, addOrRemoveTrackFromPlaylist } from '../api/playlist'
import { useI18n } from 'vue-i18n'

const stateStore = useNormalStateStore()
const { newPlaylistModal } = storeToRefs(stateStore)
const { showToast } = stateStore
const { t } = useI18n()

const { createLocalPlaylist } = useLocalMusicStore()
const { fetchLikedPlaylist } = useDataStore()

const streamMusicStore = useStreamMusicStore()
// const { currentService } = storeToRefs(streamMusicStore)
const { fetchStreamPlaylist, addOrRemoveTrackFromStreamPlaylist } = streamMusicStore

const title = ref('')
const isPrivate = ref(false)
const checked = ref(false)

const show = computed({
  get: () => newPlaylistModal.value.show,
  set: (value) => {
    newPlaylistModal.value.show = value
  }
})
const type = computed({
  get: () => newPlaylistModal.value.type,
  set: (value) => {
    newPlaylistModal.value.type = value
  }
})
const ids = computed({
  get: () => toRaw(newPlaylistModal.value.afterCreateAddTrackID),
  set: (value) => {
    newPlaylistModal.value.afterCreateAddTrackID = value
  }
})

const modelTitle = computed(() => {
  if (type.value === 'local') {
    return t('localMusic.playlist.newPlaylist')
  } else if (type.value === 'online') {
    return t('library.playlist.newPlaylist')
  }
  return t('streamMusic.playlist.newPlaylist')
})

const close = () => {
  type.value = 'online'
  ids.value = []
  show.value = false
  title.value = ''
  isPrivate.value = false
}

const createAPlaylist = async () => {
  if (type.value === 'local') {
    let imgID = 0
    if (ids.value.length) imgID = ids.value[ids.value.length - 1] as number
    const params = {
      name: title.value,
      trackIds: ids.value,
      trackCount: ids.value.length,
      coverImgUrl:
        imgID === 0
          ? 'https://p1.music.126.net/jWE3OEZUlwdz0ARvyQ9wWw==/109951165474121408.jpg?param=512y512'
          : `atom://local-asset?type=pic&id=${imgID}&size=512`
    }
    const playlist = await createLocalPlaylist(params)
    if (playlist) {
      close()
      showToast(t('toast.createLocalPlaylistSuccess'))
    } else {
      showToast(t('toast.createLocalPlaylistFailed'))
    }
  } else if (type.value === 'online') {
    const params: Record<string, any> = { name: title.value }
    if (isPrivate.value) params.privacy = 10
    createPlaylist(params).then((res) => {
      if (res.code === 200) {
        if (ids.value.length) {
          const trackIDs = ids.value.join(',')
          addOrRemoveTrackFromPlaylist({
            op: 'add',
            pid: res.id,
            tracks: trackIDs
          }).then((data) => {
            if (data.body.code === 200) {
              showToast(t('toast.savedToPlaylist'))
            } else {
              showToast(data.body.message)
            }
          })
        }
        close()
        showToast(t('toast.createLocalPlaylistSuccess'))
        fetchLikedPlaylist()
      }
    })
  } else {
    window.mainApi
      ?.invoke('createStreamPlaylist', {
        name: title.value,
        platform: type.value
      })
      .then((res: { status: 'ok' | 'failed'; pid: string | undefined }) => {
        if (res.status === 'ok') {
          if (ids.value.length) {
            addOrRemoveTrackFromStreamPlaylist(
              'add',
              type.value as serviceName,
              res.pid as string,
              ids.value as string[]
            )
          }
          close()
          showToast(t('toast.createLocalPlaylistSuccess'))
          fetchStreamPlaylist()
        }
      })
  }
}
</script>

<style lang="scss" scoped>
.add-playlist-modal {
  .content {
    display: flex;
    flex-direction: column;
    input {
      margin-bottom: 12px;
    }
    input[type='text'] {
      // width: calc(100% - 24px);
      width: 100%;
      flex: 1;
      background: var(--color-secondary-bg-for-transparent);
      font-size: 16px;
      border: none;
      font-weight: 600;
      padding: 8px 12px;
      border-radius: 8px;
      margin-top: -1px;
      color: var(--color-text);
      box-sizing: border-box;
      &:focus {
        opacity: 1;
      }
      [data-theme='light'] &:focus {
        color: var(--color-primary);
      }
    }
    .checkbox {
      user-select: none;

      .input {
        accent-color: var(--color-primary);

        &:checked {
          + .label-content {
            .container {
              &:after {
                border-color: var(--color-primary-font);
              }
            }
            .icon {
              transform: scale(1);
            }
          }
        }
      }
      .label-content {
        margin-left: 5px;
      }
    }
  }
}
.footer {
  padding-top: 16px;
  margin: 16px 24px 24px 24px;
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  display: flex;
  justify-content: flex-start;
  margin-bottom: -8px;
  button {
    color: var(--color-text);
    background: var(--color-secondary-bg-for-transparent);
    border-radius: 8px;
    padding: 6px 16px;
    font-size: 14px;
    margin-left: 12px;
    transition: 0.2s;
    &:active {
      transform: scale(0.94);
    }
  }
  button.primary {
    color: white;
    background: var(--color-primary);
    font-weight: 500;
  }
  button.block {
    width: 100%;
    margin-left: 0;
    &:active {
      transform: scale(0.98);
    }
  }
}
</style>
