<template>
  <svg-icon icon-class="explicit" :style="svgStyle"></svg-icon>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SvgIcon from './SvgIcon.vue'

const props = defineProps({
  size: {
    type: Number,
    default: 16
  }
})

const svgStyle = ref<{ [key: string]: string }>({})

onMounted(() => {
  svgStyle.value = {
    width: `${props.size}px`,
    height: `${props.size}px`,
    position: 'relative',
    left: '-1px'
  }
})
</script>

<style lang="scss" scoped></style>
