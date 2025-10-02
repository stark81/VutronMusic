<template>
  <VirtualScroll
    :list="items"
    :column-number="colunmNumber"
    :gap="gap"
    :item-size="itemHeight"
    :padding-bottom="paddingBottom"
    :height="containerHeight"
    :load-more="loadMore"
    :is-end="isEnd"
    :enable-virtual-scroll="enableVirtualScroll"
    :show-footer="showFooter"
    :show-position="showPosition"
  >
    <template #default="{ item }">
      <div class="cover-item" :class="{ artist: type === 'artist' }">
        <Cover
          :id="item.id"
          :image-url="getImageUrl(item)"
          :type="type"
          :service="item.service"
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
    </template>
  </VirtualScroll>
</template>

<script setup lang="ts">
import { PropType, toRefs } from 'vue'
import VirtualScroll from './VirtualScrollNoHeight.vue'
import Cover from './CoverBox.vue'
import SvgIcon from './SvgIcon.vue'
import ExplicitSymbol from './ExplicitSymbol.vue'
import { formatPlayCount } from '../utils'

const props = defineProps({
  items: { type: Array as () => any[], required: true },
  type: { type: String, default: '' },
  subText: { type: String, default: null },
  itemHeight: { type: Number, default: 240 },
  showPosition: { type: Boolean, default: true },
  subTextFontSize: { type: String, default: '16px' },
  showPlayCount: { type: Boolean, default: false },
  containerHeight: { type: Number, default: 0 },
  colunmNumber: { type: Number, default: 1 },
  gap: { type: Number, default: 20 },
  playButtonSize: { type: Number, default: 22 },
  paddingBottom: { type: Number, default: 64 },
  isEnd: { type: Boolean, required: true },
  showFooter: { type: Boolean, default: false },
  enableVirtualScroll: { type: Boolean, default: true },
  loadMore: { type: Function as PropType<() => void>, default: () => {} }
})

const { items } = toRefs(props)

const getImageUrl = (item: any) => {
  if (item.img1v1Url) {
    let img1v1ID = item.img1v1Url.split('/')
    img1v1ID = img1v1ID[img1v1ID.length - 1]
    if (img1v1ID === '5639395138885805.jpg') {
      return 'https://p2.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg?param=256y256'
    }
  }
  const img = item.img1v1Url || item.picUrl || item.coverImgUrl || item.avatarUrl
  return `${img?.replace('thumbnail=140y140&', 'thumbnail=256y256&')}${item.service ? '' : '?param=256y256'}`
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
  } else if (props.subText === 'creator') {
    subText = `by ${item.creator.nickname}`
  }
  return subText
}
</script>

<style scoped lang="scss">
.cover-item {
  color: var(--color-text);
  padding-bottom: 20px;
}
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
.cover-item.artist {
  display: flex;
  flex-direction: column;
  text-align: center;
  .cover {
    display: flex;
  }
  .title {
    margin-top: 2px;
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
