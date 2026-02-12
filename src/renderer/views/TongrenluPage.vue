<template>
  <div class="tongrenlu-page">
    <div class="content">
      <div v-if="keyword" class="search-info">
        <span class="search-label">{{ $t('tongrenlu.searchKeyword') }}</span>
        <span class="search-text">"{{ keyword }}"</span>
        <button class="clear-search-btn" @click="clearSearch">
          <svg-icon icon-class="close" />
          <span>{{ $t('tongrenlu.clearSearch') }}</span>
        </button>
      </div>

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
import { computed, onMounted, onUnmounted, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useTongrenluStore } from '../store/tongrenlu'
import CoverRow from '../components/CoverRow.vue'
import SvgIcon from '../components/SvgIcon.vue'
import eventBus from '../utils/eventBus'

const tongrenluStore = useTongrenluStore()
const { albums, loading, currentPage, totalPages, keyword } = storeToRefs(tongrenluStore)
const { fetchAlbums, search } = tongrenluStore

const hasMore = computed(() => currentPage.value < totalPages.value)

const loadMore = () => {
  if (hasMore.value && !loading.value) {
    currentPage.value++
    fetchAlbums(false)
  }
}

const updatePadding = inject('updatePadding') as (padding: number) => void

const handleTongrenluSearch = (keyword: unknown) => {
  search(keyword as string)
}

const clearSearch = () => {
  search('')
}

onMounted(() => {
  updatePadding(0)
  if (albums.value.length === 0) {
    fetchAlbums(true)
  }
  // 监听来自顶部搜索框的搜索事件
  eventBus.on('tongrenlu-search', handleTongrenluSearch)
})

onUnmounted(() => {
  eventBus.off('tongrenlu-search', handleTongrenluSearch)
})
</script>

<style scoped lang="scss">
.content {
  min-height: 400px;
}

.search-info {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  margin-bottom: 12px;
  background-color: var(--color-secondary-bg);
  border-radius: 8px;

  .search-label {
    font-size: 14px;
    color: var(--color-text);
    opacity: 0.7;
  }

  .search-text {
    flex: 1;
    margin-left: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-primary);
  }

  .clear-search-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--color-text);
    background-color: var(--color-primary-bg);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: 0.2s;

    .svg-icon {
      width: 12px;
      height: 12px;
      opacity: 0.7;
    }

    &:hover {
      background-color: var(--color-primary-bg-for-transparent);
      color: var(--color-primary);

      .svg-icon {
        opacity: 1;
      }
    }

    &:active {
      transform: scale(0.96);
    }
  }
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
  margin: 20px auto 120px auto;
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
