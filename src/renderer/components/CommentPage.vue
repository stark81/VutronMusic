<template>
  <div ref="commentPageRef" class="comment-page">
    <CommentList
      v-show="currentPage === 'comment'"
      :source-context="sourceContext"
      :plugin="plugin"
      :type="props.type"
      :padding-right="paddingRight"
    />
    <FloorComment
      v-if="currentPage === 'floorComment'"
      :id="0"
      :type="props.type"
      :padding-right="paddingRight"
      :be-replied-comment-id="beRepliedCommentId"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, watch } from 'vue'
import CommentList from './CommentList.vue'
import FloorComment from './CommentFloor.vue'
import { PluginId } from '@/types/plugin'

interface Props {
  sourceContext: Record<string, any>
  type?: string
  plugin: PluginId
  paddingRight?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'music',
  paddingRight: '4vh'
})

const currentPage = ref('comment')
const beRepliedCommentId = ref(0)

watch(
  () => props.sourceContext,
  () => {
    currentPage.value = 'comment'
  }
)

provide('currentPage', currentPage)
provide('beRepliedCommentId', beRepliedCommentId)
</script>

<style scoped lang="scss">
.comment-page {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  margin: 0 auto;
}
</style>
