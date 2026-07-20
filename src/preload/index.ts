import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Whitelist of valid channels used for IPC communication (Send message from Renderer to Main)
const mainAvailChannels: string[] = [
  'msgRequestGetVersion',
  'msgOpenExternalLink',
  'msgOpenFile',
  'msgShowInFolder',
  'msgCheckFileExist',
  'msgScanLocalMusic',
  'selecteFolder',
  'showOpenDialog',
  'getFilesInFolder',
  'initTrayState',
  'updateTrayVisibility',
  'metadata',
  'updateOsdState',
  'setStoreSettings',
  'deleteLocalMusicDB',
  'accurateMatch',
  'clearCacheTracks',
  'getCacheTracksInfo',
  'clearDeletedMusic',
  'minimize',
  'maximizeOrUnmaximize',
  'close',
  'askExtensionStatus',
  'check-update',
  'downloadUpdate',
  'update-powersave',
  'openLogFile',
  'getFontList',
  'playDiscordPresence',
  'pauseDiscordPresence',
  'lastfm-auth',
  'get-lastfm-session',
  'disconnect-lastfm',
  'report-playback',
  'getStreamMatchCount',
  'trackMatch',
  'plugin-comment',
  'plugin-lyric',
  'get-screenshot',
  'delete-screenshot',
  'get-cache-path',
  'get-song-url',
  'plugin-method-call',
  'get-plugins',
  'upload-plugin',
  'get-source-priority',
  'set-source-priority',
  'setPluginEnable',
  'get-lyric-offset',
  'set-lyric-offset',
  'create-plugin-instance',
  'delete-plugin-instance',
  'clearStreamMatches',
  'update-osd-lyric',
  'synchronize-player-info'
]
const rendererAvailChannels: string[] = [
  'msgHandleScanLocalMusicError',
  'scanLocalMusicDone',
  'scanLocalMusicProgress',
  'handleTrayClick',
  'play',
  'pause',
  'previous',
  'next',
  'repeat',
  'repeat-shuffle',
  'like',
  'increaseVolume',
  'decreaseVolume',
  'fm-trash',
  'updateOSDSetting',
  'rememberCloseAppOption',
  'msgExtensionCheckResult',
  'resume',
  'update-error',
  'download-progress',
  'setPosition',
  'changeRouteTo',
  'updateAmuseServerStatus',
  'receiveCacheInfo',
  'init-from-osd',
  'get-seek'
]

contextBridge.exposeInMainWorld('mainApi', {
  send: (channel: string, ...data: any[]): void => {
    if (mainAvailChannels.includes(channel)) {
      ipcRenderer.send.apply(null, [channel, ...data])
    } else {
      throw new Error(`Unknown ipc channel name: ${channel}`)
    }
  },
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void => {
    if (rendererAvailChannels.includes(channel)) {
      ipcRenderer.on(channel, listener)
    } else {
      throw new Error(`Unknown ipc channel name: ${channel}`)
    }
  },
  once: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void => {
    if (rendererAvailChannels.includes(channel)) {
      ipcRenderer.once(channel, listener)
    } else {
      throw new Error(`Unknown ipc channel name: ${channel}`)
    }
  },
  off: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void => {
    if (rendererAvailChannels.includes(channel)) {
      ipcRenderer.off(channel, listener)
    } else {
      throw new Error(`Unknown ipc channel name: ${channel}`)
    }
  },
  invoke: async (channel: string, ...data: any[]): Promise<any> => {
    if (mainAvailChannels.includes(channel)) {
      const result = await ipcRenderer.invoke.apply(null, [channel, ...data])
      return result
    }

    throw new Error(`Unknown ipc channel name: ${channel}`)
  }
})

contextBridge.exposeInMainWorld('env', {
  isElectron: true,
  isEnableTitlebar: process.platform === 'win32' || process.platform === 'linux',
  isLinux: process.platform === 'linux',
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isDev: process.env.NODE_ENV === 'development'
})
