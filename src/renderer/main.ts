import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import i18n from './plugins/i18n'
import 'virtual:svg-icons-register'
import './assets/css/global.scss'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import DOMPurify from 'dompurify'

// Add API key defined in contextBridge to window object type
declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    mainApi?: {
      send: (channel: string, ...data: any[]) => void
      on: (channel: string, func: (...data: any[]) => void) => void
      once: (channel: string, func: (...data: any[]) => void) => void
      off: (channel: string, func: (...data: any[]) => void) => void
      invoke: (channel: string, ...data: any[]) => Promise<any>
    }
    env?: {
      isElectron: boolean
      isEnableTitlebar: boolean
      isLinux: boolean
      isMac: boolean
      isWindows: boolean
      isDev: boolean
    }
    vutronmusic?: {
      progress: number
      playing: boolean
      volume: number
      currentTrack: Record<string, any>
      isLiked: boolean
      repeatMode: string
      lyric: { lrc: string; tlyric: string; romalrc: string }
    }
  }
}

const app = createApp(App)

app.directive('focus', {
  mounted(el) {
    el.focus()
  }
})

/**
 * `v-safe-html` —— 应用内**唯一**允许写入 innerHTML 的入口。
 *
 * 背景（issue #416）：平台 UGC 字段曾被拼成 HTML 字符串交给 innerHTML 渲染，
 * 而 DOMPurify 的默认配置会放行指向任意外部站点的 `<a href>`，形成存储型 HTML 注入。
 *
 * 因此这里改为「严格白名单 + 链接降级」：
 * - 只保留排版类标签与极少量属性（`style`/`src`/事件属性一律禁止）；
 * - 所有 `<a>` 仅允许 `https:`，并强制 `target="_blank" rel="noopener noreferrer nofollow"`，
 *   使其必须经过主进程的 `setWindowOpenHandler` 走系统浏览器，而不是让特权窗口导航出去。
 *
 * 新增富文本渲染需求时请复用本指令，不要直接写 `innerHTML` / `v-html`。
 */
const RICH_TEXT_ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'del',
  's',
  'code',
  'pre',
  'blockquote',
  'a',
  'span',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td'
]

const RICH_TEXT_ALLOWED_ATTR = ['href', 'colspan', 'rowspan']

const RICH_TEXT_FORBID_TAGS = [
  'style',
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'img',
  'picture',
  'video',
  'audio',
  'source',
  'track',
  'link',
  'meta',
  'base',
  'svg',
  'math',
  'template',
  'slot'
]

// 全局安装一次，避免指令在每次更新时重复注册 hook。
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName !== 'A') return
  const href = node.getAttribute('href')
  if (!href || !/^https:\/\//i.test(href)) {
    node.removeAttribute('href')
    return
  }
  node.setAttribute('target', '_blank')
  node.setAttribute('rel', 'noopener noreferrer nofollow')
})

app.directive('safe-html', (el, binding) => {
  const raw = binding.value
  if (typeof raw !== 'string' || !raw) {
    el.innerHTML = ''
    return
  }
  el.innerHTML = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
    FORBID_TAGS: RICH_TEXT_FORBID_TAGS,
    FORBID_ATTR: ['style', 'src', 'srcset', 'formaction', 'xlink:href', 'target'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP: /^https:\/\//i
  })
})

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app
  // .use(vuetify)
  .use(i18n)
  .use(router)
  .use(pinia)

app.mount('#app')
