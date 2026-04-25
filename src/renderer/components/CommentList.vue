<template>
  <div v-if="show" class="comment-container">
    <div class="comment-head">
      <label>[{{ pluginName }}]:评论({{ totalCount }})</label>
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
                    v-if="isAccountLoggedIn(commentCtx.mapPlugin) && item.owner"
                    :disabled="!commentEnabled || !capableComment.submit"
                    @click="handleDeleteComment(item)"
                    >删除</button
                  >
                  <button
                    :disabled="!commentEnabled || !capableComment.like"
                    @click="handleLikeComment(item)"
                    ><svg-icon :icon-class="item.liked ? 'liked' : 'like'" />{{
                      item.likedCount
                    }}</button
                  >
                  <button
                    v-show="!item.beReplied"
                    :disabled="!commentEnabled || !capableComment.floor"
                    @click="switchCommentPage(item)"
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
        :disabled="!commentEnabled || !capableComment.submit"
        :placeholder="commentEnabled ? '随乐而起，有感而发' : '该平台不支持此类型评论'"
        @keydown-enter="handleSubmitComment"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, inject, onBeforeUnmount, watch, nextTick } from 'vue'
import { useNormalStateStore } from '../store/state'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import WriteComment from './WriteComment.vue'
import SvgIcon from './SvgIcon.vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '../utils'
import { debounce } from 'lodash'
import { usePluginMusic } from '../store/pluginMusic'
import { PluginId, CommentType, CommentTab } from '@/types/plugin'
import { CommentContentType } from '@/types/schemas'
interface Props {
  commentCtx: { rawCtx: Record<string, any>; mapCtx: Record<string, any>; mapPlugin: PluginId }
  type: CommentContentType
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
const totalCount = ref(0)
const sortType = ref('')
const loadedTabPlugin = ref(props.commentCtx.mapPlugin)
const comments = ref<CommentType[]>([])
const tabs = ref<CommentTab[]>([])
const commentHeight = ref(mainRef.value?.offsetHeight || 0)
const hasMore = ref(true)
const pluginStore = usePluginMusic()
const { isAccountLoggedIn } = pluginStore
const commentCtx = props.commentCtx

const capabilities = computed(() => {
  return pluginStore.services.find((s) => s.code === commentCtx.mapPlugin)?.capabilities
})
const commentEnabled = computed(() => {
  return capabilities.value?.comment?.types?.includes(props.type) ?? false
})
const capableComment = computed(() => {
  return capabilities.value?.comment ?? {}
})
const pluginName = computed(() => {
  return pluginStore.services.find((s) => s.code === commentCtx.mapPlugin)?.name || ''
})

window.mainApi
  ?.invoke('plugin-comment', {
    pluginId: props.plugin,
    sourceContext: {
      rawCtx: JSON.parse(JSON.stringify(commentCtx.rawCtx)),
      mapCtx: JSON.parse(JSON.stringify(commentCtx.mapCtx)),
      mapPlugin: commentCtx.mapPlugin,
      sortType: sortType.value,
      type: props.type
    },
    method: 'getCommentTab',
    extraParams: {}
  })
  .then((result) => {
    if (result) {
      tabs.value = result.data || []
      if (tabs.value.length) sortType.value = tabs.value[0].name
    }
  })
// sourceContext 变化的监听已提升到 CommentPage 层
const { t } = useI18n()
const stateStore = useNormalStateStore()
// const { showLyrics } = storeToRefs(stateStore)
const { showToast, showConfirm } = stateStore
const updateWindowHeight = () => {
  if (!mainRef.value) return
  commentHeight.value = mainRef.value?.offsetHeight || commentHeight.value
}
const handleClickSortType = (type: string) => {
  sortType.value = type
  totalCount.value = 0
  comments.value = []
  hasMore.value = true
  loadComment()
}
const loadComment = (reset = true) => {
  if (reset) {
    comments.value = []
    hasMore.value = true
  }
  if (!hasMore.value && !reset) return

  // const mapCtx =
  //   pluginType.value === 'library'
  //     ? JSON.parse(JSON.stringify(commentCtx.rawCtx))
  //     : JSON.parse(JSON.stringify(commentCtx.mapCtx))

  window.mainApi
    ?.invoke('plugin-comment', {
      pluginId: props.plugin,
      sourceContext: {
        rawCtx: JSON.parse(JSON.stringify(commentCtx.rawCtx)),
        mapCtx: JSON.parse(JSON.stringify(commentCtx.mapCtx)),
        mapPlugin: commentCtx.mapPlugin,
        reset,
        type: props.type
      },
      method: 'getComments',
      extraParams: { sortType: sortType.value }
    })
    .then((result) => {
      if (!result || result.code !== 200 || !result.data.length) {
        show.value = true
        return
      }
      comments.value.push(...result.data)
      totalCount.value = result.count
      hasMore.value = result.hasMore !== false
      show.value = true
      if (result.mapPlugin) commentCtx.mapPlugin = result.mapPlugin
      if (result.mapCtx) commentCtx.mapCtx = result.mapCtx
      if (result.mapPlugin && result.mapPlugin !== loadedTabPlugin.value) {
        loadedTabPlugin.value = result.mapPlugin
        window.mainApi
          ?.invoke('plugin-comment', {
            pluginId: props.plugin,
            sourceContext: {
              rawCtx: JSON.parse(JSON.stringify(commentCtx.rawCtx)),
              mapCtx: JSON.parse(JSON.stringify(commentCtx.mapCtx)),
              mapPlugin: commentCtx.mapPlugin,
              type: props.type
            },
            method: 'getCommentTab',
            extraParams: {}
          })
          .then((tabRes) => {
            if (tabRes) {
              tabs.value = tabRes.data || []
              if (tabs.value.length && !sortType.value) sortType.value = tabs.value[0].name
            }
          })
      }
      nextTick(() => {
        commentHeight.value = mainRef.value?.offsetHeight || commentHeight.value
      })
    })
}
const goToUser: (item: any) => void = () => {
  // router.push(`/user/${item.user.userId}`)
  // showLyrics.value = false
}

const switchCommentPage = (item: CommentType) => {
  selectedComment.value = item
  currentPage.value = 'floorComment'
}
const handleDeleteComment = async (comment: CommentType) => {
  if (!isAccountLoggedIn(commentCtx.mapPlugin)) {
    showToast(t('toast.needToLogin', { serviceName: pluginName.value }))
    return
  }
  if (await showConfirm(`确定要删除评论'${comment.content}'吗？`)) {
    window.mainApi
      ?.invoke('plugin-comment', {
        pluginId: props.plugin,
        sourceContext: {
          rawCtx: JSON.parse(JSON.stringify(commentCtx.rawCtx)),
          mapCtx: JSON.parse(JSON.stringify(commentCtx.mapCtx)),
          mapPlugin: commentCtx.mapPlugin,
          type: props.type
        },
        method: 'submitAComment',
        extraParams: { type: props.type, t: 'del', commentId: comment.id }
      })
      .then((result) => {
        if (result.code === 200) {
          comments.value = comments.value.filter((item) => item !== comment)
          totalCount.value -= 1
        }
      })
  }
}
const handleLikeComment = (comment: CommentType) => {
  if (!isAccountLoggedIn(commentCtx.mapPlugin)) {
    showToast(t('toast.needToLogin', { serviceName: pluginName.value }))
    return
  }
  window.mainApi
    ?.invoke('plugin-comment', {
      pluginId: props.plugin,
      sourceContext: {
        rawCtx: JSON.parse(JSON.stringify(commentCtx.rawCtx)),
        mapCtx: JSON.parse(JSON.stringify(commentCtx.mapCtx)),
        mapPlugin: commentCtx.mapPlugin,
        type: props.type
      },
      method: 'likeAComment',
      extraParams: {
        commentInfo: JSON.parse(JSON.stringify(comment.sourceContext || {})),
        currentStatus: comment.liked,
        type: props.type
      }
    })
    .then((result) => {
      if (result.code === 200) {
        comment.likedCount += comment.liked ? -1 : 1
        comment.liked = !comment.liked
      } else {
        showToast('操作失败')
      }
    })
}
const handleSubmitComment = () => {
  if (!isAccountLoggedIn(commentCtx.mapPlugin)) {
    showToast(t('toast.needToLogin', { serviceName: pluginName.value }))
    return
  }
  window.mainApi
    ?.invoke('plugin-comment', {
      pluginId: props.plugin,
      sourceContext: {
        rawCtx: JSON.parse(JSON.stringify(commentCtx.rawCtx)),
        mapCtx: JSON.parse(JSON.stringify(commentCtx.mapCtx)),
        mapPlugin: commentCtx.mapPlugin,
        type: props.type
      },
      method: 'submitAComment',
      extraParams: { type: props.type, t: 'sub', comment: commentSubmitRef.value?.comment || '' }
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
watch(
  () => props.commentCtx.rawCtx,
  (newRaw, oldRaw) => {
    if (JSON.stringify(newRaw) === JSON.stringify(oldRaw)) return
    totalCount.value = 0
    hasMore.value = true
    sortType.value = ''
    loadComment()
  },
  { deep: true }
)
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
