import request from '../utils/request'

/**
 * 喜欢音乐列表（需要登录）
 * 说明 : 调用此接口 , 传入用户 id, 可获取已喜欢音乐id列表(id数组)
 * - uid: 用户 id
 * @param {number} uid
 */
export function userLikedSongsIDs(uid) {
  return request({
    url: '/likelist',
    method: 'get',
    params: {
      uid,
      timestamp: new Date().getTime()
    }
  })
}

/**
 * 每日签到
 * 说明 : 调用此接口可签到获取积分
 * -  type: 签到类型 , 默认 0, 其中 0 为安卓端签到 ,1 为 web/PC 签到
 * @param {number} type
 */
export function dailySignin(type = 0) {
  return request({
    url: '/daily/signin',
    method: 'post',
    params: {
      type,
      timestamp: new Date().getTime()
    }
  })
}

/**
 * 获取收藏的专辑（需要登录）
 * 说明 : 调用此接口可获取到用户收藏的专辑
 * - limit : 返回数量 , 默认为 25
 * - offset : 偏移数量，用于分页 , 如 :( 页数 -1)*25, 其中 25 为 limit 的值 , 默认为 0
 * @param {Object} params
 * @param {number} params.limit
 * @param {number=} params.offset
 */
export function likedAlbums(params) {
  return request({
    url: '/album/sublist',
    method: 'get',
    params: {
      limit: params.limit,
      timestamp: new Date().getTime()
    }
  })
}

/**
 * 获取收藏的歌手（需要登录）
 * 说明 : 调用此接口可获取到用户收藏的歌手
 */
export function likedArtists(params) {
  return request({
    url: '/artist/sublist',
    method: 'get',
    params: {
      limit: params.limit,
      timestamp: new Date().getTime()
    }
  })
}

/**
 * 获取收藏的MV（需要登录）
 * 说明 : 调用此接口可获取到用户收藏的MV
 */
export function likedMVs(params) {
  return request({
    url: '/mv/sublist',
    method: 'get',
    params: {
      limit: params.limit,
      timestamp: new Date().getTime()
    }
  })
}

/**
 * 获取云盘歌曲（需要登录）
 * 说明 : 登录后调用此接口 , 可获取云盘数据 , 获取的数据没有对应 url, 需要再调用一 次 /song/url 获取 url
 * - limit : 返回数量 , 默认为 200
 * - offset : 偏移数量，用于分页 , 如 :( 页数 -1)*200, 其中 200 为 limit 的值 , 默认为 0
 * @param {Object} params
 * @param {number} params.limit
 * @param {number=} params.offset
 */
export function cloudDisk(params: { [key: string]: any } = {}) {
  params.timestamp = new Date().getTime()
  return request({
    url: '/user/cloud',
    method: 'get',
    params
  })
}

/**
 * 获取云盘歌曲详情（需要登录）
 */
export function cloudDiskTrackDetail(id: number) {
  return request({
    url: '/user/cloud/detail',
    method: 'get',
    params: {
      timestamp: new Date().getTime(),
      id
    }
  })
}

/**
 * 获取用户播放记录
 * 说明 : 登录后调用此接口 , 传入用户 id, 可获取用户播放记录
 * - uid : 用户 id
 * - type : type=1 时只返回 weekData, type=0 时返回 allData
 * @param {Object} params
 * @param {number} params.uid
 * @param {number} params.type
 */
export function userPlayHistory(params: { uid: number; type: number }) {
  return request({
    url: '/user/record',
    method: 'get',
    params
  })
}

export function userDetail(params: { uid: string }) {
  return request({
    url: '/user/detail',
    method: 'get',
    params
  })
}
