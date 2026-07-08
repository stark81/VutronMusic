<template>
  <div class="next-tracks">
    <h1>{{ $t('next.nowPlaying') }}</h1>
    <TrackList
      :plugin="'' as PluginId"
      :source-context="{ pluginType: 'player', id: currentTrack?.id || '' }"
      :items="currentTrack ? [currentTrack] : []"
      :type="'Track'"
      :colunm-number="1"
      :show-service="true"
      :show-position="false"
      :dbclick-enable="false"
      :is-end="false"
    />

    <h1 v-if="playNextList.length > 0">
      {{ $t('next.insertPlaying') }}
      <button @click="clearPlayNextList">清除队列</button>
    </h1>
    <TrackList
      v-if="insertTracks.length > 0"
      :plugin="'all'"
      :source-context="{ pluginType: 'player', id: 'playNextList' }"
      :items="insertTracks"
      :type="'Track'"
      :colunm-number="1"
      :show-service="true"
      :highlight-playing-track="false"
      :show-position="false"
      :extra-context-menu-item="['removeTrackFromInsert']"
      :is-end="false"
    />

    <h1 class="next">{{ $t('next.nextPlaying') }}</h1>
    <TrackList
      v-if="filteredTracks.length > 0"
      :items="filteredTracks"
      :plugin="'all'"
      :source-context="{ pluginType: 'player', id: 'nextTracks' }"
      :type="playlistSource.type"
      :show-service="true"
      :show-position="true"
      :show-track-position="false"
      :highlight-playing-track="false"
      :colunm-number="1"
      :extra-context-menu-item="['removeTrackFromNext']"
      :is-end="true"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import TrackList from '../components/VirtualTrackList.vue'
import { usePlayerStore } from '../store/player'
import { usePluginMusic } from '../store/pluginMusic'
import { storeToRefs } from 'pinia'
import { PluginId } from '@/types/schemas'
import { Track } from '@/types/plugin.js'

const playerStore = usePlayerStore()
const pluginStore = usePluginMusic()

const { currentTrack, isShuffle, currentTrackIndex, list, playNextList, playlistSource } =
  storeToRefs(playerStore)
const { pluginMethodCall } = pluginStore
const { clearPlayNextList } = playerStore

const tracks = ref<Track[]>([])

const filteredTracks = computed(() => {
  const trackList = list.value.slice(currentTrackIndex.value + 1, currentTrackIndex.value + 100)
  const trackMap = new Map(tracks.value.map((t) => [`${t.pluginId}:${t.sourceContext?.id}`, t]))

  return trackList
    .map(([plugin, sc]) => trackMap.get(`${plugin}:${sc?.id}`))
    .filter(Boolean) as Track[]
})

const insertTracks = computed(() => {
  const trackMap = new Map(tracks.value.map((t) => [`${t.pluginId}:${t.sourceContext?.id}`, t]))

  return playNextList.value
    .map(([plugin, sc]) => trackMap.get(`${plugin}:${sc?.id}`))
    .filter(Boolean) as Track[]
})

const loadTracks = async () => {
  const trackIds = [
    ...list.value.slice(currentTrackIndex.value + 1, currentTrackIndex.value + 100),
    ...playNextList.value.slice()
  ]

  if (trackIds.length === 0) return

  const loadedKeys = new Set(tracks.value.map((t) => `${t.pluginId}:${t.sourceContext?.id}`))
  const toLoad = trackIds.filter(([plugin, sc]) => {
    const key = `${plugin}:${sc?.id}`
    return !loadedKeys.has(key)
  })

  if (toLoad.length === 0) return

  const map = new Map<PluginId, { index: number; sourceContext: Record<string, any> }[]>()
  toLoad.forEach(([plugin, sourceContext], index) => {
    if (!map.has(plugin)) map.set(plugin, [])
    map.get(plugin)!.push({ index, sourceContext })
  })

  const groups = Array.from(map, ([plugin, source]) => ({ plugin, source }))

  const results: Track[] = new Array(toLoad.length)

  await Promise.allSettled(
    groups.map((item) =>
      pluginMethodCall(item.plugin, 'getTrackDetail', {
        tracks: item.source.map((s) => s.sourceContext)
      })
        .then((result) => {
          result.data.forEach((track, i) => {
            results[item.source[i].index] = {
              ...track,
              album: { ...track.album, pluginId: item.plugin },
              artists: track.artists.map((it) => ({ ...it, pluginId: item.plugin })),
              albumArtists: track.albumArtists.map((it) => ({ ...it, pluginId: item.plugin })),
              sourceContext: item.source[i].sourceContext,
              pluginId: item.plugin
            }
          })
        })
        .catch((err) => {
          console.error(`Failed to load tracks from plugin ${item.plugin}:`, err)
        })
    )
  )

  const newTracks = results.filter(Boolean)
  tracks.value.push(...newTracks)
}

watch(currentTrack, loadTracks)
watch(isShuffle, loadTracks)
watch(playNextList, loadTracks)

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
