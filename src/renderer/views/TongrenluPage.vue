<template>
  <div class="tongrenlu-page">
    <div class="content">
      <!-- 独立搜索框 -->
      <div class="search-container">
        <div class="search-box">
          <svg-icon class="search-icon" icon-class="search" />
          <input
            ref="searchInputRef"
            v-model="searchKeyword"
            type="text"
            class="search-input"
            :placeholder="$t('tongrenlu.searchPlaceholder')"
            @keyup.enter="handleSearch"
          />
          <button
            v-if="searchKeyword"
            class="clear-btn"
            @click="handleClear"
          >
            <svg-icon icon-class="close" />
          </button>
          <button class="search-btn" @click="handleSearch">
            <svg-icon icon-class="search" />
          </button>
        </div>
      </div>

      <div v-if="keyword" class="search-info">
        <span class="search-label">{{ $t('tongrenlu.searchKeyword') }}</span>
        <span class="search-text">"{{ keyword }}"</span>
        <button class="reset-btn" @click="handleReset">
          <svg-icon icon-class="close" />
          <span>{{ $t('tongrenlu.reset') }}</span>
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
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useTongrenluStore } from '../store/tongrenlu'
import CoverRow from '../components/CoverRow.vue'
import SvgIcon from '../components/SvgIcon.vue'
import eventBus from '../utils/eventBus'

const tongrenluStore = useTongrenluStore()
const { albums, loading, currentPage, totalPages, keyword } = storeToRefs(tongrenluStore)
const { fetchAlbums, search } = tongrenluStore

const searchKeyword = ref('')
const searchInputRef = ref<HTMLInputElement>()

const hasMore = computed(() => currentPage.value < totalPages.value)

const handleSearch = () => {
  if (searchKeyword.value.trim()) {
    search(searchKeyword.value.trim())
  }
}

const handleClear = () => {
  searchKeyword.value = ''
  searchInputRef.value?.focus()
}

const handleReset = () => {
  searchKeyword.value = ''
  search('')
}

const loadMore = () => {
  if (hasMore.value && !loading.value) {
    currentPage.value++
    fetchAlbums(false)
  }
}

const updatePadding = inject('updatePadding') as (padding: number) => void

const handleTongrenluSearch = (kw: unknown) => {
  searchKeyword.value = kw as string
  search(kw as string)
}

onMounted(() => {
  updatePadding(0)
  if (albums.value.length === 0) {
    fetchAlbums(true)
  }
  // 监听来自顶部搜索框的搜索事件
  eventBus.on('tongrenlu-search', handleTongrenluSearch)

  // 同步 store 中的 keyword 到搜索框
  if (keyword.value) {
    searchKeyword.value = keyword.value
  }
})

onUnmounted(() => {
  eventBus.off('tongrenlu-search', handleTongrenluSearch)
})
</script>

<style scoped lang="scss">
.content {
  min-height: 400px;
}

.search-container {
  padding: 20px 0;
  margin-bottom: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background-color: var(--color-secondary-bg-for-transparent);
  border-radius: 8px;
  transition: 0.3s;

  .search-icon {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    opacity: 0.28;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
    background: transparent;
    border: none;
    outline: none;

    &::placeholder {
      color: var(--color-text);
      opacity: 0.5;
    }
  }

  .clear-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: var(--color-text);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.6;
    transition: 0.2s;

    .svg-icon {
      width: 14px;
      height: 14px;
    }

    &:hover {
      opacity: 1;
      background-color: var(--color-secondary-bg);
    }
  }

  .search-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    color: var(--color-text);
    background-color: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: 0.3s;

    .svg-icon {
      width: 14px;
      height: 14px;
      opacity: 0.28;
    }

    &:hover {
      background-color: var(--color-secondary-bg);

      .svg-icon {
        opacity: 0.6;
      }
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

.search-info {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  margin-bottom: 12px;
  background-color: var(--color-primary-bg);
  border-radius: 8px;

  .search-label {
    font-size: 13px;
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

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--color-text);
    background-color: var(--color-secondary-bg);
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
      background-color: var(--color-secondary-bg-for-transparent);
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
