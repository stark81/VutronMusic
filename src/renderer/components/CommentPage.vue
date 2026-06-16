<template>
  <div ref="commentPageRef" class="comment-page">
    <CommentList
      v-show="currentPage === 'comment'"
      :comment-ctx="commentCtx"
      :plugin="plugin"
      :type="props.type"
      :padding-right="paddingRight"
    />
    <FloorComment
      v-if="currentPage === 'floorComment'"
      :source-context="commentCtx.mapCtx"
      :type="props.type"
      :plugin="commentCtx.mapPlugin"
      :padding-right="paddingRight"
      :selected-comment="selectedComment"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, watch, reactive } from 'vue'
import CommentList from './CommentList.vue'
import FloorComment from './CommentFloor.vue'
import { PluginId, CommentType } from '@/types/plugin'
import { CommentContentType } from '@/types/schemas'

interface Props {
  sourceContext: Record<string, any>
  type?: CommentContentType
  plugin: PluginId
  paddingRight?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'track',
  paddingRight: '4vh'
})

const currentPage = ref('comment')
const selectedComment = ref<CommentType | null>(null)

// 共享 commentCtx，CommentList 和 FloorComment 共用同一份
const commentCtx = reactive({
  rawCtx: JSON.parse(JSON.stringify(props.sourceContext)),
  mapCtx: {} as Record<string, any>,
  mapPlugin: props.plugin
})

watch(
  () => props.sourceContext,
  (value) => {
    commentCtx.rawCtx = JSON.parse(JSON.stringify(value))
    commentCtx.mapCtx = {}
    commentCtx.mapPlugin = props.plugin
    currentPage.value = 'comment'
  },
  { deep: true }
)

provide('currentPage', currentPage)
provide('selectedComment', selectedComment)
</script>

<style scoped lang="scss">
.comment-page {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  margin: 0 auto;
}
</style>
