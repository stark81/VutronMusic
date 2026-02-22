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
  'showOpenDialog',
  'getFilesInFolder',
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
  'deleteACacheTrack',
  'updateLyricInfo',
  'clearDeletedMusic',
  'minimize',
  'maximizeOrUnmaximize',
  'close',
  'askExtensionStatus',
  'stream-login',
  'get-stream-songs',
  'get-stream-playlists',
  'get-stream-lyric',
  'deleteStreamPlaylist',
  'createStreamPlaylist',
  'updateStreamPlaylist',
  'logoutStreamMusic',
  'scrobbleStreamMusic',
  'likeAStreamTrack',
  'systemPing',
  'get-stream-account',
  'check-update',
  'downloadUpdate',
  'update-powersave',
  'openLogFile',
  'updateTooltip',
  'write-cover',
  'getFontList',
  'cacheATrack',
  'playDiscordPresence',
  'pauseDiscordPresence',
  'lastfm-auth',
  'get-lastfm-session',
  'disconnect-lastfm',
  'update-now-playing',
  'track-scrobble',
  'get-screenshot',
  'delete-screenshot',
  'get-cache-path',
  'plugin-method-call',
  'get-plugins'
]
const rendererAvailChannels: string[] = [
  'msgHandleScanLocalMusic',
  'msgHandleScanLocalMusicError',
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
  'msgExtensionCheckResult',
  'resume',
  'update-not-available',
  'update-error',
  'download-progress',
  'setPosition',
  'changeRouteTo',
  'updateAmuseServerStatus',
  'receiveCacheInfo',
  'updateLocalMusic'
]

let messagePort: MessagePort | null = null

ipcRenderer.on('port-connect', (event: any) => {
  if (messagePort) {
    messagePort.close()
  }
  messagePort = event.ports[0]
  messagePort.start()

  messagePort.onmessage = (event) => {
    window.postMessage(event.data, '*')
  }

  window.postMessage({ type: 'init-from-osd' }, '*')
})

window.addEventListener('unload', () => {
  if (messagePort) {
    messagePort.close()
  }
})

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
  },
  sendMessage: (message: any) => {
    messagePort?.postMessage(message)
  },
  closeMessagePort: () => {
    if (messagePort) {
      messagePort.close()
      messagePort = null
    }
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
