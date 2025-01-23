<template>
  <button :style="buttonStyle" :class="color">
    <svg-icon
      v-if="iconClass !== null"
      :icon-class="iconClass"
      :style="{ marginRight: iconButton ? '0px' : '8px' }"
    />
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'

const props = defineProps({
  iconClass: {
    type: String,
    default: null
  },
  iconButton: {
    type: Boolean,
    default: false
  },
  horizontalPadding: {
    type: Number,
    default: 16
  },
  color: {
    type: String,
    default: 'blue'
  },
  backgroundColor: {
    type: String,
    default: ''
  },
  textColor: {
    type: String,
    default: ''
  },
  shape: {
    type: String,
    default: 'square'
  }
})

const buttonStyle = computed(() => {
  const style: { [key: string]: string } = {
    borderRadius: props.shape === 'round' ? '50%' : '8px',
    padding: `8px ${props.horizontalPadding}px`,
    width: props.shape === 'round' ? '38px' : 'auto'
  }
  if (props.backgroundColor !== '') style.backgroundColor = props.backgroundColor
  if (props.textColor !== '') style.color = props.textColor
  return style
})
</script>

<style lang="scss" scoped>
button {
  height: 40px;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 18px;
  font-weight: 600;
  background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
  color: var(--color-primary);
  margin-right: 12px;
  transition: 0.2s;
  user-select: none;
  .svg-icon {
    width: 16px;
    height: 16px;
  }
  &:hover {
    transform: scale(1.06);
  }
  &:active {
    transform: scale(0.94);
  }
}
button.grey {
  background-color: var(--color-secondary-bg);
  color: var(--color-text);
  opacity: 0.78;
}
button.transparent {
  background-color: transparent;
}
</style>
