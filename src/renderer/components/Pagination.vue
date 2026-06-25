<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="pagination">
    <button
      class="page-btn"
      :disabled="currentPage <= 0"
      @click="$emit('page-change', currentPage - 1)"
    >
      ‹
    </button>

    <button
      v-for="p in visiblePages"
      :key="p"
      class="page-btn"
      :class="{ active: p === currentPage }"
      @click="$emit('page-change', p)"
    >
      {{ p + 1 }}
    </button>

    <button
      class="page-btn"
      :disabled="currentPage >= totalPages - 1"
      @click="$emit('page-change', currentPage + 1)"
    >
      ›
    </button>

    <span class="page-info">
      第
      <input
        v-model.number="jumpInput"
        type="number"
        class="page-input"
        :min="1"
        :max="totalPages"
        @keyup.enter="jump"
      />
      页 / 共 {{ totalPages }} 页
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  currentPage: number // 0-based
  totalPages: number
}>()

const emit = defineEmits<{
  'page-change': [page: number]
}>()

const jumpInput = ref(props.currentPage + 1)

watch(
  () => props.currentPage,
  (page) => {
    jumpInput.value = page + 1
  }
)

const visiblePages = computed(() => {
  const total = props.totalPages
  const current = props.currentPage
  const pages: number[] = []

  // 显示当前页附近的页码
  const start = Math.max(0, current - 2)
  const end = Math.min(total - 1, current + 2)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

const jump = () => {
  const page = Math.max(0, Math.min(jumpInput.value - 1, props.totalPages - 1))
  emit('page-change', page)
}
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  user-select: none;
  float: right;
}
.page-btn {
  min-width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--color-secondary-bg);
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
  transition: 0.15s;
}
.page-btn:hover:not(:disabled):not(.active) {
  opacity: 0.8;
}
.page-btn.active {
  background: var(--color-primary);
  color: white;
}
.page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.page-info {
  margin-left: 12px;
  font-size: 13px;
  opacity: 0.68;
  display: flex;
  line-height: 28px;
  align-items: center;
  gap: 4px;
}
.page-input {
  width: 40px;
  height: 28px;
  text-align: center;
  border: 1px solid var(--color-secondary-bg);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  -moz-appearance: textfield;
  appearance: textfield;
}
.page-input::-webkit-outer-spin-button,
.page-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
