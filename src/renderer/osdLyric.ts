import { createApp } from 'vue'
import OSDLyric from './views/OSDLyric.vue'
import 'virtual:svg-icons-register'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import './assets/css/osdlyric.scss'

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    mainApi?: any
    env?: {
      isElectron: boolean
      isEnableTitlebar: boolean
      isLinux: boolean
      isMac: boolean
      isWindows: boolean
    }
  }
}

const app = createApp(OSDLyric)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.mount('#lyric')
