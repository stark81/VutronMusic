<template>
  <div class="login-container">
    <div class="section-one">
      <img src="../assets/images/vutronmusic-icon.png" />
    </div>
    <div class="title">{{ $t('login.loginText', { serviceName: currentService.name }) }}</div>
    <div class="section-two">
      <div v-show="selectedMode.mode === 'qrCode'">
        <div v-show="qrCodeSvg" class="qr-code-container">
          <img :src="qrCodeSvg" loading="lazy" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import qrCode from 'qrcode'
import { usePluginMusic } from '../store/pluginMusic'
import { useSettingsStore } from '../store/settings'
import { PluginId } from '@/types/plugin'

const route = useRoute()
const router = useRouter()

const { t } = useI18n()

const pluginMusicStore = usePluginMusic()
const { services, users } = storeToRefs(pluginMusicStore)
const { pluginMethodCall } = pluginMusicStore
const { theme } = storeToRefs(useSettingsStore())

const qrCodeSvg = ref('')
const qrCodeKey = ref('')
const qrCodeCheckInterval = ref<ReturnType<typeof setInterval> | undefined>(undefined)

const modeList = ['phone', 'email', 'qrCode', 'cookie'] as const

const loginModes = ref([
  { mode: 'phone' as (typeof modeList)[number], selected: false, text: t('login.loginWithPhone') },
  { mode: 'email' as (typeof modeList)[number], selected: false, text: t('login.loginWithEmail') },
  { mode: 'qrCode' as (typeof modeList)[number], selected: true, text: t('login.loginWithQr') },
  { mode: 'cookie' as (typeof modeList)[number], selected: false, text: t('login.loginWithCookie') }
])

const selectedMode = computed(() => loginModes.value.find((M) => M.selected)!)
const currentService = reactive<{
  code: PluginId
  name: string
}>({ code: '' as PluginId, name: '' })

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

const checkQrCodeLogin = () => {
  if (qrCodeKey.value === '') return
  qrCodeCheckInterval.value = setInterval(() => {
    const pluginId = currentService.code
    pluginMethodCall(pluginId, 'loginQrCodeCheck', {
      key: qrCodeKey.value
    }).then((res) => {
      if (res.code === 803) {
        users.value[pluginId] = {
          userId: res.user!.userId || '',
          avatarUrl: res.user!.avatarUrl || '',
          nickname: res.user!.nickname || '',
          isVip: res.user!.isVip || false,
          signature: res.user!.signature || ''
        }
        const service = services.value.find((item) => item.code === pluginId)
        if (service) service.status = 'login'
        router.push({ name: 'library' })
        clearInterval(qrCodeCheckInterval.value)
      }
    })
  }, 3000)
}

const getQrCodeKey = async () => {
  const res = await pluginMethodCall(currentService.code, 'loginQrKey')
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

onMounted(() => {
  const code = route.params.service as string
  const service = services.value.find((s) => s.code === code)
  console.log('==2=2=2=', code, service)
  if (!service) return
  currentService.code = service.code
  currentService.name = service.name

  if (selectedMode.value.mode === 'qrCode') getQrCodeKey()
})

onBeforeUnmount(() => {
  clearInterval(qrCodeCheckInterval.value)
})
</script>

<style scoped lang="scss">
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.section-one {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  img {
    height: 80px;
    margin: 20px;
    user-select: none;
  }
}

.title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 48px;
}

.qr-code-container {
  background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
  padding: 20px;
  border-radius: 1.25rem;
  margin-bottom: 12px;
}
</style>
