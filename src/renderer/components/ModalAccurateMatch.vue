<template>
  <BaseModal
    class="accurate-match-track-modal"
    :show="show"
    :close-fn="close"
    title="精确匹配"
    width="25vw"
  >
    <template #default>
      <div class="current-track">
        <div class="label">当前歌曲 ID：</div>
        <code>{{ selectedTrackID }}</code>
      </div>
      <textarea
        v-model="inputJson"
        placeholder='粘贴 sourceContext JSON，如&#10;{"pluginId":"netease","sourceContext":{"id":"123456"}}'
        rows="4"
      />
      <div v-if="matchedTrack" class="matched-info">
        <div class="label">匹配结果：</div>
        <div class="track-name">{{ matchedTrack.name }}</div>
        <div v-if="matchedTrack.artists?.length" class="track-artist">
          {{ matchedTrack.artists.map((a) => a.name).join(' / ') }}
        </div>
      </div>
      <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
    </template>
    <template #footer>
      <button class="primary block" :disabled="loading" @click="doMatch">
        {{ loading ? '匹配中...' : '匹配' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from './BaseModal.vue'
import { usePluginMusic } from '../store/pluginMusic'
import { useNormalStateStore } from '../store/state'
import { usePlayerStore } from '../store/player'
import type { PluginId } from '@/types/plugin'

const pluginStore = usePluginMusic()
const { pluginMethodCall } = pluginStore
const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { accurateMatchModal } = storeToRefs(stateStore)
const { tracks } = storeToRefs(pluginStore)

const show = computed({
  get: () => accurateMatchModal.value.show,
  set: (v) => {
    accurateMatchModal.value.show = v
  }
})
const selectedTrackID = computed(() => accurateMatchModal.value.selectedTrackID)

const inputJson = ref('')
const matchedTrack = ref<Record<string, any> | null>(null)
const errorMsg = ref('')
const loading = ref(false)

const doMatch = async () => {
  errorMsg.value = ''
  matchedTrack.value = null
  if (!inputJson.value.trim()) {
    errorMsg.value = '请粘贴 sourceContext JSON'
    return
  }

  let parsed: { pluginId: string; sourceContext: Record<string, any> }
  try {
    parsed = JSON.parse(inputJson.value.trim())
    if (!parsed.pluginId || !parsed.sourceContext) throw new Error('缺少 pluginId 或 sourceContext')
  } catch {
    errorMsg.value = 'JSON 格式无效，需要 { pluginId, sourceContext }'
    return
  }

  loading.value = true
  try {
    const result = await pluginMethodCall(parsed.pluginId as PluginId, 'getTrackDetail', {
      tracks: [parsed.sourceContext]
    })
    if (result.code !== 200 || !result.data?.length) {
      errorMsg.value = '未获取到歌曲信息，请检查 sourceContext 是否正确'
      return
    }
    const track = result.data[0]
    matchedTrack.value = track

    const picUrl = track.picUrl || track.album?.picUrl || ''
    await window.mainApi
      ?.invoke('accurateMatch', {
        trackId: selectedTrackID.value,
        pluginId: parsed.pluginId,
        sourceContext: parsed.sourceContext,
        picUrl,
        currentPlayingPath: usePlayerStore().currentTrack?.filePath ?? null
      })
      .then((res: { code: number; picUrl: string | null }) => {
        const song = Object.entries(tracks.value)
          .map(([, item]) => item.data)
          .flat()
          .find((t) => t.id === selectedTrackID.value)
        if (!song) return
        song.picUrl = res.picUrl || song.picUrl
      })
    showToast('匹配成功')
    setTimeout(close, 800)
  } catch (e: any) {
    errorMsg.value = e?.message || '匹配失败'
  } finally {
    loading.value = false
  }
}

const close = () => {
  show.value = false
  inputJson.value = ''
  matchedTrack.value = null
  errorMsg.value = ''
  accurateMatchModal.value.selectedTrackID = 0
}
</script>

<style scoped lang="scss">
.current-track {
  margin-bottom: 12px;
  code {
    display: block;
    background: var(--color-secondary-bg-for-transparent);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
    word-break: break-all;
    margin-top: 4px;
  }
}
textarea {
  width: 100%;
  background: var(--color-secondary-bg-for-transparent);
  border: none;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-text);
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}
.matched-info {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--color-secondary-bg-for-transparent);
  border-radius: 8px;
  .track-name {
    font-weight: 600;
    font-size: 15px;
    margin-top: 4px;
  }
  .track-artist {
    font-size: 13px;
    opacity: 0.7;
    margin-top: 2px;
  }
}
.error {
  margin-top: 10px;
  color: var(--color-danger, #e74c3c);
  font-size: 13px;
}
.footer {
  padding-top: 16px;
  margin: 16px 24px 24px 24px;
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  display: flex;
  justify-content: flex-start;
  button {
    color: var(--color-text);
    background: var(--color-secondary-bg-for-transparent);
    border-radius: 8px;
    padding: 6px 16px;
    font-size: 14px;
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
    &:active {
      transform: scale(0.98);
    }
  }
}
</style>
