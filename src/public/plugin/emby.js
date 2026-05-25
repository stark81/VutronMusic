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
 * @property {(url: string, data?: object) => Promise<any>} delete
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
 * 由宿主注入的 API（仅用于类型提示）
 * @type {PluginApi}
 */
/* eslint-disable no-undef */
const apis = api

const user = { userId: 0, userName: '', pwd: '', isVip: true, token: '' }
let baseUrl = ''

const authHeader = [
  'Emby Client="VutronMusic"',
  'Device="VutronMusic"',
  'DeviceId="vutron-music"',
  'Version="1.0.0"'
].join(', ')

apis.db.get('PluginData').then((result) => {
  user.userId = result.userId
  user.userName = result.userName
  user.pwd = result.pwd
  user.token = result.token
})

apis.store.get('').then((store) => {
  baseUrl = store.baseUrl
})

const getPic = (id, primary, size) => {
  return `${baseUrl}/emby/Items/${id}/Images/Primary?maxHeight=${size}&maxWidth=${size}&tag=${primary}&quality=90`
}

const formatPlaylist = (item) => ({
  id: item.Id || '-1',
  name: item.Name || '我喜欢的音乐',
  picUrl: item.ImageTags?.Primary
    ? getPic(item.Id, item.ImageTags.Primary, 256)
    : 'vutron://get-default-pic',
  isMine: true,
  trackCount: item.ChildCount || 0,
  playCount: item?.UserData?.PlayCount || 0,
  creator: {
    userId: user.userId || '',
    avatarUrl: '',
    nickname: user.userName || '',
    isVip: true,
    signature: '',
    sourceContext: { userId: user.userId || '' }
  },
  isPrivate: false,
  pluginId: '',
  copywriter: '',
  sourceContext: { id: item.Id || '-1' }
})

const formatPlaylistDetail = (playlist) => ({
  id: playlist.Id || -1,
  name: playlist.Name || '我喜欢的音乐',
  subscribed: false,
  picUrl: playlist.ImageTags?.Primary
    ? getPic(playlist.Id, playlist.ImageTags.Primary, 512)
    : 'vutron://get-default-pic',
  trackCount: playlist.ChildCount,
  updateTime: new Date(playlist.DateCreated || 0).getTime(),
  description: playlist.Overview || '',
  isPrivate: false,
  pluginId: '',
  copywriter: '',
  updateFrequency: '',
  specialPlaylistInfo: null,
  trackIds: [],
  tracks: [],
  tags: [],
  creator: {
    userId: user.userId,
    avatarUrl: '',
    nickname: user.userName,
    isVip: true,
    signature: '',
    sourceContext: { userId: user.userId }
  },
  sourceContext: { id: playlist.Id || -1 }
})

const getPlaylistDetail = async (params) => {
  if (params.id === '-1') {
    const playlist = formatPlaylistDetail({})
    const { tracks, counts } = await getUserLikedTracks()
    playlist.tracks = tracks
    playlist.trackCount = counts
    return { code: 200, data: playlist }
  } else {
    const result = await get(`Users/${user.userId}/Items/${params.id}`, {
      fields: 'ShareLevel',
      ExcludeFields: 'VideoChapters,VideoMediaSources,MediaStreams'
    })
    const playlist = formatPlaylistDetail(result)
    return { code: 200, data: playlist }
  }
}

const formatMilliseconds = (num) => {
  const milliseconds = num / 10000

  const minutes = Math.floor(milliseconds / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  const remainingMilliseconds = Math.floor(milliseconds % 1000)

  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = seconds.toString().padStart(2, '0')
  const formattedMilliseconds = remainingMilliseconds.toString().padStart(3, '0')

  return `[${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}]`
}

const formatTrack = (item) => {
  const lrcItem = item.MediaSources[0].MediaStreams.find((it) => it.Codec === 'lrc')

  return {
    id: item.Id,
    name: item.Name,
    duration: item.RunTimeTicks / 10000,
    alias: [],
    playable: true,
    reason: '',
    createTime: new Date(item.DateCreated).getTime(),
    no: item.IndexNumber || 1,
    mvid: 0,
    playCount: item.UserData?.PlayCount ?? -1,
    album: {
      id: item.AlbumId ?? '',
      name: item.Album ?? '',
      picUrl: `/stream-asset?service=emby&id=${item.Id}&primary=${item.ImageTags?.Primary}&size=64`,
      pluginId: '',
      sourceContext: { id: item.AlbumId ?? '' }
    },
    artists: item.ArtistItems?.map((it) => ({
      id: it.Id,
      name: it.Name,
      picUrl: 'http://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg?param=64y64',
      pluginId: '',
      sourceContext: { id: it.Id }
    })),
    picUrl: getPic(item.Id, item.ImageTags?.Primary, 64),
    pluginId: '',
    type: meta.type,
    sourceContext: {
      id: item.Id,
      sourceId: item.MediaSources?.[0]?.Id || '',
      idx: lrcItem?.Index || '',
      PlaylistItemId: item.PlaylistItemId || ''
    }
  }
}

const getLikedTracks = () => {
  return formatPlaylist({})
}

const getPlaylist = async () => {
  const result = await get('Items', {
    IncludeItemTypes: 'Playlist',
    Fields: 'DateCreated, Overview, ChildCount',
    Recursive: true
  })
  const playlists = result.Items.map((item) => formatPlaylist(item))
  return playlists
}

const getAlbumlist = () => {
  return []
}

const getUserLikedTracks = async () => {
  const params = {
    IsFavorite: true
  }
  const result = await getTracks(params)
  const data = result.Items.map((item) => formatTrack(item))
  return { tracks: data, counts: result.TotalRecordCount }
}

const getTracks = async (_params) => {
  const params = {
    IncludeItemTypes: 'Audio',
    Fields: 'DateCreated, Size, Bitrate, IsFavorite, MediaSources',
    Recursive: true
  }

  return get('Items', { ...params, ..._params })
}

const getFileLyric = async (id, sourceId, idx) => {
  const url = `Items/${id}/${sourceId}/Subtitles/${idx}/Stream.js`
  const result = await get(url)
  if (!result) return ''
  const lrc = result.TrackEvents.map((line) => {
    const timeStamps = formatMilliseconds(line.StartPositionTicks)
    return timeStamps + line.Text
  }).join('\n')
  return lrc || ''
}

const getEmbeddedLyric = async (id) => {
  const result = await get(`Users/${user.userId}/Items/${id}`, {
    fields: 'ShareLevel',
    ExcludeFields: 'VideoChapters,VideoMediaSources,MediaStreams',
    api_key: user.token
  })

  if (!result.MediaSources) return ''
  for (const stream of result.MediaSources[0].MediaStreams) {
    if (stream.Extradata) return stream.Extradata
  }
  return ''
}

const get = async (url, params) => {
  try {
    const headers = {
      'X-Emby-Token': user.token,
      'X-Emby-Client': 'VutronMusic',
      'X-Emby-Device-Name': 'Desktop',
      'X-Emby-Device-Id': 'vutron-music',
      'X-Emby-Client-Version': '1.0.0'
    }
    const response = await apis.http.get(
      `${baseUrl}/${url}`,
      { ...params, UserId: user.userId },
      headers
    )
    return response
  } catch (error) {
    if (error.response) {
      //
    }
    throw error
  }
}

const post = async (url, data, header = null) => {
  const headers = {
    'X-Emby-Token': user.token,
    'X-Emby-Client': 'VutronMusic',
    'X-Emby-Device-Name': 'Desktop',
    'X-Emby-Device-Id': 'vutron-music',
    'X-Emby-Client-Version': '1.0.0'
  }
  const response = await apis.http.post(`${baseUrl}/${url}`, data, header ?? headers)
  return response
}

const _delete = async (url, data, header = null) => {
  const headers = {
    'X-Emby-Token': user.token,
    'X-Emby-Client': 'VutronMusic',
    'X-Emby-Device-Name': 'Desktop',
    'X-Emby-Device-Id': 'vutron-music',
    'X-Emby-Client-Version': '1.0.0'
  }
  const response = await apis.http.delete(`${baseUrl}/${url}`, data, header ?? headers)
  return response
}

const meta = {
  name: 'Emby',
  type: 'stream'
}

exports.meta = meta

exports.updateBaseUrl = async (params) => {
  const url = params.url.replace(/\/$/, '')
  baseUrl = url
  apis.store.set('baseUrl', url)
  return { code: 200 }
}

exports.getAccount = () => {
  return { code: 200, baseUrl, userName: user.userName, pwd: user.pwd }
}

exports.doLogin = async (params) => {
  const headers = { 'X-Emby-Authorization': authHeader, 'Content-Type': 'application/json' }
  const response = await post(
    'Users/AuthenticateByName',
    {
      Username: params.userName,
      Pw: params.pwd
    },
    headers
  )

  if (typeof response === 'string') {
    return { code: 404, message: response }
  }
  try {
    const { User, AccessToken } = response
    user.token = AccessToken
    user.userId = User.Id
    user.userName = params.userName
    user.pwd = params.pwd
    apis.db.set('PluginData', user)
    return {
      code: 200,
      data: {
        userId: user.userId,
        avatarUrl: '',
        nickname: user.userName,
        isVip: true,
        signature: ''
      }
    }
  } catch (error) {
    console.log('[emby login failed]', error)
    return { code: 404, message: 'emby login failed' }
  }
}

exports.systemPing = async () => {
  // const data = await get('System/Ping')
  return true
}

exports.loginQrKey = async () => {}

exports.userPlaylist = async () => {
  const [playlists, albums, liked] = await Promise.all([
    getPlaylist(),
    getAlbumlist(),
    getLikedTracks()
  ])

  return { code: 200, liked, playlists, albums, sourceContext: { offset: 0 } }
}

/**
 * id = '-1' 时代表获取喜欢的歌曲
 */
exports.getPlaylistDetail = getPlaylistDetail

exports.userLikedArtists = () => {
  return { code: 404, data: [], sourceContext: {} }
}

exports.userLikedMVs = () => {
  return { code: 404, data: [], sourceContext: {} }
}

exports.cloudDisk = () => {
  return { code: 404, data: [], sourceContext: {} }
}

exports.getTrackDetail = async (params) => {
  const result = await get(`Users/${user.userId}/Items/${params.id}`, {
    Fields: 'DateCreated, Size, Bitrate, IsFavorite, MediaSources'
  })
  result.PlaylistItemId = params.PlaylistItemId || ''
  const data = formatTrack(result)
  return { code: 200, data }
}

exports.resizePicUrl = (params) => {
  const { url, size } = params

  const u = new URL(url)
  u.searchParams.set('maxHeight', `${size}`)
  u.searchParams.set('maxWidth', `${size}`)

  return { code: 200, data: u.href }
}

exports.songUrl = async (params) => {
  const url = `vutron://get-plugin-asset?plugin=emby&type=stream&id=${params.id}`
  return { code: 200, data: { url: [url], replayGain: 0, peak: 1 } }
}

exports.getStream = (params) => {
  return {
    url: `${baseUrl}/Audio/${params.id}/stream?Static=true`,

    headers: {
      Authorization:
        `MediaBrowser ` +
        `Token="${user.token}", ` +
        `Client="VutronMusic", ` +
        `Device="Desktop", ` +
        `DeviceId="vutron-music", ` +
        `Version="1.0.0"`
    }
  }
}

exports.getLyric = async (params) => {
  const { id, sourceId, idx } = params
  let lyric
  if (sourceId && idx) {
    lyric = await getFileLyric(id, sourceId, idx)
  } else {
    lyric = await getEmbeddedLyric(id)
  }
  const data = await apis.utils.parseLyric(lyric)
  return { code: 200, data }
}

exports.addOrRemoveTracksToPlaylist = async (params) => {
  const { op, playlist, tracks } = params
  const endpoint = `Playlists/${playlist.id}/Items` + (op === 'del' ? '/Delete' : '')
  const ids = tracks.map((it) => (op === 'add' ? it.id : it.PlaylistItemId)).join(',')
  const data = op === 'add' ? { Ids: ids, UserId: user.userId } : { EntryIds: ids }
  await post(endpoint, data)
  return { code: 200 }
}

exports.likeATrack = async (params) => {
  const { op, tracks } = params

  if (op === 'add') {
    const result = await post(`Users/${user.userId}/FavoriteItems/${tracks[0].id}`)
    return { code: result?.IsFavorite ? 200 : 404 }
  } else if (op === 'del') {
    const result = await _delete(`Users/${user.userId}/FavoriteItems/${tracks[0].id}`)
    return { code: !result?.IsFavorite ? 200 : 404 }
  }

  return { code: 404 }
}

exports.createPlaylist = async (params) => {
  const { name } = params
  const result = await post('Playlists', { Name: name, Ids: '', MediaType: 'Audio' })

  try {
    const res = await get(`Users/${user.userId}/Items/${result.Id}`, {
      fields: 'ShareLevel',
      ExcludeFields: 'VideoChapters,VideoMediaSources,MediaStreams'
    })
    const playlist = formatPlaylist(res)
    return { code: 200, data: playlist }
  } catch (error) {
    console.log('[createPlaylist error]: ', error)
    return { code: 404 }
  }
}

exports.deletePlaylist = async (params) => {
  try {
    await post('Items/Delete', { Ids: params.id })
    return { code: 200 }
  } catch (error) {
    console.log('[deletePlaylist error]', error)
    return { code: 404 }
  }
}

exports.getPlaylistTracks = async (params) => {
  if (params.hasMore === false) return { code: 200, data: [], sourceContext: params }
  const result = await getTracks({ ParentId: params.id })
  const data = result.Items.map((item) => formatTrack(item))
  return { code: 200, data, sourceContext: { id: params.id, hasMore: false } }
}

exports.getAllTracks = async (params) => {
  console.log('[getAllTracks]: ', params)
  return { code: 404, data: [] }
}
