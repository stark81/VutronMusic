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
 * @property {(key: string) => Promise<string | Record<string, any>>} get key为''时表示获取整个插件的store数据
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
 * @property {string} pluginId
 */

/**
 * @typedef {Object} Album
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {string} pluginId
 * @property {string=} copywriter
 * @property {Record<string, any>} sourceContext
 */

/**
 * @typedef {Object} Artist
 * @property {string} id
 * @property {string} name
 * @property {string} picUrl
 * @property {string} pluginId
 * @property {string=} copywriter
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

const user = { userId: 0, isVip: false, token: '' }
let dfid = ''
let baseUrl = ''
const collectedPlaylists = { ids: [] }
const collectedArtists = { ids: [] }
const artistLists = { status: 0, data: {} }
const collectedMVs = { ids: [] }

apis.db.get('PluginData').then((result) => {
  user.userId = result.userId
  user.isVip = result.isVip
  user.token = result.token
})

apis.store.get('').then((store) => {
  baseUrl = store.baseUrl

  if (!user.userId) return

  get('artist/lists', { type: 0, hotsize: 30 }).then((result) => {
    artistLists.status = result.status
    artistLists.data = result.data
  })

  get('user/follow').then((result) => {
    collectedArtists.ids = result.data?.lists.map((item) => String(item.singerid || item.userid))
  })

  get('register/dev').then((res) => {
    dfid = res.data?.dfid
  })

  // 获取用户vip情况以及该用户的收藏歌单id
  get('user/vip/detail').then((result) => {
    user.userId = result.data?.userid
    const vip = result.data?.busi_vip.some((item) => item.is_vip === 1)
    user.isVip = vip

    if (!user.isVip) youthVip()

    // const tomorrow = new Date()
    // tomorrow.setDate(tomorrow.getDate() + 1)
    // youthVip(_formatDate(tomorrow))

    get('user/playlist', { pagesize: 100 })
      .then((res) => {
        collectedPlaylists.ids = res.data?.info.map((item) => ({
          id: item.list_create_gid || item.list_create_listid,
          listid: item.listid
        }))
      })
      .catch()
  })
})

const youthVip = async (date = _formatDate()) => {
  await get('youth/day/vip', { receive_day: date })
  setTimeout(() => {
    get('youth/day/vip/upgrade')
  }, 10 * 1000)
  return { code: 200 }
}

const _formatDate = (date = new Date()) => {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  )
}

/**
 * @param {string} url
 * @param {Object=} params
 * @param {string=} dfid
 */
const get = async (url, params) => {
  let cookie = ``
  if (user.token) cookie += `token=${user.token};userid=${user.userId}`
  if (dfid) cookie += `;dfid=${dfid}`

  const headers = { Cookie: cookie, 'User-Agent': 'Android16' }
  const response = await apis.http.get(`${baseUrl}/${url}`, params, headers)

  if (response.status === 0 && response.error_code === 20018) {
    throw new Error('UNAUTHORIZED')
  }

  return response
}

/**
 * @param {string} url
 * @param {Object=} data
 */
// const post = async (url, data) => {
//   const store = await apis.store.get('')
//   const baseUrl = store.baseUrl
//   const token = store.token
//   const userid = store.userid
//   const headers = token ? { Cookie: `token=${token};userid=${userid}` } : {}
//   return apis.http.post(`${baseUrl}/${url}`, data, headers)
// }

const isTrackPlayable = (item) => {
  const result = { playable: true, reason: '' }
  if (!item.privilege || item.privilege === 0) return result

  if (!item.hash) {
    result.playable = false
    result.reason = '无可用资源'
  } else if (
    (item.privilege === 10 || item.AlbumPrivilege) &&
    (item.status === 0 || item.by_count === 0)
  ) {
    result.playable = false
    result.reason = '该音频关联专辑付费'
  } else if (item.privilege === 5) {
    result.playable = false
    result.reason = '无版权'
  }
  return result
}

/**
 * Returns the first non-nullish value.
 *
 * @template T
 * @param {...T} values Values to check.
 * @returns {T | undefined} The first value that is not null or undefined.
 */
const pick = (...values) => values.find((v) => v != null && v !== '')

const parseDate = (dateStr) => {
  if (!dateStr) return null

  const fixed = String(dateStr).replace(/^(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => {
    const mm = Math.max(1, parseInt(m, 10)).toString().padStart(2, '0')
    const dd = Math.max(1, parseInt(d, 10)).toString().padStart(2, '0')
    return `${y}-${mm}-${dd}`
  })

  const ts = new Date(fixed).getTime()
  return isNaN(ts) ? null : ts
}

/**
 * @returns {Track}
 */
const formatTrack = (item, size = 64, artistId = null) => {
  try {
    const result = isTrackPlayable(item)
    const album = {
      id:
        pick(
          item.album_id,
          item.albuminfo?.id,
          item.album_info?.album_id,
          item.AlbumID
          // item.album?.album_id,
        ) || '',
      name:
        pick(
          item.album_name,
          item.albuminfo?.name,
          item.album_info?.album_name,
          item.AlbumName
          // item.album?.album_name,
        ) || '',
      picUrl: (
        pick(
          item.sizable_cover,
          item.cover,
          item.album_info?.sizable_cover,
          item.Image
          // item.pic_url,
        ) || 'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg'
      )
        .replace('{size}', `512`)
        .replace('http://', 'https://'),
      pluginId: '',
      sourceContext: {
        id:
          pick(
            item.album_id,
            item.albuminfo?.id,
            item.album_info?.album_id,
            item.AlbumID
            // item.album?.album_id,
          ) || ''
      }
    }

    const artists = pick(
      item.singerinfo,
      item.authors,
      item.Singers,

      [
        {
          id: artistId || 0,
          name: item.author_name,
          picUrl: '',
          pluginId: '',
          souceContext: { id: artistId || 0 }
        }
      ]
    ).map((ar) => ({
      id: ar.id ?? ar.author_id ?? '',
      name: ar.name ?? ar.author_name,
      picUrl:
        (ar.avatar ?? ar.sizable_avatar ?? '')
          .replace('{size}', `512`)
          .replace('http://', 'https://') ?? '',
      pluginId: '',
      sourceContext: { id: ar.id || ar.author_id || '' }
    }))

    const picUrl = pick(
      item.sizable_cover,
      item.cover,
      item.album_info?.sizable_cover,
      item.album_sizable_cover,
      item.Image,
      'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg'
    )
      .replace('{size}', `${size}`)
      .replace('http://', 'https://')

    return {
      id: item.songid ?? item.audio_id ?? item.id ?? item.Audioid ?? '',
      name:
        item.songname ??
        item.audio_name ??
        item.OriSongName ??
        item.name?.split('-')[1]?.trim() ??
        item.name ??
        '',
      duration: item.timelen ?? item.timelength ?? (item.time_length ?? item.Duration ?? 0) * 1000,
      alias: [],
      createTime:
        parseDate(
          pick(item.publish_date, item.album_info?.publish_date, item.PublishDate, item.add_time)
        ) ?? 0,
      no: 0,
      playable: result.playable,
      mvid: item.mvid || item.video_id || 0,
      playCount: -1,
      reason: result.reason,
      album,
      artists,
      albumArtists: artists,
      picUrl,
      pluginId: '',
      type: meta.type,
      sourceContext: {
        id: item.songid ?? item.audio_id ?? item.id ?? item.Audioid ?? '',
        name:
          item.songname ??
          item.audio_name ??
          item.OriSongName ??
          item.name?.split('-')[1]?.trim() ??
          item.name ??
          '',
        hash: item.hash || item.FileHash || '',
        album: { id: album.id, name: album.name },
        artists: artists.map((it) => ({ id: it.id, name: it.name })),
        picUrl,
        fileid: item.fileid || '',
        mxid:
          item.album_audio_id || item.MixSongID || item.mixsongid || item.songid || item.audio_id
      }
    }
  } catch (error) {
    console.log('[formatTrack ERROR]: ', error)
  }
}

/**
 * @param item
 * @param {'show' | 'intro' | 'update_frequency'} writer
 * @param {number} idx
 */
const formatPlaylist = (item, writer) => ({
  id: item.global_collection_id ?? item.rankid ?? item.specialid ?? item.list_create_gid ?? '',
  name: item.specialname ?? item.rankname ?? item.name,
  picUrl: (
    item.imgurl ||
    item.pic ||
    item.img?.replace('/150/', '/256/') ||
    'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg'
  ).replace('{size}', '256'),
  isMine: item.list_create_userid === user.userId,
  trackCount: item.m_count || 0,
  playCount: item.play_count ?? item.play_times ?? 0,
  creator: {
    userId: item.suid ?? item.list_create_userid ?? '',
    avatarUrl: item.pic ?? item.create_user_pic ?? '',
    nickname: item.nickname ?? item.list_create_username ?? '',
    isVip: false,
    signature: '',
    sourceContext: { userId: item.suid ?? item.list_create_userid ?? '' }
  },
  isPrivate: !!item.is_pri,
  copywriter: item[writer] || '',
  pluginId: '',
  sourceContext: {
    id: item.global_collection_id ?? item.rankid ?? item.specialid ?? item.list_create_gid ?? '',
    listid: item.listid || '',
    gid: item.list_create_gid || item.gid || item.global_collection_id || ''
  }
})

const formatPlaylistDetail = (playlist) => {
  const idx = collectedPlaylists.ids.findIndex((item) => item.id === playlist.list_create_gid)
  return {
    id: playlist.global_collection_id,
    name: playlist.name,
    subscribed: idx !== -1,
    picUrl:
      playlist.pic.replace('{size}', '512') || 'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg',
    trackCount: playlist.count,
    updateTime: new Date(playlist.update_time * 1000).getTime(),
    description: playlist.intro,
    isPrivate: !!playlist.is_pri,
    pluginId: '',
    copywriter: '',
    updateFrequency: '',
    specialPlaylistInfo: null,
    trackIds: [],
    tracks: [],
    tags: (playlist.musiclib_tags || []).map((it) => it.tag_name),
    creator: {
      userId: playlist.list_create_userid,
      avatarUrl: playlist.create_user_pic || '',
      nickname: playlist.list_create_username,
      isVip: false,
      signature: '',
      sourceContext: { userId: playlist.list_create_userid }
    },
    sourceContext: {
      id: playlist.global_collection_id,
      page: 1,
      listid: playlist.listid
      // createListid: playlist.list_create_listid
    }
  }
}

const albumTypeMap = {
  录音室专辑: '专辑',
  EP专辑: 'EP',
  单曲专辑: '单曲',
  liveCD: 'liveCD',
  精选集: '精选集'
}

const formatAlbum = (item) => ({
  id: item.list_create_listid || item.albumid || '',
  name: item.name || item.albumname || '',
  picUrl: (
    item.pic ||
    item.imgurl ||
    item.img ||
    'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg'
  ).replace('{size}', '256'),
  artists: (item.authors || item.singers)?.map((it) => ({
    id: it.author_id || it.id || '',
    name: it.author_name || it.name,
    picUrl: '',
    pluginId: '',
    sourceContext: { id: it.author_id || it.id || '' }
  })) || [
    {
      id: item.singerid,
      name: item.singername,
      picUrl: '',
      pluginId: '',
      sourceContext: { id: item.singerid }
    }
  ],
  pluginId: '',
  sourceContext: { id: item.list_create_listid || item.albumid || '', listid: item.listid || '' }
})

const formatAlbumDetail = (item) => {
  const idx = collectedPlaylists.ids.findIndex((it) => String(it.id) === String(item.album_id))
  let listid = null
  if (idx !== -1) {
    listid = collectedPlaylists.ids[idx].listid
  }
  const sourceContext = {
    id: item.album_id,
    authorId: item.author_id || item.authors?.[0]?.author_id || ''
  }
  if (listid) sourceContext.listid = listid

  return {
    id: item.album_id,
    name: item.album_name,
    picUrl: item.sizable_cover.replace('{size}', '512'),
    artists: [],
    type: item.type,
    isExplicit: false,
    subscribed: idx !== -1,
    publishTime: parseDate(item.publish_date),
    size: 0,
    company: item.publish_company || '',
    description: item.intro,

    pluginId: '',
    sourceContext
  }
}

function canPlayWithConceptVIP(song) {
  const { privilege, viponly_tag: viponlyTag } = song.copyright
  const { musicpack_advance: musicpackAdvance } = song.trans_param

  // 音乐包/概念版专属
  if (viponlyTag === 1 && musicpackAdvance === 1)
    return { playable: user.isVip, reason: '单曲付费' }

  // 普通VIP可听
  if (privilege === 8) return { playable: user.isVip, reason: 'VIP Only' }

  // 付费内容，需单独购买
  if (privilege === 10) return { playable: false, reason: '付费专辑' }

  return { playable: true, reason: '' }
}

/**
 * @returns {Track}
 */
const buildAlbumTrack = (item) => ({
  ...canPlayWithConceptVIP(item),
  id: item.base?.audio_id || '',
  name: item.base?.audio_name || '',
  duration: item.audio_info?.duration_flac || 0,
  alias: [],
  createTime: parseDate(item.musical?.publish_time || '0'),
  album: {
    id: item.base?.album_id || '',
    name: item.album_info?.album_name || '',
    picUrl: (item.album_info?.cover || '').replace('{size}', '512'),
    pluginId: '',
    sourceContext: { id: item.base?.album_id || '' }
  },
  no: item.extend?.sort || 1,
  artists: (item.authors || []).map((it) => ({
    id: it.author_id,
    name: it.author_name,
    picUrl: '',
    pluginId: '',
    sourceContext: { id: it.author_id }
  })),
  picUrl: (item.album_info?.cover || 'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg').replace(
    '{size}',
    '512'
  ),
  mvid: item.mvid || 0,
  playCount: -1,
  pluginId: '',
  type: meta.type,
  sourceContext: {
    id: item.base?.audio_id || '',
    name: item.base?.audio_name || '',
    hash:
      item.audio_info.hash_flac ||
      item.audio_info.hash_320 ||
      item.audio_info.hash_128 ||
      item.audio_info.hash ||
      '',
    album: { id: item.base?.album_id || '', name: item.album_info?.album_name || '' },
    artists: (item.authors || []).map((it) => ({
      id: it.author_id,
      name: it.author_name
    })),
    picUrl: (item.album_info?.cover || 'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg').replace(
      '{size}',
      '512'
    ),
    fileid: '',
    mxid: item.base?.album_audio_id
  }
})

const formatMv = (item) => ({
  id: item.video_id || item.MvID || '',
  name: item.video_name || item.MvName || '',
  picUrl: (
    item.hdpic ||
    item.ThumbGif ||
    item.cover ||
    'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg'
  )
    .replace('{size}', '600')
    .replace('http://', 'https://'),
  publishTime: parseDate(item.collect_time || item.publish_date) || 0,
  pluginId: '',
  artists: (
    item.Singers || [
      {
        id: item.user_id || 0,
        name: item.provider || item.author_name,
        picUrl: '',
        pluginId: '',
        sourceContext: { id: item.user_id || 0 }
      }
    ]
  ).map((ar) => ({
    id: ar.id || '',
    name: ar.name || '',
    picUrl: '',
    pluginId: '',
    sourceContext: { id: ar.id || '' }
  })),
  sourceContext: {
    id: item.video_id || item.MvID || '',
    mixsongid: item.MixSongID || ''
  }
})

const formatMvDetail = (item) => ({
  id: item.video_id || '',
  name: item.video_name || item.mv_name || '',
  desc: item.intro || item.desc || item.other_desc || '',
  publishTime: parseDate(item.publish_date || item.publish_time) || 0,
  playCount: Number(item.history_heat || item.play_times) || 0,

  subCount: Number(item.collection_total) || 0,
  subed: collectedMVs.ids.includes(String(item.video_id) || String(item.MvID)),
  likedCount: -1,
  liked: false,
  hasComment: false,

  picUrl:
    item.hdpic?.replace('{size}', '600').replace('http://', 'https://') ||
    'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg',
  sources: item.sources,
  artists: item.authors.map((ar) => ({
    id: ar.author_id || '',
    name: ar.author_name || '',
    picUrl: ar.sizeable_avatar?.replace('{size}', '512').replace('http://', 'https://') || '',
    pluginId: '',
    sourceContext: { id: ar.author_id || '' }
  })),

  pluginId: '',
  sourceContext: { id: item.video_id || '' }
})

const formatComment = (item) => {
  return {
    id: item.id || '',
    content: item.content || '',
    time: new Date(item.addtime).getTime(),
    ipLocation: item.location || '',
    owner: item.user_id === user.userId,
    liked: item.like.haslike || false,
    likedCount: item.like?.count || item.like?.likenum || 0,
    replyCount: item.reply_num || 0,
    parentCommentId: 0,
    beReplied: item.beReplied ?? null,
    user: {
      id: item.user_id,
      nickname: item.user_name,
      avatarUrl: item.user_pic
    },
    sourceContext: {
      id: item.id || '',
      special_id: item.special_id,
      special_child_id: item.special_child_id
    }
  }
}

const parseComment = (text) => {
  const match = text.match(/^(.+?)\/\/@(.*?):(.+)$/s)
  if (!match) return { content: text, nickname: '', pcontent: '' }
  return {
    content: match[1],
    nickname: match[2],
    pcontent: match[3]
  }
}

const formatFloorComment = (item) => {
  const { content, nickname, pcontent } = parseComment(item.content)
  item.content = content

  if (pcontent) {
    const beReplied = {
      id: item.pid,
      content: pcontent,
      beRepliedCommentId: item.pid,
      nickname
    }
    item.beReplied = beReplied
  }

  return formatComment(item)
}

const meta = {
  name: '酷狗',
  type: 'library' // library, stream
}

const pagesize = 100

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
exports.systemPing = async () => {
  const result = await get('user/detail')
  if (result.status === 0) {
    return { code: 404, status: 'logout' }
  }
  return { code: 200, status: 'login' }
}

exports.loginQrKey = async () => {
  const result = await get('login/qr/key', { timestamp: Date.now() })
  if (result.status === 1) {
    const data = {
      url: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${result.data.qrcode}`,
      qrcode: result.data.qrcode
    }
    return { code: 200, data }
  }
  return { code: 200, data: { url: '', qrcode: '' } }
}

exports.loginQrCodeCheck = async (params) => {
  const result = await get('login/qr/check', { ...params, timestamp: Date.now() })
  const map = {
    0: { code: 800, message: '二维码过期' },
    1: { code: 801, message: '等待扫码' },
    2: { code: 802, message: '待确认' },
    4: { code: 803, message: '授权登录成功' }
  }
  const res = map[result.data.status]

  if (result.data.status === 4) {
    user.userId = result.data.userid
    user.token = result.data.token

    const [res1, res2] = await Promise.all([get('user/detail'), get('user/vip/detail')])
    user.isVip = res2.data.is_vip || res2.data.busi_vip.some((v) => v.is_vip === 1)
    apis.db.set('PluginData', { ...user })

    res.user = {
      userId: result.data.userid,
      avatarUrl: result.data.pic,
      nickname: result.data.nickname,
      isVip: res2.data.is_vip || res2.data.busi_vip.some((v) => v.is_vip === 1),
      signature: res1.data.descri
    }
  }

  return res
}

exports.getAccount = () => {
  return { code: 200, baseUrl, userName: '', pwd: '' }
}

/**
 * 插件平台的登陆功能，登陆成功后，需要使用apis.store.set来保存所需的帐号相关信息
 */
exports.doLogin = () => true

exports.doLogout = () => {
  try {
    user.userId = 0
    user.token = ''
    apis.db.set('PluginData', user)
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

/**
 * @returns {{ code: number, data: Banner[] }}
 */
exports.getBanner = async (params) => {
  const result = await get('pc/diantai', { ...params })
  const banners = result.data.data
    .filter((item) => !item.isAd)
    .map((item) => {
      const map = {
        0: ['activity', '活动', {}],
        1: ['activity', '专辑购买', {}],
        3: ['playlist', '歌单推荐', { ids: item.type_id }],
        7: ['album', '新碟首发', { id: item.classid }]
      }
      return {
        id: item.id,
        picUrl: item.code,
        url: item.url,
        sourceId: String(item.classid),
        type: map[item.jump_type] ? map[item.jump_type][0] : 'activity',
        typeTitle: map[item.jump_type] ? map[item.jump_type][1] : '活动',
        pluginId: '',
        sourceContext: map[item.jump_type][2]
      }
    })
  return { code: result.status === 1 ? 200 : 404, data: banners }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.getRecommendPlaylist = async () => {
  const result = await get('top/playlist', { category_id: 0 })
  const data = result.data.special_list.map((item) => formatPlaylist(item, 'show')).slice(0, 10)
  return { code: result.status === 1 ? 200 : 404, data }
}

/**
 * @returns {{ code: number, data: Track[] }}
 */
exports.getRecommendTracks = async () => {
  const result = await get('everyday/recommend')
  const data = result.data.song_list
    .filter((item) => !item.shield && item.hash)
    .map((item) => formatTrack(item, 64))
  return { code: result.status === 1 ? 200 : 404, data, sourceContext: { offset: data.length } }
}

const topArtists = async (_params) => {
  if (_params.loaded && !_params.reset) {
    return {
      code: 200,
      data: [],
      sourceContext: { ..._params }
    }
  }
  const params = {}
  _params?.query?.forEach((item) => {
    const code = item.code
    const tag = item.tag
    params[code] = { code: tag.code, name: tag.name }
  })

  if (!_params.isFull) {
    params.initial = { name: '热门', code: -1, active: true }
  }

  let result = {}
  if (
    artistLists.data?.info?.length &&
    params?.type?.code === 0 &&
    params?.sextypes?.code === 0 &&
    params?.musician?.code === 0
  ) {
    result = artistLists
  } else {
    result = await get('artist/lists', {
      sextypes: params?.sextypes?.code || 0,
      type: params?.type?.code || 0,
      musician: params?.musician?.code || 0
    })
  }

  const data = result.data?.info
    .find((item) => item.title === params.initial.name)
    .singer.map((item) => ({
      id: item.singerid,
      name: item.singername,
      pluginId: '',
      picUrl: item.imgurl.replace('{size}', '256'),
      sourceContext: { id: item.singerid }
    }))
  return {
    code: result.status === 1 ? 200 : 404,
    data,
    sourceContext: { query: _params.query, offset: 30, loaded: true }
  }
}

/**
 * @returns {{ code: number, data: Artist[] }}
 */
exports.topArtists = topArtists

exports.artistsList = topArtists

/**
 * @returns {{ code: number, hasMore: boolean, albums: Album[] }}
 */
exports.topAlbums = async () => {
  const result = await get('top/album')
  const data = result.data
  const albums = ['chn', 'eur', 'jpn', 'kor']
    .flatMap((key) => data?.[key] ?? [])
    .slice(0, 10)
    .map((item) => ({
      id: item.albumid,
      name: item.albumname,
      picUrl: item.imgurl.replace('{size}', '256'),
      pluginId: '',
      sourceContext: { id: item.albumid }
    }))
  return {
    code: result.status === 1 ? 200 : 404,
    hasMore: false,
    albums,
    sourceContext: { offset: albums.length }
  }
}

/**
 * @returns {{ code: number, data: Playlist[] }}
 */
exports.rankTop = async () => {
  const data = [
    {
      id: 6666,
      name: '飙升榜',
      picUrl: 'https://imge.kugou.com/mcommon/256/20241219/20241219193628550054.png',
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
      copywriter: '每天',
      sourceContext: { id: 6666, type: 'rank' }
    },
    {
      id: 31308,
      name: '内地榜',
      picUrl: 'https://imge.kugou.com/mcommon/256/20241211/20241211192146592398.png',
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
      copywriter: '工作日',
      sourceContext: { id: 31308, type: 'rank' }
    },
    {
      id: 4681,
      name: '美国BillBoard榜',
      picUrl: 'https://imge.kugou.com/mcommon/256/20241129/20241129191451959672.jpg',
      playCount: 0,
      pluginId: '',
      isMine: false,
      isPrivate: false,
      trackCount: -1,
      creator: {
        userId: 0,
        avatarUrl: '',
        nickname: '',
        isVip: false,
        signature: '',
        sourceContext: {}
      },
      copywriter: '周三',
      sourceContext: { id: 4681, type: 'rank' }
    },
    {
      id: 25028,
      name: 'Beatport电子舞曲榜',
      picUrl: 'https://imge.kugou.com/mcommon/256/20241129/20241129191254713903.jpg',
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
      copywriter: '周三',
      sourceContext: { id: 25028, type: 'rank' }
    },
    {
      id: 4673,
      name: '日本公信榜',
      picUrl: 'https://imge.kugou.com/mcommon/256/20241129/20241129190753306040.jpg',
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
      copywriter: '周五',
      sourceContext: { id: 4673, type: 'rank' }
    }
  ]
  return { code: 200, data }
}

/**
 * @returns {{ code: number, data: Playlist[]}}
 */
exports.rankList = async (params) => {
  if (params.loaded) {
    return { code: 200, data: [], sourceContext: { loaded: true } }
  }

  const res = await get('rank/list', { timestamp: Date.now() })
  const result = res.data.info.map((item) => ({
    id: item.rankid,
    name: item.rankname,
    picUrl: item.imgurl.replace('{size}', '256'),
    isMine: false,
    trackCount: item.m_count || 0,
    isPrivate: false,
    creator: {
      userId: 0,
      avatarUrl: '',
      nickname: '',
      isVip: false,
      signature: '',
      sourceContext: {}
    },
    playCount: item.play_times,
    copywriter: item.update_frequency,
    pluginId: '',
    tracks: item.songinfo.map((it) => ({
      name: it.name,
      artist: it.author,
      souceContext: { id: it.audio_id }
    })),
    sourceContext: { id: item.rankid, type: 'rank' }
  }))

  const ids = [6666, 74534, 59896, 80025]
  const map = new Map(result.map((item) => [item.id, item]))
  const front = ids.map((id) => map.get(id)).filter(Boolean)
  const rest = result.filter((item) => !ids.includes(item.id))
  const data = [...front, ...rest]

  return { code: res.status === 1 ? 200 : 404, data, sourceContext: { loaded: res.status === 1 } }
}

const buildRankDetail = (item) => ({
  id: item.rankid,
  name: item.rankname,
  picUrl: item.imgurl.replace('{size}', '512'),
  subscribed: false,
  trackCount: item.extra?.resp?.all_total || 0,
  updateTime:
    parseDate(item.extra?.resp?.scheduled_release_conf?.latest_rank_cid_publish_date) || 0,
  description: item.intro,
  isPrivate: false,
  trackIds: [],
  tracks: [],
  pluginId: '',
  specialPlaylistInfo: null,
  copywriter: '',
  updateFrequency: '',
  creator: {
    userId: 0,
    avatarUrl: '',
    nickname: '酷狗官方榜单',
    isVip: true,
    signature: '',
    sourceContext: { userId: 0 }
  },
  tags: [],
  sourceContext: { id: item.rankid, type: 'rank' }
})

const rankToPlaylistDetail = async (params) => {
  const [res, result] = await Promise.all([
    get('rank/info', { rankid: params.id }),
    getRankTracks(params)
  ])
  const playlist = res.data
  const data = buildRankDetail(playlist)
  data.tracks = result.data
  return { code: res.status === 1 ? 200 : 404, data, sourceContext: result.sourceContext }
}

const buildRankTrackInfo = (item) => ({
  id: item.audio_id,
  name: item.songname,
  duration: item.deprecated?.duration || 0,
  alias: [],
  createTime: parseDate(item.business?.addtime) || 0,
  no: 0,
  playable: true,
  mvid: item.video_info?.video_id || 0,
  playCount: -1,
  reason: '',
  album: {
    id: item.album_id,
    name: item.album_info?.album_name || '',
    picUrl:
      item.album_info?.sizable_cover?.replace('{size}', '512') ||
      'https://imge.kugou.com/aaa/bb/cc/dd.jpg',
    pluginId: '',
    sourceContext: { id: item.album_id }
  },
  artists: item.authors.map((ar) => ({
    id: ar.author_id,
    name: ar.author_name,
    picUrl: ar.sizable_avatar?.replace('{size}', '512') || '',
    pluginId: '',
    sourceContext: { id: ar.author_id }
  })),
  picUrl:
    item.album_info?.sizable_cover?.replace('{size}', '64') ||
    'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg',
  pluginId: '',
  type: meta.type,
  sourceContext: {
    id: item.audio_id,
    name: item.songname,
    hash: item.deprecated.hash || item.hash || '',
    album: { id: item.album_id, name: item.album_info?.album_name || '' },
    artists: item.authors.map((ar) => ({ id: ar.author_id, name: ar.author_name })),
    picUrl:
      item.album_info?.sizable_cover?.replace('{size}', '64') ||
      'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg'
  }
})

const getRankTracks = async (params) => {
  const { id, reset } = params
  if (reset) params.page = 1
  const result = await get('rank/audio', { rankid: id, page: params.page, pagesize })
  const data = result.data.songlist.map((item) => buildRankTrackInfo(item))
  params.page = params.page + 1
  return { data, sourceContext: { id, type: 'rank', page: params.page } }
}

/**
 * @returns {{ code: number, data: PlaylistDetail }}
 */
exports.getPlaylistDetail = async (params) => {
  if (params.type === 'rank') {
    return await rankToPlaylistDetail(params)
  }

  const ids = params.gid || params.id || params.ids
  if (!ids) return { code: 200, data: null }
  const res = await get('playlist/detail', { ids })
  const playlist = res.data[0]
  const data = formatPlaylistDetail(playlist)
  if (params.listid) data.sourceContext.listid = params.listid

  return { code: res.status === 1 ? 200 : 404, data }
}

/**
 * @param {{ sourceContext: { id: string, page: number }}} params 这里的参数由getPlaylistDetail里的sourceContext决定
 */
exports.getPlaylistTracks = async (params) => {
  if (params.type === 'rank') {
    const result = await getRankTracks(params)
    return {
      ...result,
      code: 200
    }
  }

  const { id, page } = params
  const result = await get('playlist/track/all', { id, page, pagesize, t: Date.now() })
  const data = result.data.songs
    .filter((item) => !item.shield && item.hash)
    .map((item) => formatTrack(item, 64))

  const sourceContext = { ...params, id, page: page + 1 }
  return { code: result.status === 1 ? 200 : 404, data: data ?? [], sourceContext }
}

exports.catlist = async () => {
  const result = await get('playlist/tags')
  const data = {
    static: [
      { id: 0, name: '全部', sourceContext: { id: 0, name: '全部', loaded: true } },
      {
        id: 1084,
        name: '精选',
        sourceContext: { id: 1084, name: '精选', loaded: false }
      },
      {
        id: 12,
        name: '经典',
        sourceContext: { id: 12, name: '经典', loaded: false }
      },
      {
        id: 1085,
        name: '官方歌单',
        sourceContext: { id: 1085, name: '官方歌单', loaded: false }
      }
    ],
    tagList: result.data?.map((item) => ({
      id: Number(item.tag_id),
      name: item.tag_name,
      sub: item.son.map((it) => ({
        id: Number(it.tag_id),
        name: it.tag_name,
        parentId: Number(it.parent_id),
        sourceContext: { id: Number(it.tag_id), name: it.tag_name, loaded: false }
      }))
    }))
  }

  return { code: result.status === 1 ? 200 : 404, data }
}

exports.getCategoryPlaylist = async (params) => {
  const { id, loaded, reset } = params
  if (!reset && loaded)
    return {
      code: 200,
      data: [],
      sourceContext: { ...params }
    }

  let result = null
  for (let i = 0; i < 3; i++) {
    result = await get('top/playlist', { category_id: id, t: Date.now() })
    if (result.data.special_list) break
  }

  const data = result.data.special_list?.map((item) => formatPlaylist(item, 'show')) || []
  return {
    code: result.status === 1 ? 200 : 404,
    data,
    sourceContext: { ...params, loaded: true }
  }
}

exports.userPlaylist = async (params) => {
  if (!user.userId) {
    throw new Error('UNAUTHORIZED')
  }

  const page = params.page ?? 1
  const result = await get('user/playlist', { page, pagesize, t: Date.now() })
  if (result.status === 1 && result.data.info) {
    collectedPlaylists.ids = result.data.info.map((item) => ({
      id: item.list_create_gid || item.list_create_listid,
      listid: item.listid
    }))

    const playlists = result.data.info
      .filter((item) => item.source === 1)
      .map((item) => formatPlaylist(item, 'intro'))
    const sourceContext = { page: page + 1 }
    const liked = playlists.splice(1, 1)[0]

    const albums = result.data.info
      .filter((item) => item.source === 2)
      .map((item) => formatAlbum(item))

    return { code: 200, liked, playlists, albums, sourceContext }
  }
  return { code: 200, liked: null, playlists: [], albums: [], sourceContext: { page: page + 1 } }
}

/**
 * 酷狗api并没有提供该接口
 */

exports.userLikedArtists = async () => {
  if (!user.userId) return { code: 200, data: [], sourceContext: {} }

  const result = await get('user/follow', { t: Date.now() })

  if (result.status === 1) {
    collectedArtists.ids = result.data.lists.map((item) => String(item.singerid || item.userid))

    const data = result.data.lists
      .filter((item) => !!item.singerid)
      .map((item) => ({
        id: item.singerid || item.userid,
        name: item.nickname,
        picUrl: item.pic.replace(/\/\d+\//, `/256/`),
        pluginId: '',
        // sourceContext: { id: item.userid, singerid: item.singerid }
        sourceContext: { id: item.singerid }
      }))

    return { code: 200, data, sourceContext: {} }
  }
  return { code: 200, data: [], sourceContext: {} }
}

exports.userLikedMVs = async (params) => {
  if (!user.userId) return { code: 200, data: [], sourceContext: {} }

  const page = params.page || 1
  const result = await get('user/video/collect', { page, pagesize })

  if (result.status === 1 && result.data.ctotal > 0) {
    collectedMVs.ids = result.data.info.map((item) => String(item.video_id || item.MvID))

    const data = result.data.info.map(formatMv)
    return { code: 200, data, sourceContext: { page: page + 1 } }
  }

  return { code: 200, data: [], sourceContext: {} }
}

/**
 * @param {Record<string, any>} params
 */
exports.cloudDisk = async (params) => {
  if (!user.userId) return { code: 200, data: [], sourceContext: {} }

  const page = params.page || 1
  const result = await get('user/cloud', { page, pagesize })
  if (result.status === 1 && result.data.list) {
    const data = result.data.list
      .filter((item) => !item.shield && item.hash)
      .map((item) => formatTrack(item, 64))
    return { code: 200, data, sourceContext: { page: page + 1 } }
  }
  return { code: 200, data: [], sourceContext: {} }
}

exports.albumDetail = async (params) => {
  const id = params.id
  const result = await get('album/detail', { id })
  const res = await get('album/songs', { id })

  if (result.status === 1 && res.data) {
    const album = formatAlbumDetail(result.data[0])
    album.songs = res.data.songs.map(buildAlbumTrack)
    album.artists = album.songs?.[0]?.artists || [
      { id: 0, name: '', picUrl: '', pluginId: '', sourceContext: {} }
    ]
    album.size = res.total
    return { code: 200, data: album }
  }
  return { code: 200, data: null }
}

/**
 * @returns {Album}
 */
exports.artistAlbums = async (params) => {
  const { id, page } = params
  const result = await get('artist/albums', { id, pagesize, page: page ?? 1 })
  if (result.status === 1) {
    const data = result.data.map((item) => ({
      id: item.album_id,
      name: item.album_name,
      picUrl: (item.sizable_cover || 'https://c1.kgimg.com/stdmusic/aaa/ddd/ddd.jpg').replace(
        '{size}',
        '256'
      ),
      createTime: parseDate(item.publish_date) || 0,
      copywriter: `${item.type} · ${new Date(item.publish_date).getFullYear()}`,
      type: albumTypeMap[item.type] || '其他',
      pluginId: '',
      sourceContext: { id: item.album_id }
    }))
    return { code: 200, data, sourceContext: { id, page: (page || 1) + 1 } }
  }
  return { code: 200, data: [], sourceContext: { id, page: (page || 1) + 1 } }
}

exports.artistDetail = async (params) => {
  const { id, page } = params
  // const result = await get('artist/detail', { id })
  const [result, res] = await Promise.all([
    get('artist/detail', { id }),
    get('artist/audios', { id, page, sort: 'hot' })
  ])
  if (result.status === 1) {
    const artist = {
      id: result.data.author_id,
      name: result.data.author_name,
      picUrl: result.data.sizable_avatar.replace('{size}', '512'),
      musicSize: result.data.song_count,
      albumSize: result.data.album_count,
      mvSize: result.data.mv_count,
      description: result.data.intro,
      followed: collectedArtists.ids.includes(String(id)),
      pluginId: '',
      sourceContext: { id: result.data.author_id }
    }
    let songs = []

    if (res.status === 1) {
      songs = res.data.map((item) => formatTrack(item, 64, id))
    }
    return { code: 200, artist, songs, sourceContext: { id, page: (page || 1) + 1 } }
  }
  return { code: 200, artist: null, songs: [], sourceContext: { id, page: (page || 1) + 1 } }
}

exports.artistMVs = async (params) => {
  const { id, page = 1, limit: pagesize = 30, offset = 0 } = params
  const _page = Math.floor(offset / pagesize) + 1

  const result = await get('artist/videos', { id, pagesize, page: Math.max(page, _page) })
  if (result.status === 1) {
    const data = result.data.map(formatMv)
    return { code: 200, data, sourceContext: { id, page: Math.max(page, _page) + 1 } }
  }

  return { code: 200, data: [], sourceContext: { id, page: Math.max(page, _page) + 1 } }
}

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

exports.simiArtists = async () => {
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
      pluginId: '',
      picUrl: item.imgurl.replace('{size}', '256'),
      sourceContext: { id: item.singerid }
    }))
  return {
    code: result.status === 1 ? 200 : 404,
    data: shuffle(data),
    sourceContext: { offset: 30 }
  }
}

/**
 * @param {Object} params
 * @param {'add' | 'del'} params.op
 * @param { Record<string, any> } params.playlist
 * @param { Record<string, anu>[] } params.tracks
 */
const addOrRemoveTracksToPlaylist = async (params) => {
  const { op, playlist, tracks } = params
  if (op === 'add') {
    const data = tracks.map((track) => `${track.name}|${track.hash}`).join(',')
    const result = await get('playlist/tracks/add', {
      listid: playlist.listid,
      data,
      t: Date.now()
    })
    return { code: result.status === 1 ? 200 : 404 }
  } else if (op === 'del') {
    const fileids = tracks.map((track) => track.fileid).join(',')
    const result = await get('playlist/tracks/del', {
      listid: playlist.listid,
      fileids,
      t: Date.now()
    })
    return { code: result.status === 1 ? 200 : 404 }
  }
}

exports.addOrRemoveTracksToPlaylist = addOrRemoveTracksToPlaylist

exports.likeATrack = addOrRemoveTracksToPlaylist

exports.search = async (params) => {
  const { tab, keywords, page: _page = 1, reset = true, count: _count = 0 } = params
  const count = reset ? 0 : _count
  if (count && count <= _page * 30) {
    return { code: 200, data: [], count, sourceContext: { page: _page, count } }
  }

  const map = {
    tracks: 'song',
    albums: 'album',
    artists: 'author',
    playlists: 'special',
    mvs: 'mv',
    lyrics: 'lyric'
  }
  const type = map[tab]
  const page = reset ? 1 : _page
  const result = await get('search', { keywords, page, type })

  if (tab === 'tracks') {
    const data = result.data.lists.map((item) => formatTrack(item, 64))
    return {
      code: 200,
      data,
      count: result.data?.total || count,
      sourceContext: { page: page + 1, count: result.data?.total || count }
    }
  } else if (tab === 'albums') {
    const data = result.data.lists.map(formatAlbum)
    return {
      code: 200,
      data,
      count: result.data?.total || count,
      sourceContext: {
        page: page + 1,
        count: result.data?.total || count
      }
    }
  } else if (tab === 'artists') {
    const data = result.data.lists.map((item) => ({
      id: item.author_id || item.AuthorId || '',
      name: item.author_name || item.AuthorName || '',
      picUrl: (item.sizable_avatar || item.Avatar || 'vutron://get-singer-pic').replace(
        '{size}',
        '256'
      ),
      pluginId: '',
      sourceContext: { id: item.author_id || item.AuthorId || '' }
    }))
    return {
      code: 200,
      data,
      count: result.data?.total || count,
      sourceContext: {
        page: page + 1,
        count: result.data?.total || count
      }
    }
  } else if (tab === 'playlists') {
    const data = result.data.lists.map((item) => formatPlaylist(item, 'show'))
    return {
      code: 200,
      data,
      count: result.data?.total || count,
      sourceContext: {
        page: page + 1,
        count: result.data?.total || count
      }
    }
  } else if (tab === 'mvs') {
    const data = result.data.lists.map(formatMv)
    return {
      code: 200,
      data,
      count: result.data?.total || count,
      sourceContext: {
        page: page + 1,
        count: result.data?.total || count
      }
    }
  }

  return { code: 200, data: [], count, sourceContext: {} }
}

const parseKrcLyricString = (lyrics) => {
  const lines = lyrics.split(/\r?\n/)
  const languageMatch = lyrics.match(/\[language:(.+?)\]/)
  let translations = []
  let romanizations = []
  if (languageMatch) {
    try {
      const json = JSON.parse(atob(languageMatch[1]))
      json.content.forEach((it) => {
        if (it.type === 1) translations = it.lyricContent || []
        if (it.type === 0) romanizations = it.lyricContent || []
      })
    } catch {}
  }

  function parseWordTiming(line, lineStartSec) {
    const words = []

    const regex = /<(\d+),(\d+),\d+>([^<]+)/g
    let match

    while ((match = regex.exec(line)) !== null) {
      const startMs = Number(match[1])
      const durMs = Number(match[2])

      words.push({
        start: startMs + lineStartSec * 1000,
        end: startMs + durMs + lineStartSec * 1000,
        word: match[3]
      })
    }

    return words.length ? words : undefined
  }

  const result = []
  let index = 0

  for (const line of lines) {
    const match = line.match(/^\[(\d+),(\d+)\](.*)$/)
    if (!match) continue

    const startMs = Number(match[1])
    const durationMs = Number(match[2])
    let text = match[3] || ''

    const start = startMs / 1000
    const end = (startMs + durationMs) / 1000

    text = text.replace(/<(\d+),(\d+),\d+>/g, '').trim()

    const tText = translations[index]?.[0] || ''
    const rText = romanizations[index]?.join('') || ''

    result.push({
      start,
      end,
      lyric: {
        text,
        info: parseWordTiming(line, start)
      },
      ...(tText
        ? { tlyric: { text: tText, info: [{ start: start * 1000, end: end * 1000, word: tText }] } }
        : {}),
      ...(rText
        ? { rlyric: { text: rText, info: [{ start: start * 1000, end: end * 1000, word: rText }] } }
        : {})
    })

    index++
  }

  return result
}

/**
 * 获取歌词
 * @param {Object} params
 * @returns {LyricLine[]}
 */
exports.getLyric = async (params) => {
  let result = null
  for (let i = 0; i < 3; i++) {
    try {
      const r = await get('search/lyric', { hash: params.hash })
      if (r.candidates?.length) {
        result = r
        break
      }
    } catch {}
  }

  if (!result || !result.candidates?.length) return []

  const { id, accesskey } = result.candidates[0]
  const res = await get('lyric', { id, accesskey, fmt: 'krc', decode: true })
  let data = parseKrcLyricString(res.decodeContent)
  if (!data.length) {
    data = await apis.utils.parseLyric(res.decodeContent)
  }
  return { code: 200, data }
}

/**
 * @param {{ url: string, size: number }} params
 */
exports.resizePicUrl = (params) => {
  const { url, size } = params
  return { code: 200, data: url.replace(/\/\d+\//, `/${size}/`) }
}

/**
 * @param {{ tracks: Record<string, any> }} params
 */
exports.getTrackDetail = async (params) => {
  const sources = params.tracks
  const size = sources.length === 1 ? '512' : '256'
  const hash = sources.map((item) => item.hash).join(',')
  const result = await get('privilege/lite', { hash })

  if (result.status === 1) {
    const data = result.data.map((item, idx) => {
      const { album, artists: _ar, picUrl: image } = sources[idx]

      const res = isTrackPlayable(item)
      const picUrl = item.info?.image?.replace('{size}', size) || image.replace(/\/\d+\//, `/512/`)

      const artists = _ar.map((it) => ({
        ...it,
        picUrl: '',
        pluginId: '',
        sourceContext: { id: it.id }
      }))
      return {
        id: item.id,
        name: item.name?.split('-')[1]?.trim() ?? item.name ?? '',
        duration: item.info.duration,
        alias: [],
        createTime: 0,
        no: 0,
        playable: res.playable,
        reason: res.reason,
        mvid: 0,
        playCount: -1,
        album: {
          ...album,
          picUrl,
          pluginId: '',
          sourceContext: { id: album.id }
        },
        artists,
        albumArtists: artists,
        picUrl,
        pluginId: '',
        type: meta.type,
        sourceContext: sources[idx]
      }
    })
    return { code: 200, data }
  }
  return { code: 200, data: [] }
}

/**
 * 创建歌单
 * @param {Record<string, any>} params
 * @returns {{ stauts: string, pid: number | string }}
 */
exports.createPlaylist = async (params) => {
  const { name, isPrivate } = params
  const res = await get('playlist/add', {
    name,
    list_create_userid: user.userId,
    is_pri: isPrivate ? 1 : 0,
    type: 0
  })
  if (res.status === 1) {
    const playlist = formatPlaylist(res.data.info)
    return { code: 200, data: playlist }
  }
  return { code: 404 }
}

exports.subscribePlaylist = async (params) => {
  const { op, id, gid, name, listid /** tracks , createListid */ } = params

  if (op === 'add') {
    const res = await get('playlist/add', {
      name,
      list_create_gid: gid || id,
      list_create_userid: user.userId,
      type: 1,
      source: 1 // 这里的source应该是歌单或者album，2是album
    })
    return { code: res.status === 1 ? 200 : 404 }
  } else {
    const res = await get('playlist/del', { listid })
    return { code: res.status === 1 ? 200 : 404 }
  }
}

exports.deletePlaylist = async (params) => {
  const { listid } = params
  const res = await get('playlist/del', { listid })
  return { code: res.status === 1 ? 200 : 404 }
}

exports.followArtist = async (params) => {
  const { op, id } = params
  if (op === 'follow') {
    const result = await get('artist/follow', { id, t: Date.now() })
    return { code: result.status === 1 ? 200 : 404 }
  } else if (op === 'unfollow') {
    const result = await get('artist/unfollow', { id, t: Date.now() })
    return { code: result.status === 1 ? 200 : 404 }
  }
  return { code: 404 }
}

exports.subscribeAlbum = async (params) => {
  const { op, id, name, authorId, listid } = params
  if (op === 'add') {
    const result = await get('playlist/add', {
      name,
      list_create_listid: id,
      type: 1,
      source: 2,
      list_create_userid: authorId
    })
    return { code: result.status === 1 ? 200 : 404 }
  } else {
    const result = await get('playlist/del', { listid })
    return { code: result.status === 1 ? 200 : 404 }
  }
}

exports.songUrl = async (params) => {
  if (params.hash) {
    const result = await get('song/url', {
      hash: params.hash,
      quality: 'high',
      ppage_id: 356753938
    })

    if (result.status === 1) {
      const url = [...result.url, ...result.backupUrl]

      const replayGain = result.volume || 0
      const peak = 10 ** ((result.volume_peak || 1) / 20)
      return { code: 200, data: { url, replayGain, peak } }
    }
  }
  return { code: 200, data: { url: [], replayGain: 0, peak: 1 } }
}

exports.getTrackCatlist = () => ({
  code: 200,
  data: [{ name: '全部', code: 0, active: true, sourceContext: { name: '全部', code: 0, page: 1 } }]
})

exports.topSong = async (params) => {
  if (params.hasMore === false && !params.reset) {
    return { code: 200, data: [], sourceContext: { ...params, hasMore: false } }
  }

  const result = await get('top/song', { pagesize: 100, page: params.reset ? 1 : params.page })
  if (result.status === 1 && Array.isArray(result.data)) {
    const data = result.data.map((item) => formatTrack(item, 64))
    return {
      code: 200,
      data,
      sourceContext: { ...params, page: (params.reset ? 1 : params.page) + 1 }
    }
  }
  return { code: 200, data: [], sourceContext: { ...params, hasMore: false } }
}

exports.getAlbumCatlist = () => ({
  code: 200,
  data: [
    { name: '推荐', code: 'all', sourceContext: { name: '推荐', code: 'all' } },
    { name: '华语', code: 'chn', sourceContext: { name: '华语', code: 'chn' } },
    { name: '欧美', code: 'eur', sourceContext: { name: '欧美', code: 'eur' } },
    { name: '日本', code: 'jpn', sourceContext: { name: '日本', code: 'jpn' } },
    { name: '韩国', code: 'kor', sourceContext: { name: '韩国', code: 'kor' } }
  ]
})

exports.newAlbums = async (params) => {
  const { code } = params

  const result = await get('top/album')
  const data = result.data

  if (code === 'all') {
    const albums = ['chn', 'eur', 'jpn', 'kor'].flatMap((key) => data?.[key] ?? []).map(formatAlbum)
    return {
      code: result.status === 1 ? 200 : 404,
      data: albums,
      sourceContext: { offset: albums.length }
    }
  } else {
    const albums = data?.[code]?.map(formatAlbum) || []
    return {
      code: result.status === 1 ? 200 : 404,
      data: albums,
      sourceContext: { offset: albums.length }
    }
  }
}

exports.getArtistCatlist = () => ({
  code: 200,
  data: [
    {
      name: '性别',
      code: 'sextypes',
      sub: [
        { name: '全部', code: 0, sourceContext: { name: '全部', code: 0 } },
        { name: '男', code: 1, sourceContext: { name: '男', code: 1 } },
        { name: '女', code: 2, sourceContext: { name: '女', code: 2 } },
        { name: '组合', code: 3, sourceContext: { name: '组合', code: 3 } }
      ]
    },
    {
      name: '类型',
      code: 'type',
      sub: [
        { name: '全部', code: 0, sourceContext: { name: '全部', code: 0 } },
        { name: '华语', code: 1, sourceContext: { name: '华语', code: 1 } },
        { name: '欧美', code: 2, sourceContext: { name: '欧美', code: 2 } },
        { name: '日本', code: 5, sourceContext: { name: '日本', code: 5 } },
        { name: '韩国', code: 6, sourceContext: { name: '韩国', code: 6 } },
        { name: '其他', code: 4, sourceContext: { name: '其他', code: 4 } },
        { name: '粤语', code: 7, sourceContext: { name: '粤语', code: 7 } },
        { name: '闽南语', code: 8, sourceContext: { name: '闽南语', code: 8 } }
      ]
    },
    {
      name: '音乐人',
      code: 'musician',
      sub: [
        { name: '默认', code: 0, sourceContext: { name: '默认', code: 0 } },
        { name: '音乐人', code: 3, sourceContext: { name: '音乐人', code: 3 } }
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

exports.scrobble = async (params) => {
  try {
    const res = await get('server/now')
    const time = res.data.timestamp
    await get('playhistory/upload', { mxid: params.mxid, time })
    return { code: 200 }
  } catch (error) {
    console.log('[kugou - scrobble]: ', error)
    return { code: 404 }
  }
}

const parseMvQualities = async (h264) => {
  const configs = [{ key: 'fhd' }, { key: 'hd' }, { key: 'qhd' }, { key: 'sd' }, { key: 'ld' }]

  const qualities = configs
    .map(({ key }) => {
      const width = Number(h264[`${key}_width`] || 0)
      const height = Number(h264[`${key}_height`] || 0)
      return {
        width,
        height,
        bitrate: Number(h264[`${key}_bitrate`] || 0),
        filesize: Number(h264[`${key}_filesize`] || 0),
        hash: h264[`${key}_hash`] || '',
        label: `${Math.min(width, height)}`
      }
    })
    .filter((item) => item.hash)
    .slice(0, 2)

  await Promise.all(
    qualities.map(async (item) => {
      const result = await get('video/url', {
        hash: item.hash
      })

      if (result.status === 1) {
        const video = Object.values(result.data)[0]

        item.url = video?.downurl || video?.backupdownurl?.[0] || ''
      }
    })
  )

  return qualities.map((item) => ({ url: item.url, type: 'video/mp4', quality: item.label }))
}

exports.mvDetail = async (params) => {
  const result = await get('video/detail', { id: params.id })
  if (result.status === 1 && result.data) {
    const item = result.data[0]
    item.sources = await parseMvQualities(item)
    const data = formatMvDetail(item)
    return { code: 200, data }
  }

  return { code: 200, data: null }
}

exports.subAMV = async () => ({ code: 404 })

exports.getCommentTab = () => ({ code: 200, data: [{ name: '全部', code: 0, active: true }] })

const getTrackComments = async (params) => {
  try {
    const { mxid: mixsongid, page = 1 } = params
    const result = await get('comment/music', { mixsongid, page, pageSize: 50 })
    if (!result.list) {
      return { code: 200, data: [], count: 0, sourceContext: params }
    }

    const data = result.list.map(formatFloorComment)
    const count = result.count
    return { code: 200, data, count, sourceContext: { ...params, page: page + 1 } }
  } catch (error) {
    console.log('[kugou getTrackComment]', error)
    return { code: 404, data: [], count: 0, sourceContext: {} }
  }
}

const getPlaylistComments = async (params) => {
  try {
    const { id, reset = true, page: _page, hasMore = true } = params
    const page = reset ? 1 : _page
    const pagesize = 50

    if (!hasMore) {
      return { code: 200, data: [], count: 0, sourceContext: params }
    }

    const result = await get('comment/playlist', { id, pagesize, page })
    if (!result.list) {
      return { code: 200, data: [], count: 0, sourceContext: { ...params, hasMore: false } }
    }

    const data = result.list.map(formatFloorComment)
    const count = result.count

    return { code: 200, data, count, sourceContext: { ...params, page: page + 1 } }
  } catch (error) {
    console.log('[kugou getPlaylistComments]', error)
    return { code: 404, data: [], count: 0, sourceContext: {} }
  }
}

const getAlbumComments = async (params) => {
  try {
    const { id, reset = true, page: _page, hasMore = true } = params
    const page = reset ? 1 : _page
    const pagesize = 50

    if (!hasMore) {
      return { code: 200, data: [], count: 0, sourceContext: params }
    }

    const result = await get('comment/album', { id, pagesize, page })
    if (!result.list) {
      return { code: 200, data: [], count: 0, sourceContext: { ...params, hasMore: false } }
    }

    const data = result.list.map(formatFloorComment)
    const count = result.count

    return { code: 200, data, count, sourceContext: { ...params, page: page + 1 } }
  } catch (error) {
    console.log('[kugou getPlaylistComments]', error)
    return { code: 404, data: [], count: 0, sourceContext: {} }
  }
}

exports.getComments = async (params) => {
  const type = params.type || 'track'
  if (type === 'track') {
    return getTrackComments(params)
  } else if (type === 'playlist') {
    return getPlaylistComments(params)
  } else if (type === 'album') {
    return getAlbumComments(params)
  }
  return { code: 404, data: [], count: 0, sourceContext: {} }
}

exports.likeAComment = async () => ({ code: 404 })

exports.submitAComment = () => ({ code: 404, data: null })

exports.getFloorComments = async (params) => {
  const { sourceContext, commentInfo } = params
  const { mxid: mixsongid, page = 1, hasMore = true } = sourceContext
  const { special_child_id: specialId, id: tid } = commentInfo

  if (!hasMore || !mixsongid) {
    return { code: 200, data: [], count: 0, sourceContext: { page, hasMore } }
  }

  const result = await get('comment/floor', { special_id: specialId, mixsongid, tid, page })
  if (!result.list) {
    return { code: 200, data: [], count: 0, sourceContext: { page, hasMore: false } }
  }
  const data = result.list.map(formatFloorComment)
  const count = result.comments_num
  return { code: 200, data, count, sourceContext: { page: page + 1 } }
}
