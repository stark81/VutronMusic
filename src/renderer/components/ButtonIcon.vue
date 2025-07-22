<template>
  <button class="button-icon"><slot></slot></button>
</template>

<script setup lang="ts"></script>

<style scoped lang="scss">
button {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
  background: transparent;
  margin: 4px;
  border-radius: 25%;
  transition: 0.2s;
  :deep(.svg-icon) {
    height: 16px;
    width: 16px;
    color: var(--color-text);
    transition: color 0.3s;
  }
  &:first-child {
    margin-left: 0;
  }
  &:hover {
    background: var(--color-secondary-bg-for-transparent);
  }
  &:active {
    transform: scale(0.92);
  }
}
</style>
