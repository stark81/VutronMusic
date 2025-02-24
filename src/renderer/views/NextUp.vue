<template>
  <div class="next-tracks">
    <h1>{{ $t('next.nowPlaying') }}</h1>
    <TrackList
      :id="playlistSource.id"
      :items="[currentTrack!]"
      :type="playlistSource.type"
      :colunm-number="1"
      :show-position="false"
      :dbclick-enable="false"
      :is-end="false"
    />

    <h1 v-if="_playNextList.length > 0">
      {{ $t('next.insertPlaying') }}
      <button @click="clearPlayNextList">清除队列</button>
    </h1>
    <TrackList
      v-if="tracks.length > 0"
      :id="playlistSource.id"
      :items="playNextTracks"
      :type="playlistSource.type"
      :colunm-number="1"
      :highlight-playing-track="false"
      :show-position="false"
      :extra-context-menu-item="['removeTrackFromQueue']"
      :is-end="filteredTracks.length === 0"
    />

    <h1 class="next">{{ $t('next.nextPlaying') }}</h1>
    <TrackList
      v-if="filteredTracks.length > 0"
      :id="playlistSource.id"
      :items="filteredTracks"
      :type="playlistSource.type"
      :show-position="false"
      :highlight-playing-track="false"
      :colunm-number="1"
      :is-end="true"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import TrackList from '../components/VirtualTrackList.vue'
import { usePlayerStore } from '../store/player'
import { useLocalMusicStore } from '../store/localMusic'
import { useStreamMusicStore } from '../store/streamingMusic'
import { storeToRefs } from 'pinia'
import { getTrackDetail } from '../api/track'

const playerStore = usePlayerStore()
const localMusicStore = useLocalMusicStore()
const streamMusicStore = useStreamMusicStore()
const { currentTrack, shuffle, currentTrackIndex, list, _playNextList, playlistSource } =
  storeToRefs(playerStore)
const { localTracks } = storeToRefs(localMusicStore)
const { streamTracks } = storeToRefs(streamMusicStore)

const { clearPlayNextList } = playerStore

const tracks = ref<any[]>([])

const playNextTracks = computed(() => {
  return _playNextList.value.map((trackID: number) => {
    return tracks.value.find((t) => t.id === trackID)
  })
})

const filteredTracks = computed(() => {
  const trackIDs = list.value.slice(currentTrackIndex.value + 1, currentTrackIndex.value + 100)
  return tracks.value.filter((t) => trackIDs.includes(t.id))
})

const loadTracks = async () => {
  const trackIDs = [
    ...list.value.slice(currentTrackIndex.value + 1, currentTrackIndex.value + 100),
    ..._playNextList.value.slice()
  ]
  const loadedTrackIDs = tracks.value.map((t) => t.id)
  const localMusics = localTracks.value.filter((t) => trackIDs.includes(t.id))
  const streamMusics = streamTracks.value.filter((t) => trackIDs.includes(t.id))

  let newTracks = localMusics.filter((t) => !loadedTrackIDs.includes(t.id))

  const onlineTrackIDs = trackIDs.filter((t) => !localMusics.map((s) => s.id).includes(t))

  if (onlineTrackIDs.length > 0) {
    await getTrackDetail(onlineTrackIDs.join(',')).then((data) => {
      newTracks.push(...data.songs)
    })
  }
  const sMusic = streamMusics.filter((t) => !loadedTrackIDs.includes(t.id))
  newTracks = [...newTracks, ...sMusic]
  newTracks = newTracks
    .filter((t) => trackIDs.includes(t.id))
    .sort((a, b) => trackIDs.indexOf(a.id) - trackIDs.indexOf(b.id))

  tracks.value.push(...newTracks)
}

watch(currentTrack, loadTracks)
watch(shuffle, loadTracks)
watch(_playNextList, loadTracks)

onMounted(() => {
  loadTracks()
})
</script>

<style lang="scss" scoped>
.next {
  justify-content: flex-start;
}
h1 {
  margin-top: 36px;
  margin-bottom: 18px;
  cursor: default;
  color: var(--color-text);
  display: flex;
  justify-content: space-between;
  button {
    color: var(--color-text);
    border-radius: 8px;
    padding: 0 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: 0.2s;
    opacity: 0.68;
    font-size: 16px;
    font-weight: 500;
    &:hover {
      opacity: 1;
      background: var(--color-secondary-bg);
    }
    &:active {
      opacity: 1;
      transform: scale(0.92);
    }
  }
}
</style>
