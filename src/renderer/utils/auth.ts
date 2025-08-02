import Cookies from 'js-cookie'
import { logout } from '../api/auth'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'

export function setCookies(string: string) {
  const cookies = string.split(';;')
  cookies.map((cookie) => {
    document.cookie = cookie
    const cookieKeyValue = cookie.split(';')[0].split('=')
    localStorage.setItem(`cookie-${cookieKeyValue[0]}`, cookieKeyValue[1])
  })
}

export function setCookiesWithCookie(raw: string, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const cookies = raw.split(';')
  cookies.forEach((c) => {
    const [key, ...rest] = c.trim().split('=')
    const value = rest.join('=')
    if (!key || !value) return

    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}`
    localStorage.setItem(`cookie-${key}`, value)
  })
}

export function getCookie(key: string) {
  return Cookies.get(key) ?? localStorage.getItem(`cookie-${key}`)
}

export function removeCookie(key: string) {
  Cookies.remove(key)
  localStorage.removeItem(`cookie-${key}`)
}

// MUSIC_U 只有在账户登录的情况下才有
// export function isLoggedIn() {
//   return getCookie('MUSIC_U') !== null
// }

// 账号登录
export function isAccountLoggedIn() {
  return getCookie('MUSIC_U') !== null
}

// 用户名搜索（用户数据为只读）
// export function isUsernameLoggedIn() {
//   return store.state.data.loginMode === 'username';
// }

// 账户登录或者用户名搜索都判断为登录，宽松检查
export function isLooseLoggedIn() {
  return isAccountLoggedIn()
  // return isAccountLoggedIn() || isUsernameLoggedIn();
}

export function doLogout() {
  const { resetUserInfo, resetLiked } = useDataStore()
  const { user } = storeToRefs(useDataStore())
  window.mainApi?.invoke('logout', user.value.userId).then((res: boolean) => {
    if (res) {
      logout()
      removeCookie('MUSIC_U')
      removeCookie('__csrf')
      resetUserInfo()
      resetLiked()
    } else {
      console.log('logout failed')
    }
  })
}
