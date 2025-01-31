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
      <span class="label" v-text="props.label"></span>
    </label>
  </div>
</template>

<script setup lang="ts">
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
  &:checked {
    accent-color: var(--color-primary);
    + .content {
      .container {
        &:after {
          border-color: var(--color-primary-font);
        }
      }
      .icon {
        transform: scale(1);
      }
    }
  }
}
.content {
  align-items: center;
}

.label {
  flex: auto;
  margin-left: 5px;
  line-height: 1.5;
  cursor: pointer;
}
</style>
