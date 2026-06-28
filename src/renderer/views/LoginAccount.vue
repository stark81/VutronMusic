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
          :src="getPluginIcon(platform)"
          :class="{ selected: platform.code === pluginId }"
          :alt="`${platform.name}`"
        />
      </div>
      <div class="indicator" :class="{ animated: isIndicatorReady }" :style="indicatorStyle"></div>
    </div>
    <div class="title">{{ pluginDisplayName }}</div>
    <div class="section-2">
      <template v-if="!step && loginType !== 'LocalDir' && currentMode !== 'Cookie'">
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
      <template v-else-if="loginType === 'QrCode' && currentMode === 'QrCode'">
        <div class="qr-code-container">
          <img :src="qrCodeSvg" loading="lazy" />
        </div>
      </template>
      <template v-else-if="loginType === 'QrCode' && currentMode === 'Cookie'">
        <div class="input-box">
          <div class="container cookie-container">
            <textarea
              v-model="cookie"
              class="cookie-input"
              :placeholder="$t('login.cookiePlaceholder')"
            ></textarea>
          </div>
        </div>
      </template>
      <template v-else-if="loginType === 'LocalDir'">
        <div class="local-dir-container">
          <div class="dir-list">
            <div v-for="(dir, index) in localScanDir" :key="dir" class="dir-item">
              <label>{{ dir }}</label>
              <button class="remove-btn" @click="removeDir(index)">{{
                $t('login.removeDir')
              }}</button>
            </div>
            <div v-if="!localScanDir.length" class="empty-hint">{{ $t('login.emptyScanDir') }}</div>
          </div>
          <div class="dir-actions">
            <button @click="chooseDir">{{ $t('login.chooseDir') }}</button>
            <button @click="showManualInput = !showManualInput">手动输入</button>
          </div>
          <div v-if="showManualInput" class="manual-input-row">
            <input
              v-model="manualDir"
              type="text"
              class="manual-input"
              placeholder="/home/user/Music"
              @keyup.enter="addManualDir"
            />
            <button class="add-btn" @click="addManualDir">添加</button>
          </div>
        </div>
      </template>

      <div
        v-if="step === 0 || loginType !== 'QrCode' || currentMode === 'Cookie'"
        class="confirm"
        :class="{ 'confirm-single': loginType === 'LocalDir' }"
      >
        <div v-if="step > 0 && loginType !== 'LocalDir'" class="button" @click="prev"> 上一步 </div>
        <div
          class="button"
          :class="{ disable: loginType === 'LocalDir' && !localScanDir.length }"
          @click="step ? login() : next()"
        >
          {{
            loginType === 'LocalDir' ? $t('login.setScanDir') : step ? $t('login.login') : '下一步'
          }}
        </div>
      </div>
      <div v-if="loginType === 'QrCode' && loginModes.length > 1" class="other-login">
        <a
          v-for="mode in loginModes.filter((m) => m.mode !== currentMode)"
          :key="mode.mode"
          @click="switchMode(mode.mode)"
          >{{ mode.text }}</a
        >
      </div>
      <label v-if="error" style="color: red">{{ error }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'
import qrCode from 'qrcode'
import { useSettingsStore } from '../store/settings.js'
import { usePluginMusic } from '../store/pluginMusic.js'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LoginType, PluginId } from '@/types/plugin'
import { getPluginIcon } from '../utils/common'

const { t } = useI18n()

const iconWrappers = ref<HTMLElement[]>([])
const indicatorStyle = ref({ width: '0px', left: '0px' })
const isIndicatorReady = ref(false)
const { theme } = storeToRefs(useSettingsStore())

const pluginStore = usePluginMusic()
const { services, users, scanDir: pluginScanDir } = storeToRefs(pluginStore)
const { pluginMethodCall, handleStatusChange } = pluginStore

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

const pluginDisplayName = computed(() => {
  if (!pluginId.value) return ''
  const service = services.value.find((s) => s.code === pluginId.value)
  return service?.name || pluginId.value
})
const step = ref(0)
const currentMode = ref<LoginType>('QrCode')

watch(step, (newStep) => {
  if (newStep === 1 && loginType.value === 'QrCode' && currentMode.value === 'QrCode') {
    getQrCodeKey()
  } else {
    clearInterval(qrCodeCheckInterval)
    qrCodeSvg.value = ''
    qrCodeKey.value = ''
  }
})

const loginModes = computed(() => {
  const service = services.value.find((it) => it.code === pluginId.value)
  if (service?.type !== 'library') return []
  return [
    { mode: 'QrCode' as LoginType, text: t('login.loginWithQr') },
    { mode: 'Cookie' as LoginType, text: t('login.loginWithCookie') }
  ]
})

const cookie = ref('')

const localScanDir = ref<string[]>([])
const showManualInput = ref(false)
const manualDir = ref('')

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

const switchMode = (mode: LoginType) => {
  currentMode.value = mode
  step.value = 0
  error.value = null
  saved.value = false
  qrCodeSvg.value = ''
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

        handleStatusChange(pluginId.value, 'login')
        users.value[pluginId.value] = {
          userId: res.user!.userId || '',
          avatarUrl: res.user!.avatarUrl || '',
          nickname: res.user!.nickname || '',
          isVip: res.user!.isVip || false,
          signature: res.user!.signature || ''
        }

        const service = services.value.find((item) => item.code === pluginId.value)
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

const chooseDir = () => {
  window.mainApi?.invoke('selecteFolder', { multi: true }).then((folderPath: string[]) => {
    if (!folderPath) return
    localScanDir.value = [...new Set([...localScanDir.value, ...folderPath])]
    step.value++
  })
}

const removeDir = (index: number) => {
  localScanDir.value.splice(index, 1)
}

const addManualDir = () => {
  const path = manualDir.value.trim()
  if (!path) return
  if (!localScanDir.value.includes(path)) {
    localScanDir.value.push(path)
  }
  manualDir.value = ''
}

const login = () => {
  if (!pluginId.value) return

  const handleLoginSuccess = (
    result: { code: number; data?: any; message?: string },
    onRoute: () => void
  ) => {
    if (result.code === 200) {
      handleStatusChange(pluginId.value!, 'login')
      users.value[pluginId.value!] = {
        userId: result.data!.userId || '',
        avatarUrl: result.data!.avatarUrl || '',
        nickname: result.data!.nickname || '',
        isVip: result.data!.isVip || false,
        signature: result.data!.signature || ''
      }
      onRoute()
    } else {
      error.value = result.message || ''
    }
  }

  if (loginType.value === 'LocalDir') {
    if (!localScanDir.value.length) {
      error.value = t('login.errorNoScanDir')
      return
    }
    pluginMethodCall(pluginId.value, 'doLogin', { dirs: localScanDir.value }).then((result) => {
      handleLoginSuccess(result, () => {
        if (result.data?.scanDir) {
          pluginScanDir.value = result.data.scanDir
        }
        router.push('/localMusic')
      })
    })
    return
  }

  if (currentMode.value === 'Cookie') {
    if (!cookie.value.trim()) {
      error.value = t('login.errorNoCookie')
      return
    }
    pluginMethodCall(pluginId.value, 'doLogin', { cookie: cookie.value.trim() }).then((result) => {
      handleLoginSuccess(result, () => {
        const ser = services.value.find((item) => item.code === pluginId.value)
        router.push({ name: ser?.type || 'library' })
      })
    })
    return
  }

  pluginMethodCall(pluginId.value, 'doLogin', { userName: user.value, pwd: password.value }).then(
    (result) => {
      handleLoginSuccess(result, () => {
        const ser = services.value.find((item) => item.code === pluginId.value)
        router.push({ name: ser?.type || 'stream' })
      })
    }
  )
}

const prev = () => {
  if (step.value > 0) step.value--
}

const next = async () => {
  if (!pluginId.value) return

  if (loginType.value === 'LocalDir') {
    step.value = 1
    return
  }

  if (currentMode.value === 'Cookie') {
    step.value = 1
    return
  }

  if (!saved.value) {
    await pluginMethodCall(pluginId.value, 'updateBaseUrl', { url: url.value }).then((result) => {
      if (result.code !== 200) return
      step.value += 1
      saved.value = true
    })
  } else {
    step.value += 1
  }
}

watch(url, (value, old) => {
  if (!old) return
  saved.value = false
})

watch(pluginId, (value) => {
  step.value = 0
  error.value = null
  currentMode.value = 'QrCode'
  const service = services.value.find((s) => s.code === value)!

  if (loginType.value === 'LocalDir') {
    if (service.status === 'login') {
      router.push('/localMusic')
    }
    localScanDir.value = [...pluginScanDir.value]
    return
  }

  if (service.status === 'login') {
    router.push('/stream')
  }

  pluginMethodCall(service.code, 'getAccount').then((result) => {
    user.value = result.userName
    password.value = result.pwd
    url.value = result.baseUrl
    saved.value = !!result.baseUrl
    if (result.baseUrl) step.value++
  })
})

onMounted(async () => {
  const { service, type } = route.params as { service: PluginId; type: LoginType }

  pluginId.value = service
  loginType.value = type
  currentMode.value = type

  if (type === 'LocalDir') {
    step.value = 1
    localScanDir.value = [...pluginStore.scanDir]
    return
  }

  await pluginMethodCall(service, 'getAccount').then((result) => {
    user.value = result.userName
    password.value = result.pwd
    url.value = result.baseUrl
    saved.value = !!result.baseUrl
    if (result.baseUrl) step.value++
  })
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

    &.confirm-single .button {
      width: 100%;
      margin-right: 0;
    }

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

  .cookie-container {
    height: 108px !important;
    box-sizing: border-box;
  }

  .cookie-input {
    font-size: 16px;
    border: none;
    background: transparent;
    width: 100%;
    height: 100%;
    font-weight: 600;
    margin-top: -1px;
    color: var(--color-text);
    box-sizing: border-box;
    resize: none;
    outline: none;
    border-radius: 8px;
    padding: 12px 20px;
    scrollbar-width: none;
  }

  .cookie-input::placeholder {
    color: var(--color-text);
    opacity: 0.38;
    font-size: 16px;
  }

  .other-login {
    margin-top: 24px;
    font-size: 13px;
    opacity: 0.68;
    a {
      padding: 0 8px;
      border-right: 2px solid var(--color-text);
      cursor: pointer;
      &:last-child {
        border-right: 0;
      }
      &:hover {
        opacity: 1;
      }
    }
  }

  .local-dir-container {
    width: 400px;

    .dir-list {
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 16px;
      padding: 8px;
      background: var(--color-secondary-bg);
      border-radius: 8px;

      .dir-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        margin-bottom: 4px;
        background: var(--color-primary-bg);
        border-radius: 4px;

        label {
          font-size: 14px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          margin-right: 8px;
        }

        .remove-btn {
          color: var(--color-text);
          opacity: 0.6;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          background: transparent;
          border: none;
          cursor: pointer;

          &:hover {
            opacity: 1;
          }
        }
      }

      .empty-hint {
        text-align: center;
        color: var(--color-text);
        opacity: 0.5;
        padding: 20px 0;
      }
    }

    .dir-actions {
      display: flex;
      gap: 12px;

      button {
        flex: 1;
        padding: 8px 16px;
        border-radius: 8px;
        background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
        color: var(--color-primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;

        &:hover {
          opacity: 0.9;
        }
      }
    }

    .manual-input-row {
      display: flex;
      gap: 8px;
      margin-top: 12px;

      .manual-input {
        flex: 1;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid var(--color-secondary-bg);
        background: var(--color-secondary-bg);
        color: var(--color-text);
        font-size: 14px;
        outline: none;

        &:focus {
          border-color: var(--color-primary);
        }
      }

      .add-btn {
        padding: 8px 16px;
        border-radius: 8px;
        background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
        color: var(--color-primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;

        &:hover {
          opacity: 0.9;
        }
      }
    }
  }
}
</style>
