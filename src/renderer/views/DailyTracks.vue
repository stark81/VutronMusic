<template>
  <div v-show="show">
    <div class="special-playlist1">
      <div class="title gradient"> 每日歌曲推荐 </div>
      <div class="subtitle">根据你的音乐口味生成 · 每天6:00更新</div>
    </div>

    <TrackList
      id="/daily/songs"
      :items="dailyTracks"
      :colunm-number="1"
      type="url"
      :is-end="true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useNormalStateStore } from '../store/state'
import { storeToRefs } from 'pinia'
import TrackList from '../components/VirtualTrackList.vue'
import { dailyRecommendTracks } from '../api/playlist'

const show = ref(false)
const { dailyTracks } = storeToRefs(useNormalStateStore())

const loadDailyTracks = () => {
  dailyRecommendTracks().then((result) => {
    dailyTracks.value = result.data.dailySongs
    show.value = true
  })
}

onMounted(() => {
  if (dailyTracks.value.length === 0) {
    loadDailyTracks()
  } else {
    show.value = true
  }
})
</script>

<style scoped lang="scss">
.special-playlist1 {
  padding: 192px 0 128px 0;
  border-radius: 1.25em;
  text-align: center;

  @keyframes letterSpacing4 {
    from {
      letter-spacing: 0px;
    }

    to {
      letter-spacing: 4px;
    }
  }

  @keyframes letterSpacing1 {
    from {
      letter-spacing: 0px;
    }

    to {
      letter-spacing: 1px;
    }
  }

  .title {
    font-size: 84px;
    line-height: 1.05;
    font-weight: 700;
    text-transform: uppercase;

    letter-spacing: 4px;
    animation-duration: 0.8s;
    animation-name: letterSpacing4;
    -webkit-text-fill-color: transparent;
    background-clip: text;

    img {
      height: 78px;
      border-radius: 0.125em;
      margin-right: 24px;
    }
  }
  .subtitle {
    font-size: 18px;
    letter-spacing: 1px;
    margin: 28px 0 18px 0;
    animation-duration: 0.8s;
    animation-name: letterSpacing1;
    text-transform: uppercase;
    color: var(--color-text);
  }
  .buttons {
    margin-top: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    button {
      margin-right: 16px;
    }
  }
}

.gradient {
  background: linear-gradient(to left, #dd2476, #ff512f);
}
</style>
