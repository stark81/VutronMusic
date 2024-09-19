<script setup lang="tsx">
// import HeaderLayout from '@/renderer/components/layout/HeaderLayout.vue'
import NavBar from '@/renderer/components/NavBar.vue'
</script>

<template>
  <v-app>
    <v-layout>
      <!-- <HeaderLayout /> -->
      <NavBar />
      <v-main>
        <slot />
      </v-main>
    </v-layout>
  </v-app>
</template>
