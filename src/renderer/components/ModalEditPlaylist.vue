<template>
  <BaseModal
    class="edit-playlist-modal"
    :show="show"
    :title="$t('contextMenu.editPlaylistInfo')"
    :close-fn="close"
    width="25vw"
  >
    <template #default>
      <input
        v-model="editPlaylistModal.info.title"
        type="text"
        :placeholder="$t('library.playlist.modifyTitle')"
      />
      <div class="container">
        <textarea
          v-model="editPlaylistModal.info.description"
          class="comment-input"
          :placeholder="$t('library.playlist.modifyDesc')"
        />
      </div>
    </template>
    <template #footer>
      <button class="primary block" @click="updatePlaylist">修改</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { useNormalStateStore } from '../store/state'
import { usePluginMusic } from '../store/pluginMusic'
import type { PluginId } from '@/types/plugin'

const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { editPlaylistModal } = storeToRefs(stateStore)

const { pluginMethodCall } = usePluginMusic()

const show = computed({
  get: () => editPlaylistModal.value.show,
  set: (value) => {
    editPlaylistModal.value.show = value
  }
})

const close = () => {
  editPlaylistModal.value = {
    show: false,
    pluginId: '' as PluginId,
    playlistID: 0,
    info: { title: '', description: '', tags: [] }
  }
}

const updatePlaylist = () => {
  const modal = editPlaylistModal.value
  const pluginId = modal.pluginId as PluginId
  if (!pluginId) return

  pluginMethodCall(pluginId, 'editPlaylist', {
    id: modal.playlistID,
    name: modal.info.title,
    desc: modal.info.description,
    tags: modal.info.tags.join(';')
  }).then((result) => {
    showToast(`更新歌单信息${result.code === 200 ? '成功' : '失败'}`)
    if (result.code === 200) close()
    return result
  })
}
</script>

<style lang="scss" scoped>
.edit-playlist-modal {
  .content {
    display: flex;
    flex-direction: column;
    input {
      margin-bottom: 12px;
    }
    input[type='text'] {
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

    .container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 100px;

      .comment-input {
        color: var(--text-color);
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        font-size: 14px;
        resize: none;
        border: none;
        outline: none;
        border-radius: 8px;
        padding: 6px 12px;
        scrollbar-width: none;
        background: var(--color-secondary-bg-for-transparent);
      }
      .comment-input::placeholder {
        opacity: 0.6;
        color: var(--text-color);
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
