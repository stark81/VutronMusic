<template>
  <div v-show="pros.isShow" class="loading">
    <p>Loading...</p>
  </div>
</template>

<script setup>
const pros = defineProps({
  isShow: {
    type: Boolean,
    default: false
  }
})
</script>

<style>
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50px;
  background-color: #f5f5f5;
}
</style>
