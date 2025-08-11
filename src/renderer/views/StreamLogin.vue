<template>
  <div class="stream-container">
    <div class="icon-container">
      <div
        v-for="platform in services"
        :key="platform.name"
        ref="iconWrappers"
        class="icon-wrapper"
        @click="selectPlatform(platform.name)"
      >
        <img
          :src="getImagePath(platform.name)"
          :class="{ selected: platform.name === currentService }"
          alt="platform logo"
        />
      </div>
      <div class="indicator" :class="{ animated: isIndicatorReady }" :style="indicatorStyle"></div>
    </div>
    <div class="title">{{ currentService }}</div>
    <div class="section-2">
      <div class="input-box">
        <div class="container" :class="{ active: inputFocus === 'web' }">
          <svg-icon icon-class="web" />
          <div class="inputs">
            <input
              v-model="url"
              type="text"
              placeholder="主机地址"
              @focus="inputFocus = 'web'"
              @blur="inputFocus = ''"
            />
          </div>
        </div>
      </div>

      <div class="input-box">
        <div class="container" :class="{ active: inputFocus === 'user' }">
          <svg-icon icon-class="user" />
          <div class="inputs">
            <input
              v-model="user"
              type="text"
              placeholder="账号"
              @focus="inputFocus = 'user'"
              @blur="inputFocus = ''"
            />
          </div>
        </div>
      </div>

      <div class="input-box">
        <div class="container" :class="{ active: inputFocus === 'password' }">
          <svg-icon icon-class="lock" />
          <div class="inputs">
            <input
              v-model="password"
              type="password"
              placeholder="密码"
              @focus="inputFocus = 'password'"
              @blur="inputFocus = ''"
            />
          </div>
        </div>
      </div>

      <div class="confirm">
        <button @click="login">
          {{ $t('login.login') }}
        </button>
      </div>
      <label v-if="error" style="color: red">{{ error }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'
import { useStreamMusicStore, serviceName } from '../store/streamingMusic'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

const iconWrappers = ref<HTMLElement[]>([])
const indicatorStyle = ref({ width: '0px', left: '0px' })
const isIndicatorReady = ref(false)
const currentService = ref<serviceName>('navidrome')

const streamMusicStore = useStreamMusicStore()
const { services } = storeToRefs(streamMusicStore)

const router = useRouter()
const route = useRoute()

const inputFocus = ref('')
const url = ref('')
const user = ref('')
const password = ref('')
const error = ref<string | null>(null)

const getImagePath = (platform: serviceName) => {
  return new URL(`../assets/images/${platform}.png`, import.meta.url).href
}

const updateIndicatorPosition = () => {
  const index = services.value.findIndex((s) => s.name === currentService.value)
  const wrapper = iconWrappers.value[index]
  const container = wrapper?.parentElement

  if (wrapper && container) {
    const containerRect = container.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()

    indicatorStyle.value = {
      width: `${wrapperRect.width}px`,
      left: `${wrapperRect.left - containerRect.left}px`
    }
  }
}

const selectPlatform = (platform: serviceName) => {
  currentService.value = platform
  nextTick(updateIndicatorPosition)
}

const login = () => {
  const params = {
    platform: currentService.value,
    baseURL: url.value,
    username: user.value,
    password: password.value
  }
  window.mainApi?.invoke('stream-login', params).then((res: { code: number; message: any }) => {
    if (res.code === 200) {
      services.value = services.value.map((service) =>
        service.name === currentService.value ? { ...service, status: 'login' } : service
      )
      nextTick(() => {
        router.push('/stream')
      })
    } else {
      error.value = res.message
    }
  })
}

watch(currentService, (value) => {
  const service = services.value.find((s) => s.name === value)!
  if (service.status === 'login') {
    router.push('/stream')
    return
  }
  window.mainApi?.invoke('get-stream-account', { platform: value }).then((result) => {
    url.value = result?.url || ''
    user.value = result?.username || ''
    password.value = result?.password || ''
  })
})

onMounted(() => {
  currentService.value = (route.params.service as serviceName) || 'jellyfin'

  window.mainApi
    ?.invoke('get-stream-account', { platform: currentService.value })
    .then((result) => {
      url.value = result?.url || ''
      user.value = result?.username || ''
      password.value = result?.password || ''
    })
  window.addEventListener('resize', updateIndicatorPosition)
  nextTick(() => {
    updateIndicatorPosition()
    // 延迟100ms后启用过渡效果，确保首次渲染无动画
    setTimeout(() => {
      isIndicatorReady.value = true
    }, 100)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIndicatorPosition)
})
</script>

<style scoped lang="scss">
.stream-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.icon-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80px;
  gap: 0 4rem;

  .icon-wrapper {
    position: relative;
    cursor: pointer;
  }

  img {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 64px;
    transform: scale(0.7);
    opacity: 0.8;

    &.selected {
      transform: scale(1);
      opacity: 1;
    }
  }

  .indicator {
    position: absolute;
    bottom: -10px;
    height: 6px;
    background-color: var(--color-primary);
    border-radius: 2px;
    transition: none; // 默认禁用过渡

    &.animated {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); // 后续启用过渡
    }
  }
}

.title {
  font-size: 24px;
  font-weight: 700;
  margin-top: 48px;
}

.section-2 {
  display: flex;
  align-items: center;
  flex-direction: column;
  margin-top: 30px;

  .input-box {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
    color: var(--color-text);

    .container {
      display: flex;
      align-items: center;
      height: 46px;
      background: var(--color-secondary-bg);
      border-radius: 8px;
      width: 400px;
    }

    .svg-icon {
      height: 18px;
      width: 18px;
      color: #969696;
      margin: 0 6px 0 12px;
    }

    .inputs {
      display: flex;
      width: 85%;

      input {
        font-size: 16px;
        border: none;
        background: transparent;
        width: 100%;
        font-weight: 600;
        margin-top: -1px;
        padding-left: 4px;
        color: var(--color-text);
      }
    }

    .active {
      background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
      input,
      .svg-icon {
        color: var(--color-primary);
      }
    }
  }

  .confirm button {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
    color: var(--color-primary);
    border-radius: 8px;
    margin: 20px 0;
    transition: 0.2s;
    padding: 8px;
    width: 100%;
    width: 400px;
    &:hover {
      transform: scale(1.02);
    }
    &:active {
      transform: scale(0.98);
    }
  }
}
</style>
