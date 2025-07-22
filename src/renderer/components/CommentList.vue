<template>
  <div v-if="show" class="comment-container" :style="containerStyle">
    <div class="comment-head">
      <label>评论({{ commentInfo.totalCount }})</label>
      <div class="btns">
        <button
          class="btn"
          :class="{ active: commentInfo.sortType === 1 }"
          @click="handleClickSortType(1)"
          >推荐</button
        >
        <button
          class="btn"
          :class="{ active: commentInfo.sortType === 2 }"
          @click="handleClickSortType(2)"
          >最热</button
        >
        <button
          class="btn"
          :class="{ active: commentInfo.sortType === 3 }"
          @click="handleClickSortType(3)"
          >最新</button
        >
      </div>
    </div>
    <div ref="mainRef" class="comment-main" :style="mainStyle">
      <VirtualScroll
        v-if="comments.length"
        :list="comments"
        :item-size="63"
        :is-end="false"
        :height="commentHeight"
        :padding-bottom="0"
        :above-value="5"
        :below-value="5"
        :show-position="false"
        :load-more="loadComment"
      >
        <template #default="{ item }">
          <div class="comment-item">
            <div class="avatar" @click="goToUser(item)">
              <img :src="getImage(item.user.avatarUrl)" alt="" loading="lazy"
            /></div>
            <div class="comment-info">
              <div class="comment">
                <label class="comment-nickname" @click="goToUser(item)"
                  >{{ item.user.nickname }}：</label
                >
                <label>{{ item.content }}</label>
              </div>
              <div
                v-if="
                  item.beReplied?.length &&
                  item.beReplied[0].beRepliedCommentId !== item.parentCommentId
                "
                class="comment-beReplied"
              >
                <label v-if="item.beReplied[0].content" class="comment-nickname"
                  >@{{ item.beReplied[0].user.nickname }}:
                </label>
                <label>{{ item.beReplied[0].content ?? '该评论已删除' }}</label>
              </div>
              <div class="comment-ex">
                <div class="time-ip">
                  <div class="time">{{ formatDate(item.time, 'YYYY年MM月DD日 H:mm') }}</div>
                  <div v-if="item.ipLocation?.location">来自{{ item.ipLocation.location }}</div>
                </div>
                <div class="comment-btns">
                  <button v-if="isAccountLoggedIn && item.owner" @click="handleDeleteComment(item)"
                    >删除</button
                  >
                  <button @click="handleLikeComment(item)"
                    ><svg-icon :icon-class="item.liked ? 'liked' : 'like'" />{{
                      item.likedCount
                    }}</button
                  >
                  <button
                    v-show="!item.beReplied?.length"
                    @click="switchCommentPage(item.commentId)"
                    ><svg-icon icon-class="floor-comment" />{{ item.replyCount }}</button
                  >
                </div>
              </div>
            </div>
          </div>
        </template>
      </VirtualScroll>
    </div>
    <div class="write-comment">
      <WriteComment
        ref="commentSubmitRef"
        placeholder="随乐而起，有感而发"
        @keydown-enter="handleSubmitComment"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, inject, computed, onBeforeUnmount, watch } from 'vue'
import { getComment, likeComment, submitComment } from '../api/comment'
import { useNormalStateStore } from '../store/state'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import WriteComment from './WriteComment.vue'
import SvgIcon from './SvgIcon.vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '../utils'
import { isAccountLoggedIn } from '../utils/auth'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

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

const currentPage = inject('currentPage', ref('comment'))
const beRepliedCommentId = inject('beRepliedCommentId', ref(0))
const show = ref(false)
const comments = ref<any[]>([])
const mainRef = ref()
const commentSubmitRef = ref()
const router = useRouter()
const winHeight = ref(window.innerHeight)
const commentInfo = reactive({
  totalCount: 0,
  sortType: 1,
  paramType: 1,
  pageNo: 1,
  hasMore: true,
  cursor: 0,
  pageSize: 50
})

const containerStyle = computed(() => {
  return {
    height: props.type === 'mv' ? 'calc(100vh - 84px)' : '100vh',
    padding: props.type === 'mv' ? '0 0 0 3vh' : `40px 8vh 0 ${props.paddingRight}`
  }
})

const commentHeight = computed(() => {
  return winHeight.value - (props.type === 'mv' ? 205 : 160)
})

const mainStyle = computed(() => {
  return {
    height: props.type === 'mv' ? 'calc(100vh - 205px)' : 'calc(100vh - 160px)'
  }
})

const typeMap = {
  music: 0,
  mv: 1,
  playlist: 2,
  album: 3,
  djRadio: 4,
  video: 5
}

watch(
  () => props.id,
  () => {
    if (props.type === 'music') {
      commentInfo.totalCount = 0
      commentInfo.sortType = 1
      commentInfo.paramType = 1
      commentInfo.pageNo = 1
      commentInfo.hasMore = true
      commentInfo.cursor = 0
      commentInfo.pageSize = 50
      comments.value = []
      loadComment()
    }
  }
)

const { t } = useI18n()
const stateStore = useNormalStateStore()
const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

const getImage = (url: string) => {
  if (url.startsWith('http:')) {
    url = url.replace('http:', 'https:')
  }
  return url + '?param=64y64'
}

const updateWindowHeight = () => {
  winHeight.value = window.innerHeight
}

const handleClickSortType = (type: number) => {
  commentInfo.sortType = type
  commentInfo.paramType = type
  commentInfo.pageNo = 1
  commentInfo.hasMore = true
  commentInfo.totalCount = 0
  commentInfo.cursor = 0
  comments.value = []
  loadComment()
}

/**
 * 加载评论。逻辑为：
 * 1. 先加载推荐评论，但推荐评论一般只有一页，所以之后需要自动切换到加载最新评论
 * 2. 加载最新评论时，评论列表为之前的推荐+最新评论，所以评论列表数量比评论总数要更多
 * 3. 网易评论返回的数据问题很大，要么是hasMore为true但实际没有更多数据，要么是hasMore为false但实际还有更多数据, 要么会出现评论数量和总数不一致的问题，所以处理有些复杂，本项目里暂时按评论数量大于总数 或者 评论数量和总数之间的差值小于3视为加载完毕
 */
const loadComment = () => {
  if (
    !commentInfo.hasMore &&
    (comments.value.length >= commentInfo.totalCount ||
      Math.abs(comments.value.length - commentInfo.totalCount) < 3)
  ) {
    return
  }
  const params = {
    id: props.id,
    type: typeMap[props.type],
    sortType: commentInfo.paramType,
    pageNo: commentInfo.pageNo,
    pageSize: commentInfo.pageSize
  }
  if (!commentInfo.hasMore && commentInfo.sortType === 1 && commentInfo.paramType === 1) {
    commentInfo.paramType = 3
    params.sortType = 3
    commentInfo.pageNo = 1
    params.pageNo = 1
  }

  if (params.sortType === 3 && params.pageNo > 1) {
    // @ts-ignore
    params.cursor = commentInfo.cursor
  }
  getComment(params).then((res) => {
    if (res.code === 200) {
      commentInfo.totalCount = res.data.totalCount || commentInfo.totalCount
      commentInfo.hasMore = res.data.hasMore
      commentInfo.pageNo++
      commentInfo.cursor = res.data.cursor
      comments.value.push(...res.data.comments)
    }
    show.value = true
  })
}

const goToUser = (item: any) => {
  router.push(`/user/${item.user.userId}`)
  showLyrics.value = false
}

const switchCommentPage = (pid: number) => {
  beRepliedCommentId.value = pid
  currentPage.value = 'floorComment'
}

const handleDeleteComment = (comment: any) => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  if (confirm(`确定要删除评论'${comment.content}'吗？`)) {
    const params = {
      t: 0,
      type: typeMap[props.type],
      id: props.id,
      commentId: comment.commentId
    }
    submitComment(params).then((res) => {
      if (res.code === 200) {
        comments.value = comments.value.filter((item) => item !== comment)
        commentInfo.totalCount -= 1
      } else {
        showToast(`${res.message}，${res.data?.dialog?.subtitle}`)
      }
    })
  }
}

const handleLikeComment = (comment: any) => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  likeComment({
    id: props.id,
    cid: comment.commentId,
    t: comment.liked ? 0 : 1,
    type: typeMap[props.type]
  })
    .then((res) => {
      if (res.code === 200) {
        comment.likedCount += comment.liked ? -1 : 1
        comment.liked = !comment.liked
      } else {
        showToast(res.msg + res?.data?.dialog?.subtitle)
      }
    })
    .catch((err) => {
      showToast(err)
    })
}

const handleSubmitComment = () => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  const params = {
    t: 1,
    type: typeMap[props.type],
    id: props.id,
    content: commentSubmitRef.value.comment
  }
  submitComment(params)
    .then((res) => {
      if (res.code === 200) {
        const comment = res.comment
        comment.liked = false
        comment.likedCount = 0
        comment.replyCount = 0
        comments.value.unshift(comment)
        commentInfo.totalCount += 1
      } else {
        showToast(`${res.message}，${res.data?.dialog?.subtitle}`)
      }
    })
    .catch((error) => {
      showToast(error)
    })
    .finally(() => {
      commentSubmitRef.value.comment = ''
    })
}

onMounted(() => {
  window.addEventListener('resize', updateWindowHeight)
  loadComment()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateWindowHeight)
})
</script>

<style scoped lang="scss">
.comment-container {
  // height: 100vh;
  // width: 100%;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  // padding: 40px 8vh 0 4vh;
  transition: all 0.5s;
}

.comment-head {
  display: flex;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 20px;
  justify-content: space-between;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  .btns {
    display: flex;
    text-align: center;
    justify-items: center;
    .btn {
      font-size: 16px;
      color: var(--color-text);
      font-weight: bold;
      padding: 0 10px;
      opacity: 0.5;
      -webkit-app-region: no-drag;
      cursor: pointer;
    }
    .btn.active {
      opacity: 1;
    }
  }
}

.comment-main {
  width: 100%;
  // height: calc(100vh - 160px);
}

.comment-item {
  display: flex;
  width: 100%;
  padding-bottom: 4px;

  .avatar {
    cursor: pointer;
  }
  img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    margin-right: 10px;
  }
}
.comment-item.first {
  padding-bottom: 10px;
  .comment-ex {
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  }
}
.comment-info {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.comment {
  // width: auto;
  word-break: break-all;

  .comment-nickname {
    cursor: pointer;
    font-weight: bold;
  }
}
.comment-beReplied {
  font-size: 14px;
  margin: 5px 0;
  padding: 6px 10px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.1);

  .comment-nickname {
    font-weight: bold;
  }
}
.comment-ex {
  display: flex;
  margin-top: 4px;
  padding-bottom: 10px;
  width: 100%;
  font-size: 14px;
  opacity: 0.7;
  text-align: center;
  justify-content: center;
  justify-content: space-between;

  .time-ip {
    display: flex;

    .time {
      margin-right: 6px;
    }
  }
  .comment-btns {
    display: flex;
  }
  button {
    display: flex;
    margin-left: 10px;
    align-items: center;
    color: var(--color-text);

    svg {
      margin-right: 2px;
    }
  }
}
.write-comment {
  padding-top: 8px;
}
</style>
