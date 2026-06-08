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
      <div class="checkbox">
        <input
          id="checkbox-private"
          v-model="isPrivate"
          type="checkbox"
          :disabled="service?.type !== 'library'"
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
import { usePluginMusic } from '../store/pluginMusic'
import { useI18n } from 'vue-i18n'
import { PluginId } from '@/types/plugin'

const stateStore = useNormalStateStore()
const { newPlaylistModal } = storeToRefs(stateStore)
const { showToast } = stateStore
const { t } = useI18n()

const pluginStore = usePluginMusic()
const { services } = storeToRefs(pluginStore)
const { pluginMethodCall, fetchLikedPlaylists } = pluginStore

const title = ref('')
const isPrivate = ref(false)
const checked = ref(false)

const show = computed({
  get: () => newPlaylistModal.value.show,
  set: (value) => {
    newPlaylistModal.value.show = value
  }
})

const plugin = computed({
  get: () => newPlaylistModal.value.plugin,
  set: (value) => {
    newPlaylistModal.value.plugin = value
  }
})
const ids = computed({
  get: () => toRaw(newPlaylistModal.value.afterCreateAddTrackID),
  set: (value) => {
    newPlaylistModal.value.afterCreateAddTrackID = value
  }
})

const service = computed(() => services.value.find((item) => item.code === plugin.value))

// const playlists = computed(() => pluginPlaylist.value[plugin.value].data!)

const modelTitle = computed(() => {
  const service = services.value.find((item) => item.code === plugin.value)
  return t('playlist.newPlaylist', { name: service?.name || '', code: service?.code || '' })
})

const close = () => {
  plugin.value = '' as PluginId
  ids.value = []
  show.value = false
  title.value = ''
  isPrivate.value = false
}

const createAPlaylist = async () => {
  const data = { name: title.value, isPrivate: isPrivate.value }
  const result = await pluginMethodCall(plugin.value, 'createPlaylist', data)
  if (result.code === 200 && result.data) {
    fetchLikedPlaylists([plugin.value])
    if (!ids.value.length) {
      showToast(t('toast.createLocalPlaylistSuccess'))
      close()
      return
    }
    const res = await pluginMethodCall(plugin.value, 'addOrRemoveTracksToPlaylist', {
      op: 'add',
      playlist: result.data.sourceContext,
      tracks: ids.value
    })
    if (res.code === 200) {
      showToast(t('toast.savedToPlaylist'))
      close()
    }
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
