/**
 * 插件规范：
 * - 禁止 export / import / require，写了也会在运行时报错
 * - 只能通过 exports.xxx = fn 或者 exports.xxx = { xxx } 来导出给外部使用；
 * - 插件需要提供的内容如下，可复制后进行相对应的修改，其中的函数允许修改传参等；
 * - 内部只允许使用
 *   - api.http.get/post发送网络请求；
 *   - api.log打印log；
 *   - api.store.get/set来存储一些必要的数据，如登陆所需要的帐号密码以及token之类的；
 */

/**
 * ===================================
 * 插件api定义。插件内部能使用的权限暂定如下
 * ===================================
 */

/**
 * @typedef {Object} PluginHttp
 * @property {(url: string, params?: object) => Promise<any>} get
 * @property {(url: string, data?: object) => Promise<any>} post
 */

/**
 * @typedef {Object} PluginStore
 * @property {(key: string) => any} get
 * @property {(key: string, value: any) => void} set
 */

/**
 * @typedef {Object} PluginApi
 * @property {PluginHttp} http
 * @property {(msg: string) => void} log
 * @property {PluginStore} store
 */

/**
 * 由宿主注入的 API（仅用于类型提示）
 * @type {PluginApi}
 */
const api = globalThis.api

/**
 * - meta：插件的基础信息
 * - meta.code: 英文，在系统内的插件索引，以及在api.store里进行保存时使用的key；
 * - meta.name: 中英文均可，用来表示这个插件的数据来源，如；
 * - meta.allowedDomains：列表，本插件需要使用到的网址，如自己局域网内部署的各家api服务、vercel服务等，除了这里的网址之外别的网络请求将会被禁止
 */
exports.meta = {
  code: 'demo',
  name: '测试',
  allowedDomains: ['http://192.168.3.6:1993/demo']
}

exports.doLogin = () => {}

exports.search = async (keyword) => {
  const res = await api.http.get(`http://192.168.3.6:1993/demo/search`, { keyword })
  return res
}
