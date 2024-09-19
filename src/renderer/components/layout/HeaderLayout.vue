<script setup lang="tsx">
import SearchBox from '../SearchBox.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// const handleRoute = (path: string): void => {
//   router.push(path)
// }

// const isCurrentRoute = (path: string): boolean => {
//   return path === route.path
// }
</script>
<template>
  <v-app-bar class="px-10" flat>
    <v-btn class="mr-2 rounded-lg" @click="router.go(-1)">
      <v-icon icon="$prev" size="32"></v-icon>
    </v-btn>
    <v-btn class="rounded-lg" @click="router.go(1)">
      <v-icon icon="$next" size="32"></v-icon>
    </v-btn>
    <template #append>
      <SearchBox />
    </template>
  </v-app-bar>
</template>
<style scoped lang="scss">
.v-toolbar {
  -webkit-app-region: drag;
}
.v-btn {
  -webkit-app-region: no-drag;
  opacity: 0.7;
  min-width: 36px;
  width: 36px;

  &:hover {
    background-color: var(--color-secondary-bg-for-transparent);
    opacity: 1;
  }
}
.active {
  opacity: 1 !important;
}
.v-text-field {
  -webkit-app-region: no-drag;
}
</style>
