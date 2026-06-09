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
 * @typedef {'PluginData' | 'Track'} DBTable
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
 * @property {(key: DBTable) => Promise<any>} get
 * @property {(key: DBTable, value: any) => void} set
 */

/**
 * @typedef {Object} Utils
 * @property {(msg: string) => Promise<LyricLine[]>} parseLyric
 */

/**
 * @typedef {Object} PluginApi
 * @property {PluginHttp} http
 * @property {(msg: string) => void} log
 * @property {PluginStore} store
 * @property {DB} db - 仅支持登陆相关的数据保存与获取
 * @property {Utils} utils
 */

/**
 * =======================================================================================
 *                                     返回结果类型定义
 * =======================================================================================
 */

/**
 * @typedef {'local' | 'library' | 'stream'} MusicType
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
 * @property {string} pluginId
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} Album
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {Artist[]=} artists
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} Artist
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {Record<string, any>} sourceContext
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
 * @property {Artist[]} albumArtists
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
 * @property {{userId: string, avatarUrl: string,  nickname: string, isVip: boolean, signature: string}=} creator
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

/**
 * ========================================================================
 *                          下面的内容是目前插件所需的全部函数，
 *                          只需要按照自己插件的实际情况进行修
 *                             改即可，无需新增其他的内容
 * ========================================================================
 */

const user = { userId: 0, isVip: false, cookie: '' }
let baseUrl = ''
const limit = 50
const artistLists = { code: 0, artists: {} }

apis.db.get('PluginData').then((result) => {
  user.userId = result.userId
  user.vipType = result.vipType
  user.cookie = result.cookie
})

apis.store.get('').then((store) => {
  baseUrl = store.baseUrl

  get('top/artists', { limit: 30 }).then((result) => {
    artistLists.code = result.code
    artistLists.artists = result.artists
  })
})

/**
 * @param {string} cookieStr
 * @returns
 */
const setCookies = (cookieStr) => {
  const cookies = {}
  cookieStr.split(';;').forEach((item) => {
    const cookieKV = item.split(';')[0].split('=')
    cookies[cookieKV[0].trim()] = cookieKV[1].trim()
  })

  const result = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')

  return result
}

/**
 * @param {string} url
 * @param {Object=} params
 */
const get = async (url, params) => {
  try {
    const headers = user.cookie ? { Cookie: user.cookie } : {}
    const response = await apis.http.get(`${baseUrl}/${url}`, params, headers)
    if (response.code === 301) {
      user.userId = 0
      user.vipType = false
      user.cookie = ''
      apis.db.set('PluginData', data)
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
  try {
    const headers = user.cookie ? { Cookie: user.cookie } : {}
    const response = await apis.http.post(`${baseUrl}/${url}`, data, headers)
    if (response.code === 301) {
      user.userId = 0
      user.vipType = false
      user.cookie = ''
      apis.db.set('PluginData', data)
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
 * @param {any[]=} privileges
 */
const mapTrackPlayableStatus = (tracks = [], privileges = []) => {
  if (!tracks?.length) return []
  return tracks.map((t) => {
    const privilege = privileges.find((item) => item.id === t.id) ?? {}
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
const formatTrack = (item, size = 64) => {
  const artists = (item.ar || item.artists || [])?.map((it) => ({
    id: it.id,
    name: it.name || '',
    picUrl: it.img1v1Url ?? '',
    pluginId: '',
    sourceContext: { id: it.id }
  }))

  return {
    id: item.id,
    name: item.name,
    duration: item.dt ?? item.duration ?? 0,
    alias: item.alia ?? item.alias ?? [],
    playable: item.playable ?? false,
    reason: item.reason ?? '',
    createTime: item.publishTime || item.album?.publishTime || 0,
    no: item.no ?? 1,
    mvid: item.mvid ?? 0,
    playCount: item.playCount ?? -1,
    album: {
      id: item.al?.id ?? item.album?.id ?? '',
      name: item.al?.name ?? item.album?.name ?? '',
      pluginId: '',
      picUrl: item.al?.picUrl + '?param=256y256' ?? item.album?.picUrl + '?param=256y256' ?? '',
      sourceContext: { id: item.al?.id ?? item.album?.id ?? '' }
    },
    artists,
    albumArtists: artists,
    picUrl: (item.al || item.album)?.picUrl + `?param=${size}y${size}`,
    pluginId: '',
    type: meta.type,
    sourceContext: { id: item.id }
  }
}

/**
 * @returns {Album}
 */
const formatAlbum = (item, showArtists = false) => {
  const result = {
    id: item.id,
    name: item.name,
    picUrl: item.picUrl + '?param=256y256',
    pluginId: '',
    sourceContext: { id: item.id }
  }
  if (showArtists && item.artists) {
    result.artists = item.artists.map((it) => ({
      id: it.id,
      name: it.name,
      picUrl: it.picUrl || it.img1v1Url,
      pluginId: '',
      sourceContext: { id: it.id }
    }))
  }
  return result
}

const formatMv = (item) => ({
  id: item.id || item.vid,
  name: item.name || item.title,
  picUrl: item.imgurl16v9 || item.coverUrl || item.cover || '',
  publishTime: new Date(item.publishTime || 0).getTime(),
  pluginId: '',
  artists: (
    item.creator || [
      {
        id: item.artist?.id,
        name: item.artist?.name,
        picUrl: item.artist?.img1v1Url + '?param=256y256',
        pluginId: '',
        sourceContext: { id: item.artist?.id }
      }
    ]
  ).map((it) => ({
    id: it.userId || it.id,
    name: it.name || it.userName,
    picUrl: it.picUrl || '',
    pluginId: '',
    sourceContext: { id: it.id || it.userId }
  })),
  sourceContext: { id: item.id || item.vid }
})

const specialPlaylist = {
  2829816518: {
    name: '欧美私人订制',
    gradient: 'gradient-pink-purple-blue'
  },
  2890490211: {
    name: '助眠鸟鸣声',
    gradient: 'gradient-green'
  },
  5089855855: {
    name: '夜的胡思乱想',
    gradient: 'gradient-moonstone-blue'
  },
  2888212971: {
    name: '全球百大DJ',
    gradient: 'gradient-orange-red'
  },
  2829733864: {
    name: '睡眠伴侣',
    gradient: 'gradient-midnight-blue'
  },
  2829844572: {
    name: '洗澡时听的歌',
    gradient: 'gradient-yellow'
  },
  2920647537: {
    name: '还是会想你',
    gradient: 'gradient-dark-blue-midnight-blue'
  },
  2890501416: {
    name: '助眠白噪声',
    gradient: 'gradient-sky-blue'
  },
  5217150082: {
    name: '摇滚唱片行',
    gradient: 'gradient-yellow-red'
  },
  2829961453: {
    name: '古风音乐大赏',
    gradient: 'gradient-fog'
  },
  4923261701: {
    name: 'Trance',
    gradient: 'gradient-light-red-light-blue '
  },
  5212729721: {
    name: '欧美点唱机',
    gradient: 'gradient-indigo-pink-yellow'
  },
  3103434282: {
    name: '甜蜜少女心',
    gradient: 'gradient-pink'
  },
  2829896389: {
    name: '日系私人订制',
    gradient: 'gradient-yellow-pink'
  },
  2829779628: {
    name: '运动随身听',
    gradient: 'gradient-orange-red'
  },
  2860654884: {
    name: '独立女声精选',
    gradient: 'gradient-sharp-blue'
  },
  898150: {
    name: '浪漫婚礼专用',
    gradient: 'gradient-pink'
  },
  2638104052: {
    name: '牛奶泡泡浴',
    gradient: 'gradient-fog'
  },
  5317236517: {
    name: '后朋克精选',
    gradient: 'gradient-pink-purple-blue'
  },
  2821115454: {
    name: '一周原创发现',
    gradient: 'gradient-blue-purple'
  },
  2829883282: {
    name: '华语私人雷达',
    gradient: 'gradient-yellow-red'
  },
  3136952023: {
    name: '私人雷达',
    gradient: 'gradient-radar'
  }
}

/**
 * @returns {Playlist}
 */
const formatPlaylist = (item) => ({
  id: item.id,
  name: item.name,
  picUrl: (item.picUrl || item.coverImgUrl) + '?param=256y256',
  isMine: item.creator?.userId === user.userId,
  trackCount: item.trackIds?.length || item.trackCount || 0,
  playCount: item.playCount || item.playcount || 0,
  creator: {
    userId: item.creator?.userId || user.userId || '',
    avatarUrl: item.creator?.avatarUrl || '',
    nickname: item.creator?.nickname || user.nickname || '',
    isVip: [11, 110].includes(item.creator?.vipType),
    signature: item.creator?.signature || '',
    sourceContext: { userId: item.creator?.userId || '' }
  },
  isPrivate: item.privacy === 10,
  pluginId: '',
  copywriter: item.copywriter || '',
  sourceContext: { id: item.id }
})

const formatComment = (item) => {
  const _beReplied = item.beReplied?.[0]
  const _user = item.user
  return {
    id: item.commentId || '',
    content: item.content || '',
    time: item.time || 0,
    ipLocation: item.ipLocation?.location || '',
    owner: item.owner,
    liked: item.liked || false,
    likedCount: item.likedCount || 0,
    replyCount: item.replyCount || 0,
    parentCommentId: item.parentCommentId || 0,
    beReplied: _beReplied
      ? {
          id: _beReplied.commentId || '',
          content: _beReplied.content || '',
          beRepliedCommentId: _beReplied.beRepliedCommentId,
          nickname: _beReplied.user.nickname
        }
      : null,
    user: {
      id: _user.userId,
      nickname: _user.nickname,
      avatarUrl: _user.avatarUrl + '?param=64y64'
    },
    sourceContext: { id: item.commentId || '' }
  }
}

const meta = {
  name: '网易云',
  type: 'library' // library, stream
}

/**
 * - meta：插件的基础信息
 * - meta.name: 中英文均可，用来表示这个插件的数据来源；
 * - meta.type: library, local 或者 stream，表示插件类型是线上服务还是自建流媒体服务，作为本地音乐匹配的依据
 */
exports.meta = meta

/**
 * 平台连同性测试
 * @returns {boolean}
 */
exports.systemPing = async () => true
// {
//   const result = await get('user/account')
//   return { code: result?.code ?? 200, status: result.profile ? 'login' : 'logout' }
// }

/**
 * @returns {{ code: number, data: { url: string, qrcode: string } }}
 */
exports.loginQrKey = async () => {
  const result = await get('login/qr/key', { timestamp: Date.now() })
  const data = {
    url: `https://music.163.com/login?codekey=${result.data.unikey}`,
    qrcode: result.data.unikey
  }
  return { code: result?.code ?? 200, data }
}

/**
 * @returns {{ code: number, message: string, user: User }}
 */
exports.loginQrCodeCheck = async (params) => {
  const result = await get('login/qr/check', { ...params, timestamp: Date.now() })
  if (result.code === 803) {
    result.cookie = result.cookie.replaceAll(' HTTPOnly', '')

    const cookie = setCookies(result.cookie)
    user.cookie = cookie

    const res = await post(`login/status?timestamp=${Date.now()}`)
    const profile = res.data.profile

    const data = { userId: profile.userId, isVip: profile.vipType === 11, cookie }
    user.userId = profile.userId
    user.vipType = [11, 110].includes(profile.vipType)
    apis.db.set('PluginData', data)

    result.user = {
      userId: profile.userId,
      avatarUrl: profile.avatarUrl,
      nickname: profile.nickname,
      isVip: [11, 110].includes(profile.vipType),
      signature: profile.signature
    }
  }
  return result
}

exports.getAccount = () => {
  return { code: 200, baseUrl, userName: '', pwd: '' }
}

/**
 * 插件平台的登陆功能，登陆成功后，需要使用apis.store.set来保存所需的帐号相关信息
 */
exports.doLogin = async () => true

exports.doLogout = () => {
  try {
    user.userId = 0
    user.cookie = ''
    apis.db.set('PluginData', user)
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

/**
 * @returns {{ code: number, data: Banner[] }}
 */
exports.getBanner = async () => {
  const result = await get('banner', { type: 0 })
  if (result && result.code === 200) {
    const banners = result.banners
      .filter((item) => item.typeTitle !== '广告')
      .map((item) => {
        const url = new URL(item.url)
        const sourceId =
          item.typeTitle === '数字专辑'
            ? Number(url.searchParams.get('id') ?? url.pathname.split('/').pop())
            : item.targetId

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
          id: item.targetId || sourceId || 0,
          picUrl: item.imageUrl,
          url: item.url,
          sourceId,
          type,
          pluginId: '',
          typeTitle: item.typeTitle,
          sourceContext: { id: item.targetId || sourceId || 0 }
        }
      })
    return { code: result.code, data: banners }
  }
  return { code: result?.code ?? 200, data: [] }
}

const dailyRecommendPlaylist = async (removePrivateRecommand) => {
  const result = await get('recommend/resource')

  if (result && result.code === 200) {
    let recommend = result.recommend
    if (recommend.length) {
      if (removePrivateRecommand) recommend = recommend.slice(1)
      // await replaceRecommendResult(recommend)
    }
    const playlists = recommend.map(formatPlaylist)
    return playlists
  }
  return []
}

const recommendPlaylist = async (limit) => {
  const result = await get('personalized', { limit })
  if (result && result.code === 200) {
    const playlists = result.result.map(formatPlaylist)
    return playlists
  }
  return []
}

const getRecommendPlaylist = async (limit, removePrivateRecommand) => {
  if (user.cookie) {
    const playlists = await Promise.all([
      dailyRecommendPlaylist(removePrivateRecommand),
      recommendPlaylist(limit)
    ])
    const data = [...new Map(playlists[0].concat(playlists[1]).map((p) => [p.id, p])).values()]
    return { code: 200, data: data.slice(0, limit) }
  } else {
    const data = await recommendPlaylist(limit)
    return { code: 200, data }
  }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.getRecommendPlaylist = () => getRecommendPlaylist(10, false)

/**
 * @returns {{ code: number, data: Track[], sourceContext: Record<string, any> }}
 */
exports.getRecommendTracks = async () => {
  const result = await get('recommend/songs')
  if (result && result.code === 200) {
    const data = mapTrackPlayableStatus(result.data.dailySongs, result.data.privileges)
    const tracks = data.map((item) => formatTrack(item, 64))
    const sourceContext = { offset: tracks.length }
    return { code: result.code, data: tracks, sourceContext }
  } else {
    return { code: result?.code ?? 200, data: [], sourceContext: {} }
  }
}

/**
 * @returns {{ code: number, data: Artist[], sourceContext: Record<string, any> }}
 */
exports.topArtists = async (params) => {
  const { offset, reset } = params

  let result = null
  if (reset && artistLists.code === 200 && artistLists.artists?.length) {
    result = artistLists
  } else {
    result = await get('top/artists', { limit: 30, offset: offset ?? 0 })
  }

  if (result && result.code === 200) {
    const data = result?.artists.map((item) => ({
      id: item.id,
      name: item.name,
      pluginId: '',
      picUrl: item.picUrl + '?param=256y256',
      sourceContext: { id: item.id }
    }))
    return { code: result.code, data, sourceContext: { offset: (params?.offset ?? 0) + 30 } }
  }
  return { code: result?.code ?? 200, data: [], sourceContext: { offset: params?.offset ?? 0 } }
}

/**
 * @returns {{ code: number, hasMore: boolean, albums: Album[], sourceContext: Record<string, any> }}
 */
exports.topAlbums = async () => {
  const result = await get('album/new', { area: 'ALL', limit: 10 })
  if (result && result.code === 200) {
    return {
      code: result?.code,
      hasMore: result.total > 10,
      albums: result.albums.map((item) => formatAlbum(item, true)),
      sourceContext: {}
    }
  }
  return { code: result?.code ?? 200, hasMore: false, albums: [], sourceContext: {} }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.rankTop = async () => {
  const data = [
    {
      id: 19723756,
      name: '飙升榜',
      picUrl:
        'https://p3.music.126.net/rIi7Qzy2i2Y_1QD7cd0MYA==/109951170048506929.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      isMine: false,
      trackCount: -1,
      isPrivate: false,
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '刚刚更新',
      sourceContext: { id: 19723756 }
    },
    {
      id: 180106,
      name: 'UK排行榜周榜',
      picUrl:
        'https://p4.music.126.net/fhAqiflLy3eU-ldmBQByrg==/109951165613082765.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      isMine: false,
      trackCount: -1,
      isPrivate: false,
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '每天更新',
      sourceContext: { id: 180106 }
    },
    {
      id: 60198,
      name: '美国Billboard榜',
      picUrl:
        'https://p4.music.126.net/rwRsVIJHQ68gglhA6TNEYA==/109951165611413732.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      isMine: false,
      trackCount: -1,
      isPrivate: false,
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '每周三更新',
      sourceContext: { id: 60198 }
    },
    {
      id: 3812895,
      name: 'Beatport全球电子舞曲榜',
      picUrl:
        'https://p1.music.126.net/oT-RHuPBJiD7WMoU7WG5Rw==/109951166093489621.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      isMine: false,
      trackCount: -1,
      isPrivate: false,
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '每周三更新',
      sourceContext: { id: 3812895 }
    },
    {
      id: 60131,
      name: '日本Oricon榜',
      picUrl:
        'https://p3.music.126.net/aXUPgImt8hhf4cMUZEjP4g==/109951165611417794.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      isMine: false,
      trackCount: -1,
      isPrivate: false,
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '每天更新',
      sourceContext: { id: 60131 }
    }
  ]
  return { code: 200, data }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.rankList = async (params) => {
  if (params.loaded) {
    return { code: 200, data: [], sourceContext: params }
  }

  const res = await get('toplist/detail')
  if (res && res.code === 200) {
    const data = res.list.map((item) => ({
      id: item.id,
      name: item.name,
      picUrl: item.coverImgUrl,
      isMine: false,
      trackCount: item.trackCount,
      isPrivate: item.privacy === 10,
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: { userId: 0 }
      },
      playCount: item.playCount,
      copywriter: item.updateFrequency,
      pluginId: '',
      tracks: item.tracks.map((it) => ({ name: it.first, artist: it.second })),
      sourceContext: { id: item.id }
    }))
    return { code: 200, data, sourceContext: { loaded: true } }
  }
  return { code: res?.code ?? 200, data: [], sourceContext: params }
}

/**
 * @returns {{ code: number, data: PlaylistDetail }}
 */
exports.getPlaylistDetail = async (params) => {
  const res = await get('playlist/detail', { id: params.id })
  if (res && res.code === 200) {
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
      description: playlist.description || '',
      isPrivate: playlist.privacy === 10,
      pluginId: '',
      copywriter: '',
      updateFrequency: playlist.updateFrequency,
      specialPlaylistInfo: specialPlaylist[playlist.id] ?? null,
      trackIds,
      tracks,
      tags: playlist.tags,
      creator: {
        userId: playlist.creator.userId,
        avatarUrl: playlist.creator.avatarUrl,
        nickname: playlist.creator.nickname,
        isVip: [11, 110].includes(playlist.creator.vipType),
        signature: playlist.creator.signature,
        sourceContext: { userId: playlist.creator.userId }
      },
      sourceContext: { id: playlist.id, trackIds, loadedIDs: tracks.map((item) => item.id) }
    }

    return { code: res.code, data }
  }
  return { code: res?.code ?? 200, data: null }
}

exports.getPlaylistTracks = async (params) => {
  const { trackIds, loadedIDs } = params
  const ids = trackIds.filter((id) => !loadedIDs.includes(id)).join(',')
  const result = await get('song/detail', { ids })
  result.songs = mapTrackPlayableStatus(result.songs, result.privileges)
  const data = result.songs.map((item) => formatTrack(item))
  return {
    code: result?.code ?? 200,
    data,
    sourceContext: { trackIds, loadedIDs: [...loadedIDs, ...data.map((item) => item.id)] }
  }
}

exports.catlist = async () => {
  const result = await get('playlist/catlist')

  const cats = Object.entries(result.categories).map(([key, value]) => ({
    id: Number(key),
    name: value
  }))

  const data = {
    static: [
      {
        id: 0,
        name: '全部',
        sourceContext: { name: '全部', hasMore: true, offset: 0 }
      },
      {
        id: 0,
        name: '推荐歌单',
        sourceContext: { name: '推荐歌单', hasMore: true, offset: 0 }
      },
      {
        id: 0,
        name: '精品歌单',
        sourceContext: { name: '精品歌单', hasMore: true, offset: 0 }
      },
      {
        id: 0,
        name: '官方',
        sourceContext: { name: '官方', hasMore: true, offset: 0 }
      }
    ],
    tagList: cats.map((item) => {
      const sub = result.sub
        .filter((s) => s.category === item.id)
        .map((s) => ({
          id: 0,
          name: s.name,
          parentId: s.category,
          sourceContext: { name: s.name, hasMore: true, offset: 0 }
        }))
      return { ...item, sub }
    })
  }
  return { code: result?.code ?? 200, data }
}

const highQualityPlaylist = async (params) => {
  const { name, before } = params
  const result = await get('top/playlist/highquality', { limit, before })
  return {
    code: result.code ?? 200,
    data: result.playlists?.map(formatPlaylist) || [],
    sourceContext: { name, before: result.playlists.at(-1).updateTime }
  }
}

exports.getCategoryPlaylist = async (params) => {
  if (params.name === '推荐歌单') {
    if (!params.hasMore)
      return {
        code: 200,
        data: [],
        sourceContext: params
      }
    const result = await getRecommendPlaylist(100, true)
    return {
      ...result,
      sourceContext: { name: params.name, hasMore: false, offset: 100 }
    }
  } else if (params.name === '精品歌单') {
    return highQualityPlaylist(params)
  }

  const { name, hasMore, reset } = params
  if (!hasMore) return { code: 200, data: [], sourceContext: params }

  const offset = reset ? 0 : params.offset
  const result = await get('top/playlist', { cat: params.name, limit: 50, offset })
  const data = (result?.playlists || []).map(formatPlaylist)
  return {
    code: result?.code ?? 200,
    data,
    sourceContext: { name, hasMore: result.more || false, offset: offset + 50 }
  }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.userPlaylist = async (params) => {
  const uid = params.id ?? user.userId
  const offset = params.offset ?? 0
  const [result, res] = await Promise.all([
    get('user/playlist', { uid, limit, offset }),
    get('album/sublist', { limit })
  ])

  if (result && result.code === 200) {
    const playlists = result?.playlist.map(formatPlaylist)
    const liked = playlists.length ? playlists.splice(0, 1)[0] : null

    const albums = res.data.map((item) => ({
      id: item.id,
      name: item.name,
      picUrl: item.picUrl,
      artists: item.artists.map((it) => ({
        id: it.id,
        name: it.name,
        picUrl: it.picUrl,
        pluginId: '',
        sourceContext: { id: it.id }
      })),
      pluginId: '',
      sourceContext: { id: item.id }
    }))

    const sourceContext = { uid, offset: offset + limit }
    return { code: result?.code ?? 200, liked, playlists, albums, sourceContext }
  }

  return {
    code: result?.code ?? 200,
    liked: null,
    data: [],
    sourceContext: { uid, offset: offset + limit }
  }
}

exports.userLikedArtists = async () => {
  const result = await get('artist/sublist', { limit: 2000 })
  if (result && result.code === 200) {
    const data = result.data.map((item) => ({
      id: item.id,
      name: item.name,
      picUrl: item.picUrl,
      pluginId: '',
      sourceContext: { id: item.id }
    }))
    return { code: result.code, data, sourceContext: {} }
  }
  return { code: result?.code ?? 200, data: [], sourceContext: {} }
}

exports.userLikedMVs = async () => {
  const result = await get('mv/sublist', { limit: 1000 })
  if (result && result.code === 200) {
    const data = result.data.map(formatMv)
    return { code: result.code, data, sourceContext: {} }
  }
  return { code: result?.code ?? 200, data: [], sourceContext: {} }
}

exports.cloudDisk = async (params) => {
  const offset = params.offset || 0
  const result = await get('user/cloud', { limit, offset })
  if (result && result.code === 200) {
    const data = result.data.map((item) => formatTrack(item.simpleSong))
    return { code: result.code, data, sourceContext: { offset: offset + limit } }
  }
  return { code: result?.code ?? 200, data: [], sourceContext: { offset: offset + limit } }
}

const formatAlbumDetail = (result) => {
  const songs = result.songs.map((item) => formatTrack(item, 64))
  const item = result.album
  return {
    id: item.id,
    name: item.name,
    picUrl: item.picUrl + '?param=512y512',
    type: item.type,
    isExplicit: item.mark === 1048576,
    subscribed: false,
    publishTime: new Date(item.publishTime).getTime(),
    size: item.size,
    company: item.company,
    description: item.description,
    songs,
    artists: item.artists.map((it) => ({
      id: it.id,
      name: it.name || '',
      picUrl: it.img1v1Url || '',
      pluginId: '',
      sourceContext: { id: it.id }
    })),

    pluginId: '',
    sourceContext: { id: item.id }
  }
}

exports.albumDetail = async (params) => {
  const result = await get('album', { id: params.id })
  if (result.code === 200) {
    const album = formatAlbumDetail(result)
    return { code: 200, data: album }
  }
  return { code: 404, data: null }
}

exports.artistAlbums = async (params) => {
  const { id, offset } = params
  const result = await get('artist/album', { id, limit: 200, offset: offset || 0 })
  if (result.code === 200) {
    const data = result.hotAlbums.map((item) => {
      let type = item.type
      if (item.type === 'EP/Single') {
        type = item.size === 1 ? '单曲' : 'EP'
      } else if (item.type === 'Single') {
        type = '单曲'
      } else if (item.type === '未知') {
        type = '其他'
      } else if (item.type === 'DEMO') {
        type = '其他'
      }

      return {
        id: item.id,
        name: item.name,
        picUrl: item.picUrl + '?param=256y256',
        createTime: new Date(item.publishTime).getTime(),
        copywriter: `${item.type} · ${new Date(item.publishTime).getFullYear()}`,
        type,
        pluginId: '',
        sourceContext: { id: item.id }
      }
    })
    return { code: 200, data, sourceContext: { id, offset: (offset || 0) + 1 } }
  }
  return { code: 404, data: [], sourceContext: { id, offset: (offset || 0) + 1 } }
}

/**
 * 搜索功能
 * @param {Object} params
 * @returns {Array} 列表形式的搜索结果
 */
exports.search = async (params) => {
  const { tab, keywords, page: _page = 1, reset = true, count = 0 } = params
  const page = reset ? 1 : _page

  if (!reset && count && page * 50 >= count) {
    return { code: 200, data: [], count, sourceContext: params }
  }

  const map = {
    tracks: 1,
    albums: 10,
    artists: 100,
    playlists: 1000,
    mvs: 1004,
    lyrics: 1006
  }

  const type = map[tab]
  const limit = 50
  const offset = (page - 1) * 50
  const result = await get('search', { type, keywords, limit, offset })

  if (result.code === 200) {
    if (tab === 'tracks') {
      const ids = result.result.songs.map((item) => item.id).join(',')
      const res = await get('song/detail', { ids })

      res.songs = mapTrackPlayableStatus(res.songs, res.privileges)
      const data = res.songs.map((item) => formatTrack(item, 64))

      return {
        code: 200,
        data,
        count: result.result.songCount,
        sourceContext: { keywords, page: page + 1, count: result.result.songCount }
      }
    } else if (tab === 'albums') {
      const data = result.result.albums.map((item) => formatAlbum(item, true))
      return {
        code: 200,
        data,
        count: result.result.albumCount,
        sourceContext: { keywords, page: page + 1, count: result.result.albumCount }
      }
    } else if (tab === 'artists') {
      const data = result.result.artists.map((item) => ({
        id: item.id,
        name: item.name,
        picUrl: (item.picUrl || item.img1v1Url) + '?param=256y256',
        pluginId: '',
        sourceContext: { id: item.id }
      }))
      return {
        code: 200,
        data,
        count: result.result.artistCount,
        sourceContext: { keywords, page: page + 1, count: result.result.artistCount }
      }
    } else if (tab === 'playlists') {
      const data = result.result.playlists.map(formatPlaylist)
      return {
        code: 200,
        data,
        count: result.result.playlistCount,
        sourceContext: { keywords, page: page + 1, count: result.result.playlistCount }
      }
    } else if (tab === 'mvs') {
      const data = result.result.mvs.map(formatMv)
      return {
        code: 200,
        data,
        count: result.result.mvCount,
        sourceContext: { keywords, page: page + 1, count: result.result.mvCount }
      }
    }
  }
  return { code: 404, data: [], count: 0, sourceContext: {} }
}

/**
 * 获取歌词
 * @param {Object} params
 * @returns {LyricLine[]}
 */
exports.getLyric = async (params) => {
  const result = await get(`lyric/new`, { id: params.id })
  const data = await apis.utils.parseLyric(result)
  return { code: 200, data }
}

exports.resizePicUrl = (params) => {
  const { url, size } = params
  const u = new URL(url)
  u.searchParams.set('param', `${size}y${size}`)
  return { code: 200, data: u.href }
}

exports.getTrackDetail = async (params) => {
  const sources = params.tracks
  const size = sources.length === 1 ? 512 : 256
  const ids = sources.map((item) => item.id).join(',')

  const result = await get('song/detail', { ids })
  if (result.code === 200) {
    result.songs = mapTrackPlayableStatus(result.songs, result.privileges)
    const songs = result.songs.map((item) => formatTrack(item, size))
    return { code: 200, data: songs || [] }
  }
  return { code: 404, data: [] }
}

exports.songUrl = async (params) => {
  const result = await get('song/url', { id: params.id, br: 999000 })

  if (result.code === 200) {
    const item = result.data[0]
    let url = [item.url]
    const replayGain = item.gain || 0
    const peak = item.peak || 1
    if (!item || !item.url || item.freeTrialInfo !== null) {
      const res = await get('unblock/song/url', { id: params.id })
      if (res.url) {
        url = [`vutron://get-online-music/${res.url}`]
      }
    }

    return { code: 200, data: { url, replayGain, peak } }
  }
  return { code: 200, data: { url: [], replayGain: 0, peak: 1 } }
}

exports.addOrRemoveTracksToPlaylist = async (params) => {
  const { op, playlist, tracks } = params
  const result = await get('playlist/tracks', {
    op,
    pid: playlist.id,
    tracks: tracks.map((t) => t.id).join(','),
    timestamp: Date.now()
  })
  return { code: result.code || result.body.code }
}

exports.likeATrack = async (params) => {
  const { op, tracks } = params
  const result = await get('like', { like: op === 'add', id: tracks[0].id })
  return { code: result.code }
}

/**
 * 创建歌单
 * @param {any}
 * @returns {{ stauts: string, pid: number | string }}
 */
exports.createPlaylist = async (params) => {
  const { name, isPrivate } = params
  const result = await get('playlist/create', { name, privacy: isPrivate ? '10' : '0' })
  if (result.code === 200) {
    const data = formatPlaylist(result.playlist)
    return { code: 200, data }
  }
  return { code: 404 }
}

exports.deletePlaylist = async (params) => {
  const result = await get('playlist/delete', { id: params.id })
  return { code: result.code }
}

/**
 * @param {Object} params
 * @param {number} params.id
 * @param {'add' | 'del'} params.op
 */
exports.subscribePlaylist = async (params) => {
  const { id, op } = params
  const map = {
    add: 1,
    del: 2
  }
  const result = await get('playlist/subscribe', {
    id,
    t: map[op],
    timestamp: new Date().getTime()
  })
  return { code: result.code }
}

exports.subscribeAlbum = async (params) => {
  const { id, op } = params
  const map = {
    add: 1,
    del: 2
  }
  const result = await get('album/sub', { id, t: map[op] })
  return { code: result.code }
}

exports.artistDetail = async (params) => {
  const result = await get('artists', { id: params.id, timestamp: Date.now() })
  if (result.code === 200) {
    const item = result.artist
    const artist = {
      id: item.id,
      name: item.name,
      picUrl: (item.picUrl || item.img1v1Url) + '?param=256y256',
      musicSize: item.musicSize,
      albumSize: item.albumSize,
      mvSize: item.mvSize,
      description: item.briefDesc,
      followed: item.followed,
      pluginId: '',
      sourceContext: { id: item.id }
    }
    const songs = result.hotSongs.map((item) => formatTrack(item, 64))
    return { code: 200, artist, songs, sourceContext: { id: params.id } }
  }
  return { code: 200, artist: null, songs: [], sourceContext: { d: params.id } }
}

exports.artistMVs = async (params) => {
  const { id, limit = 10, offset = 0, hasMore = true } = params
  if (!hasMore) {
    return { code: 200, data: [], sourceContext: params }
  }

  const result = await get('artist/mv', { id, limit, offset })
  if (result.code === 200) {
    const data = result.mvs.map(formatMv)
    return { code: 200, data, sourceContext: { id, hasMore: result.hasMore } }
  }
  return { code: 200, data: [], sourceContext: params }
}

exports.simiArtists = async (params) => {
  const result = await get('simi/artist', { id: params.id })
  if (result.code === 200) {
    const data = result.artists.map((item) => ({
      id: item.id,
      name: item.name,
      pluginId: '',
      picUrl: item.picUrl + '?param=256y256',
      sourceContext: { id: item.id }
    }))
    return { code: 200, data, sourceContext: {} }
  }
  return { code: 404, data: [], sourceContext: {} }
}

exports.followArtist = async (params) => {
  const { op, id } = params
  const result = await get('artist/sub', { id, t: op === 'follow' ? 1 : 0 })
  return { code: result.code }
}

exports.getTrackCatlist = () => ({
  code: 200,
  data: [
    { name: '全部', code: 0, sourceContext: { name: '全部', code: 0 } },
    { name: '华语', code: 7, sourceContext: { name: '华语', code: 7 } },
    { name: '欧美', code: 96, sourceContext: { name: '欧美', code: 96 } },
    { name: '日本', code: 8, sourceContext: { name: '日本', code: 8 } },
    { name: '韩国', code: 16, sourceContext: { name: '韩国', code: 16 } }
  ]
})

exports.topSong = async (params) => {
  if (params.hasMore === false && !params.reset) {
    return { code: 200, data: [], sourceContext: params }
  }

  const result = await get('top/song', { type: params.code })
  if (result.code === 200) {
    const items = mapTrackPlayableStatus(result.data)
    const data = items.map((item) => formatTrack(item, 64))
    return { code: 200, data, sourceContext: { ...params, hasMore: false } }
  }
  return { code: result?.code ?? 200, data: [], sourceContext: params }
}

exports.getAlbumCatlist = () => ({
  code: 200,
  data: [
    { name: '全部', code: 'ALL', sourceContext: { name: '全部', code: 'ALL' } },
    { name: '华语', code: 'ZH', sourceContext: { name: '华语', code: 'ZH' } },
    { name: '欧美', code: 'EA', sourceContext: { name: '欧美', code: 'EA' } },
    { name: '日本', code: 'JP', sourceContext: { name: '日本', code: 'JP' } },
    { name: '韩国', code: 'KR', sourceContext: { name: '韩国', code: 'KR' } }
  ]
})

exports.newAlbums = async (params) => {
  if (params.hasMore === false && !params.reset) {
    return { code: 200, data: [], sourceContext: params }
  }
  const offset = params.reset ? 0 : params.offset || 0
  const result = await get('album/new', { area: params.code, limit: 100, offset })
  if (result.code === 200 && result.albums?.length) {
    const data = result.albums.map((item) => formatAlbum(item, true))
    return { code: 200, data, sourceContext: { ...params, offset: offset + 100 } }
  }
  return { code: 200, data: [], sourceContext: { ...params, hasMore: false } }
}

exports.getArtistCatlist = () => ({
  code: 200,
  data: [
    {
      name: '语种',
      code: 'area',
      sub: [
        { name: '全部', code: '-1', sourceContext: { name: '全部', code: '-1' } },
        { name: '华语', code: '7', sourceContext: { name: '华语', code: '7' } },
        { name: '欧美', code: '96', sourceContext: { name: '欧美', code: '96' } },
        { name: '日本', code: '8', sourceContext: { name: '日本', code: '8' } },
        { name: '韩国', code: '16', sourceContext: { name: '韩国', code: '16' } },
        { name: '其他', code: '0', sourceContext: { name: '其他', code: '0' } }
      ]
    },
    {
      name: '分类',
      code: 'type',
      sub: [
        { name: '全部', code: '-1', sourceContext: { name: '全部', code: '-1' } },
        { name: '男歌手', code: '1', sourceContext: { name: '男歌手', code: '1' } },
        { name: '女歌手', code: '2', sourceContext: { name: '女歌手', code: '2' } },
        { name: '组合/乐队', code: '3', sourceContext: { name: '组合/乐队', code: '3' } }
      ]
    },
    {
      name: '筛选',
      code: 'initial',
      sub: [
        { name: '热门', code: '-1', sourceContext: { name: '热门', code: '-1' } },
        { name: '#', code: '0', sourceContext: { name: '#', code: '0' } },
        { name: 'A', code: 'a', sourceContext: { name: 'A', code: 'a' } },
        { name: 'B', code: 'b', sourceContext: { name: 'B', code: 'b' } },
        { name: 'C', code: 'c', sourceContext: { name: 'C', code: 'c' } },
        { name: 'D', code: 'd', sourceContext: { name: 'D', code: 'd' } },
        { name: 'E', code: 'e', sourceContext: { name: 'E', code: 'e' } },
        { name: 'F', code: 'f', sourceContext: { name: 'F', code: 'f' } },
        { name: 'G', code: 'g', sourceContext: { name: 'G', code: 'g' } },
        { name: 'H', code: 'h', sourceContext: { name: 'H', code: 'h' } },
        { name: 'I', code: 'i', sourceContext: { name: 'I', code: 'i' } },
        { name: 'J', code: 'j', sourceContext: { name: 'J', code: 'j' } },
        { name: 'K', code: 'k', sourceContext: { name: 'K', code: 'k' } },
        { name: 'L', code: 'l', sourceContext: { name: 'L', code: 'l' } },
        { name: 'M', code: 'm', sourceContext: { name: 'M', code: 'm' } },
        { name: 'N', code: 'n', sourceContext: { name: 'N', code: 'n' } },
        { name: 'O', code: 'o', sourceContext: { name: 'O', code: 'o' } },
        { name: 'P', code: 'p', sourceContext: { name: 'P', code: 'p' } },
        { name: 'Q', code: 'q', sourceContext: { name: 'Q', code: 'q' } },
        { name: 'R', code: 'r', sourceContext: { name: 'R', code: 'r' } },
        { name: 'S', code: 's', sourceContext: { name: 'S', code: 's' } },
        { name: 'T', code: 't', sourceContext: { name: 'T', code: 't' } },
        { name: 'U', code: 'u', sourceContext: { name: 'U', code: 'u' } },
        { name: 'V', code: 'v', sourceContext: { name: 'V', code: 'v' } },
        { name: 'W', code: 'w', sourceContext: { name: 'W', code: 'w' } },
        { name: 'X', code: 'x', sourceContext: { name: 'X', code: 'x' } },
        { name: 'Y', code: 'y', sourceContext: { name: 'Y', code: 'y' } },
        { name: 'Z', code: 'z', sourceContext: { name: 'Z', code: 'z' } }
      ]
    }
  ]
})

exports.artistsList = async (_params) => {
  if (_params.hasMore === false && _params.reset) {
    return { code: 200, data: [], sourceContext: _params }
  }

  const params = {}
  _params?.query?.forEach((item) => {
    const code = item.code
    const tag = item.tag
    params[code] = { code: tag.code, name: tag.name }
  })
  const offset = _params.offset || 0

  const result = await get('artist/list', {
    area: params.area.code,
    type: params.type.code,
    initial: params.initial.code,
    limit: 100,
    offset
  })

  if (result.code === 200) {
    const data = result.artists.map((item) => ({
      id: item.id,
      name: item.name,
      pluginId: '',
      picUrl: item.picUrl + '?param=256y256',
      sourceContext: { id: item.id }
    }))
    return { code: 200, data, sourceContext: { query: _params.query, offset: offset + 100 } }
  }

  return { code: 200, data: [], sourceContext: _params }
}

exports.scrobble = async () => ({ code: 200 })

exports.mvDetail = async (params) => {
  const [result, result1] = await Promise.all([
    get('mv/detail', { mvid: params.id }),
    get('mv/detail/info', { mvid: params.id })
  ])

  if (result.code === 200) {
    const item = result.data
    const request = item.brs.map((item) => get('mv/url', { id: params.id, r: item.br }))
    const res = await Promise.all(request)
    const sources = res.map((item) => ({
      url: item.data.url,
      type: 'video/mp4',
      quality: String(item.data.r)
    }))

    const data = {
      id: item.id,
      name: item.name,
      desc: item.briefDesc,
      publishTime: new Date(item.publishTime).getTime(),
      playCount: item.playCount,

      subCount: item.subCount,
      subed: result.subed,
      likedCount: result1.likedCount || 0,
      liked: result1.liked || false,
      hasComment: true,

      picUrl: item.cover + '?param=512y512',
      sources,
      artists: item.artists.map((it) => ({
        id: it.id,
        name: it.name,
        picUrl: it.img1v1Url + '?param=256y256',
        pluginId: '',
        sourceContext: { id: it.id }
      })),
      pluginId: '',
      sourceContext: { id: item.id }
    }
    return { code: 200, data }
  }
  return { code: 200, data: null }
}

exports.likeAMV = async (params) => {
  try {
    await get('resource/like', { id: params.id, type: 1, t: params.t })
    return { code: 200 }
  } catch (error) {
    console.error(error)
    return { code: 404 }
  }
}

exports.subAMV = async (params) => {
  try {
    await get('mv/sub', { mvid: params.id, t: params.t })
    return { code: 200 }
  } catch (error) {
    console.error(error)
    return { code: 404 }
  }
}

const tabs = [
  { name: '推荐', code: 99, active: true },
  { name: '最热', code: 2, active: false },
  { name: '最新', code: 3, active: false }
]

exports.getCommentTab = () => ({ code: 200, data: tabs })

const commentType = {
  track: 0,
  mv: 1,
  playlist: 2,
  album: 3
}

const sortMap = {
  推荐: 99,
  最热: 2,
  最新: 3
}

const sortMap1 = {
  99: '推荐',
  2: '最热',
  3: '最新'
}

function isNumeric(str) {
  if (typeof str !== 'string') return false
  const trimmed = str.trim()
  if (trimmed === '') return false
  const num = Number(trimmed)
  return !isNaN(num) && isFinite(num)
}

/**
 * @param {Object} params
 * @param {number} params.id
 * @param {number} params.pageNo
 * @param {number} params.cursor
 * @param {boolean} params.hasMore
 * @param {'track' | 'mv' | 'playlist' | 'album'} params.type
 * @param {"推荐" | "最热" | "最新"} params.sortType
 */
exports.getComments = async (params) => {
  try {
    const {
      id,
      reset = true,
      pageNo: _pageNo = 1,
      cursor: _cursor = 0,
      hasMore = true,
      type: _type = 'track',
      sortType: _sortType = '推荐'
    } = params

    let sortType = sortMap[_sortType]
    let pageNo = reset ? 1 : _pageNo
    let cursor = isNumeric(_cursor) ? _cursor : 0

    if (!hasMore && sortType !== 99) {
      return { code: 200, data: [], count: 0, sourceContext: params }
    } else if (!hasMore && sortType === 99) {
      sortType = 3
      pageNo = 1
      cursor = 0
    }

    const type = commentType[_type]
    const pageSize = 50

    let result = await get('comment/new', { id, type, sortType, pageSize, pageNo, cursor })
    const count = result.data.totalCount
    let data = result.data.comments.map(formatComment)

    if (sortType === 99 && !data.length) {
      sortType = 3
      result = await get('comment/new', { id, type, sortType, pageSize, pageNo, cursor })
      data = result.data.comments.map(formatComment)
    }

    return {
      code: result.code,
      data,
      count,
      sourceContext: {
        type: _type,
        pageNo: pageNo + 1,
        cursor: result.data.cursor,
        sortType: sortMap1[sortType],
        hasMore: result.data.hasMore
      }
    }
  } catch (error) {
    console.log('[netease getComments]: ', error)
    return { code: 404, data: [], count: 0, sourceContext: params }
  }
}

/**
 * @param {Object} params
 * @param {Record<string, any>} params.sourceContext
 * @param {Record<string, any>} params.commentInfo
 * @param {boolean} params.currentStatus
 * @param {'track' | 'mv' | 'playlist' | 'album'} params.type
 */
exports.likeAComment = async (params) => {
  try {
    const { sourceContext, commentInfo, currentStatus, type: _type } = params
    const id = sourceContext.id
    const cid = commentInfo.id
    const type = commentType[_type]
    const t = currentStatus ? 0 : 1
    const result = await get('comment/like', { id, cid, type, t })
    return { code: result.code }
  } catch (error) {
    console.log('[netease likeAComment]: ', error)
    return { code: 404 }
  }
}

const submitType = {
  del: 0,
  sub: 1,
  reply: 2
}

exports.submitAComment = async (params) => {
  try {
    const { id, type: _type, comment: _comment, t: _t, commentId } = params
    const type = commentType[_type]

    const _data = { t: submitType[_t], type, id }
    if (['sub', 'reply'].includes(_t)) {
      _data.content = _comment
    } else if (_t === 'del') {
      _data.commentId = commentId
    }
    if (commentId) _data.commentId = commentId

    const result = await get('comment', _data)
    if (result.code !== 200) {
      throw new Error('submit comment error')
    }

    const data = result.comment ? formatComment(result.comment) : null
    return { code: 200, data }
  } catch (error) {
    console.log('[netease submitAComment]: ', error)
    return { code: 404, data: null }
  }
}

exports.getFloorComments = async (params) => {
  try {
    const { sourceContext, commentInfo, type: _type } = params
    const { id, time = 0, hasMore = true } = sourceContext
    const parentCommentId = commentInfo.id

    if (!hasMore) {
      return { code: 200, data: [], count: 0, sourceContext: params }
    }

    const type = commentType[_type]
    const result = await get('comment/floor', { id, parentCommentId, type, limit: 50, time })

    const comments = result.data.comments.map(formatComment)

    return {
      code: 200,
      data: comments,
      count: result.data.totalCount,
      sourceContext: { time: result.data.time, hasMore: result.data.hasMore }
    }
  } catch {
    return { code: 200, data: [], count: 0, sourceContext: params }
  }
}
