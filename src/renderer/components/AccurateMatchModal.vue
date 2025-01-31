<template>
  <BaseModal
    class="accurate-match-track-modal"
    :show="show"
    :close-fn="close"
    title="本地歌曲精确匹配"
    width="25vw"
  >
    <template #default>
      <input v-model="title" type="text" :placeholder="selectedTrack?.name" maxlength="40" />
    </template>
    <template #footer>
      <button class="primary block" @click="accurateMatchTrack">匹配</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { getTrackDetail } from '../api/track'
import BaseModal from './BaseModal.vue'
import { useLocalMusicStore } from '../store/localMusic'
import { useNormalStateStore } from '../store/state'

const localMusicStore = useLocalMusicStore()
const { updateTrack } = localMusicStore
const { localTracks } = storeToRefs(localMusicStore)

const stateStore = useNormalStateStore()
const { accurateMatchModal } = storeToRefs(stateStore)

const title = ref('')

const show = computed({
  get: () => accurateMatchModal.value.show,
  set: (value) => {
    accurateMatchModal.value.show = value
  }
})
const selectedTrackID = computed({
  get: () => accurateMatchModal.value.selectedTrackID,
  set: (value) => {
    accurateMatchModal.value.selectedTrackID = value
  }
})
const selectedTrack = computed(() => {
  const track = localTracks.value.find((t) => t.id === selectedTrackID.value)!
  return track
})

const accurateMatchTrack = () => {
  const filePath = selectedTrack.value.filePath
  getTrackDetail(title.value).then(async (data) => {
    const track = data.songs[0]
    track.album = track.al
    track.artists = track.ar
    const result = await window.mainApi.invoke('accurateMatch', track, selectedTrack.value.id)
    if (result) {
      updateTrack(filePath, track)
      close()
    }
  })
}
const close = () => {
  show.value = false
  selectedTrackID.value = 0
}
</script>

<style scoped lang="scss">
.accurate-match-track-modal {
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
      &:focus {
        // background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
        opacity: 1;
      }
      [data-theme='light'] &:focus {
        color: var(--color-primary);
      }
    }
    .checkbox {
      display: flex;
      align-items: center;
      user-select: none;
      input[type='checkbox' i] {
        margin: 3px 3px 3px 4px;
      }
      label {
        font-size: 12px;
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
