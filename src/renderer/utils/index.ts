import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'
import { isAccountLoggedIn } from './auth'
import { refreshCookie } from '../api/auth'
import { dailySignin } from '../api/user'

export default class Utils {
  static getCurrentLocale(): string {
    return navigator?.language?.split('-')[0] || 'en'
  }

  static async openExternal(url: string): Promise<void> {
    await window.mainApi.send('msgOpenExternalLink', url)
  }

  static async openFile(type: string): Promise<any> {
    return window.mainApi.invoke('msgOpenFile', type)
  }

  static async nativeAlert(msg: string): Promise<void> {
    return window.mainApi.send('msgNativeAlert', msg)
  }

  static changeAppearance(appearance: string): void {
    if (appearance === 'auto' || appearance === undefined) {
      appearance = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.body.setAttribute('data-theme', appearance)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', appearance === 'dark' ? '#222' : '#fff')
  }

  static randomNum(minNum: number, maxNum: number) {
    switch (arguments.length) {
      case 1:
        return parseInt((Math.random() * minNum + 1).toString(), 10)
      case 2:
        return parseInt((Math.random() * (maxNum - minNum + 1) + minNum).toString(), 10)
      default:
        return 0 // 返回0
    }
  }

  static formatTime(Milliseconds: number, format = 'HH:MM:SS') {
    const { locale } = useI18n()
    if (!Milliseconds) return ''
    dayjs.extend(duration)
    dayjs.extend(relativeTime)

    const time = dayjs.duration(Milliseconds)
    const hours = time.hours().toString()
    const mins = time.minutes().toString()
    const seconds = time.seconds().toString().padStart(2, '0')

    if (format === 'HH:MM:SS') {
      return hours !== '0' ? `${hours}:${mins.padStart(2, '0')}:${seconds}` : `${mins}:${seconds}`
    } else if (format === 'Human') {
      let hoursUnit, minitesUnit
      switch (locale.value) {
        case 'zh':
          hoursUnit = '小时'
          minitesUnit = '分钟'
          break
        case 'zh-TW':
          hoursUnit = '小時'
          minitesUnit = '分鐘'
          break
        default:
          hoursUnit = 'hr'
          minitesUnit = 'min'
          break
      }
      return hours !== '0'
        ? `${hours} ${hoursUnit} ${mins} ${minitesUnit}`
        : `${mins} ${minitesUnit}`
    }
  }

  static formatDate(timestamp: any, format: string = '') {
    if (!timestamp) return ''
    if (format === '') {
      const { locale } = useI18n()
      if (locale.value === 'zh') {
        format = 'YYYY年MM月DD日'
      } else {
        format = 'YYYY-MM-DD'
      }
    }
    return dayjs(timestamp).format(format)
  }

  static formatAlbumType(type: any, album: any) {
    if (!type) return ''
    if (type === 'EP/Single') {
      return album.size === 1 ? 'Single' : 'EP'
    } else if (type === 'Single') {
      return 'Single'
    } else if (type === '专辑') {
      return 'Album'
    } else {
      return type
    }
  }

  static formatPlayCount(count: any) {
    if (!count) return '0'
    const { locale } = useI18n()
    if (locale.value === 'zh') {
      if (count > 100000000) {
        return `${Math.floor((count / 100000000) * 100) / 100}亿` // 2.32 亿
      }
      if (count > 100000) {
        return `${Math.floor((count / 10000) * 10) / 10}万` // 232.1 万
      }
      if (count > 10000) {
        return `${Math.floor((count / 10000) * 100) / 100}万` // 2.3 万
      }
      return count
    } else {
      if (count > 10000000) {
        return `${Math.floor((count / 1000000) * 10) / 10}M` // 233.2M
      }
      if (count > 1000000) {
        return `${Math.floor((count / 1000000) * 100) / 100}M` // 2.3M
      }
      if (count > 1000) {
        return `${Math.floor((count / 1000) * 100) / 100}K` // 233.23K
      }
      return count
    }
  }

  static dailyTask() {
    const { lastRefreshCookieDate } = storeToRefs(useDataStore())
    if (
      isAccountLoggedIn() &&
      (lastRefreshCookieDate.value === undefined || lastRefreshCookieDate.value !== dayjs().date())
    ) {
      refreshCookie().then(() => {
        console.debug('[debug][common.js] 刷新cookie')
        lastRefreshCookieDate.value = dayjs().date()
      })
      dailySignin(0).catch((e) => {
        console.debug(`[debug][common.js] 手机端重复签到: ${e}`)
      })
      dailySignin(1).catch((e) => {
        console.debug(`[debug][common.js] PC端重复签到: ${e}`)
      })
    }
  }
}

export const {
  getCurrentLocale,
  openExternal,
  openFile,
  nativeAlert,
  changeAppearance,
  randomNum,
  formatTime,
  formatDate,
  formatAlbumType,
  formatPlayCount,
  dailyTask
} = Utils
