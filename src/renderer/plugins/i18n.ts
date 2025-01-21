import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import zh from '../locales/zh-hans.json'
import zht from '../locales/zh-hant.json'
// import { getCurrentLocale } from '../utils'

const settings = JSON.parse(localStorage.getItem('settings') || '{}')
const language = settings?.general?.language || 'zh'

// getCurrentLocale()
export default createI18n({
  legacy: false,
  locale: language,
  fallbackLocale: 'en',
  globalInjection: true,
  messages: {
    en,
    zh,
    zht
  }
})
