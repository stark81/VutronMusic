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
 * @property {(key: string) => Promise<any>} get
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
 * 1. 这里的 baseUrl 是为了适配不同用户的部署环境，用户需要在插件设置界面输入自己部署的服务地址，插件才能正常使用；
 * 2. 下面的netease和插件名字一致，否则会导致此插件无法获取已保存的插件信息
 */
// const baseUrl = await apis.store
//   .get('plugins.netease.baseUrl')
//   .catch(() => 'http://127.0.0.1:1993/netease')

/**
 * @param {string} url
 * @param {Object=} params
 */
const get = async (url, params) => {
  const baseUrl = await apis.store
    .get('plugins.netease.baseUrl')
    .then((url) => url || 'http://127.0.0.1:1993/netease')
    .catch(() => 'http://127.0.0.1:1993/netease')
  return apis.http.get(`${baseUrl}/${url}`, params)
}

/**
 * @param {string} url
 * @param {Object=} data
 */
const post = async (url, data) => {
  const baseUrl = await apis.store
    .get('plugins.netease.baseUrl')
    .then((url) => url || 'http://127.0.0.1:1993/netease')
    .catch(() => 'http://127.0.0.1:1993/netease')
  return apis.http.post(`${baseUrl}/${url}`, data)
}

/**
 * - meta：插件的基础信息
 * - meta.name: 中英文均可，用来表示这个插件的数据来源；
 * - meta.type: online 或者 streaming，表示插件类型是线上服务还是自建流媒体服务，作为本地音乐匹配的依据
 */
exports.meta = {
  name: '网易云',
  type: 'online' // online, stream
}

/**
 * 平台连同性测试
 * @returns {boolean}
 */
exports.systemPing = () => true

/**
 * 插件平台的登陆功能，登陆成功后，需要使用apis.store.set来保存所需的帐号相关信息
 */
exports.doLogin = async () => {
  return true
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
exports.getLyric = (params) => get(`lyric/new`, { id: params.id })

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
