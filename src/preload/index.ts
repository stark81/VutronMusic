import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Whitelist of valid channels used for IPC communication (Send message from Renderer to Main)
const mainAvailChannels: string[] = [
  'msgRequestGetVersion',
  'msgOpenExternalLink',
  'msgOpenFile',
  'msgShowInFolder',
  'msgCheckFileExist',
  'msgScanLocalMusic',
  'getLocalMusic',
  'selecteFolder',
  'updateTray',
  'metadata',
  'updateOsdState',
  'updateTouchBarLyric',
  'showWindow',
  'updatePlayerState',
  'setStoreSettings',
  'deleteLocalMusicDB',
  'upsertLocalPlaylist',
  'deleteLocalPlaylist',
  'logout',
  'accurateMatch',
  'updateLocalTrackInfo',
  'updateStreamingAccount',
  'clearCacheTracks',
  'getCacheTracksInfo',
  'updateLyricInfo',
  'clearDeletedMusic',
  'minimize',
  'maximizeOrUnmaximize',
  'close',
  'askExtensionStatus',
  'stream-login',
  'get-stream-songs',
  'get-stream-playlists',
  'deleteStreamPlaylist',
  'createStreamPlaylist',
  'updateStreamPlaylist',
  'logoutStreamMusic',
  'scrobbleStreamMusic',
  'get-stream-account'
]
const rendererAvailChannels: string[] = [
  'msgHandleScanLocalMusic',
  'scanLocalMusicDone',
  'handleTrayClick',
  'play',
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
  'msgDeletedTracks',
  'msgExtensionCheckResult'
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
  isWindows: process.platform === 'win32'
})
