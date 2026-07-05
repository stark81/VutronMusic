<template>
  <div ref="rootRef" class="select-wrapper">
    <div class="custom-select" @click="toggleDropdown">
      <input
        v-if="searchable && dropdownVisible"
        ref="searchInputRef"
        v-model="searchKeyword"
        class="custom-input"
        :placeholder="selectedLabel"
        @input="onSearchInput"
        @keydown="onKeyDown"
        @click.stop
      />
      <span v-else class="custom-text" @click.stop="toggleDropdown">{{ selectedLabel }}</span>
      <span class="custom-icon"
        ><svg-icon
          icon-class="dropdown"
          :style="{ transform: dropdownVisible ? 'scaleY(-1)' : 'scaleY(1)' }"
      /></span>
    </div>
    <Teleport to="body">
      <div v-if="dropdownVisible" ref="dropdownRef" class="custom-dropdown" :style="dropdownStyle">
        <div v-if="filteredOptions.length === 0" class="no-data-item">
          {{ noDataText }}
        </div>
        <div
          v-for="(option, index) in filteredOptions"
          :key="String(option.value)"
          class="custom-select-item"
          :class="{
            active: option.value === hoverValue,
            highlighted: index === highlightedIndex
          }"
          @mouseover="onMouseOver(option.value, index)"
          @click="selectOption(option.value)"
        >
          <slot name="option" :option="option">
            <div>{{ option.label }}</div>
          </slot>
        </div>
      </div>
    </Teleport>
  </div>
</template>
<script lang="ts" setup>
import { computed, watch, ref, nextTick, onUnmounted } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { useNormalStateStore } from '../store/state'
import { storeToRefs } from 'pinia'

const props = withDefaults(
  defineProps<{
    modelValue: string | number | boolean | null | undefined
    options: Array<{ label: string; value: string | number | boolean }>
    searchable?: boolean
    noDataText?: string
    placeholder?: string
    direction?: 'auto' | 'up' | 'down'
    filterMethod?: (
      keyword: string,
      option: { label: string; value: string | number | boolean }
    ) => boolean
  }>(),
  {
    searchable: false,
    placeholder: '请选择',
    noDataText: '暂无数据',
    direction: 'auto',
    filterMethod: undefined
  }
)

const $emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | boolean): void
  (e: 'search', keyword: string): void
}>()

const { enableScrolling } = storeToRefs(useNormalStateStore())

const rootRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const dropdownVisible = ref(false)
const hoverValue = ref(props.modelValue)
const dropdownStyle = ref<Record<string, string>>({})
const searchKeyword = ref('')
const highlightedIndex = ref(-1)

const defaultFilterMethod = (
  keyword: string,
  option: { label: string; value: string | number | boolean }
) => {
  return option.label.toLowerCase().includes(keyword.toLowerCase())
}

const filteredOptions = computed(() => {
  if (!props.searchable || !searchKeyword.value.trim()) {
    return props.options
  }

  const filterFn = props.filterMethod || defaultFilterMethod
  return props.options.filter((option) => filterFn(searchKeyword.value, option))
})

const selectedLabel = computed(() => {
  const selectedOption = props.options.find((option) => option.value === props.modelValue)
  return selectedOption ? selectedOption.label : props.placeholder
})

const calculateDropdownPosition = async () => {
  if (!rootRef.value) return
  const selectRect = rootRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const GAP = 4

  const spaceBelow = viewportHeight - selectRect.bottom
  const spaceAbove = selectRect.top

  const openUp =
    props.direction === 'up' ||
    (props.direction === 'auto' && spaceBelow < 200 && spaceAbove > spaceBelow)

  let top: number
  let maxHeight: number

  if (openUp) {
    maxHeight = Math.min(300, spaceAbove - GAP)
    top = selectRect.top - GAP - maxHeight
  } else {
    maxHeight = Math.min(300, spaceBelow - GAP)
    top = selectRect.bottom + GAP
  }

  let left = selectRect.left
  if (left + selectRect.width > viewportWidth - 8) {
    left = viewportWidth - selectRect.width - 8
  } else if (left < 8) {
    left = 8
  }

  dropdownStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${selectRect.width}px`,
    maxHeight: `${maxHeight}px`
  }
}

const toggleDropdown = async () => {
  dropdownVisible.value = !dropdownVisible.value

  if (dropdownVisible.value) {
    await nextTick()
    calculateDropdownPosition()

    if (props.searchable) {
      await nextTick()
      searchInputRef.value?.focus()
    }
  } else {
    resetSearch()
  }
}

const selectOption = (value: string | number | boolean) => {
  $emit('update:modelValue', value)
  dropdownVisible.value = false
  resetSearch()
}

const resetSearch = () => {
  searchKeyword.value = ''
  highlightedIndex.value = -1
}

const onSearchInput = () => {
  highlightedIndex.value = -1
  $emit('search', searchKeyword.value)
}

const onMouseOver = (value: string | number | boolean, index: number) => {
  hoverValue.value = value
  highlightedIndex.value = index
}

const onKeyDown = (event: KeyboardEvent) => {
  const optionsLength = filteredOptions.value.length

  if (optionsLength === 0) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value =
        highlightedIndex.value < optionsLength - 1 ? highlightedIndex.value + 1 : 0
      hoverValue.value = filteredOptions.value[highlightedIndex.value]?.value
      break

    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value =
        highlightedIndex.value > 0 ? highlightedIndex.value - 1 : optionsLength - 1
      hoverValue.value = filteredOptions.value[highlightedIndex.value]?.value
      break

    case 'Enter':
      event.preventDefault()
      if (highlightedIndex.value >= 0) {
        selectOption(filteredOptions.value[highlightedIndex.value].value)
      }
      break

    case 'Escape':
      event.preventDefault()
      dropdownVisible.value = false
      resetSearch()
      break
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    dropdownVisible.value = false
    resetSearch()
  }
}

const handleScroll = () => {
  if (dropdownVisible.value) {
    calculateDropdownPosition()
  }
}

const handleResize = () => {
  if (dropdownVisible.value) {
    calculateDropdownPosition()
  }
}

const closeDropdown = () => {
  dropdownVisible.value = false
  resetSearch()
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    closeDropdown()
  }
}

const isTargetInside = (target: Node) => {
  return rootRef.value?.contains(target) || dropdownRef.value?.contains(target)
}

watch(dropdownVisible, (visible) => {
  if (visible) {
    enableScrolling.value = false
    hoverValue.value = props.modelValue
    document.addEventListener('click', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    window.addEventListener('blur', closeDropdown)
    window.addEventListener('visibilitychange', handleVisibilityChange)
  } else {
    enableScrolling.value = true
    document.removeEventListener('click', handleClickOutside)
    window.removeEventListener('scroll', handleScroll, true)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('blur', closeDropdown)
    window.removeEventListener('visibilitychange', handleVisibilityChange)
    dropdownStyle.value = {}
  }
})

defineExpose({ isTargetInside })

onUnmounted(() => {
  enableScrolling.value = true
})
</script>

<style lang="scss" scoped>
.select-wrapper {
  position: relative;
  width: 100%;
}

.custom-select {
  display: flex;
  background: var(--color-secondary-bg);
  min-width: 150px;
  height: 40px;
  box-sizing: border-box;
  border-radius: 8px;
  padding: 0 12px;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.custom-select .custom-input {
  background: transparent;
  border: none;
  outline: none;
  width: 120px;
  color: var(--color-text);
  font-size: 16px;
  font-weight: 600;
  box-sizing: border-box;
  text-align: center;
  cursor: text;

  &::placeholder {
    color: var(--color-text-secondary);
    font-weight: normal;
  }
}

.custom-select .custom-text {
  color: var(--color-text);
  font-size: 16px;
  font-weight: 600;
  width: 100%;
  user-select: none;
  text-align: center;
}

.custom-select .custom-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  flex-shrink: 0;
}

.custom-dropdown {
  position: fixed;
  background: var(--color-secondary-bg);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  overflow: auto;
  box-sizing: border-box;
}

.custom-select-item {
  padding: 8px 12px;
  cursor: pointer;
  color: var(--color-text);
  text-align: center;
  font-size: 14px;
  transition: background-color 0.2s ease;

  &:hover,
  &.highlighted {
    background-color: var(--color-primary);
    color: white;
  }

  &:first-child {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  &:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
}

.custom-select-item.active {
  background-color: var(--color-primary);
  color: white;
}

.no-data-item {
  padding: 12px;
  color: var(--color-text-secondary);
  text-align: center;
  font-size: 14px;
  font-style: italic;
}

.custom-dropdown::-webkit-scrollbar {
  width: 0px;
}

.custom-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.custom-dropdown::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 3px;

  &:hover {
    background-color: var(--color-text-secondary);
  }
}
</style>
