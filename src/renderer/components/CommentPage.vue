<template>
  <CommentList v-show="currentPage === 'comment'" :id="props.id" :type="props.type" />
  <FloorComment
    v-if="currentPage === 'floorComment'"
    :id="props.id"
    :type="props.type"
    :be-replied-comment-id="beRepliedCommentId"
  />
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
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
  }
})

const currentPage = ref('comment')
const beRepliedCommentId = ref(0)
provide('currentPage', currentPage)
provide('beRepliedCommentId', beRepliedCommentId)
</script>

<style scoped lang="scss"></style>
