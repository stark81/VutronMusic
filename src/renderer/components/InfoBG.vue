<template>
  <svg id="bgSvg" style="height: 100%; width: 100%">
    <defs>
      <linearGradient v-if="!isDarkMode" id="gradient" gradientTransform="rotate(30)">
        <stop offset="0%" stop-color="#fdfbfb"></stop>
        <stop offset="40%" stop-color="#ededed"></stop>
        <stop offset="150%" stop-color="#fff"></stop>
      </linearGradient>
      <linearGradient v-else id="gradient" gradientTransform="rotate(30)">
        <stop offset="0%" stop-color="#323232"></stop>
        <stop offset="40%" stop-color="#3F3F3F"></stop>
        <stop offset="150%" stop-color="#222"></stop>
      </linearGradient>
    </defs>
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M 408 240  L 0 240  L 0 119.676748582231  L 0 0  L 493.923 0  L 542 61.401  L 408 240  Z M 523.673 190  L 502.983 216.435  L 521.427 240  L 819.671 240  L 802.435 217.978  C 801.723 217.07  801.723 215.801  802.435 214.885  L 821.917 190  L 523.673 190  Z M 809.178 216.435  L 827.621 240  L 843.477 240  L 826.241 217.978  C 825.528 217.07  825.528 215.801  826.241 214.885  L 859.723 172  L 843.868 172  L 829.868 190  L 809.178 216.435  Z M 517.178 59.0216  L 486.421 19.7349  C 486.059 19.265  485.493 19  484.903 19  L 475.59 19  C 474.783 19  474.337 19.9276  474.831 20.5541  L 506.805 61.407  L 474.831 102.26  C 474.337 102.886  474.783 103.814  475.59 103.814  L 484.903 103.814  C 485.493 103.814  486.059 103.537  486.421 103.079  L 517.178 63.7803  C 517.71 63.1016  518 62.2638  518 61.401  C 518 60.5382  517.71 59.7004  517.178 59.0216  Z M 449.796 19.7349  C 449.435 19.265  448.869 19  448.278 19  L 438.966 19  C 438.159 19  437.713 19.9276  438.207 20.5541  L 470.181 61.407  L 438.207 102.26  C 437.713 102.886  438.159 103.814  438.966 103.814  L 448.278 103.814  C 448.869 103.814  449.435 103.537  449.796 103.079  L 480.554 63.7803  C 481.086 63.1016  481.376 62.2638  481.376 61.401  C 481.376 60.5382  481.086 59.7004  480.554 59.0216  L 449.796 19.7349  Z M 496.241 214.885  L 528.723 172  L 510.868 172  L 460.7 240  L 513.477 240  L 496.241 217.978  C 495.529 217.07  495.529 215.801  496.241 214.885  Z "
      fill="url(#gradient)"
    />
  </svg>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '../store/settings'

const { theme } = storeToRefs(useSettingsStore())
const isDarkMode = ref(false)

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  isDarkMode.value =
    theme.value.appearance === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme.value.appearance === 'dark'
})

onMounted(() => {
  isDarkMode.value =
    theme.value.appearance === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme.value.appearance === 'dark'
})
</script>
