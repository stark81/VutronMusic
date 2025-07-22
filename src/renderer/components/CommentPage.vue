<template>
  <div class="comment-page">
    <CommentList
      v-show="currentPage === 'comment'"
      :id="props.id"
      :type="props.type"
      :padding-right="paddingRight"
    />
    <FloorComment
      v-if="currentPage === 'floorComment'"
      :id="props.id"
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

const props = defineProps({
  id: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    default: 'music'
  },
  paddingRight: {
    type: String,
    default: '4vh'
  }
})

const currentPage = ref('comment')
const beRepliedCommentId = ref(0)

watch(
  () => props.id,
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
}
</style>
