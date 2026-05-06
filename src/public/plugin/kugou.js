/**
 * 插件规范：
 * - 禁止 export / import / require，写了也会在***运行时***报错
 * - 只能通过 exports.xxx = fn 或者 exports.xxx = { xxx } 来导出给外部使用；
 * - 插件需要提供的内容如下，可复制后进行相对应的修改，其中的函数允许修改传参等；
 * - 插件内部只允许使用
 *   - apis.http.get/post发送网络请求；
 *   - apis.log.info/error 来把一些重要信息保存到本地的log文件中；
 *   - apis.store.get/set 建议用来保存插件运行相关的配置、状态信息；
 *   - apis.db.get/set 建议用来保存帐号 + 业务核心数据，如token、cookie信息等；
 */

/**
 * =======================================================================================
 *                             插件api定义。插件内部能使用的权限暂定如下
 * =======================================================================================
 */

/**
 * @typedef {Object} PluginHttp
 * @property {(url: string, params?: object) => Promise<any>} get
 * @property {(url: string, data?: object) => Promise<any>} post
 */

/**
 * @typedef {Object} PluginStore
 * @property {(key: string) => Promise<string | Record<string, any>>} get key为''时表示获取整个插件的store数据
 * @property {(key: string, value: any) => void} set
 */

/**
 * @typedef {Object} DB
 * @property {() => Promise<any>} get
 * @property {(key: string, value: any) => void} set
 */

/**
 * @typedef {Object} PluginApi
 * @property {PluginHttp} http
 * @property {(msg: string) => void} log
 * @property {PluginStore} store
 * @property {DB} db - 仅支持登陆相关的数据保存与获取
 */

/**
 * =======================================================================================
 *                                     返回结果类型定义
 * =======================================================================================
 */

/**
 * @typedef {Object} Word
 * @property {string} text
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} LyricLine
 * @property {number} start
 * @property {number} end
 * @property {{ text: string, info?: Word[] }} lyric
 * @property {{ text: string, info?: Word[] }} [tlyric]
 * @property {{ text: string, info?: Word[] }} [rlyric]
 */

/**
 * @typedef {Object} Banner
 * @property {string} id
 * @property {string} picUrl
 * @property {string} url
 * @property {string} sourceId
 * @property {'track' | 'album' | 'playlist' | 'mv' | 'activity'} type
 * @property {string} typeTitle
 */

/**
 * @typedef {Object} Album
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 */

/**
 * @typedef {Object} Artist
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 */

/**
 * @typedef {Object} Track
 * @property {string} id
 * @property {string} name
 * @property {number} duration
 * @property {string[]} alias
 * @property {number} createTime
 * @property {Album} album
 * @property {number} no
 * @property {Artist[]} artists
 * @property {string} picUrl
 * @property {string} pluginId
 * @property {MusicType} type
 * @property {boolean} playable
 * @property {string} reason
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} Playlist
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {number} playCount
 * @property {string} pluginId
 * @property {{ name: string, artist: string }[]=} tracks
 * @property {string} copywriter
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} PlaylistDetail
 * @property {number} id
 * @property {string} name
 * @property {string} picUrl
 * @property {boolean} subscribed
 * @property {number} trackCount
 * @property {number} updateTime
 * @property {string} description
 * @property {boolean} isPrivate
 * @property {number} trackCount
 * @property {number[]} trackIds
 * @property {Track} tracks
 * @property {string} pluginId
 * @property {string} copywriter
 * @property {string | null} updateFrequency
 * @property {User} creator
 * @property {string[]} tags
 * @property {{ id: number, trackIds: number[], loadedIDs: number[] }} sourceContext
 */

/**
 * 由宿主注入的 API（仅用于类型提示）
 * @type {PluginApi}
 */
/* eslint-disable no-undef */
const apis = api

/**
 * ================================================================================
 *                          下面的内容是目前插件所需的全部函数，
 *                          只需要按照自己插件的实际情况进行修
 *                             改即可，无需新增其他的内容
 * ================================================================================
 */

const user = { userId: 0, isVip: false }
const collectedPlaylists = { ids: [] }
const artistLists = { status: 0, data: {} }

apis.db.get().then((result) => {
  console.log('[kugou get user]: ', result)
})

/**
 * @param {string} url
 * @param {Object=} params
 */
const get = async (url, params) => {
  const store = await apis.store.get('')
  const { baseUrl, token, userid, dfid } = store

  let cookie = ``
  if (token) cookie += `token=${token};userid=${userid}`
  if (dfid) cookie += `;dfid=${dfid}`

  const headers = { Cookie: cookie, 'User-Agent': 'Android16' }
  return apis.http.get(`${baseUrl}/${url}`, params, headers)
}

/**
 * @param {string} url
 * @param {Object=} data
 */
const post = async (url, data) => {
  const store = await apis.store.get('')
  const baseUrl = store.baseUrl
  const token = store.token
  const userid = store.userid
  const headers = token ? { Cookie: `token=${token};userid=${userid}` } : {}
  return apis.http.post(`${baseUrl}/${url}`, data, headers)
}

// 获取用户vip情况以及该用户的收藏歌单id
// get('user/vip/detail').then((result) => {
//   console.log('[/user/vip/detail]: ', result)
//   user.userId = result.data.userid
//   const vip = result.data.busi_vip.find((item) => item.product_type === 'svip')
//   user.isVip = vip?.is_vip === 1

//   get('user/playlist', { pagesize: 100 })
//     .then((res) => {
//       collectedPlaylists.ids = res.data.info.map((item) => item.list_create_gid)
//     })
//     .catch()
// })

get('artist/lists', { type: 0, hotsize: 30 }).then((result) => {
  artistLists.status = result.status
  artistLists.data = result.data
})

const isTrackPlayable = (item) => {
  const result = { playable: true, reason: '' }
  if (item.privilege === 0) return result

  if (!item.hash) {
    result.playable = false
    result.reason = '无可用资源'
  } else if (item.privilege === 10 && !user.isVip) {
    result.playable = false
    result.reason = 'VIP Only'
  }
  return result
}

/**
 * @returns {Track}
 */
const formatTrack = (item) => {
  const result = isTrackPlayable(item)
  return {
    id: item.songid ?? item.audio_id,
    name: item.songname ?? item.name.split('-')[1].trim(),
    duration: item.timelen ?? (item.time_length ?? 0) * 1000,
    alias: [],
    createTime: new Date(item.publish_date).getTime() ?? 0,
    no: 0,
    playable: result.playable,
    reason: result.reason,
    album: {
      id: item.album_id ?? item.albuminfo.id,
      name: item.album_name ?? item.albuminfo.name,
      picUrl: (item.sizable_cover ?? item.cover).replace('{size}', '512')
    },
    artists: item.singerinfo.map((ar) => ({
      id: ar.id,
      name: ar.name,
      picUrl: ar.avatar?.replace('{size}', '512') ?? ''
    })),
    picUrl: (item.sizable_cover ?? item.cover).replace('{size}', '512'),
    pluginId: '',
    type: meta.type,
    sourceContext: { hash: item.hash }
  }
}

const meta = {
  name: '酷狗',
  type: 'online' // online, stream
}

/**
 * - meta：插件的基础信息
 * - meta.name: 中英文均可，用来表示这个插件的数据来源；
 * - meta.type: online, local 或者 stream，表示插件类型是线上服务还是自建流媒体服务，作为本地音乐匹配的依据
 */
exports.meta = meta

/**
 * 平台连同性测试
 * @returns {boolean}
 */
exports.systemPing = () => true

exports.loginQrKey = async () => {
  const result = await get('login/qr/key', { timestamp: Date.now() })
  if (result.status === 1) {
    result.data.url = `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${result.data.qrcode}`
  }
  return result
}

exports.loginQrCodeCheck = async (params) => {
  const result = await get('login/qr/check', { ...params, timestamp: Date.now() })
  if (result.data.status === 4) {
    console.log('[loginQrCodeCheck]:', result)
    const token = result.data.token
    const userid = result.data.userid
    apis.store.set('token', token)
    apis.store.set('userid', userid)
  }
  const map = {
    0: { code: 800, message: '二维码过期' },
    1: { code: 801, message: '等待扫码' },
    2: { code: 802, message: '待确认' },
    4: { code: 803, message: '授权登录成功' }
  }
  console.log('[loginQrCodeCheck]:', map[result.data.status])
  return result
}

/**
 * 插件平台的登陆功能，登陆成功后，需要使用apis.store.set来保存所需的帐号相关信息
 */
exports.doLogin = () => true

/**
 * @returns {{ code: number, data: Banner[] }}
 */
exports.getBanner = async (params) => {
  const result = await get('pc/diantai', { ...params })
  const banners = result.data.data
    .filter((item) => !item.isAd)
    .map((item) => {
      const map = {
        0: ['activity', '活动'],
        1: ['album', '专辑购买'],
        3: ['playlist', '歌单推荐'],
        7: ['album', '新碟首发']
      }
      return {
        id: item.id,
        picUrl: item.code,
        url: item.url,
        sourceId: String(item.classid),
        type: map[item.jump_type] ? map[item.jump_type][0] : 'activity',
        typeTitle: map[item.jump_type] ? map[item.jump_type][1] : '活动'
      }
    })
  return { code: result.status === 1 ? 200 : 404, data: banners }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.getRecommendPlaylist = async () => {
  const result = await get('top/playlist', { category_id: 0 })
  const data = result.data.special_list
    .map((item) => ({
      id: item.global_collection_id,
      name: item.specialname,
      picUrl: item.imgurl.replace('{size}', '256'),
      playCount: item.play_count,
      copywriter: item.show ?? '',
      pluginId: '',
      sourceContext: {}
    }))
    .slice(0, 10)
  return { code: result.status === 1 ? 200 : 404, data }
}

/**
 * @returns {{ code: number, data: Track[] }}
 */
exports.getRecommendTracks = async () => {
  const result = await get('everyday/recommend')
  const data = result.data.song_list.filter((item) => item.hash).map((item) => formatTrack(item))
  return { code: result.status === 1 ? 200 : 404, data }
}

/**
 * @returns {{ code: number, data: Artist[] }}
 */
exports.topArtists = async () => {
  let result = {}
  if (artistLists.data?.info.length) {
    result = artistLists
  } else {
    result = await get('artist/lists', { type: 0, hotsize: 30 })
  }
  const data = result.data.info
    .find((item) => item.title === '热门')
    .singer.map((item) => ({
      id: item.singerid,
      name: item.singername,
      picUrl: item.imgurl.replace('{size}', '256')
    }))
  return { code: result.status === 1 ? 200 : 404, data }
}

/**
 * @returns {{ code: number, hasMore: boolean, albums: Album[] }}
 */
exports.topAlbums = async () => {
  const result = await get('top/album', { timestamp: Date.now() })
  const data = result.data
  const albums = ['chn', 'eur', 'jpn', 'kor']
    .flatMap((key) => data?.[key] ?? [])
    .slice(0, 10)
    .map((item) => ({
      id: item.albumid,
      name: item.albumname,
      picUrl: item.imgurl.replace('{size}', '256')
    }))
  return { code: result.status === 1 ? 200 : 404, hasMore: false, albums }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.rankTop = async () => {
  const result = await get('rank/top', { timestamp: Date.now() })
  const data = result.data.list.map((item) => ({
    id: item.rankid,
    name: item.rankname,
    picUrl: item.imgurl.replace('{size}', '256'),
    playCount: item.play_times,
    copywriter: item.update_frequency,
    sourceContext: {},
    pluginId: ''
  }))
  return { code: result.status === 1 ? 200 : 404, data }
}

/**
 * @returns {{ code: number, data: Playlist[]}}
 */
exports.rankList = async () => {
  const res = await get('rank/list', { timestamp: Date.now() })

  const result = res.data.info.map((item) => ({
    id: item.rankid,
    name: item.rankname,
    picUrl: item.imgurl.replace('{size}', '256'),
    playCount: item.play_times,
    copywriter: item.update_frequency,
    pluginId: '',
    tracks: item.songinfo.map((it) => ({ name: it.name, artist: it.author })),
    sourceContext: {}
  }))

  const ids = [6666, 74534, 59896, 80025]
  const map = new Map(result.map((item) => [item.id, item]))
  const front = ids.map((id) => map.get(id)).filter(Boolean)
  const rest = result.filter((item) => !ids.includes(item.id))
  const data = [...front, ...rest]

  return { code: res.status === 1 ? 200 : 404, data }
}

/**
 * @returns {{ code: number, data: PlaylistDetail }}
 */
exports.getPlaylistDetail = async (params) => {
  const res = await get('playlist/detail', { ids: params.id })
  const playlist = res.data[0]
  const data = {
    id: playlist.global_collection_id,
    name: playlist.name,
    subscribed: collectedPlaylists.ids.includes(playlist.global_collection_id),
    picUrl: playlist.pic.replace('{size}', '512'),
    trackCount: playlist.count,
    updateTime: new Date(playlist.update_time * 1000).getTime(),
    description: playlist.intro,
    isPrivate: !!playlist.is_pri,
    pluginId: '',
    copywriter: '',
    updateFrequency: '',
    trackIds: [],
    tracks: [],
    tags: playlist.musiclib_tags.map((it) => it.tag_name),
    creator: {
      userId: playlist.list_create_userid,
      avatarUrl: playlist.create_user_pic,
      nickname: playlist.list_create_username
    },
    sourceContext: { id: playlist.global_collection_id, trackIds: [], loadedIDs: [] }
  }
  return { code: res.status === 1 ? 200 : 404, data }
}

exports.getPlaylistTracks = async (params) => {
  const { id, loadedIDs } = params.sourceContext
  const pagesize = 500
  const offset = loadedIDs.length

  const page = Math.floor(offset / pagesize) + 1
  const result = await get('playlist/track/all', { id, page, pagesize })
  const data = result.data.songs.filter((item) => item.hash).map((item) => formatTrack(item))
  return { code: result.status === 1 ? 200 : 404, data: data ?? [] }
}

exports.catlist = async () => {
  const result = await get('playlist/tags')
  const data = {
    static: [
      { id: 0, name: '全部', active: true },
      { id: 1084, name: '精选', active: false },
      { id: 12, name: '经典', active: false },
      { id: 1085, name: '官方歌单', active: false }
    ],
    tagList: result.data.map((item) => ({
      id: Number(item.tag_id),
      name: item.tag_name,
      sub: item.son.map((it) => ({
        id: Number(it.tag_id),
        name: it.tag_name,
        parentId: Number(it.parent_id)
      }))
    }))
  }

  return { code: result.status === 1 ? 200 : 404, data }
}

exports.getCategoryPlaylist = async (params) => {
  const result = await get('top/playlist', { category_id: params.id })
  const data = result.data.special_list.map((item) => ({
    id: item.global_collection_id,
    name: item.specialname,
    picUrl: item.imgurl.replace('{size}', '256'),
    playCount: item.play_count,
    copywriter: item.show ?? '',
    pluginId: '',
    sourceContext: {}
  }))
  return {
    code: result.status === 1 ? 200 : 404,
    hasMore: false,
    data,
    sourceContext: { id: params.id, name: params.name, offset: 0 }
  }
}

/**
 * 搜索功能
 * @param {Object} params
 * @returns {Array} 列表形式的搜索结果
 */
exports.search = (params) => get('search', { ...params })

/**
 * 获取歌词
 * @param {Object} params
 * @returns {LyricLine[]}
 */
exports.getLyric = async (params) => {
  const result = await get('search/lyric', { hash: params.hash })
  if (!result.candidates?.length) return []

  const { id, accesskey } = result.candidates[0]
  return get('lyric', { id, accesskey, fmt: 'krc', decode: true })
}

exports.userPlaylist = async () => {
  const result = await get('user/playlist')
  return result
}

/**
 * 创建歌单
 * @param {any}
 * @returns {{ stauts: string, pid: number | string }}
 */
exports.createPlaylist = () => {}

/**
 * 删除歌单
 * @param {any}
 * @param {'GET' | "POST"} method
 * @returns {boolean} 删除结果
 */
exports.deletePlaylist = () => {}

exports.vipStatus = async () => {
  const result = await get('user/vip/detail')
  return result
}

const registerDev = async () => {
  const result = await get('register/dev')
  if (result.status === 1) {
    const dfid = result.data.dfid
    apis.store.set('dfid', dfid)
  }
  return result
}

exports.registerDev = registerDev

exports.songUrl = (params) => get('song/url', { ...params })

exports.receiveVip = (params) => get('youth/day/vip', { ...params })

exports.upgradeVip = () => {}
