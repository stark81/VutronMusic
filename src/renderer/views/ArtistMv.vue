<template>
  <div v-show="show">
    <h1> <img class="avatar" :src="image" loading="lazy" />{{ artist.name }}的 MV </h1>
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
import { ref, inject, computed, onActivated, onDeactivated, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { artistMv, getArtist } from '../api/artist'
import { tricklingProgress } from '../utils/tricklingProgress'
import MvRow from '../components/MvRow.vue'

const show = ref(false)
const hasMore = ref(true)
const artist = ref<any>({})
const mvs = ref<any[]>([])
const image = computed(() => artist.value.img1v1Url + '?param=512y512')

const route = useRoute()

const loadData = (id: string) => {
  setTimeout(() => {
    if (!show.value) tricklingProgress.start()
  }, 1000)
  getArtist(Number(id)).then((res) => {
    artist.value = res.artist
  })
  loadMVs()
}

const loadMVs = () => {
  if (!hasMore.value) return
  artistMv({ id: Number(route.params.id), limit: 100, offset: mvs.value.length }).then((data) => {
    mvs.value.push(...data.mvs)
    hasMore.value = data.hasMore
    tricklingProgress.done()
    show.value = true
  })
}

const updatePadding = inject('updatePadding') as (value: number) => void

onActivated(() => {
  setTimeout(() => {
    updatePadding(0)
  }, 100)
})
onDeactivated(() => {
  updatePadding(96)
})
onMounted(() => {
  loadData(route.params.id as string)
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
