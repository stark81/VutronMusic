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
 * @property {(key: string) => Promise<any>} get
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
 * @typedef {'local' | 'online' | 'stream'} MusicType
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
 * @property {{ text: string, info?: Word[] }} tlyric
 * @property {{ text: string, info?: Word[] }} rlyric
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
 * @typedef {Object} User
 * @property {number} userId
 * @property {string} avatarUrl
 * @property {string} nickname
 */

/**
 * @typedef {Object} Playlist
 * @property {number} id
 * @property {string} name
 * @property {string} picUrl
 * @property {number} playCount
 * @property {{ name: string, artist: string }[]=} tracks
 * @property {string} pluginId
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

const setCookies = (cookieStr) => {
  const cookies = {}

  cookieStr.split(',').forEach((item) => {
    const [pair] = item.split(';')
    const [key, value] = pair.split('=')
    if (key && value) {
      cookies[key.trim()] = value.trim()
    }
  })

  apis.db.set()

  return cookies
}

/**
 * ========================================================================
 *                          下面的内容是目前插件所需的全部函数，
 *                          只需要按照自己插件的实际情况进行修
 *                             改即可，无需新增其他的内容
 * ========================================================================
 */

const user = { userId: 0, isVip: false }
let baseUrl = ''

apis.db.get().then((result) => {
  console.log('[netease get user]: ', result)
  user.userId = result.userId
  user.vipType = result.vipType
})

apis.store.get('').then((store) => {
  baseUrl = store.baseUrl
})

/**
 * @param {string} url
 * @param {Object=} params
 */
const get = async (url, params) => {
  try {
    const response = await apis.http.get(`${baseUrl}/${url}`, params)
    if (response.code === 301) {
      throw new Error('UNAUTHORIZED')
    }
    return response
  } catch (error) {
    if (error.response && error.response.code === 301) {
      throw new Error('UNAUTHORIZED')
    }
    throw error
  }
}

/**
 * @param {string} url
 * @param {Object=} data
 */
const post = async (url, data) => {
  const info = await apis.db.get()
  const { baseUrl } = info
  const headers = info['cookie-MUSIC_U'] ? { Cookie: info['cookie-MUSIC_U'] } : {}
  return apis.http.post(`${baseUrl}/${url}`, data, headers)
}

const isTrackPlayable = (track) => {
  const result = { playable: true, reason: '' }
  if (track.privilege?.pr > 0) return result
  if (user.userId !== 0 && track.privilege.cs) return result
  if (track.fee === 1 || track.privilege?.fee === 1) {
    if (user.userId !== 0 && user.vipType === 11) {
      result.playable = true
    } else {
      result.playable = false
      result.reason = 'VIP Only'
    }
  } else if (track.fee === 4 || track.privilege?.fee === 4) {
    result.playable = false
    result.reason = '付费专辑'
  } else if (track.noCopyrightRcmd !== null && track.noCopyrightRcmd !== undefined) {
    result.playable = false
    result.reason = '无版权'
  } else if (track.privilege?.st < 0 && user.userId !== 0) {
    result.playable = false
    result.reason = '已下架'
  }
  return result
}

/**
 * @param {any[]} tracks
 * @param {any[]} privileges
 */
const mapTrackPlayableStatus = (tracks, privileges) => {
  if (!tracks?.length) return []
  return tracks.map((t) => {
    const privilege = (privileges ?? []).find((item) => item.id === t.id) ?? {}
    if (t.privilege) {
      Object.assign(t.privilege, privilege)
    } else {
      t.privilege = privilege
    }
    const result = isTrackPlayable(t)
    t.playable = result.playable
    t.reason = result.reason
    return t
  })
}

/**
 * @returns {Track}
 */
const formatTrack = (item) => ({
  id: item.id,
  name: item.name,
  duration: item.dt,
  alias: item.alia ?? [],
  playable: item.playable,
  reason: item.reason,
  createTime: item.publishTime,
  no: item.no ?? 0,
  album: { id: item.al.id, name: item.al.name, picUrl: item.al.picUrl + '?param=256y256' },
  artists: item.ar.map((it) => ({ id: it.id, name: it.name, picUrl: '' })),
  picUrl: item.al.picUrl + '?param=256y256',
  pluginId: '',
  type: meta.type,
  sourceContext: {}
})

const meta = {
  name: '网易云',
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

/**
 * @returns {{ code: number, data: { url: string, qrcode: string } }}
 */
exports.loginQrKey = async () => {
  const result = await get('login/qr/key', { timestamp: Date.now() })
  if (result.code === 200) {
    result.data.url = `https://music.163.com/login?codekey=${result.data.unikey}`
  }
  return result
}

/**
 * @returns {{ code: number, message: string, user: User }}
 */
exports.loginQrCodeCheck = async (params) => {
  const result = await get('login/qr/check', { ...params, timestamp: Date.now() })
  if (result.code === 803) {
    result.cookie = result.cookie.replaceAll(' HTTPOnly', '')
    setCookies(result.cookie)
    const res = await post(`login/status?timestamp=${Date.now()}`)
    const profile = res.data.profile
    result.user = {
      userId: profile.userId,
      avatarUrl: profile.avatarUrl,
      nickname: profile.nickname,
      vipType: profile.vipType,
      signature: profile.signature
    }
  }
  return result
}

/**
 * 插件平台的登陆功能，登陆成功后，需要使用apis.store.set来保存所需的帐号相关信息
 */
exports.doLogin = async () => true

/**
 * @returns {{ code: number, data: Banner[] }}
 */
exports.getBanner = async () => {
  const result = await get('banner', { type: 0 })
  const banners = result.banners
    .filter((item) => item.typeTitle !== '广告')
    .map((item) => {
      const sourceId =
        item.typeTitle === '数字专辑' ? new URL(item.url).searchParams.get('id') : item.targetId

      let type = 'activity'
      if (['新歌首发', '热歌推荐'].includes(item.typeTitle)) {
        type = 'track'
      } else if (['新碟首发', '热碟推荐', '数字专辑'].includes(item.typeTitle)) {
        type = 'album'
      } else if (item.typeTitle === '歌单推荐') {
        type = 'playlist'
      } else if (item.typeTitle === 'MV首发') {
        type = 'mv'
      }

      return {
        id: item.targetId,
        picUrl: item.imageUrl,
        url: item.url,
        sourceId,
        type,
        typeTitle: item.typeTitle
      }
    })
  return { code: result.code, data: banners }
}

const getRecommendPlayList = async (limit, removePrivateRecommand) => {
  if (!user.userId) {
    console.log('====2=== 未登录', user)
  } else {
    console.log('=====', limit, removePrivateRecommand)
  }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.getRecommendPlaylist = async () => {
  getRecommendPlayList(10, false)
  const result = await get('personalized', { limit: 10 })
  const playlists = result.result.map((item) => ({
    id: item.id,
    name: item.name,
    picUrl: item.picUrl + '?param=256y256',
    playCount: item.playCount,
    copywriter: item.copywriter,
    pluginId: '',
    sourceContext: {}
  }))
  return { code: result.code, data: playlists }
}

/**
 * @returns {{ code: number, data: Track[] }}
 */
exports.getRecommendTracks = async () => {
  const result = await get('recommend/songs', { timestamp: Date.now() })
  const data = mapTrackPlayableStatus(result.data.dailySongs, result.data.privileges ?? [])
  const tracks = data.map((item) => formatTrack(item))
  return { code: result.code, data: tracks }
}

/**
 * @returns {{ code: number, data: Artist[] }}
 */
exports.topArtists = async () => {
  const result = await get('top/artists')
  const data = result.artists.map((item) => ({
    id: item.id,
    name: item.name,
    picUrl: item.picUrl + '?param=256y256'
  }))
  return { code: result.code, data }
}

/**
 * @returns {{ code: number, hasMore: boolean, albums: Album[] }}
 */
exports.topAlbums = async () => {
  const result = await get('album/new', { area: 'ALL', limit: 10, timestamp: Date.now() })
  return {
    code: result.code,
    hasMore: result.total > 10,
    albums: result.albums.map((item) => ({
      id: item.id,
      name: item.name,
      picUrl: item.picUrl + '?param=256y256'
    }))
  }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.rankTop = async () => {
  const ids = [19723756, 180106, 60198, 3812895, 60131]
  const result = await get('toplist', { timestamp: Date.now() })
  const data = result.list
    .filter((item) => ids.includes(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      picUrl: item.coverImgUrl + '?param=256y256',
      playCount: item.playCount,
      pluginId: '',
      copywriter: item.updateFrequency,
      sourceContext: {}
    }))
  return { code: result.code, data }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.rankList = async () => {
  const res = await get('toplist/detail', { timestamp: Date.now() })
  const data = res.list.map((item) => ({
    id: item.id,
    name: item.name,
    picUrl: item.coverImgUrl,
    playCount: item.playCount,
    copywriter: item.updateFrequency,
    pluginId: '',
    tracks: item.tracks.map((it) => ({ name: it.first, artist: it.second })),
    sourceContext: {}
  }))
  return { code: result.code, data }
}

/**
 * @returns {{ code: number, data: PlaylistDetail }}
 */
exports.getPlaylistDetail = async (params) => {
  const res = await get('playlist/detail', { id: params.id })
  const playlist = res.playlist
  playlist.tracks = mapTrackPlayableStatus(playlist.tracks, res.privileges ?? [])

  const trackIds = playlist.trackIds.map((item) => item.id)
  const tracks = playlist.tracks.map((item) => formatTrack(item))

  const data = {
    id: playlist.id,
    name: playlist.name,
    subscribed: !!playlist.subscribed,
    picUrl: playlist.coverImgUrl + '?param=512y512',
    trackCount: playlist.trackCount,
    updateTime: playlist.updateTime,
    description: playlist.description,
    isPrivate: playlist.privacy === 10,
    pluginId: '',
    copywriter: '',
    updateFrequency: playlist.updateFrequency,
    trackIds,
    tracks,
    tags: playlist.tags,
    creator: {
      userId: playlist.creator.userId,
      avatarUrl: playlist.creator.avatarUrl,
      nickname: playlist.creator.nickname
    },
    sourceContext: { id: playlist.id, trackIds, loadedIDs: tracks.map((item) => item.id) }
  }

  return { code: res.code, data }
}

exports.getPlaylistTracks = async (params) => {
  const { trackIds, loadedIDs } = params.sourceContext
  const ids = trackIds.filter((id) => !loadedIDs.includes(id)).join(',')
  const result = await get('song/detail', { ids })
  result.songs = mapTrackPlayableStatus(result.songs, result.privileges)
  const data = result.songs.map((item) => formatTrack(item))
  return { code: result.code, data }
}

exports.catlist = async () => {
  const result = await get('playlist/catlist')

  const cats = Object.entries(result.categories).map(([key, value]) => ({
    id: Number(key),
    name: value
  }))

  const data = {
    // static: ['全部', '推荐歌单', '精品歌单', '官方'],
    static: [
      { id: 0, name: '全部', active: true },
      { id: 0, name: '推荐歌单', active: false },
      { id: 0, name: '精品歌单', active: false },
      { id: 0, name: '官方', active: false }
    ],
    tagList: cats.map((item) => {
      const sub = result.sub
        .filter((s) => s.category === item.id)
        .map((s) => ({ id: 0, name: s.name, parentId: s.category }))
      return { ...item, sub }
    })
  }
  return { code: result.code, data }
}

exports.getCategoryPlaylist = async (params) => {
  if (params.name === '推荐歌单') {
    //
  } else if (params.name === '精品歌单') {
    //
  }
  const result = await get('top/playlist', { cat: params.name, offset: params.offset })
  const data = result.playlists.map((item) => ({
    id: item.id,
    name: item.name,
    picUrl: item.coverImgUrl + '?param=256y256',
    playCount: item.playCount,
    copywriter: '',
    pluginId: '',
    sourceContext: {}
  }))
  return {
    code: result.code,
    hasMore: result.more,
    data,
    sourceContext: { id: params.id, offset: params.offset }
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
  const data = await get(`lyric/new`, { id: params.id })
  return { code: 200, data }
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
