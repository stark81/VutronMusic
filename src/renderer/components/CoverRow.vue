<template>
  <VueDraggable v-model="list" class="cover-row" :disabled="!isLocal" :style="rowStyles">
    <div v-for="item in list" :key="item?.id" class="item" :class="{ artist: type === 'artist' }">
      <Cover
        :id="item.id"
        :image-url="getImageUrl(item)"
        :type="type"
        :play-button-size="type === 'artist' ? 26 : playButtonSize"
      />
      <div class="text">
        <div v-show="showPlayCount" class="info">
          <span class="play-count">
            <svg-icon icon-class="play" />{{ formatPlayCount(item.playCount) }}
          </span>
        </div>
        <div class="title" :style="{ fontSize: subTextFontSize }">
          <span v-show="isExplicit(item)" class="explicit-symbol">
            <ExplicitSymbol />
          </span>
          <span v-show="isPrivacy(item)" class="lock-icon">
            <SvgIcon icon-class="lock" />
          </span>
          <router-link :to="`/${type}/${item.id}`">{{ item.name }}</router-link>
        </div>
        <div v-show="type !== 'artist' && subText !== 'none'" class="info">
          <span v-same-html="getSubText(item)"></span>
        </div>
      </div>
    </div>
  </VueDraggable>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocalMusicStore } from '../store/localMusic'
import Cover from './CoverBox.vue'
import SvgIcon from './SvgIcon.vue'
import ExplicitSymbol from './ExplicitSymbol.vue'
import { VueDraggable } from 'vue-draggable-plus'
import { formatPlayCount } from '../utils'

const props = defineProps({
  items: {
    type: Array as () => any[],
    required: true
  },
  showPlayCount: { type: Boolean, default: false },
  type: { type: String, required: true },
  subText: { type: String, default: 'null' },
  subTextFontSize: { type: String, default: '16px' },
  colunmNumber: { type: Number, default: 5 },
  gap: { type: String, default: '34px 24px' },
  playButtonSize: { type: Number, default: 22 }
})

const localMusicStore = useLocalMusicStore()
const { sortPlaylistsIDs } = storeToRefs(localMusicStore)
const isLocal = computed(() => props.type.includes('local'))

const list = computed({
  get: () =>
    isLocal.value
      ? sortPlaylistsIDs.value.map((id: number) => props.items.find((item) => item.id === id)!)
      : props.items,
  set: (value) => {
    sortPlaylistsIDs.value = value.map((item) => item.id)
  }
})

const rowStyles = computed(() => {
  return {
    'grid-template-columns': `repeat(${props.colunmNumber}, 1fr)`,
    gap: props.gap
  }
})

const getImageUrl = (item: any) => {
  if (item.img1v1Url) {
    let img1v1ID = item.img1v1Url.split('/')
    img1v1ID = img1v1ID[img1v1ID.length - 1]
    if (img1v1ID === '5639395138885805.jpg') {
      return 'https://p2.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg?param=256y256'
    }
  }
  const img = item.img1v1Url || item.picUrl || item.coverImgUrl
  let url = img?.replace('http://', 'https://')
  if (url.startsWith('https://')) url += '?param=256y256'
  return url
}

const isExplicit = (item: any) => {
  return props.type === 'album' && item.mark === 1056768
}

const isPrivacy = (item: any) => {
  return props.type === 'playlist' && item.privacy === 10
}

const getSubText = (item: any) => {
  let subText = ''
  if (props.subText === 'artist') {
    if (item.artist !== undefined)
      subText = `<a href="/#/artist/${item.artist.id}">${item.artist.name}</a>`
    if (item.artists !== undefined)
      subText = `<a href="/#/artist/${item.artists[0].id}">${item.artists[0].name}</a>`
  } else if (props.subText === 'updateFrequency') {
    subText = item.updateFrequency
  } else if (props.subText === 'copywriter') {
    subText = item.copywriter
  } else if (props.subText === 'releaseYear') {
    subText = new Date(item.publishTime).getFullYear().toString()
  } else if (props.subText === 'albumType+releaseYear') {
    let albumType = item.type
    if (item.type === 'EP/Single') {
      albumType = item.size === 1 ? 'Single' : 'EP'
    } else if (item.type === 'Single') {
      albumType = 'Single'
    } else if (item.type === '专辑') {
      albumType = 'Album'
    }
    return `${albumType} · ${new Date(item.publishTime).getFullYear()}`
  }
  return subText
}
</script>

<style scoped lang="scss">
.cover-row {
  display: grid;
}

.item {
  color: var(--color-text);
  .text {
    margin-top: 8px;
    .title {
      font-size: 16px;
      font-weight: 600;
      line-height: 20px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      word-break: break-all;
    }
    .info {
      font-size: 12px;
      opacity: 0.68;
      line-height: 18px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      word-break: break-word;
    }
  }
}

.item.artist {
  display: flex;
  flex-direction: column;
  text-align: center;
  .cover {
    display: flex;
  }
  .title {
    margin-top: 4px;
  }
}

@media (max-width: 834px) {
  .item .text .title {
    font-size: 14px;
  }
}

.explicit-symbol {
  opacity: 0.28;
  color: var(--color-text);
  float: right;
  .svg-icon {
    margin-bottom: -3px;
  }
}

.lock-icon {
  opacity: 0.28;
  color: var(--color-text);
  margin-right: 4px;
  // float: right;
  .svg-icon {
    height: 12px;
    width: 12px;
  }
}

.play-count {
  font-weight: 600;
  opacity: 0.58;
  color: var(--color-text);
  font-size: 12px;
  .svg-icon {
    margin-right: 3px;
    height: 8px;
    width: 8px;
  }
}
</style>
