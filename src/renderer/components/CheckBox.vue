<template>
  <div class="checkbox">
    <input
      :id="props.id"
      class="input"
      :disabled="props.disabled"
      :checked="checked"
      type="checkbox"
      @input="handleInput"
    />
    <label :for="props.id" class="content">
      <div class="container" role="checkbox" :aria-checked="checked">
        <svg-icon v-if="checked" icon-class="checked" style="color: var(--color-primary)" />
        <svg-icon v-else icon-class="checkbox" />
      </div>
      <span class="label" v-text="props.label"></span>
    </label>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean, () => [] as Array<any>],
    required: true
  },
  value: {
    type: [String, Number, Boolean, () => [] as Array<any>],
    default: undefined
  },
  id: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const checked = ref(false)

const $emit = defineEmits(['updateInput'])

const handleInput = (event: Event) => {
  checked.value = !checked.value
  const target = event.target as HTMLInputElement
  $emit('updateInput', target.checked)
}

const setValue = (value: any) => {
  if (Array.isArray(props.modelValue)) {
    checked.value = value.includes(props.value)
  } else if (typeof props.modelValue === 'boolean') {
    checked.value = props.modelValue
  } else if (value === null) {
    checked.value = props.modelValue !== ''
  } else {
    checked.value = props.modelValue === props.value
  }
}

watch(
  () => props.modelValue,
  (value) => {
    setValue(value)
  }
)

onMounted(() => {
  setValue(props.modelValue)
})
</script>

<style lang="scss" scoped>
.checkbox {
  display: inline-block;
  margin: 0 16px 4px 0;
  font-size: 15px;
}
.input {
  display: none;
  &[disabled] {
    + .content {
      opacity: 0.5;
      .container,
      .label {
        cursor: default;
      }
    }
  }
  &:checked {
    + .content {
      .container {
        &:after {
          border-color: var(--color-primary-font);
        }
      }
      .icon {
        transform: scale(1);
        // opacity: 1;
      }
    }
  }
}
.content {
  display: flex;
  align-items: center;
}
.container {
  flex: none;
  position: relative;
  cursor: pointer;
  display: flex;
  border-radius: 2px;
  &:after {
    position: absolute;
    content: ' ';
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
  }
}
.icon {
  transition: 0.3s ease;
  transition-property: transform;
  transform: scale(0);
  border-radius: 2px;
  // opacity: 0;
}

.label {
  flex: auto;
  margin-left: 5px;
  line-height: 1.5;
  cursor: pointer;
}
</style>
