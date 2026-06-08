<template>
  <div v-if="show" class="comment-container">
    <div class="comment-head">
      <label>评论({{ totalCount }})</label>
      <div class="btns">
        <button
          v-for="tab in tabs"
          :key="tab.name"
          class="btn"
          :class="{ active: sortType === tab.name }"
          @click="handleClickSortType(tab.name)"
          >{{ tab.name }}</button
        >
      </div>
    </div>
    <div ref="mainRef" class="comment-main">
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
        :load-more="() => loadComment(false)"
      >
        <template #default="{ item }">
          <div class="comment-item">
            <div class="avatar" @click="goToUser(item)">
              <img :src="item.user.avatarUrl" alt="" loading="lazy"
            /></div>
            <div class="comment-info">
              <div class="comment">
                <label class="comment-nickname" @click="goToUser(item)"
                  >{{ item.user.nickname }}：</label
                >
                <label>{{ item.content }}</label>
              </div>
              <div
                v-if="item.beReplied && item.beReplied.beRepliedCommentId !== item.parentCommentId"
                class="comment-beReplied"
              >
                <label v-if="item.beReplied?.content" class="comment-nickname"
                  >@{{ item.beReplied?.nickname }}:
                </label>
                <label>{{ item.beReplied?.content ?? '该评论已删除' }}</label>
              </div>
              <div class="comment-ex">
                <div class="time-ip">
                  <span class="time">{{ formatDate(item.time, 'YYYY年MM月DD日 H:mm') }}</span>
                  <span v-if="item.ipLocation">来自{{ item.ipLocation }}</span>
                </div>
                <div class="comment-btns">
                  <button
                    v-if="isAccountLoggedIn(plugin) && item.owner"
                    @click="handleDeleteComment(item)"
                    >删除</button
                  >
                  <button @click="handleLikeComment(item)"
                    ><svg-icon :icon-class="item.liked ? 'liked' : 'like'" />{{
                      item.likedCount
                    }}</button
                  >
                  <button v-show="!item.beReplied" @click="switchCommentPage(item)"
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
import { ref, onMounted, reactive, inject, onBeforeUnmount, watch, nextTick } from 'vue'
import { getComment, likeComment, submitComment } from '../api/comment'
import { useNormalStateStore } from '../store/state'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import WriteComment from './WriteComment.vue'
import SvgIcon from './SvgIcon.vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '../utils'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { debounce } from 'lodash'
import { usePluginMusic } from '../store/pluginMusic'
import { PluginId, CommentType, CommentTab } from '@/types/plugin'

interface Props {
  sourceContext: Record<string, any>
  type: string
  plugin: PluginId
  paddingRight?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'track',
  paddingRight: '4vh'
})

const currentPage = inject('currentPage', ref('comment'))
const selectedComment = inject('selectedComment', ref<CommentType | null>(null))
const show = ref(false)

const mainRef = ref<HTMLElement>()
const commentSubmitRef = ref<InstanceType<typeof WriteComment>>()
const router = useRouter()

const totalCount = ref(0)
const sortType = ref('')
const comments = ref<CommentType[]>([])
const tabs = ref<CommentTab[]>([])
let sourceContext = props.sourceContext

const commentHeight = ref(mainRef.value?.offsetHeight || 0)

const pluginStore = usePluginMusic()
const { pluginMethodCall, isAccountLoggedIn } = pluginStore

pluginMethodCall(props.plugin, 'getCommentTab').then((result) => {
  tabs.value = result.data
  sortType.value = tabs.value[0].name
})

watch(
  () => props.sourceContext,
  (value) => {
    sourceContext = value
    if (props.type === 'track') {
      totalCount.value = 0
      sortType.value = '推荐'
      comments.value = []
      loadComment()
    }
  },
  { deep: true }
)

const { t } = useI18n()
const stateStore = useNormalStateStore()
// const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

// const getImage = (url: string) => {
//   if (url.startsWith('http:')) {
//     url = url.replace('http:', 'https:')
//   }
//   return url + '?param=64y64'
// }

const updateWindowHeight = () => {
  if (!mainRef.value) return
  commentHeight.value = mainRef.value?.offsetHeight || commentHeight.value
}

const handleClickSortType = (type: string) => {
  sortType.value = type
  totalCount.value = 0
  comments.value = []
  sourceContext.sortType = type
  loadComment()
}

const loadComment = (reset = true) => {
  if (reset) comments.value = []

  pluginMethodCall(props.plugin, 'getComments', {
    ...sourceContext,
    reset,
    type: props.type
  }).then((result) => {
    if (result.code !== 200) return
    comments.value.push(...result.data)
    totalCount.value = result.count
    sourceContext = { ...sourceContext, ...result.sourceContext }
    show.value = true

    nextTick(() => {
      commentHeight.value = mainRef.value?.offsetHeight || commentHeight.value
    })
  })
}

const goToUser = (item: any) => {
  // router.push(`/user/${item.user.userId}`)
  // showLyrics.value = false
}

const switchCommentPage = (item: CommentType) => {
  selectedComment.value = item
  currentPage.value = 'floorComment'
}

const handleDeleteComment = (comment: CommentType) => {
  if (!isAccountLoggedIn(props.plugin)) {
    showToast(t('toast.needToLogin'))
    return
  }
  if (confirm(`确定要删除评论'${comment.content}'吗？`)) {
    pluginMethodCall(props.plugin, 'submitAComment', {
      ...sourceContext,
      type: props.type,
      t: 'del',
      commentId: comment.id
    }).then((result) => {
      if (result.code === 200) {
        comments.value = comments.value.filter((item) => item !== comment)
        totalCount.value -= 1
      }
    })
  }
}

const handleLikeComment = (comment: CommentType) => {
  if (!isAccountLoggedIn(props.plugin)) {
    showToast(t('toast.needToLogin'))
    return
  }

  pluginMethodCall(props.plugin, 'likeAComment', {
    sourceContext,
    commentInfo: comment.sourceContext,
    currentStatus: comment.liked,
    type: props.type
  }).then((result) => {
    if (result.code === 200) {
      comment.likedCount += comment.liked ? -1 : 1
      comment.liked = !comment.liked
    } else {
      showToast('操作失败')
    }
  })
}

const handleSubmitComment = () => {
  if (!isAccountLoggedIn(props.plugin)) {
    showToast(t('toast.needToLogin'))
    return
  }
  pluginMethodCall(props.plugin, 'submitAComment', {
    ...sourceContext,
    type: props.type,
    t: 'sub' as 'sub' | 'reply',
    comment: commentSubmitRef.value?.comment || ''
  })
    .then((result) => {
      if (result.code === 200) {
        comments.value.unshift(result.data!)
        totalCount.value += 1
      } else {
        showToast('操作失败')
      }
    })
    .finally(() => {
      if (!commentSubmitRef.value) return
      commentSubmitRef.value.comment = ''
    })
}

onMounted(() => {
  window.addEventListener(
    'resize',
    debounce(() => updateWindowHeight(), 200)
  )
  loadComment()
})

onBeforeUnmount(() => {
  window.removeEventListener(
    'resize',
    debounce(() => updateWindowHeight(), 200)
  )
})
</script>

<style scoped lang="scss">
.comment-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  box-sizing: border-box;
  transition: all 0.5s;
}

.comment-head {
  display: flex;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  justify-content: space-between;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  box-sizing: border-box;

  .btns {
    display: flex;
    text-align: center;
    justify-items: center;
    .btn {
      font-size: 16px;
      color: var(--color-text);
      font-weight: 600;
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
  height: calc(100% - 108px);
  box-sizing: border-box;
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
  flex: 1;
  min-width: 0;
}
.comment {
  word-break: break-all;
  overflow-wrap: anywhere;

  .comment-nickname {
    cursor: pointer;
    font-weight: 600;
  }
}
.comment-beReplied {
  font-size: 14px;
  margin: 5px 0;
  padding: 6px 10px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.1);

  .comment-nickname {
    font-weight: 600;
  }
}
.comment-ex {
  display: flex;
  margin-top: 4px;
  padding-bottom: 10px;
  width: 100%;
  font-size: 14px;
  opacity: 0.8;
  text-align: center;
  justify-content: center;
  justify-content: space-between;

  .time-ip .time {
    margin-right: 6px;
  }
  .comment-btns {
    display: flex;
  }
  button {
    display: flex;
    align-items: center;
    color: var(--color-text);

    svg {
      margin-right: 2px;
    }
  }
}
.write-comment {
  padding: 8px 0;
  box-sizing: border-box;
}
</style>
