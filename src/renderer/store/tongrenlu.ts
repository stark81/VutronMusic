import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Album } from '@/types/music'

export const useTongrenluStore = defineStore(
  'tongrenlu',
  () => {
    const albums = ref<Album[]>([])
    const loading = ref(false)
    const currentPage = ref(1)
    const totalPages = ref(1)
    const total = ref(0)
    const keyword = ref('')

    const fetchAlbums = async (reset = false) => {
      if (reset) {
        currentPage.value = 1
        albums.value = []
      }
      loading.value = true

      const result = await window.mainApi?.invoke('get-tongrenlu-albums', {
        keyword: keyword.value,
        pageNumber: currentPage.value,
        pageSize: 15
      })

      if (result && result.code === 200) {
        if (reset) {
          albums.value = result.data
        } else {
          albums.value.push(...result.data)
        }
        totalPages.value = result.pages
        total.value = result.total
      }

      loading.value = false
    }

    const loadMore = () => {
      if (loading.value || currentPage.value >= totalPages.value) return
      currentPage.value++
      fetchAlbums(false)
    }

    const search = (newKeyword: string) => {
      keyword.value = newKeyword
      fetchAlbums(true)
    }

    return {
      albums,
      loading,
      currentPage,
      totalPages,
      total,
      keyword,
      fetchAlbums,
      loadMore,
      search
    }
  },
  {
    persist: {
      key: 'tongrenlu-store',
      pick: ['keyword']
    }
  }
)
