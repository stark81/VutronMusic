<template>
  <div ref="containerRef" class="container">
    <CustomSelect
      v-if="showInput && services.length > 1"
      v-model="plugin"
      :options="services.map((item) => ({ label: item.name, value: item.code }))"
    />
    <div class="search-container">
      <div
        ref="searchIconRef"
        class="search-icon"
        :class="{ active: showInput }"
        @click="toggleInput"
        ><svg-icon icon-class="search"
      /></div>
      <input
        ref="inputRef"
        v-model="keywords"
        type="search"
        class="search-input"
        :placeholder="placeholder"
        :style="{ width: showInputWidth + 'px', padding: showPadding }"
        @keydown.enter="doKeydownEnter"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { service } from '@/types/plugin'
import CustomSelect from './CustomSelect.vue'

const props = defineProps({
  showInputInitially: {
    type: Boolean,
    default: false
  },
  inputWidth: {
    type: Number,
    default: 140
  },
  placeholder: {
    type: String,
    default: '搜索'
  },
  clearKeywords: {
    type: Boolean,
    default: false
  },
  services: {
    type: Array as () => service[],
    default: () => []
  }
})

const $emit = defineEmits(['keydownEnter'])

const showInput = ref(props.showInputInitially)
const keywords = ref('')
const showInputWidth = ref(showInput.value ? props.inputWidth : 0)
const showPadding = ref(showInput.value ? '4px' : '0px')
const inputRef = ref<HTMLInputElement | null>(null)
const plugin = ref(props.services[0]?.code ?? '')
const containerRef = ref()

const doKeydownEnter = () => {
  $emit('keydownEnter', keywords.value, plugin.value)
  if (!props.clearKeywords) return
  keywords.value = ''
  inputRef.value?.blur()
  showInput.value = false
  showInputWidth.value = 0
  showPadding.value = '0px'
}

const toggleInput = () => {
  if (props.showInputInitially) {
    showInput.value = true
    return
  }
  showInput.value = !showInput.value
  if (showInput.value) {
    showInputWidth.value = props.inputWidth
    showPadding.value = '4px'
    inputRef.value?.focus()
  } else {
    showInputWidth.value = 0
    showPadding.value = '0px'
    inputRef.value?.blur()
  }
}

defineExpose({ keywords, plugin })

const handleOutside = (e: MouseEvent) => {
  if (!containerRef.value?.contains(e.target as Node) && !keywords.value) {
    showInput.value = false
    showInputWidth.value = 0
    showPadding.value = '0px'
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutside)
})
</script>

<style scoped lang="scss">
.container {
  display: flex;
  align-items: center;

  &:deep(.custom-select) {
    height: 32px;
    min-width: 120px;
    background-color: unset;

    .custom-text {
      font-size: 14px;
    }
  }
}

.search-container {
  display: flex;
  align-items: center;
  border: none;
  border-radius: 8px;
  -webkit-app-region: no-drag;
  height: 32px;
  box-sizing: border-box;
  background: var(--color-secondary-bg-for-transparent);
}

.search-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.svg-icon {
  height: 14px;
  width: 14px;
  opacity: 0.28;
}

.search-input {
  padding: 4px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  color: var(--color-text);
  background: transparent;
  transition: all 0.3s;
}
</style>
