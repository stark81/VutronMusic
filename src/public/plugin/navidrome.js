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
 * @property {(url: string, params?: object, headers?: object, raw?: boolean) => Promise<any>} get raw: 设置为true时返回原始的fetch响应数据，包括响应头、响应码、响应体，否则只返回响应体
 * @property {(url: string, data?: object,  headers?: object, raw?: boolean) => Promise<any>} post
 * @property {(url: string, data?: object,  headers?: object, raw?: boolean) => Promise<any>} delete
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
 * @property {(input: string) => string} md5
 * @property {() => string} generateSalt
 * @property {(password: string, salt: string) => string} generateToken
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

const meta = {
  name: 'Navidrome',
  icon: 'navidrome',
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

const user = { userId: '', userName: '', pwd: '', nativeToken: '', clientId: '', isVip: true }
let baseUrl = ''

apis.db.get('PluginData').then((result) => {
  if (result) {
    user.userName = result.userName || ''
    user.userId = result.userId || ''
    user.pwd = result.pwd || ''
    user.nativeToken = result.nativeToken || ''
    user.clientId = result.clientId || ''
  }
})

apis.store.get('').then((store) => {
  baseUrl = store.baseUrl || ''
})

// ===================================================

function buildSubsonicUrl(endpoint, params = {}) {
  const salt = apis.utils.generateSalt()
  const token = apis.utils.generateToken(user.pwd, salt)
  const query = {
    u: user.userName,
    t: token,
    s: salt,
    v: '1.16.1',
    c: 'VutronMusic',
    f: 'json',
    ...params
  }
  const queryString = Object.entries(query)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `${baseUrl}/rest/${endpoint}?${queryString}`
}

/**
 * @param {string} endpoint
 * @param {Record<string, any>} params
 * @param {'GET' | 'POST'} method
 */
async function subsonicRequest(endpoint, params = {}) {
  const url = buildSubsonicUrl(endpoint, params)
  const response = await apis.http.get(url)
  if (response && response['subsonic-response'] && response['subsonic-response'].status === 'ok') {
    return response['subsonic-response']
  }
  throw new Error(`Subsonic API error: ${response?.['subsonic-response']?.status || 'unknown'}`)
}

function formatPlaylist(item) {
  return {
    id: item.id || -1,
    name: item.name || '我喜欢的音乐',
    picUrl: item.id
      ? buildSubsonicUrl('getCoverArt', { id: item.id, size: 256 })
      : 'vutron://get-default-pic',
    isMine: true,
    trackCount: item.songCount || 0,
    playCount: 0,
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
    sourceContext: { id: item.id || '-1' }
  }
}

function formatPlaylistDetail(item) {
  return {
    id: item.id || '-1',
    name: item.name || '我喜欢的音乐',
    subscribed: false,
    picUrl: item.id
      ? buildSubsonicUrl('getCoverArt', { id: item.id, size: 512 })
      : 'vutron://get-default-pic',
    trackCount: item.songCount || 0,
    updateTime: new Date(item.DateCreated || item.updatedAt || 0).getTime(),
    description: item.comment || '',
    isPrivate: false,
    pluginId: '',
    copywriter: '',
    updateFrequency: '',
    specialPlaylistInfo: null,
    trackIds: [],
    tracks: [],
    tags: [],
    creator: {
      userId: user.userId, // item.ownerId ||
      avatarUrl: '',
      nickname: item.ownerName || user.userName,
      isVip: true,
      signature: '',
      sourceContext: { userId: item.ownerId || user.userId }
    },
    sourceContext: { id: item.id || '-1' }
  }
}

function formatTrack(item, idx) {
  return {
    id: item.mediaFileId || item.id || '',
    name: item.title ?? '',
    duration: (item.duration || 0) * 1000,
    alias: [],
    playable: true,
    reason: '',
    createTime: new Date(item.updatedAt || item.createdAt || 0).getTime(),
    no: item.trackNumber || 1,
    mvid: 0,
    size: item.size || 0,
    playCount: item.playCount || 0,
    album: {
      id: item.albumId ?? '',
      name: item.album ?? '',
      picUrl: buildSubsonicUrl('getCoverArt', { id: item.albumId, size: 64 }),
      pluginId: '',
      sourceContext: { id: item.albumId || '' }
    },
    picUrl: buildSubsonicUrl('getCoverArt', { id: item.albumId, size: 64 }),
    artists: [
      {
        id: item.artistId || '',
        name: item.artist || '未知艺人',
        picUrl: buildSubsonicUrl('getCoverArt', {
          id: item.artistId || item.albumId || item.id,
          size: 64
        }),
        pluginId: '',
        sourceContext: { id: item.artistId || '' }
      }
    ],
    albumArtists: [
      {
        id: item.albumArtistId || item.artistId || '',
        name: item.albumArtist || item.artist || '未知艺人',
        picUrl: buildSubsonicUrl('getCoverArt', {
          id: item.albumArtistId || item.artistId || '',
          size: 64
        }),
        pluginId: '',
        sourceContext: { id: item.albumArtistId || item.artistId || '' }
      }
    ],
    pluginId: '',
    type: meta.type,
    sourceContext: {
      id: item.mediaFileId || item.id || '',
      idx: idx + 1
    }
  }
}

async function getTracks(params) {
  const result = await nativeRequest('song', { params, raw: true })
  const tracks = result.data.map(formatTrack)
  const count = Number(result.headers?.['x-total-count']) || 0
  return { tracks, count }
}

async function getUserLikedTracks() {
  const params = { starred: true }
  const { tracks, count } = await getTracks(params)
  return { tracks, count }
}

async function getPlaylistDetail(params) {
  try {
    if (params.id === '-1') {
      const playlist = formatPlaylistDetail({})
      const { tracks, count } = await getUserLikedTracks()
      playlist.tracks = tracks
      playlist.trackCount = count
      return { code: 200, data: playlist }
    } else {
      const result = await nativeRequest('playlist', { id: params.id })
      const playlist = result.find((item) => item.id === params.id)
      if (!playlist) return { code: 404, data: null }
      const data = formatPlaylistDetail(playlist)
      return { code: 200, data }
    }
  } catch {
    return { code: 404, data: null }
  }
}

function formatTime(time, rate = 1000) {
  const totalSeconds = time / rate
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  let secondsStr = seconds.toFixed(1)
  if (seconds < 10 && secondsStr.length < 4) {
    secondsStr = '0' + secondsStr
  }

  const minutesStr = String(minutes).padStart(2, '0')
  return `[${minutesStr}:${secondsStr}]`
}

async function nativeRequest(endpoint, options = {}) {
  try {
    const { method = 'GET', params = {}, raw } = options
    const url = `${baseUrl}/api/${endpoint}`
    const headers = {
      'x-nd-authorization': `Bearer ${user.nativeToken}`,
      'x-nd-client-unique-id': user.clientId || '',
      'Content-Type': 'application/json'
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      return await apis.http.post(url, params, headers, !!raw)
    } else {
      let fullUrl = url
      if (Object.keys(params).length) {
        const query = new URLSearchParams(params).toString()
        fullUrl = `${url}?${query}`
      }
      const fn = method === 'GET' ? apis.http.get : apis.http.delete
      return await fn(fullUrl, {}, headers, !!raw)
    }
  } catch (error) {
    const errMsg = error?.error || error?.response?.data?.error || error?.message || error
    if (errMsg === 'Not authenticated') {
      throw new Error('UNAUTHORIZED')
    }
    throw new Error(errMsg || 'UNKNOWN_ERROR')
  }
}

function formatAlbum(item) {
  return {
    id: item.id ?? '',
    name: item.name ?? '',
    picUrl: buildSubsonicUrl('getCoverArt', { id: item.id, size: 256 }),
    artists: [
      {
        id: item.albumArtistId || '',
        name: item.albumArtist || '',
        picUrl: buildSubsonicUrl('getCoverArt', { id: item.albumArtistId, size: 512 }),
        pluginId: '',
        sourceContext: { id: item.albumArtistId || '' }
      }
    ],
    createTime: new Date(item.updatedAt || item.createdAt || 0).getTime(),
    copywriter: `专辑 · ${item.releaseDate || ''}`,
    type: '专辑',
    pluginId: '',
    sourceContext: { id: item.id }
  }
}

function formatAlbumDetail(item) {
  return {
    id: item.id ?? '',
    name: item.name ?? '',
    picUrl: buildSubsonicUrl('getCoverArt', { id: item.id, size: 512 }),
    type: 'Album',
    isExplicit: false,
    subscribed: item.starred || false,
    publishTime: new Date(item.createdAt || 0).getTime(),
    size: item.songCount || 0,
    company: '',
    description: '',
    songs: item.songs || [],
    artists: [
      {
        id: item.albumArtistId ?? '',
        name: item.albumArtist ?? '',
        picUrl: buildSubsonicUrl('getCoverArt', { id: item.albumArtistId, size: 512 }),
        pluginId: '',
        sourceContext: { id: item.albumArtistId }
      }
    ],

    pluginId: '',
    sourceContext: { id: item.id }
  }
}

async function getAlbumlist(params) {
  const result = await nativeRequest('album', { params, raw: true })
  const albums = result.data.map(formatAlbum)
  const count = Number(result.headers?.['x-total-count']) || 0
  return { albums, count }
}

async function getArtists(params) {
  const result = await nativeRequest('artist', { params, raw: true })
  const artists = result.data.map((item) => ({
    id: item.id ?? '',
    name: item.name ?? '',
    picUrl: buildSubsonicUrl('getCoverArt', { id: item.id, size: 256 }),
    pluginId: '',
    sourceContext: { id: item.id }
  }))
  const count = Number(result.headers?.['x-total-count']) || 0
  return { artists, count }
}

exports.updateBaseUrl = async (params) => {
  const url = params.url.replace(/\/$/, '')
  baseUrl = url
  apis.store.set('baseUrl', url)
  return { code: 200 }
}

exports.systemPing = async () => {
  try {
    const result = await subsonicRequest('ping')
    if (result && result.status === 'ok') {
      return { code: 200, status: user.nativeToken ? 'login' : 'logout' }
    }
  } catch {
    user.nativeToken = ''
    user.clientId = ''
    apis.db.set('PluginData', user)
    return { code: 404, status: 'offline' }
  }
}

exports.getAccount = () => {
  return { code: 200, baseUrl, userName: user.userName, pwd: user.pwd }
}

exports.doLogin = async (params) => {
  try {
    const endpoint = `${baseUrl}/auth/login`
    const result = await apis.http.post(endpoint, {
      username: params.userName,
      password: params.pwd
    })

    if (result.error) {
      return { code: 404, message: result.error }
    }

    const { id, token } = result
    user.nativeToken = token
    user.clientId = id
    user.userId = params.userName
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
    console.log('[navidrome login failed]', error)
    return { code: 404, message: 'navidrome login failed' }
  }
}

exports.doLogout = () => {
  try {
    user.Id = ''
    user.nativeToken = ''
    user.clientId = ''
    apis.db.set('PluginData', user)
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.getAllTracks = async (_params) => {
  try {
    const { _start: rawStart = 0, sort, order, hasMore = true, reset, pageSize = 1000 } = _params
    const _start = reset ? 0 : rawStart

    if (!hasMore) return { code: 200, data: [], count: 0, sourceContext: _params }

    const map = {
      name: 'title',
      createTime: 'createdAt',
      playCount: 'play_count'
    }
    const _end = _start + pageSize
    const params = { _start, _end, _sort: map[sort], _order: order }
    const { tracks, count } = await getTracks(params)

    return {
      code: 200,
      data: tracks,
      count,
      sourceContext: { _start: _start + tracks.length }
    }
  } catch {
    return { code: 404, data: [], count: 0, sourceContext: {} }
  }
}

exports.search = async (_params) => {
  try {
    const { tab, keywords, reset } = _params
    const _start = reset ? 0 : _params._start || 0
    if (!keywords) return { code: 200, data: [], count: 0, sourceContext: {} }

    const pageSize = 50

    switch (tab) {
      case 'tracks': {
        const result = await subsonicRequest('search3', {
          query: keywords,
          songCount: pageSize,
          songOffset: _start
        })
        const songs = result.searchResult3?.song || []
        const data = songs.map((item) => {
          const trackId = item.id
          return {
            id: trackId,
            name: item.title ?? '',
            duration: (item.duration || 0) * 1000,
            alias: [],
            playable: true,
            reason: '',
            createTime: Date.now(),
            no: item.track || 1,
            mvid: 0,
            playCount: 0,
            album: {
              id: item.albumId || '',
              name: item.album || '',
              picUrl: buildSubsonicUrl('getCoverArt', { id: item.albumId || trackId, size: 64 }),
              pluginId: '',
              sourceContext: { id: item.albumId || '' }
            },
            picUrl: buildSubsonicUrl('getCoverArt', { id: item.albumId || trackId, size: 64 }),
            artists: [
              {
                id: item.artistId || '',
                name: item.artist || '未知艺人',
                picUrl: '',
                pluginId: '',
                sourceContext: { id: item.artistId || '' }
              }
            ],
            albumArtists: [
              {
                id: item.artistId || '',
                name: item.artist || '未知艺人',
                picUrl: '',
                pluginId: '',
                sourceContext: { id: item.artistId || '' }
              }
            ],
            pluginId: '',
            type: meta.type,
            sourceContext: { id: trackId }
          }
        })
        return {
          code: 200,
          data,
          count: songs.length < pageSize ? _start + songs.length : -1,
          sourceContext: { _start: _start + data.length }
        }
      }
      case 'albums': {
        const result = await subsonicRequest('search3', {
          query: keywords,
          albumCount: pageSize,
          albumOffset: _start
        })
        const albums = result.searchResult3?.album || []
        const data = albums.map((item) => ({
          id: item.id,
          name: item.name,
          picUrl: buildSubsonicUrl('getCoverArt', { id: item.id, size: 256 }),
          artists: [
            {
              id: item.artistId || '',
              name: item.artist || '',
              picUrl: '',
              pluginId: '',
              sourceContext: { id: item.artistId || '' }
            }
          ],
          createTime: item.created ? new Date(item.created).getTime() : Date.now(),
          copywriter: item.year ? `专辑 · ${item.year}` : '',
          type: '专辑',
          pluginId: '',
          sourceContext: { id: item.id }
        }))
        return {
          code: 200,
          data,
          count: albums.length < pageSize ? _start + albums.length : -1,
          sourceContext: { _start: _start + data.length }
        }
      }
      case 'artists': {
        const result = await subsonicRequest('search3', {
          query: keywords,
          artistCount: pageSize,
          artistOffset: _start
        })
        const artists = result.searchResult3?.artist || []
        const data = artists.map((item) => ({
          id: item.id,
          name: item.name,
          picUrl: buildSubsonicUrl('getCoverArt', { id: item.id, size: 256 }),
          pluginId: '',
          sourceContext: { id: item.id }
        }))
        return {
          code: 200,
          data,
          count: artists.length < pageSize ? _start + artists.length : -1,
          sourceContext: { _start: _start + data.length }
        }
      }
      case 'playlists': {
        const result = await nativeRequest('playlist')
        const filtered = keywords
          ? result.filter((p) => p.name?.toLowerCase().includes(keywords.toLowerCase()))
          : result
        const data = filtered.map(formatPlaylist)
        return { code: 200, data, count: data.length, sourceContext: {} }
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
    const [playlistResp, albumsResp, liked] = await Promise.all([
      nativeRequest('playlist'),
      getAlbumlist({ starred: true }),
      formatPlaylist({})
    ])

    const playlists = playlistResp.map((p) => formatPlaylist(p))
    return { code: 200, liked, playlists, albums: albumsResp.albums, sourceContext: { offset: 0 } }
  } catch {
    return { code: 404, liked: null, playlists: [], albums: [], sourceContext: {} }
  }
}

exports.getLyric = async (params) => {
  try {
    const result = await subsonicRequest('getLyricsBySongId.view', { id: params.id })
    const lyricRaw = result.lyricsList?.structuredLyrics?.[0]?.line || []
    if (!lyricRaw.length) return { code: 200, data: [] }

    const lrc = lyricRaw
      .map(({ start, value }) => {
        const timeStr = formatTime(start)
        return `${timeStr}${value}`
      })
      .join('\n')
    const data = await apis.utils.parseLyric(lrc)
    return { code: 200, data }
  } catch {
    return { code: 404, data: [] }
  }
}

exports.userLikedArtists = async () => {
  try {
    const result = await getArtists({ starred: true })
    return { code: 200, data: result.artists, sourceContext: {} }
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

exports.getPlaylistDetail = getPlaylistDetail

exports.getPlaylistTracks = async (params) => {
  try {
    const result = await nativeRequest(`playlist/${params.id}/tracks`, { _start: 0, _end: 0 })
    const data = result.map(formatTrack)
    return { code: 200, data, sourceContext: params }
  } catch {
    return { code: 404, data: [], sourceContext: {} }
  }
}

exports.getTrackDetail = async (params) => {
  try {
    const result = await Promise.all(params.tracks.map((item) => nativeRequest(`song/${item.id}`)))

    const data = result.map(formatTrack)
    return { code: 200, data }
  } catch {
    return { code: 404, data: [] }
  }
}

exports.songUrl = async (params) => {
  const url = buildSubsonicUrl('stream', { id: params.id })
  return { code: 200, data: { url: [url], replayGain: 0, peak: 1 } }
}

exports.resizePicUrl = (params) => {
  const { url, size } = params
  const u = new URL(url)
  u.searchParams.set('size', `${size}`)
  return { code: 200, data: u.href }
}

exports.addOrRemoveTracksToPlaylist = async (_params) => {
  try {
    const { op, playlist, tracks } = _params
    let endpoint = `playlist/${playlist.id}/tracks`
    const params = {}
    let method = ''
    if (op === 'add') {
      params.ids = tracks.map((it) => it.sourceContext?.id || it.id)
      method = 'POST'
    } else {
      const __params = new URLSearchParams()
      tracks.forEach((item) => __params.append('id', item.sourceContext?.idx || item.idx))
      endpoint = `${endpoint}?${__params.toString()}`
      method = 'DELETE'
    }
    await nativeRequest(endpoint, { params, method })
    return { code: 200 }
  } catch (error) {
    console.log('[navidrome addOrRemoveTracksToPlaylist]', error)
    return { code: 404 }
  }
}

exports.likeATrack = async (params) => {
  try {
    const { op, tracks } = params
    const id = tracks.map((track) => track.id).join(',')
    const endpoint = op === 'add' ? 'star' : 'unstar'
    await subsonicRequest(endpoint, { id })
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.createPlaylist = async (_params) => {
  try {
    const params = { name: _params.name }
    const result = await subsonicRequest('createPlaylist', params)
    const playlist = formatPlaylist(result.playlist)
    return { code: 200, data: playlist }
  } catch (error) {
    console.log('[navidrome createPlaylist error]: ', error)
    return { code: 404 }
  }
}

exports.deletePlaylist = async (params) => {
  try {
    await subsonicRequest('deletePlaylist', { id: params.id })
    return { code: 200 }
  } catch (error) {
    console.log('[navidrome deletePlaylist error]', error)
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
    await subsonicRequest('updatePlaylist', { playlistId: id, name, comment: desc })
    return { code: 200 }
  } catch (error) {
    console.log('[navidrome editPlaylist error]', error)
    return { code: 404 }
  }
}

exports.albumDetail = async (params) => {
  try {
    const [result, { tracks }] = await Promise.all([
      nativeRequest(`album/${params.id}`),
      getTracks({ _start: 0, _end: 0, album_id: params.id })
    ])
    result.songs = tracks
    const data = formatAlbumDetail(result)
    return { code: 200, data, sourceContext: params }
  } catch {
    return { code: 404, data: null }
  }
}

exports.artistAlbums = async (params) => {
  try {
    const result = await getAlbumlist({ artist_id: params.id })
    return { code: 200, data: result.albums, sourceContext: {} }
  } catch {
    return { code: 404, data: [], sourceContext: {} }
  }
}

exports.subscribeAlbum = async (params) => {
  try {
    const { op, id } = params
    const endpoint = op === 'add' ? 'star' : 'unstar'
    await subsonicRequest(endpoint, { albumId: id })
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.artistDetail = async (params) => {
  try {
    const [_artist, { tracks: songs }] = await Promise.all([
      nativeRequest(`artist/${params.id}`),
      getTracks({ _start: 0, _end: 0, artist_id: params.id })
    ])

    const artist = {
      id: _artist.id,
      name: _artist.name,
      picUrl: buildSubsonicUrl('getCoverArt', { id: _artist.id, size: 256 }),
      musicSize: _artist.songCount || 0,
      albumSize: _artist.albumCount || 0,
      mvSize: 0,
      description: '',
      followed: _artist.starred || false,
      pluginId: '',
      sourceContext: { id: _artist.id }
    }

    return { code: 200, artist, songs, sourceContext: params }
  } catch {
    return { code: 404, artist: null, songs: [], sourceContext: {} }
  }
}

exports.artistMVs = async (params) => {
  return { code: 200, data: [], sourceContext: params }
}

exports.simiArtists = async (params) => {
  return { code: 200, data: [], sourceContext: params }
}

exports.followArtist = async (params) => {
  try {
    const { op, id } = params
    const endpoint = op === 'unfollow' ? 'unstar' : 'star'
    await subsonicRequest(endpoint, { artistId: id })
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.scrobble = async (params) => {
  try {
    await subsonicRequest('scrobble', { id: params.id })
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.reportPlayback = async (params) => {
  try {
    if (params.type === 'end') return { code: 200 }

    await subsonicRequest('scrobble', {
      id: params.id,
      submission: false,
      time: Date.now() - (params.position || 0) * 1000
    })
    return { code: 200 }
  } catch {
    return { code: 404 }
  }
}

exports.userRecord = async () => ({ code: 404, weekData: [], allData: [], sourceContext: {} })
