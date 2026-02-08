/**
 * 插件规范：
 * - 禁止 export / import / require，写了也会在***运行时***报错
 * - 只能通过 exports.xxx = fn 或者 exports.xxx = { xxx } 来导出给外部使用；
 * - 插件需要提供的内容如下，可复制后进行相对应的修改，其中的函数允许修改传参等；
 * - 插件内部只允许使用
 *   - apis.http.get/post发送网络请求；
 *   - apis.log.info/error 来把一些重要信息保存到本地的log文件中；
 *   - apis.store.get/set来存储一些必要的数据，如登陆所需要的帐号密码以及token之类的；
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
 * @typedef {Object} PluginApi
 * @property {PluginHttp} http
 * @property {(msg: string) => void} log
 * @property {PluginStore} store
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
 * 由宿主注入的 API（仅用于类型提示）
 * @type {PluginApi}
 */
/* eslint-disable no-undef */
const apis = api

/**
 * =======================================================================================
 *                          下面的内容是目前插件所需的全部函数，
 *                          只需要按照自己插件的实际情况进行修
 *                             改即可，无需新增其他的内容
 * =======================================================================================
 */

/**
 * @param {string} url
 * @param {Object=} params
 * @param {boolean=} useToken
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

/**
 * - meta：插件的基础信息
 * - meta.name: 中英文均可，用来表示这个插件的数据来源；
 * - meta.type: online 或者 streaming，表示插件类型是线上服务还是自建流媒体服务，作为本地音乐匹配的依据
 */
exports.meta = {
  name: '酷狗',
  type: 'online' // online, stream
}

/**
 * 平台连同性测试
 * @returns {boolean}
 */
exports.systemPing = () => true

exports.loginQrKey = async () => {
  const result = await get('login/qr/key', { timestamp: new Date().getTime() })
  if (result.status === 1) {
    result.data.url = `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${result.data.qrcode}`
  }
  return result
}

exports.loginQrCreate = (params) =>
  get('login/qr/create', { ...params, timestamp: new Date().getTime() })

exports.loginQrCodeCheck = async (params) => {
  const result = await get('login/qr/check', { ...params, timestamp: new Date().getTime() })
  if (result.data.status === 4) {
    const token = result.data.token
    const userid = result.data.userid
    apis.store.set('token', token)
    apis.store.set('userid', userid)
  }
  return result
}

/**
 * 插件平台的登陆功能，登陆成功后，需要使用apis.store.set来保存所需的帐号相关信息
 */
exports.doLogin = () => true

exports.getBanner = (params) => get('pc/diantai', { ...params })

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
