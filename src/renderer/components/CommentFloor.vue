<template>
  <div v-if="show" class="comment-container" :style="containerStyle">
    <div class="comment-head">
      <label>回复({{ floorCommentInfo.totalCount }})</label>
      <div class="btns">
        <button class="btn" @click="switchToCommentPage">关闭</button>
      </div>
    </div>
    <div ref="mainRef" class="comment-main" :style="mainStyle">
      <VirtualScroll
        v-if="floorComments.length"
        :list="floorComments"
        :height="commentHeight"
        :item-size="63"
        :padding-bottom="0"
        :above-value="5"
        :below-value="5"
        :show-position="false"
        :is-end="false"
        :load-more="() => loadFloorComment(props.beRepliedCommentId)"
      >
        <template #default="{ item, index }">
          <div class="comment-item" :class="{ first: index === 0 }">
            <div class="avatar" @click="goToUser(item)"
              ><img :src="getImage(item.user.avatarUrl)" alt="" loading="lazy"
            /></div>
            <div class="comment-info" @click="replyFloor(item)">
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
                  <button
                    v-if="isAccountLoggedIn && item.owner"
                    @click.stop="handleDeleteComment(item)"
                    >删除</button
                  >
                  <button @click.stop="handleLikeComment(item)"
                    ><svg-icon :icon-class="item.liked ? 'liked' : 'like'" />{{
                      item.likedCount
                    }}</button
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
        ref="floorCommentRef"
        :placeholder="placeholder"
        @keydown-enter="handleSubmitComment"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, inject, onBeforeUnmount } from 'vue'
import { likeComment, getFloorComment, submitComment } from '../api/comment'
import { useNormalStateStore } from '../store/state'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import WriteComment from './WriteComment.vue'
import SvgIcon from './SvgIcon.vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatDate } from '../utils'
import { isAccountLoggedIn } from '../utils/auth'
import { storeToRefs } from 'pinia'

const props = defineProps({
  beRepliedCommentId: {
    type: Number,
    required: true
  },
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

const show = ref(false)
const floorComments = ref<any[]>([])
const mainRef = ref()
const selectedComment = ref()
const floorCommentRef = ref()
const currentPage = inject('currentPage', ref('floorComment'))
const winHeight = ref(window.innerHeight)
const floorCommentInfo = reactive({
  limit: 20,
  time: 0,
  hasMore: true,
  totalCount: 0,
  commentId: 0
})
const placeholder = computed(() => {
  return `回复${selectedComment.value.user.nickname}:`
})

const containerStyle = computed(() => {
  return {
    height: props.type === 'mv' ? 'calc(100vh - 84px)' : '100vh',
    padding: props.type === 'mv' ? '0 0 0 3.5vh' : `40px 8vh 0 ${props.paddingRight}`
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

const router = useRouter()
const goToUser = (item: any) => {
  router.push(`/user/${item.user.userId}`)
  showLyrics.value = false
}

const switchToCommentPage = () => {
  currentPage.value = 'comment'
  show.value = false
}

const loadFloorComment = (pid: number) => {
  if (!floorCommentInfo.hasMore) return
  const params = {
    parentCommentId: pid,
    type: typeMap[props.type],
    id: props.id,
    limit: floorCommentInfo.limit,
    time: floorCommentInfo.time
  }
  getFloorComment(params).then((res) => {
    if (res.code === 200) {
      floorCommentInfo.time = res.data.time
      floorCommentInfo.hasMore = res.data.hasMore
      floorCommentInfo.totalCount = res.data.totalCount || floorCommentInfo.totalCount
      floorCommentInfo.commentId = res.data.ownerComment?.commentId || floorCommentInfo.commentId
      if (res.data.ownerComment) {
        selectedComment.value = res.data.ownerComment
        floorComments.value.push(res.data.ownerComment)
      }
      floorComments.value.push(...res.data.bestComments)
      floorComments.value.push(...res.data.comments)
    }
    show.value = true
  })
}

const handleLikeComment = (comment: any) => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  const params = {
    id: props.id,
    cid: comment.commentId,
    t: comment.liked ? 0 : 1,
    type: typeMap[props.type]
  }
  likeComment(params)
    .then((res) => {
      if (res.code === 200) {
        comment.likedCount += comment.liked ? -1 : 1
        comment.liked = !comment.liked
      } else {
        showToast(`${res.msg}, ${res?.data?.dialog?.subtitle}`)
      }
    })
    .catch((err) => {
      showToast(err)
    })
}

const replyFloor = (comment: any) => {
  selectedComment.value = comment
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
        floorComments.value = floorComments.value.filter((item) => item !== comment)
        floorCommentInfo.totalCount -= 1
      } else {
        showToast(`${res.message}，${res.data?.dialog?.subtitle}`)
      }
    })
  }
}

const handleSubmitComment = () => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  const params = {
    t: 2,
    type: typeMap[props.type],
    id: props.id,
    content: floorCommentRef.value.comment,
    commentId: selectedComment.value.commentId
  }
  submitComment(params)
    .then((res) => {
      if (res.code === 200) {
        const comment = res.comment
        comment.owner = true
        comment.beReplied = []
        floorCommentInfo.totalCount += 1
        if (selectedComment.value.commentId !== floorCommentInfo.commentId) {
          comment.beReplied.push({
            beRepliedCommentId: selectedComment.value.commentId,
            content: selectedComment.value.content,
            user: { nickname: selectedComment.value.user.nickname }
          })
        }
        floorComments.value.splice(1, 0, comment)
      }
    })
    .catch((err) => {
      showToast(err)
    })
}

onMounted(() => {
  window.addEventListener('resize', updateWindowHeight)
  loadFloorComment(props.beRepliedCommentId)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateWindowHeight)
})
</script>

<style scoped lang="scss">
.comment-container {
  display: flex;
  flex-direction: column;
  overflow-y: hidden;
  scrollbar-width: none;
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
      font-weight: bold;
      color: var(--color-text);
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
  width: auto;

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
      margin-right: 10px;
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
