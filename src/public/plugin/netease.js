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

apis.db.get('PluginData').then((result) => {
  user.userId = result.userId
  user.vipType = result.vipType
  user.cookie = result.cookie
})

apis.store.get('').then((store) => {
  baseUrl = store.baseUrl
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
  const headers = user.cookie ? { Cookie: user.cookie } : {}
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
  duration: item.dt ?? 0,
  alias: item.alia ?? [],
  playable: item.playable ?? false,
  reason: item.reason ?? '',
  createTime: item.publishTime,
  no: item.no ?? 1,
  mvid: item.mvid ?? 0,
  playCount: item.playCount ?? -1,
  album: {
    id: item.al.id,
    name: item.al.name,
    picUrl: item.al.picUrl + '?param=256y256',
    sourceContext: { id: item.al.id }
  },
  artists:
    item.ar?.map((it) => ({
      id: it.id,
      name: it.name,
      picUrl: '',
      sourceContext: { id: it.id }
    })) || [],
  picUrl: item.al.picUrl + '?param=256y256',
  pluginId: '',
  type: meta.type,
  sourceContext: { id: item.id }
})

/**
 * @returns {Album}
 */
const formatAlbum = (item, showArtists = false) => {
  const result = {
    id: item.id,
    name: item.name,
    picUrl: item.picUrl + '?param=256y256',
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
  playCount: item.playCount,
  creator: {
    userId: item.creator?.userId || '',
    avatarUrl: item.creator?.avatarUrl || '',
    nickname: item.creator?.nickname || '',
    isVip: [11, 110].includes(item.creator?.vipType),
    signature: item.creator?.signature || '',
    sourceContext: { userId: item.creator?.userId || '' }
  },
  pluginId: '',
  copywriter: item.copywriter || '',
  sourceContext: { id: item.id }
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

/**
 * 插件平台的登陆功能，登陆成功后，需要使用apis.store.set来保存所需的帐号相关信息
 */
exports.doLogin = async () => true

/**
 * @returns {{ code: number, data: Banner[] }}
 */
exports.getBanner = async () => {
  const result = await get('banner', { type: 0 })
  if (result && result.code === 200) {
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
          typeTitle: item.typeTitle,
          sourceContext: { id: item.targetId }
        }
      })
    return { code: result.code, data: banners }
  }
  return { code: result?.code ?? 200, data: [] }
}

// const getRecommendPlayList = async (limit, removePrivateRecommand) => {
//   if (!user.userId) {
//     console.log('====2=== 未登录', user)
//   } else {
//     console.log('=====', limit, removePrivateRecommand)
//   }
// }

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.getRecommendPlaylist = async () => {
  // getRecommendPlayList(10, false)
  const result = await get('personalized', { limit: 10 })
  if (result && result.code === 200) {
    const playlists = result.result.map(formatPlaylist)
    return { code: result.code, data: playlists }
  }
  return { code: result?.code ?? 200, data: [] }
}

/**
 * @returns {{ code: number, data: Track[], sourceContext: Record<string, any> }}
 */
exports.getRecommendTracks = async () => {
  const result = await get('recommend/songs')
  if (result && result.code === 200) {
    const data = mapTrackPlayableStatus(result.data.dailySongs, result.data.privileges)
    const tracks = data.map(formatTrack)
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
  const result = await get('top/artists', { limit, offset: params?.offset ?? 0 })
  if (result && result.code === 200) {
    const data = result?.artists.map((item) => ({
      id: item.id,
      name: item.name,
      picUrl: item.picUrl + '?param=256y256',
      sourceContext: { id: item.id }
    }))
    return { code: result.code, data, sourceContext: { offset: (params?.offset ?? 0) + limit } }
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
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '刚刚更新',
      sourceContext: {}
    },
    {
      id: 180106,
      name: 'UK排行榜周榜',
      picUrl:
        'https://p4.music.126.net/fhAqiflLy3eU-ldmBQByrg==/109951165613082765.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '每天更新',
      sourceContext: {}
    },
    {
      id: 60198,
      name: '美国Billboard榜',
      picUrl:
        'https://p4.music.126.net/rwRsVIJHQ68gglhA6TNEYA==/109951165611413732.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '每周三更新',
      sourceContext: {}
    },
    {
      id: 3812895,
      name: 'Beatport全球电子舞曲榜',
      picUrl:
        'https://p1.music.126.net/oT-RHuPBJiD7WMoU7WG5Rw==/109951166093489621.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '每周三更新',
      sourceContext: {}
    },
    {
      id: 60131,
      name: '日本Oricon榜',
      picUrl:
        'https://p3.music.126.net/aXUPgImt8hhf4cMUZEjP4g==/109951165611417794.jpg?param=256y256',
      playCount: 0,
      pluginId: '',
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '每天更新',
      sourceContext: {}
    }
  ]
  return { code: 200, data }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.rankList = async () => {
  const res = await get('toplist/detail')
  if (res && res.code === 200) {
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
    return { code: 200, data }
  }
  return { code: res?.code ?? 200, data: [] }
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
  return { code: result?.code ?? 200, data }
}

exports.getCategoryPlaylist = async (params) => {
  if (params.name === '推荐歌单') {
    //
  } else if (params.name === '精品歌单') {
    //
  }
  const result = await get('top/playlist', { cat: params.name, offset: params.offset })
  const data = (result?.playlists || []).map(formatPlaylist)
  return {
    code: result?.code ?? 200,
    hasMore: result.more,
    data,
    sourceContext: { id: params.id, offset: params.offset }
  }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.userPlaylist = async (params) => {
  const uid = params.id ?? user.userId
  const offset = params.offset ?? 0
  const result = await get('user/playlist', { uid, limit, offset })

  if (result && result.code === 200) {
    const playlists = result?.playlist.map(formatPlaylist)
    const liked = playlists.length ? playlists.splice(0, 1)[0] : null
    const sourceContext = { uid, offset: offset + limit }
    return { code: result?.code ?? 200, liked, data: playlists, sourceContext }
  }

  return {
    code: result?.code ?? 200,
    liked: null,
    data: [],
    sourceContext: { uid, offset: offset + limit }
  }
}

/**
 * @returns {{ code: number, data: Album[] }}
 */
exports.userLikedAlbums = async () => {
  const result = await get('album/sublist', { limit: 2000 })

  if (result && result.code === 200) {
    const data = result.data.map((item) => ({
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
    return { code: result.code, data, sourceContext: {} }
  }
  return { code: result?.code ?? 200, data: [], sourceContext: {} }
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
    const data = result.data.map((item) => ({
      id: item.vid,
      name: item.title,
      picUrl: item.coverUrl,
      publishTime: 0,
      pluginId: '',
      artists: item.creator.map((it) => ({
        id: it.userId,
        name: it.userName,
        picUrl: '',
        pluginId: '',
        sourceContext: { id: it.userId }
      })),
      sourceContext: { id: item.vid }
    }))
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
  const result = await get(`lyric/new`, { id: params.id })
  const data = await apis.utils.parseLyric(result)
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
