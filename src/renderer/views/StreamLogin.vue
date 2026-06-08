<template>
  <div class="stream-container">
    <div class="icon-container">
      <div
        v-for="platform in saveTypeServices"
        :key="platform.name"
        ref="iconWrappers"
        class="icon-wrapper"
        @click="selectPlatform(platform.code)"
      >
        <img
          :src="getImagePath(platform.code)"
          :class="{ selected: platform.code === pluginId }"
          :alt="`${platform.name}`"
        />
      </div>
      <div class="indicator" :class="{ animated: isIndicatorReady }" :style="indicatorStyle"></div>
    </div>
    <div class="title">{{ pluginId }}</div>
    <div class="section-2">
      <template v-if="!step">
        <div class="input-box">
          <div class="container" :class="{ active: inputFocus === 'web' }">
            <svg-icon icon-class="web" />
            <div class="inputs">
              <input
                v-model="url"
                type="text"
                placeholder="设置插件服务地址"
                @focus="inputFocus = 'web'"
                @blur="inputFocus = ''"
              />
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="loginType === 'Username'">
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
      </template>
      <template v-else-if="loginType === 'QrCode'">
        <div class="qr-code-container">
          <img :src="qrCodeSvg" loading="lazy" />
        </div>
      </template>

      <div v-if="!step || loginType !== 'QrCode'" class="confirm">
        <div class="button" :class="{ disable: step === 0 }" @click="prev"> 上一步 </div>
        <div class="button" @click="step ? login() : next()">{{ step ? '登陆' : '下一步' }}</div>
      </div>
      <label v-if="error" style="color: red">{{ error }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'
import qrCode from 'qrcode'
import { useSettingsStore } from '../store/settings'
import { usePluginMusic } from '../store/pluginMusic'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { LoginType, PluginId } from '@/types/plugin'

const iconWrappers = ref<HTMLElement[]>([])
const indicatorStyle = ref({ width: '0px', left: '0px' })
const isIndicatorReady = ref(false)
const { theme } = storeToRefs(useSettingsStore())

const pluginStore = usePluginMusic()
const { services, users } = storeToRefs(pluginStore)
const { pluginMethodCall } = pluginStore

const router = useRouter()
const route = useRoute()

const inputFocus = ref('')
const saved = ref(false)
const url = ref('')
const user = ref('')
const password = ref('')
const error = ref<string | null>(null)

const qrCodeSvg = ref('')
const qrCodeKey = ref('')
let qrCodeCheckInterval: ReturnType<typeof setInterval>

const pluginId = ref<PluginId>()
const loginType = ref<LoginType>('Username')
const step = ref(0)

const saveTypeServices = computed(() => {
  const service = services.value.find((it) => it.code === pluginId.value)
  return services.value.filter((item) => item.type === service?.type)
})

const selectedColor = computed(() => {
  const color = theme.value.colors.find((c) => c.selected)?.color || 'rgba(51, 94, 234, 1)'
  const parts = color.startsWith('rgba')
    ? color.slice(5, -1).split(',')
    : color.slice(4, -1).split(',')
  const r = parseInt(parts[0].trim(), 10)
  const g = parseInt(parts[1].trim(), 10)
  const b = parseInt(parts[2].trim(), 10)

  const red = Math.min(255, Math.max(0, r)).toString(16).padStart(2, '0')
  const green = Math.min(255, Math.max(0, g)).toString(16).padStart(2, '0')
  const blue = Math.min(255, Math.max(0, b)).toString(16).padStart(2, '0')

  return `#${red}${green}${blue}`
})

const getImagePath = (platform: string) => {
  return new URL(`../assets/images/${platform}.png`, import.meta.url).href
}

const updateIndicatorPosition = () => {
  const index = saveTypeServices.value.findIndex((s) => s.code === pluginId.value)
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

const selectPlatform = (platform: PluginId) => {
  pluginId.value = platform
  step.value = 0
  nextTick(updateIndicatorPosition)
}

const checkQrCodeLogin = () => {
  if (qrCodeKey.value === '') return

  qrCodeCheckInterval = setInterval(() => {
    if (!pluginId.value) {
      clearInterval(qrCodeCheckInterval)
      return
    }
    pluginMethodCall(pluginId.value, 'loginQrCodeCheck', { key: qrCodeKey.value }).then((res) => {
      if (res.code === 803) {
        if (!pluginId.value) return

        users.value[pluginId.value] = {
          userId: res.user!.userId || '',
          avatarUrl: res.user!.avatarUrl || '',
          nickname: res.user!.nickname || '',
          isVip: res.user!.isVip || false,
          signature: res.user!.signature || ''
        }

        const service = services.value.find((item) => item.code === pluginId.value)
        if (service) service.status = 'login'
        router.push({ name: service?.type })
        clearInterval(qrCodeCheckInterval)
      }
    })
  }, 3000)
}

const getQrCodeKey = async () => {
  if (!pluginId.value) return
  const res = await pluginMethodCall(pluginId.value, 'loginQrKey')
  if (res.code === 200) {
    qrCodeKey.value = res.data.qrcode
  }
  qrCode
    .toString(res.data.url, {
      width: 192,
      margin: 0,
      color: {
        dark: selectedColor.value,
        light: '#00000000'
      },
      type: 'svg'
    })
    .then((svg: string) => {
      qrCodeSvg.value = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    })
    .catch((err: any) => {
      console.log('err = ', err)
    })
  checkQrCodeLogin()
}

const login = () => {
  if (!pluginId.value) return
  pluginMethodCall(pluginId.value, 'doLogin', { userName: user.value, pwd: password.value }).then(
    (result) => {
      if (result.code === 200) {
        users.value[pluginId.value!] = {
          userId: result.data!.userId || '',
          avatarUrl: result.data!.avatarUrl || '',
          nickname: result.data!.nickname || '',
          isVip: result.data!.isVip || false,
          signature: result.data!.signature || ''
        }
        const service = services.value.find((item) => item.code === pluginId.value)
        if (service) service.status = 'login'
        router.push({ name: 'stream' })
      } else {
        error.value = result.message || ''
      }
    }
  )
  // const params = {
  //   platform: pluginId.value,
  //   baseURL: url.value,
  //   username: user.value,
  //   password: password.value
  // }
  // window.mainApi?.invoke('stream-login', params).then((res: { code: number; message: any }) => {
  //   if (res.code === 200) {
  //     services.value = services.value.map((service) =>
  //       service.name === pluginId.value ? { ...service, status: 'login' } : service
  //     )
  //     nextTick(() => {
  //       router.push('/stream')
  //     })
  //   } else {
  //     error.value = res.message
  //   }
  // })
}

const prev = () => {
  if (step.value > 0) step.value--
}

const next = async () => {
  if (!pluginId.value) return
  if (!saved.value) {
    await pluginMethodCall(pluginId.value, 'updateBaseUrl', { url: url.value }).then((result) => {
      if (result.code !== 200) return
      step.value += 1
      saved.value = true
    })
  } else {
    step.value += 1
  }

  if (loginType.value === 'QrCode') {
    getQrCodeKey()
  }
}

watch(url, (value, old) => {
  if (!old) return
  saved.value = false
})

watch(pluginId, (value) => {
  step.value = 0
  const service = services.value.find((s) => s.code === value)!
  if (service.status === 'login') {
    router.push('/stream')
    // return
  }
  // console.log('')

  pluginMethodCall(service.code, 'getAccount').then((result) => {
    user.value = result.userName
    password.value = result.pwd
    url.value = result.baseUrl
    saved.value = !!result.baseUrl
    if (result.baseUrl) step.value++
  })

  // window.mainApi?.invoke('get-stream-account', { platform: value }).then((result) => {
  //   url.value = result?.url || ''
  //   user.value = result?.username || ''
  //   password.value = result?.password || ''
  // })
})

onMounted(async () => {
  const { service, type } = route.params as { service: PluginId; type: LoginType }

  pluginId.value = service
  loginType.value = type

  await pluginMethodCall(service, 'getAccount').then((result) => {
    user.value = result.userName
    password.value = result.pwd
    url.value = result.baseUrl
    saved.value = true
    if (result.baseUrl) step.value++
  })

  if (type === 'QrCode') getQrCodeKey()

  // pluginId.value = (route.params.service as serviceName) || 'jellyfin'

  // window.mainApi
  //   ?.invoke('get-stream-account', { platform: pluginId.value })
  //   .then((result) => {
  //     url.value = result?.url || ''
  //     user.value = result?.username || ''
  //     password.value = result?.password || ''
  //   })
  // window.addEventListener('resize', updateIndicatorPosition)
  // nextTick(() => {
  //   updateIndicatorPosition()
  //   // 延迟100ms后启用过渡效果，确保首次渲染无动画
  //   setTimeout(() => {
  //     isIndicatorReady.value = true
  //   }, 100)
  // })
})

onBeforeUnmount(() => {
  clearInterval(qrCodeCheckInterval)
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

  .confirm {
    width: 100%;
    display: flex;

    .button {
      // 基础样式
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 600;
      background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
      color: var(--color-primary);
      border-radius: 8px;
      margin: 20px 0;
      padding: 8px;
      user-select: none;

      flex: 0 0 auto;
      width: calc(50% - 10px);
      margin-right: 20px;
      transition:
        width 0.3s ease,
        margin 0.3s ease,
        padding 0.3s ease,
        opacity 0.2s;
      box-sizing: border-box;
      overflow: hidden;
      white-space: nowrap;

      // 最后一个按钮没有右边距
      &:last-child {
        margin-right: 0;
      }

      // hover / active 效果
      &:hover {
        transform: scale(1.02);
      }
      &:active {
        transform: scale(0.98);
      }

      // 禁用状态（隐藏第一个按钮）
      &.disable {
        width: 0;
        margin: 0;
        padding: 0;
        opacity: 0;
        pointer-events: none;

        &:hover {
          transform: scale(1);
        }
      }

      // 当第一个按钮隐藏时，第二个按钮占满整行
      &.disable + .button {
        width: 100%;
      }
    }
  }

  .qr-code-container {
    background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
    padding: 20px;
    border-radius: 1.25rem;
    margin-bottom: 12px;
  }
}
</style>
