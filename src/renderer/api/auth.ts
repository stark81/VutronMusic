import request from '../utils/request'

/**
 * 获取用户歌单
 * 说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户歌单
 * - uid : 用户 id
 * - limit : 返回数量 , 默认为 30
 * - offset : 偏移数量，用于分页 , 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0
 * @param {Object} params
 * @param {number} params.uid
 * @param {number} params.limit
 * @param {number=} params.offset
 * @param {number=} params.timestamp
 */
export function userPlaylist(params: {
  uid: number
  limit: number
  offset?: number
  timestamp?: number
}) {
  return request({
    url: '/user/playlist',
    method: 'get',
    params
  })
}

export function loginWithPhone(params: {
  phone: string
  password: string
  countrycode?: string
  md5_password?: string
  captcha?: string
}) {
  return request({
    url: '/login/cellphone',
    method: 'post',
    params
  })
}

/**
 * 邮箱登录
 * - email: 163 网易邮箱
 * - password: 密码
 * - md5_password: md5加密后的密码,传入后 password 将失效
 * @param {Object} data
 * @param {string} data.email
 * @param {string} data.password
 * @param {string=} data.md5_password
 */
export function loginWithEmail(params: { email: string; password: string; md5_password?: string }) {
  return request({
    url: '/login',
    method: 'post',
    params
  })
}

export interface LoginQrCodeKeyResponse {
  code: number
  data: {
    code: number
    unikey: string
  }
}

export function loginQrCodeKey() {
  return request({
    url: '/login/qr/key',
    method: 'get',
    params: {
      timestamp: new Date().getTime()
    }
  })
}

/**
 * 二维码检测扫码状态接口
 * 说明: 轮询此接口可获取二维码扫码状态,800为二维码过期,801为等待扫码,802为待确认,803为授权登录成功(803状态码下会返回cookies)
 * @param {string} key
 */
export function loginQrCodeCheck(key: string) {
  return request({
    url: '/login/qr/check',
    method: 'get',
    params: {
      key,
      timestamp: new Date().getTime()
    }
  })
}

/**
 * 刷新登录
 * 说明 : 调用此接口 , 可刷新登录状态
 * - 调用例子 : /login/refresh
 */
export function refreshCookie() {
  return request({
    url: '/login/refresh',
    method: 'post'
  })
}

/**
 * 获取账号详情
 * 说明 : 登录后调用此接口 ,可获取用户账号信息
 */
export function userAccount() {
  return request({
    url: '/user/account',
    method: 'get',
    params: {
      timestamp: new Date().getTime()
    }
  })
}

export function getQrImg(key: string) {
  return request({
    url: '/login/qr/create',
    method: 'get',
    params: {
      key,
      qrimg: true,
      timestamp: new Date().getTime()
    }
  })
}

export function getLoginStatus(cookie: string) {
  return request({
    url: `/login/status?timestamp=${Date.now()}`,
    method: 'post',
    data: {
      cookie
    }
  })
}

/**
 * 退出登录
 * 说明 : 调用此接口 , 可退出登录
 */
export function logout() {
  return request({
    url: '/logout',
    method: 'post'
  })
}
