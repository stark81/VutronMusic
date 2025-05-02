import request from '../utils/request'

export function getLyric(id: number) {
  return request({
    url: '/lyric',
    method: 'get',
    params: {
      id
    }
  }) as Promise<{
    lrc: { lyric: any[] }
    tlyric: { lyric: any[] }
    romalrc: { lyric: any[] }
    yrc: { lyric: any[] }
    ytlrc: { lyric: any[] }
    yromalrc: { lyric: any[] }
  }>
}

/**
 * 喜欢音乐
 * 说明 : 调用此接口 , 传入音乐 id, 可喜欢该音乐
 * - id - 歌曲 id
 * - like - 默认为 true 即喜欢 , 若传 false, 则取消喜欢
 * @param {Object} params
 * @param {number} params.id
 * @param {boolean=} [params.like]
 */
export function likeTrack(params: any) {
  params.timestamp = new Date().getTime()
  return request({
    url: '/like',
    method: 'get',
    params
  })
}

/**
 * 获取歌曲详情
 * 说明 : 调用此接口 , 传入音乐 id(支持多个 id, 用 , 隔开), 可获得歌曲详情(注意:歌曲封面现在需要通过专辑内容接口获取)
 * @param {string} ids - 音乐 id, 例如 ids=405998841,33894312
 */
export function getTrackDetail(ids: string) {
  return request({
    url: '/song/detail',
    method: 'get',
    params: {
      ids
    }
  })
}

/**
 * 听歌打卡
 * 说明 : 调用此接口 , 传入音乐 id, 来源 id，歌曲时间 time，更新听歌排行数据
 * - id - 歌曲 id
 * - sourceid - 歌单或专辑 id
 * - time - 歌曲播放时间,单位为秒
 * @param {Object} params
 * @param {number} params.id
 * @param {number} params.sourceid
 * @param {number=} params.time
 */
export function scrobble(params) {
  params.timestamp = new Date().getTime()
  return request({
    url: '/scrobble',
    method: 'get',
    params
  })
}

/**
 * 新歌速递
 * 说明 : 调用此接口 , 可获取新歌速递
 * @param {number} type - 地区类型 id, 对应以下: 全部:0 华语:7 欧美:96 日本:8 韩国:16
 */
export function topSong(type: number) {
  return request({
    url: '/top/song',
    method: 'get',
    params: {
      type
    }
  })
}

/**
 * 新碟上架
 * 说明 : 调用此接口 , 可获取新碟上架
 * @param {string} params.area - ALL: 全部,ZH: 华语,EA: 欧美, KR: 韩国, JP: 日本
 * @param {string=} params.type - new: 全部，hot：热门，默认为new
 * @param {number=} params.year - 年，默认本年
 * @param {number=} params.month -月，默认本月
 * @param {number} params.limit
 * @param {number} params.offset
 */
export function topAlbum(params: any) {
  return request({
    url: '/top/album',
    method: 'get',
    params
  })
}
