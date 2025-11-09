<template>
  <div class="line" :class="{ active: isActive }">
    <div class="lyric-line">
      <span>{{ item.lyric.text }}</span>
    </div>
    <div v-if="item[lyricMap[translationMode]]" class="translation">
      <span>{{ item[lyricMap[translationMode]].text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { lyricLine, TranslationMode } from '@/types/music.d'
withDefaults(
  defineProps<{
    item: lyricLine
    fontSize: number
    isActive: boolean
    backgroundColor: string
    translationMode: TranslationMode
  }>(),
  {}
)

const lyricMap = {
  tlyric: 'tlyric',
  rlyric: 'rlyric'
}
</script>

<style scoped lang="scss">
.line {
  border-radius: 12px;
  margin: 2px 0;
  user-select: none;
  padding: 12px;
  font-weight: 600;

  .lyric-line {
    transform: scale(0.95);
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    span {
      font-size: v-bind('`${fontSize}px`');
      background-repeat: no-repeat;
      background-color: v-bind('`${backgroundColor}`');
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-image: -webkit-linear-gradient(
        top,
        var(--color-wbw-text-played),
        var(--color-wbw-text-played)
      );
      background-size: 0 100%;
      overflow-wrap: break-word;
    }
  }

  .translation {
    transform: scale(0.95);
    span {
      font-size: v-bind('`${fontSize - 2}px`');
      background-color: v-bind('`${backgroundColor}`');
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-image: -webkit-linear-gradient(top, var(--color-wbw-text), var(--color-wbw-text));
      background-size: 0 100%;
      overflow-wrap: break-word;
    }
  }

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
  }
}

.line.active .lyric-line {
  transform: scale(1);
}
</style>
