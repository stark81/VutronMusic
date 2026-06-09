<template>
  <div v-show="show">
    <h1> <img class="avatar" :src="artist?.picUrl" loading="lazy" />{{ artist?.name }}的 MV </h1>
    <MvRow
      :mvs="mvs"
      :is-end="true"
      :show-position="true"
      :padding-bottom="64"
      :load-more="loadMVs"
      subtitle="publishTime"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, inject, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { usePluginMusic } from '../store/pluginMusic'
import { tricklingProgress } from '../utils/tricklingProgress'
import MvRow from '../components/MvRow.vue'
import { PluginId } from '@/types/schemas'
import { ArtistDetail, Mv } from '@/types/plugin'

const show = ref(false)
const hasMore = ref(true)
const artist = ref<ArtistDetail>()
const mvs = ref<Mv[]>([])

const pluginId = ref<PluginId>()
const sourceContext = ref<Record<string, any>>({})

const route = useRoute()
const { pluginMethodCall } = usePluginMusic()

const loadData = () => {
  if (!pluginId.value) return
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)

  pluginMethodCall(pluginId.value, 'artistDetail', sourceContext.value).then((result) => {
    if (!result.artist) return
    artist.value = { ...result.artist, pluginId: pluginId.value! }
  })

  loadMVs()
}

const loadMVs = () => {
  if (!hasMore.value || !pluginId.value) return
  pluginMethodCall(pluginId.value, 'artistMVs', {
    ...sourceContext.value,
    hasMore: hasMore.value,
    limit: 100,
    offset: mvs.value.length
  }).then((res) => {
    if (!res.data.length) {
      hasMore.value = false
      show.value = true
      return
    }
    mvs.value.push(...res.data.map((item) => ({ ...item, pluginId: pluginId.value! })))
    tricklingProgress.done()
    show.value = true
  })
}

const updatePadding = inject('updatePadding') as (value: number) => void

onMounted(() => {
  const { pluginId: plugin, sourceContext: source } = route.params
  pluginId.value = plugin as PluginId
  sourceContext.value = JSON.parse(source as string)

  loadData()
  setTimeout(() => {
    updatePadding(0)
  }, 100)
})
onBeforeUnmount(() => {
  updatePadding(96)
})
</script>

<style lang="scss" scoped>
h1 {
  font-size: 42px;
  color: var(--color-text);
  margin-bottom: 10px;
  .avatar {
    height: 44px;
    margin-right: 12px;
    vertical-align: -7px;
    border-radius: 50%;
    border: rgba(0, 0, 0, 0.2);
  }
}
</style>
