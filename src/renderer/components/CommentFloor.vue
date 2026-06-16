<template>
  <div v-if="show" class="comment-container">
    <div class="comment-head">
      <label>[{{ pluginName }}]:回复({{ totalCount }})</label>
      <div class="btns">
        <button class="btn" @click="switchToCommentPage">关闭</button>
      </div>
    </div>
    <div ref="mainRef" class="comment-main">
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
        :load-more="() => loadFloorComment(false)"
      >
        <template #default="{ item, index }">
          <div class="comment-item" :class="{ first: index === 0 && floorComments.length > 1 }">
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
                v-if="item.beReplied && item.beReplied.beRepliedCommentId !== item.parentCommentId"
                class="comment-beReplied"
              >
                <label v-if="item.beReplied" class="comment-nickname"
                  >@{{ item.beReplied.nickname }}:
                </label>
                <label>{{ item.beReplied.content || '该评论已删除' }}</label>
              </div>
              <div class="comment-ex">
                <div class="time-ip">
                  <span class="time">{{ formatDate(item.time, 'YYYY年MM月DD日 H:mm') }}</span>
                  <span v-if="item.ipLocation">来自{{ item.ipLocation }}</span>
                </div>
                <div class="comment-btns">
                  <button
                    v-if="isAccountLoggedIn && item.owner"
                    :disabled="!commentEnabled || !capableComment.submit"
                    @click.stop="handleDeleteComment(item)"
                    >删除</button
                  >
                  <button
                    :disabled="!commentEnabled || !capableComment.like"
                    @click.stop="handleLikeComment(item)"
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
        :disabled="!commentEnabled || !capableComment.submit"
        :placeholder="placeholder"
        @keydown-enter="handleSubmitComment"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject, onBeforeUnmount, nextTick, toRefs } from 'vue'
import { useNormalStateStore } from '../store/state'
import { usePluginMusic } from '../store/pluginMusic'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import WriteComment from './WriteComment.vue'
import SvgIcon from './SvgIcon.vue'
// import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatDate } from '../utils'
import { debounce } from 'lodash'
import { PluginId, CommentType } from '@/types/plugin'
import { CommentContentType } from '@/types/schemas'

interface Props {
  selectedComment: CommentType | null
  sourceContext: Record<string, any>
  type: CommentContentType
  plugin: PluginId
  paddingRight?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'track',
  paddingRight: '4vh'
})

const show = ref(false)
const floorComments = ref<CommentType[]>([])
const mainRef = ref<HTMLElement>()
const floorCommentRef = ref<InstanceType<typeof WriteComment>>()
const currentPage = inject('currentPage', ref('floorComment'))
const totalCount = ref(0)

const placeholder = computed(() => {
  return `回复${_selectedComment.value?.user.nickname}:`
})

const commentHeight = ref(mainRef.value?.offsetHeight || 0)

let sourceContext = props.sourceContext
const { selectedComment } = toRefs(props)
const _selectedComment = ref<CommentType | null>(selectedComment.value)

const { t } = useI18n()
const stateStore = useNormalStateStore()
// const { showLyrics } = storeToRefs(stateStore)
const { showToast } = stateStore

const { pluginMethodCall, isAccountLoggedIn, services } = usePluginMusic()

const capabilities = computed(() => {
  return services.find((s) => s.code === props.plugin)?.capabilities
})
const commentEnabled = computed(() => {
  return capabilities.value?.comment?.types?.includes(props.type) ?? false
})
const capableComment = computed(() => {
  return capabilities.value?.comment ?? {}
})
const pluginName = computed(() => {
  return services.find((s) => s.code === props.plugin)?.name || ''
})

if (selectedComment.value) floorComments.value.push(selectedComment.value)

const getImage = (url: string) => {
  if (url.startsWith('http:')) {
    url = url.replace('http:', 'https:')
  }
  return url + '?param=64y64'
}

const updateWindowHeight = () => {
  if (!mainRef.value) return
  commentHeight.value = mainRef.value?.offsetHeight || commentHeight.value
}

// const router = useRouter()
const goToUser = (item: CommentType) => {
  // router.push(`/user/${item.user.userId}`)
  // showLyrics.value = false
}

const switchToCommentPage = () => {
  currentPage.value = 'comment'
  show.value = false
}

const loadFloorComment = (reset = true) => {
  pluginMethodCall(props.plugin, 'getFloorComments', {
    sourceContext: { ...sourceContext, reset },
    commentInfo: _selectedComment.value?.sourceContext,
    type: props.type
  }).then((result) => {
    if (result.code !== 200) return
    totalCount.value = result.count || totalCount.value

    floorComments.value.push(...result.data)
    sourceContext = { ...sourceContext, ...result.sourceContext }
    show.value = true

    nextTick(() => {
      commentHeight.value = mainRef.value?.offsetHeight || commentHeight.value
    })
  })
}

const handleLikeComment = (comment: CommentType) => {
  if (!isAccountLoggedIn(props.plugin)) {
    showToast(t('toast.needToLogin', { serviceName: pluginName.value }))
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

const replyFloor = (comment: CommentType) => {
  _selectedComment.value = comment
}

const handleDeleteComment = (comment: CommentType) => {
  if (!isAccountLoggedIn(props.plugin)) {
    showToast(t('toast.needToLogin', { serviceName: pluginName.value }))
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
        floorComments.value = floorComments.value.filter((item) => item !== comment)
        totalCount.value -= 1
      }
    })
  }
}

const handleSubmitComment = () => {
  if (!isAccountLoggedIn(props.plugin)) {
    showToast(t('toast.needToLogin', { serviceName: pluginName.value }))
    return
  }

  pluginMethodCall(props.plugin, 'submitAComment', {
    ...sourceContext,
    type: props.type,
    t: 'reply' as 'sub' | 'reply',
    comment: floorCommentRef.value?.comment || '',
    commentId: _selectedComment.value?.id || ''
  })
    .then((res) => {
      if (res.code === 200) {
        const comment = res.data!
        comment.owner = true
        totalCount.value += 1

        const parentId = floorComments.value[0].id
        if (_selectedComment.value!.id !== parentId) {
          comment.beReplied = {
            id: _selectedComment.value!.id,
            content: _selectedComment.value!.content,
            nickname: _selectedComment.value!.user.nickname,
            beRepliedCommentId: _selectedComment.value!.id
          }
        }
        floorComments.value.splice(1, 0, comment)
      } else {
        showToast('操作失败')
      }
    })
    .finally(() => {
      if (!floorCommentRef.value) return
      floorCommentRef.value.comment = ''
    })
}

onMounted(() => {
  window.addEventListener(
    'resize',
    debounce(() => updateWindowHeight(), 200)
  )
  loadFloorComment(true)
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
      font-weight: 600;
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
    border-bottom: 1px solid rgba(205, 205, 205, 0.5);
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
    margin-right: 10px;
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
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
}
.write-comment {
  padding: 8px 0;
  box-sizing: border-box;
}
</style>
