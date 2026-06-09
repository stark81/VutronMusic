<template>
  <div class="mv-page" :style="mainStyle">
    <div class="left" :class="{ 'with-comment': mv?.hasComment && showComment }">
      <div class="current-video">
        <div class="video">
          <video ref="videoPlayer" class="plyr"></video>
        </div>
        <div class="video-info">
          <div class="title">
            <template v-if="mv?.artists?.[0]">
              <router-link
                :to="`/artist/${mv?.artists?.[0]?.pluginId}/${JSON.stringify(mv?.artists?.[0]?.sourceContext)}`"
                >{{ mv?.artists?.[0]?.name }}</router-link
              >
              -
            </template>
            {{ mv?.name || '' }}
          </div>
          <div class="desc">{{ mv?.desc }}</div>
          <div class="info">
            <div>
              <span>{{ formatDate(mv?.publishTime) }}</span>
              <span style="margin-left: 20px">播放次数：{{ formatPlayCount(mv?.playCount) }}</span>
            </div>
            <div class="btns">
              <button v-if="mv && mv.likedCount > -1" @click="handleLikeMv(mv!)"
                ><svg-icon :icon-class="mv?.liked ? 'liked' : 'like'" />{{ mv?.likedCount }}</button
              >
              <button @click="handleSubMv(mv!)"
                ><svg-icon :icon-class="mv?.subed ? 'collected' : 'collect'" />{{
                  mv?.subCount
                }}</button
              >
              <button v-if="mv?.hasComment" @click="showComment = !showComment"
                ><svg-icon icon-class="comment"
              /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="right" :class="{ 'with-comment': mv?.hasComment && showComment }">
      <Comment
        v-if="mv?.hasComment && showComment"
        :id="mv?.id"
        :plugin="mv.pluginId"
        :source-context="mv.sourceContext"
        type="mv"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import { tricklingProgress } from '../utils/tricklingProgress'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import { formatPlayCount, formatDate } from '../utils'
import SvgIcon from '../components/SvgIcon.vue'
import Comment from '../components/CommentPage.vue'
import '../assets/css/plyr.css'
import Plyr from 'plyr'
import { useI18n } from 'vue-i18n'
import { useNormalStateStore } from '../store/state'
import { usePluginMusic } from '../store/pluginMusic'
import { PluginId } from '@/types/schemas'
import { MvDetail } from '@/types/plugin'

const mv = ref<MvDetail>()
const videoPlayer = ref()
const player = ref()
const showComment = ref(false)

const hasCustomTitleBar = inject('hasCustomTitleBar', ref(true))

const mainStyle = computed(() => {
  return {
    height: `calc(100vh - ${hasCustomTitleBar.value ? 84 : 64}px)`
  }
})

const playerStore = usePlayerStore()
const { playing, volume } = storeToRefs(playerStore)
const { playOrPause } = playerStore

const pluginStore = usePluginMusic()
const { pluginMethodCall, isAccountLoggedIn } = pluginStore

const route = useRoute()

const loadData = (plugin: PluginId, sourceContext: Record<string, any>) => {
  tricklingProgress.start()

  pluginMethodCall(plugin, 'mvDetail', sourceContext).then((res) => {
    if (res.code === 200 && res.data) {
      mv.value = {
        ...res.data,
        pluginId: plugin,
        artists: res.data.artists.map((artist: any) => ({ ...artist, pluginId: plugin }))
      }
      const sources = mv.value.sources.map((item) => ({
        src: item.url,
        type: item.type,
        size: item.quality
      }))

      const options = sources.map((item) => Number(item.size))
      const videoOptions = {
        settings: ['quality', 'speed'],
        autoplay: false,
        quality: {
          default: options[0],
          options
        },
        speed: {
          selected: 1,
          options: [0.5, 0.75, 1, 1.25, 1.5, 2]
        }
      }
      if (route.query.autoplay === 'true') videoOptions.autoplay = true
      player.value = new Plyr(videoPlayer.value, videoOptions)
      player.value.volume = volume.value
      player.value.on('playing', () => {
        if (playing.value) playOrPause()
      })

      player.value.source = {
        type: 'video',
        title: mv.value.name,
        sources,
        poster: mv.value.picUrl.replace(/^http:/, 'https:')
      }
    }
    tricklingProgress.done()
  })
}

const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { t } = useI18n()

const handleLikeMv = (mv: MvDetail) => {
  if (!isAccountLoggedIn(mv.pluginId)) {
    showToast(t('toast.needToLogin'))
    return
  }
  pluginMethodCall(mv.pluginId, 'likeAMV', {
    ...mv.sourceContext,
    t: mv.subed ? 0 : 1
  })
    .then((res) => {
      if (res.code === 200) {
        mv.liked = !mv.liked
        mv.likedCount += mv.likedCount ? 1 : -1
      } else {
        showToast('操作失败')
      }
    })
    .catch((err) => {
      showToast(err)
    })
}

const handleSubMv = (mv: MvDetail) => {
  if (!isAccountLoggedIn(mv.pluginId)) {
    showToast(t('toast.needToLogin'))
    return
  }

  pluginMethodCall(mv.pluginId, 'subAMV', {
    ...mv.sourceContext,
    t: mv.subed ? 0 : 1
  })
    .then((res) => {
      if (res.code === 200) {
        mv.subed = !mv.subed
        mv.subCount += mv.subed ? 1 : -1
      } else {
        showToast('操作失败')
      }
    })
    .catch((err) => {
      showToast(err)
    })

  // const params = {
  //   mvid: mv.data.id,
  //   t: mv.data.subed ? 0 : 1
  // }
  // subAMV(params)
  //   .then((res) => {
  //     if (res.code === 200) {
  //       mv.data.subed = !mv.data.subed
  //       mv.data.subCount += mv.data.subed ? 1 : -1
  //     } else {
  //       showToast(res.msg)
  //     }
  //   })
  //   .catch((err) => {
  //     showToast(err)
  //   })
}

const updatePadding = inject('updatePadding') as (val: number) => void

onMounted(() => {
  updatePadding(0)

  const { pluginId, sourceContext } = route.params
  loadData(pluginId as PluginId, JSON.parse(sourceContext as string))
})

onBeforeUnmount(() => {
  updatePadding(96)
})
</script>

<style lang="scss" scoped>
.mv-page {
  width: 100%;
  display: flex;
}

.left {
  width: 100%;
  max-height: 100vh;
  overflow-y: auto;
  scrollbar-width: none;
  transition: width 0.3s;
  padding-bottom: 40px;

  &.with-comment {
    width: 56%;
  }
}

.current-video {
  width: 100%;
}

.video {
  --plyr-color-main: var(--color-primary);
  --plyr-control-radius: 8px;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  background: transparent;
  overflow: hidden;
  max-height: 100vh;
}

.video-info {
  margin-top: 20px;
  color: var(--color-text);

  .title {
    font-size: 24px;
    font-weight: 600;
  }

  .desc {
    margin-top: 12px;
    font-size: 15px;
    opacity: 0.88;
    max-height: 32vh;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .info {
    font-size: 13px;
    opacity: 0.68;
    margin-top: 12px;
    display: flex;
    text-align: center;
    justify-content: center;
    justify-content: space-between;

    .btns {
      display: flex;

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
  }
}

.buttons {
  display: inline-block;
  margin-left: 10px;
  .button {
    display: inline-block;
    padding: 0 8px;
  }
  .svg-icon {
    height: 18px;
    width: 18px;
    color: var(--color-primary);
  }
}

.right {
  width: 0%;
  transition: all 0.3s;

  &.with-comment {
    width: 44%;
    padding: 0 0 10px 4vw;
  }
}
</style>
