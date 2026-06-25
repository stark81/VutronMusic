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
  baseUrl = store.baseUrl || ''
})

const getPic = (id, primary, size) => {
  return `${baseUrl}/emby/Items/${id}/Images/Primary?maxHeight=${size}&maxWidth=${size}&tag=${primary}&quality=90`
}

const formatPlaylist = (item) => ({
  id: item.Id || '-1',
  name: item.Name || '我喜欢的音乐',
  icon: 'emby',
  picUrl: item.ImageTags?.Primary
    ? getPic(item.Id, item.ImageTags.Primary, 256)
    : `http://localhost:41830/local-asset/default-cover?v=${item.Id}`,
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
  icon: 'emby',
  subscribed: playlist.UserData?.IsFavorite || false,
  picUrl: playlist.ImageTags?.Primary
    ? getPic(playlist.Id, playlist.ImageTags?.Primary, 512)
    : `http://localhost:41830/local-asset/default-cover?v=${playlist.Id}`,
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
  try {
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
  } catch {
    return { code: 404, data: null }
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

const formatTrack = (item, size = 512, showPlayCount = true) => {
  const lrcItem = item.MediaSources?.[0]?.MediaStreams?.find((it) => it.Codec === 'lrc')

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
    playCount: showPlayCount ? (item.UserData?.PlayCount ?? -1) : -1,
    album: {
      id: item.AlbumId ?? '',
      name: item.Album ?? '',
      picUrl: `/stream-asset?service=emby&id=${item.Id}&primary=${item.ImageTags?.Primary}&size=64`,
      pluginId: '',
      sourceContext: { id: item.AlbumId ?? '' }
    },
    artists: item.ArtistItems.map((it) => ({
      id: it.Id,
      name: it.Name,
      picUrl: 'http://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg?param=64y64',
      pluginId: '',
      sourceContext: { id: it.Id }
    })),
    albumArtists: item.AlbumArtists?.map((it) => ({
      id: it.Id,
      name: it.Name,
      picUrl: 'http://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg?param=64y64',
      pluginId: '',
      sourceContext: { id: it.Id }
    })),
    size: item.Size || 0,
    picUrl: item.ImageTags?.Primary
      ? getPic(item.Id, item.ImageTags.Primary, size)
      : `http://localhost:41830/local-asset/default-cover?v=${item.Id}`,
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

const formatAlbumDetail = (item) => {
  return {
    id: item.Id,
    name: item.Name,
    picUrl: item.PrimaryImageTag
      ? getPic(item.PrimaryImageItemId || item.Id, item.PrimaryImageTag, 512)
      : `http://localhost:41830/local-asset/default-cover?v=${item.Id}`,
    type: 'Album',
    isExplicit: false,
    subscribed: item.UserData?.IsFavorite || false,
    publishTime: new Date(item.DateCreated).getTime(),
    size: item.ChildCount || 0,
    company: '',
    description: item.description || '',
    songs: item.tracks,
    artists:
      item.ArtistItems?.map((it) => ({
        id: it.Id,
        name: it.Name || '',
        picUrl: it.img1v1Url || '',
        pluginId: '',
        sourceContext: { id: it.Id }
      })) ?? [],

    pluginId: '',
    sourceContext: { id: item.Id }
  }
}

const formatAlbum = (item) => ({
  id: item.Id,
  name: item.Name,
  icon: 'emby',
  picUrl: item.PrimaryImageTag
    ? getPic(item.PrimaryImageItemId || item.Id, item.PrimaryImageTag, 512)
    : `http://localhost:41830/local-asset/default-cover?v=${item.Id}`,
  artists:
    item.ArtistItems?.map((it) => ({
      id: it.Id,
      name: it.Name,
      picUrl: '',
      pluginId: '',
      sourceContext: { id: it.Id }
    })) || [],
  createTime: new Date(item.DateCreated).getTime(),
  copywriter: `专辑 · ${new Date(item.DateCreated).getFullYear()}`,
  type: '专辑',
  pluginId: '',
  sourceContext: { id: item.Id }
})

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

const getAlbumlist = async (_params) => {
  const params = {
    IncludeItemTypes: 'MusicAlbum',
    Fields: 'ChildCount, DateCreated, ProductionYear',
    Recursive: true,
    Limit: 1000
  }
  const result = await get(`Users/${user.userId}/Items`, { ...params, ..._params })

  return result.Items.map(formatAlbum)
}

const getArtists = async (_params) => {
  const params = {
    Recursive: true,
    Limit: 1000
  }
  const result = await get('Artists', { ...params, ..._params })
  return result.Items.map((item) => ({
    id: item.Id,
    name: item.Name,
    picUrl: item.ImageTags?.Primary
      ? getPic(item.Id, item.ImageTags?.Primary, 512)
      : 'vutron://get-singer-pic',
    pluginId: '',
    sourceContext: { id: item.Id }
  }))
}

const getUserLikedTracks = async () => {
  const params = {
    IsFavorite: true
  }
  const result = await getTracks(params)
  const data = result.Items.map((item) => formatTrack(item, 64))
  return { tracks: data, counts: result.TotalRecordCount }
}

const getTracks = async (_params) => {
  const params = {
    IncludeItemTypes: 'Audio',
    Fields: 'DateCreated, Size, Bitrate, IsFavorite, MediaSources, UserDataPlayCount',
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

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    return response
  } catch (error) {
    throw new Error(error)
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

const meta = {
  name: 'Emby',
  icon: 'emby',
  type: 'stream',
  capabilities: {
    matchTrack: false,
    getLyric: true,
    getComments: false,
    comment: { read: false, like: false, submit: false, floor: false },
    mv: { detail: false, like: false, subscribe: false }
  }
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
  try {
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
  } catch {
    return { code: 404, message: '' }
  }
}

exports.doLogout = () => {
  try {
    user.userId = ''
    user.token = ''
    apis.db.set('PluginData', user)
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.systemPing = async () => {
  try {
    await get('System/Ping')
    return { code: 200, status: user.token ? 'login' : 'logout' }
  } catch {
    user.token = ''
    user.userId = ''
    apis.db.set('PluginData', user)
    return { code: 404, status: 'offline' }
  }
}

exports.search = async (_params) => {
  try {
    const { tab, keywords, reset } = _params
    const StartIndex = reset ? 0 : _params.StartIndex || 0
    if (!keywords) return { code: 200, data: [], count: 0, sourceContext: {} }

    const limit = 50

    switch (tab) {
      case 'tracks': {
        const result = await getTracks({
          SearchTerm: keywords,
          Limit: limit,
          StartIndex
        })
        const data = (result.Items || []).map((item) => formatTrack(item, 64))
        return {
          code: 200,
          data,
          count: result.TotalRecordCount || data.length,
          sourceContext: { StartIndex: StartIndex + data.length }
        }
      }
      case 'albums': {
        const result = await get('Users/' + user.userId + '/Items', {
          SearchTerm: keywords,
          IncludeItemTypes: 'MusicAlbum',
          Fields: 'ChildCount, DateCreated, ProductionYear',
          Recursive: true,
          Limit: limit,
          StartIndex
        })
        const data = (result.Items || []).map(formatAlbum)
        return {
          code: 200,
          data,
          count: result.TotalRecordCount || data.length,
          sourceContext: { StartIndex: StartIndex + data.length }
        }
      }
      case 'artists': {
        const result = await get('Artists', {
          SearchTerm: keywords,
          Limit: limit,
          StartIndex
        })
        const data = (result.Items || []).map((item) => ({
          id: item.Id,
          name: item.Name,
          picUrl: item.ImageTags?.Primary
            ? getPic(item.Id, item.ImageTags?.Primary, 512)
            : 'vutron://get-singer-pic',
          pluginId: '',
          sourceContext: { id: item.Id }
        }))
        return {
          code: 200,
          data,
          count: result.TotalRecordCount || data.length,
          sourceContext: { StartIndex: StartIndex + data.length }
        }
      }
      case 'playlists': {
        const result = await get('Items', {
          SearchTerm: keywords,
          IncludeItemTypes: 'Playlist',
          Fields: 'DateCreated, Overview, ChildCount',
          Recursive: true,
          Limit: limit,
          StartIndex
        })
        const data = (result.Items || []).map(formatPlaylist)
        return {
          code: 200,
          data,
          count: result.TotalRecordCount || data.length,
          sourceContext: { StartIndex: StartIndex + data.length }
        }
      }
      default:
        return { code: 200, data: [], count: 0, sourceContext: {} }
    }
  } catch {
    return { code: 404, data: [], count: 0, sourceContext: {} }
  }
}

exports.userPlaylist = async () => {
  try {
    const [playlists, albums, liked] = await Promise.all([
      getPlaylist(),
      getAlbumlist({ isFavorite: true }),
      getLikedTracks()
    ])

    return { code: 200, liked, playlists, albums, sourceContext: { offset: 0 } }
  } catch {
    return { code: 404, liked: null, playlists: [], albums: [], sourceContext: {} }
  }
}

/**
 * id = '-1' 时代表获取喜欢的歌曲
 */
exports.getPlaylistDetail = getPlaylistDetail

exports.userLikedArtists = async () => {
  try {
    const data = await getArtists({ isFavorite: true })
    return { code: 200, data, sourceContext: {} }
  } catch {
    return { code: 404, data: [], sourceContext: {} }
  }
}

exports.userLikedMVs = () => {
  return { code: 404, data: [], sourceContext: {} }
}

exports.cloudDisk = () => {
  return { code: 404, data: [], sourceContext: {} }
}

exports.getTrackDetail = async (params) => {
  try {
    const ids = params.tracks.map((item) => item.id).join(',')
    const size = params.tracks.length === 1 ? 512 : 256
    const result = await get(`Users/${user.userId}/Items`, {
      Ids: ids,
      Fields: 'DateCreated, Size, Bitrate, IsFavorite, MediaSources'
    })
    const data = result.Items.map((item, idx) => {
      item.PlaylistItemId = params.tracks[idx].PlaylistItemId || ''
      return formatTrack(item, size)
    })
    return { code: 200, data }
  } catch {
    return { code: 404, data: [] }
  }
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
  try {
    const { id, sourceId, idx } = params
    let lyric
    if (sourceId && idx) {
      lyric = await getFileLyric(id, sourceId, idx)
    } else {
      lyric = await getEmbeddedLyric(id)
    }
    const data = await apis.utils.parseLyric(lyric)
    return { code: 200, data }
  } catch {
    return { code: 404, data: [] }
  }
}

exports.addOrRemoveTracksToPlaylist = async (params) => {
  try {
    const { op, playlist, tracks } = params
    const endpoint = `Playlists/${playlist.id}/Items` + (op === 'del' ? '/Delete' : '')
    const ids = tracks
      .map((it) =>
        op === 'add'
          ? it.sourceContext?.id || it.id
          : it.sourceContext?.PlaylistItemId || it.PlaylistItemId
      )
      .join(',')
    const data = op === 'add' ? { Ids: ids, UserId: user.userId } : { EntryIds: ids }
    await post(endpoint, data)
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.likeATrack = async (params) => {
  try {
    const { op, tracks } = params
    const endPoint =
      `Users/${user.userId}/FavoriteItems/${tracks[0].id}` + (op === 'add' ? '' : '/Delete')
    await post(endPoint)
    return { code: 200 }
  } catch (error) {
    console.log('[subscribeAlbum]: ', error)
    return { code: 404 }
  }
}

exports.createPlaylist = async (params) => {
  try {
    const { name } = params
    const result = await post('Playlists', { Name: name, Ids: '', MediaType: 'Audio' })
    const res = await get(`Users/${user.userId}/Items/${result.Id}`, {
      fields: 'ShareLevel',
      ExcludeFields: 'VideoChapters,VideoMediaSources,MediaStreams'
    })
    const playlist = formatPlaylist(res)
    return { code: 200, data: playlist }
  } catch {
    return { code: 404 }
  }
}

exports.deletePlaylist = async (params) => {
  try {
    await post('Items/Delete', { Ids: params.id })
    return { code: 200 }
  } catch (error) {
    console.log('[emby deletePlaylist error]', error)
    return { code: 404 }
  }
}

/**
 * 编辑歌单信息
 * @param {Object} params
 * @param {number|string} params.id
 * @param {string} params.name
 * @param {string} params.desc
 */
exports.editPlaylist = async (params) => {
  try {
    const { id, name, desc } = params
    // Emby API 需要先获取完整数据，修改后全量更新
    const item = await get(`Users/${user.userId}/Items/${id}`)
    item.Name = name
    item.Overview = desc
    delete item.ServerId
    delete item.Etag
    delete item.DateCreated
    await post(`Items/${id}`, item)
    return { code: 200 }
  } catch (error) {
    console.log('[emby editPlaylist error]', error)
    return { code: 404 }
  }
}

exports.getPlaylistTracks = async (params) => {
  try {
    if (params.hasMore === false) return { code: 200, data: [], sourceContext: params }
    const result = await getTracks({ ParentId: params.id })
    const data = result.Items.map((item) => formatTrack(item, 64))
    return { code: 200, data, sourceContext: { id: params.id, hasMore: false } }
  } catch {
    return { code: 404, data: [], sourceContext: {} }
  }
}

exports.getAllTracks = async (_params) => {
  try {
    const { page: rawPage = 0, sort, order, reset } = _params
    const page = reset ? 0 : rawPage
    const map = {
      name: 'SortName',
      createTime: 'DateCreated',
      playCount: 'PlayCount'
    }

    const SortBy = sort === 'id' ? '' : map[sort]
    const SortOrder = order === 'ASC' ? 'Ascending' : 'Descending'
    const params = { SortBy, SortOrder, Limit: 1000, StartIndex: 1000 * page }

    const result = await getTracks(params)
    const data = result.Items.map((item) => formatTrack(item, 64))

    return {
      code: 200,
      data,
      count: result.TotalRecordCount || data.length,
      sourceContext: { page: page + 1 }
    }
  } catch {
    return { code: 404, data: [], count: 0, sourceContext: {} }
  }
}

exports.albumDetail = async (params) => {
  try {
    const { id } = params
    const result = await get(`Users/${user.userId}/Items/${id}`)
    const res = await getTracks({ ParentId: id })
    const tracks = res.Items.map((item) => formatTrack(item, 64))
    result.tracks = tracks

    const data = formatAlbumDetail(result)
    return { code: 200, data, sourceContext: { id } }
  } catch {
    return { code: 404, data: null }
  }
}

exports.artistAlbums = async (params) => {
  try {
    const data = await getAlbumlist({ artistIds: params.id })
    return { code: 200, data, sourceContext: {} }
  } catch {
    return { code: 404, data: [], sourceContext: {} }
  }
}

exports.artistDetail = async (params) => {
  try {
    const [_artist, _songs] = await Promise.all([
      get(`Users/${user.userId}/Items/${params.id}`),
      getTracks({ ArtistIds: params.id })
    ])

    const artist = {
      id: _artist.Id,
      name: _artist.Name,
      picUrl: _artist.ImageTags?.Primary
        ? getPic(_artist.Id, _artist.ImageTags?.Primary, 512)
        : 'vutron://get-singer-pic',
      musicSize: _artist.ChildCount || 0,
      albumSize: _artist.albumSize || _artist.ChildCount || 0,
      mvSize: 0,
      description: _artist.Overview || '',
      followed: _artist.UserData?.IsFavorite || false,
      pluginId: '',
      sourceContext: { id: _artist.Id }
    }

    const songs = _songs.Items.map((item) => formatTrack(item, 64, false))

    return { code: 200, artist, songs, sourceContext: { d: params.id } }
  } catch {
    return { code: 404, artist: null, songs: [], sourceContext: {} }
  }
}

exports.artistMVs = async (params) => {
  return { code: 200, data: [], sourceContext: { id: params.id } }
}

exports.simiArtists = async (params) => {
  try {
    const result = await get(`Artists/${params.id}/Similar`, { Fields: 'Overview' })
    const data = result.Items.map((item) => ({
      id: item.Id,
      name: item.Name,
      pluginId: '',
      picUrl: item.ImageTags?.Primary
        ? getPic(item.Id, item.ImageTags?.Primary, 512)
        : 'vutron://get-singer-pic',
      sourceContext: { id: item.Id }
    }))
    return { code: 200, data, sourceContext: {} }
  } catch {
    return { code: 404, data: [], sourceContext: {} }
  }
}

exports.followArtist = async (params) => {
  try {
    const { op, id } = params
    const endPoint =
      `Users/${user.userId}/FavoriteItems/${id}` + (op === 'unfollow' ? '/Delete' : '')
    await post(endPoint)
    return { code: 200 }
  } catch (error) {
    console.log('[followArtist]: ', error)
    return { code: 404 }
  }
}

exports.subscribeAlbum = async (params) => {
  try {
    const { op, id } = params
    const endPoint = `Users/${user.userId}/FavoriteItems/${id}` + (op === 'add' ? '' : '/Delete')
    await post(endPoint)
    return { code: 200 }
  } catch (error) {
    console.log('[subscribeAlbum]: ', error)
    return { code: 404 }
  }
}

exports.scrobble = async (params) => {
  try {
    const time = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14)
    await post(`Users/${user.userId}/PlayedItems/${params.id}`, { datePlayed: time })
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.userRecord = async () => ({ code: 404, weekData: [], allData: [], sourceContext: {} })
