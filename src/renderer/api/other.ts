import request from '../utils/request'

/**
 * 本地音乐匹配
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.album
 * @param {string} params.artist
 * @param {number} params.duration
 * @param {string=} params.md5
 * @param {number=} params.localID
 */
export function searchMatch(params: {
  title: string
  album: string
  artist: string
  duration: number
  md5?: string
  localID?: number
}): Promise<any> {
  return request({
    url: '/search/match',
    method: 'get',
    params
  })
}

/**
 * 搜索
 * 说明 : 调用此接口 , 传入搜索关键词可以搜索该音乐 / 专辑 / 歌手 / 歌单 / 用户 , 关键词可以多个 , 以空格隔开 ,
 * 如 " 周杰伦 搁浅 "( 不需要登录 ), 搜索获取的 mp3url 不能直接用 , 可通过 /song/url 接口传入歌曲 id 获取具体的播放链接
 * - keywords : 关键词
 * - limit : 返回数量 , 默认为 30
 * - offset : 偏移数量，用于分页 , 如 : 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0
 * - type: 搜索类型；默认为 1 即单曲 , 取值意义 : 1: 单曲, 10: 专辑, 100: 歌手, 1000: 歌单, 1002: 用户, 1004: MV, 1006: 歌词, 1009: 电台, 1014: 视频, 1018:综合
 * - 调用例子 : /search?keywords=海阔天空 /cloudsearch?keywords=海阔天空(更全)
 * @param {Object} params
 * @param {string} params.keywords
 * @param {number=} params.limit
 * @param {number=} params.offset
 * @param {number=} params.type
 */
export function search(params: {
  keywords: string
  limit?: number
  offset?: number
  type?: number
}) {
  return request({
    url: '/search',
    method: 'get',
    params
  })
}

/**
 * 获取banner图
 * @param {Object} params
 * @param {number=} params.type
 */
export function getBanner(params: { type?: number } = { type: 0 }) {
  return request({
    url: '/banner',
    method: 'get',
    params
  })
}

export function personalFM() {
  return request({
    url: '/personal/fm',
    method: 'get',
    params: {
      timestamp: new Date().getTime()
    }
  })
}

export function fmTrash(id: number) {
  return request({
    url: '/fm_trash',
    method: 'post',
    params: {
      timestamp: new Date().getTime(),
      id
    }
  })
}

/**
 * 获取歌曲副歌时间
 */
export function songChorus(id: number) {
  return request({
    url: '/song/chorus',
    method: 'get',
    params: {
      id
    }
  })
}
