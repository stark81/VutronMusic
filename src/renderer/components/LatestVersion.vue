<template>
  <div
    v-if="latestVersion?.updateInfo?.releaseNotes"
    v-same-html="latestVersion?.updateInfo?.releaseNotes || ''"
    class="update-release"
  ></div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import { useNormalStateStore } from '../store/state'

const stateStore = useNormalStateStore()
const { latestVersion } = toRefs(stateStore)
</script>

<style lang="scss">
.update-release {
  width: 100%;
  display: table;
  border-radius: 12px;
  padding: 10px 10px;
  background-color: var(--color-secondary-bg);

  h1,
  h2,
  h3 {
    padding: 0.3em 0;
    border-bottom: 2px solid var(--color-secondary-bg-for-transparent);
  }

  ul,
  ol {
    padding: 0.5em 0 0.5em 2em;
  }
}
</style>
