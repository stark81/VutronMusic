import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import i18n from './plugins/i18n'
import 'virtual:svg-icons-register'
import './assets/css/global.scss'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import DOMPurify from 'dompurify'
import { dailyTask } from './utils'

// Add API key defined in contextBridge to window object type
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

const app = createApp(App)

app.directive('focus', {
  mounted(el) {
    el.focus()
  }
})
app.directive('same-html', (el, binding) => {
  el.innerHTML = DOMPurify.sanitize(binding.value)
})

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(vuetify).use(i18n).use(router).use(pinia)

app.mount('#app')

dailyTask()
