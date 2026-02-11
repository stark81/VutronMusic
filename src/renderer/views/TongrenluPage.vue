<template>
  <div class="tongrenlu-page">
    <div class="tabs-row">
      <div class="tabs">
        <div class="tab active">{{ $t('nav.tongrenlu') }}</div>
      </div>
      <div class="search-box">
        <SearchBox
          ref="searchBoxRef"
          :placeholder="$t('tongrenlu.searchPlaceholder')"
          @search="handleSearch"
        />
      </div>
    </div>

    <div class="content">
      <div v-if="loading && albums.length === 0" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="albums.length === 0" class="empty">
        <div class="empty-icon">?</div>
        <div class="empty-text">{{ $t('tongrenlu.noResults') }}</div>
      </div>

      <div v-else class="album-grid">
        <CoverRow
          :items="albums"
          type="album"
          :sub-text="'none'"
          :colunm-number="5"
          :style="{ paddingBottom: '96px' }"
        />
      </div>

      <div v-if="loading && albums.length > 0" class="loading-more">
        <div class="spinner"></div>
      </div>

      <div v-if="hasMore && !loading" class="load-more" @click="loadMore">
        {{ $t('tongrenlu.loadMore') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useTongrenluStore } from '../store/tongrenlu'
import CoverRow from '../components/CoverRow.vue'
import SearchBox from '../components/SearchBox.vue'

const tongrenluStore = useTongrenluStore()
const { albums, loading, currentPage, totalPages } = storeToRefs(tongrenluStore)
const { fetchAlbums, search } = tongrenluStore

const searchBoxRef = ref<InstanceType<typeof SearchBox>>()

const hasMore = computed(() => currentPage.value < totalPages.value)

const handleSearch = () => {
  const keyword = searchBoxRef.value?.keywords || ''
  search(keyword)
}

const loadMore = () => {
  if (hasMore.value && !loading.value) {
    currentPage.value++
    fetchAlbums(false)
  }
}

const updatePadding = inject('updatePadding') as (padding: number) => void

onMounted(() => {
  updatePadding(0)
  if (albums.value.length === 0) {
    fetchAlbums(true)
  }
})
</script>

<style scoped lang="scss">
.tabs-row {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0;
  background: var(--color-body-bg);
  z-index: 10;

  .tabs {
    display: flex;
    font-size: 18px;

    .tab {
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 8px;
      opacity: 0.68;
      transition: 0.2s;

      &.active {
        opacity: 0.88;
        background-color: var(--color-secondary-bg);
      }
    }
  }
}

.search-box {
  width: 280px;
}

.content {
  min-height: 400px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 100px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-secondary-bg);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  color: var(--color-text);
  opacity: 0.6;

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .empty-text {
    font-size: 16px;
  }
}

.album-grid {
  padding: 20px 0;
}

.loading-more {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.load-more {
  text-align: center;
  padding: 12px 24px;
  margin: 20px auto;
  max-width: 200px;
  border-radius: 8px;
  background-color: var(--color-secondary-bg);
  color: var(--color-text);
  cursor: pointer;
  transition: 0.2s;
  opacity: 0.8;

  &:hover {
    opacity: 1;
    background-color: var(--color-primary);
    color: white;
  }

  &:active {
    transform: scale(0.96);
  }
}
</style>
