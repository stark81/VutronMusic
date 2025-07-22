<template>
  <div class="mv-page">
    <div class="left">
      <div class="current-video">
        <div class="video">
          <video ref="videoPlayer" class="plyr"></video>
        </div>
        <div class="video-info">
          <div class="title">
            <router-link :to="`/artist/${mv.data.artistId}`">{{ mv.data.artistName }}</router-link>
            -
            {{ mv.data.name }}
          </div>
          <div class="desc">{{ mv.data.desc }}</div>
          <div class="info">
            <div>
              <span>发布时间：{{ mv.data.publishTime }}</span>
              <span style="margin-left: 20px"
                >播放次数：{{ formatPlayCount(mv.data.playCount) }}</span
              >
            </div>
            <div class="btns">
              <button @click="handleLikeMv(mv)"
                ><svg-icon :icon-class="mv.data.liked ? 'liked' : 'like'" />{{
                  mv.data.likedCount
                }}</button
              >
              <button @click="handleSubMv(mv)"
                ><svg-icon :icon-class="mv.data.subed ? 'collected' : 'collect'" />{{
                  mv.data.subCount
                }}</button
              >
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="right">
      <Comment v-if="mv.data.id" :id="mv.data.id" type="mv" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { mvDetail, mvDetailInfo, likeAMV, subAMV, mvUrl, simiMv } from '../api/mv'
import { tricklingProgress } from '../utils/tricklingProgress'
import { usePlayerStore } from '../store/player'
import { storeToRefs } from 'pinia'
import { formatPlayCount } from '../utils'
import SvgIcon from '../components/SvgIcon.vue'
import Comment from '../components/CommentPage.vue'
import '../assets/css/plyr.css'
import Plyr from 'plyr'
import { isAccountLoggedIn } from '../utils/auth'
import { useI18n } from 'vue-i18n'
import { useNormalStateStore } from '../store/state'

const mv = ref<{ [key: string]: any }>({
  url: '',
  data: {
    name: '',
    artistId: 0,
    artistName: '',
    cover: '',
    playCount: 0,
    publishTime: 0
  }
})
const simiMvs = ref<any[]>([])
const videoPlayer = ref()
const player = ref()

const playerStore = usePlayerStore()
const { playing, volume } = storeToRefs(playerStore)
const { playOrPause } = playerStore

const route = useRoute()
const loadData = (id: string) => {
  tricklingProgress.start()
  mvDetail(Number(id)).then((res) => {
    mv.value = res
    const requests = res.data.brs.map((item: any) => mvUrl({ id: Number(id), r: item.br }))
    Promise.all(requests).then((results) => {
      const sources = results.map((result: any) => {
        return {
          src: result.data.url.replace(/^http:/, 'https:'),
          type: 'video/mp4',
          size: result.data.r
        }
      })
      player.value.source = {
        type: 'video',
        title: mv.value.data.name,
        sources,
        poster: mv.value.data.cover?.replace(/^http:/, 'https:')
      }
      tricklingProgress.done()
    })
    mvDetailInfo(Number(id)).then((res) => {
      mv.value.data.likedCount = res.likedCount
      mv.value.data.liked = res.liked
    })
  })
  simiMv(Number(id)).then((res) => {
    simiMvs.value = res.mvs
  })
}

const stateStore = useNormalStateStore()
const { showToast } = stateStore
const { t } = useI18n()

const handleLikeMv = (mv: any) => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  const params = {
    id: mv.data.id,
    type: 1,
    t: mv.data.liked ? 0 : 1
  }
  likeAMV(params)
    .then((res) => {
      if (res.code === 200) {
        mv.data.liked = !mv.data.liked
        mv.data.likedCount += mv.data.liked ? 1 : -1
      } else {
        showToast(res.msg)
      }
    })
    .catch((err) => {
      showToast(err)
    })
}

const handleSubMv = (mv: any) => {
  if (!isAccountLoggedIn()) {
    showToast(t('toast.needToLogin'))
    return
  }
  const params = {
    mvid: mv.data.id,
    t: mv.data.subed ? 0 : 1
  }
  subAMV(params)
    .then((res) => {
      if (res.code === 200) {
        mv.data.subed = !mv.data.subed
        mv.data.subCount += mv.data.subed ? 1 : -1
      } else {
        showToast(res.msg)
      }
    })
    .catch((err) => {
      showToast(err)
    })
}

const updatePadding = inject('updatePadding') as (val: number) => void

onMounted(() => {
  updatePadding(0)
  const videoOptions = {
    settings: ['quality', 'speed'],
    autoplay: false,
    quality: {
      default: 1080,
      options: [1080, 720, 480, 240]
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
  loadData(route.params.id as string)
})

onBeforeUnmount(() => {
  updatePadding(96)
})
</script>

<style lang="scss" scoped>
.mv-page {
  // margin-top: 20px;
  width: 100%;
  height: calc(100vh - 84px);
  display: flex;
}

.left {
  width: 56%;
  max-height: 100vh;
  overflow-y: auto;
  scrollbar-width: none;
}

.current-video {
  width: 100%;
}

.video {
  --plyr-color-main: #335eea;
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
  width: 44%;
}
</style>
