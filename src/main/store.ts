import Store from 'electron-store'

export interface TypeElectronStore {
  window: {
    width: number
    height: number
    x?: number
    y?: number
  }
  osdWin: {
    show: boolean
    isLock: boolean
    type: string
    x?: number
    y?: number
    x2?: number
    y2?: number
  }
  settings: {
    [key: string]: any
  }
  accounts: {
    selected: string
    navidrome: {
      url: string
      clientID: string
      anthorization: string
      token: string
      username: string
      password: string
      salt: string
    }
    emby: {
      url: string
      username: string
      password: string
      userId: string
      accessToken: string
    }
  }
}

const store = new Store<TypeElectronStore>({
  defaults: {
    window: {
      width: 1080,
      height: 720
    },
    osdWin: {
      type: 'small',
      show: false,
      isLock: false
    },
    settings: {
      innerFirst: false,
      lang: 'zh',
      enableTrayMenu: false,
      closeAppOption: 'ask',
      useCustomTitlebar: false,
      showTray: true,
      enableGlobalShortcut: false,
      unblockNeteaseMusic: {
        enable: true,
        source: '',
        enableFlac: true,
        orderFirst: true,
        jooxCookie: '',
        qqCookie: ''
      },
      autoCacheTrack: {
        enable: false,
        sizeLimit: 512 as boolean | number
      },
      shortcuts: [
        {
          id: 'play',
          name: '播放/暂停',
          shortcut: 'CommandOrControl+P',
          globalShortcut: 'Alt+CommandOrControl+P'
        },
        {
          id: 'next',
          name: '下一首',
          shortcut: 'CommandOrControl+Right',
          globalShortcut: 'Alt+CommandOrControl+Right'
        },
        {
          id: 'previous',
          name: '上一首',
          shortcut: 'CommandOrControl+Left',
          globalShortcut: 'Alt+CommandOrControl+Left'
        },
        {
          id: 'increaseVolume',
          name: '增加音量',
          shortcut: 'CommandOrControl+Up',
          globalShortcut: 'Alt+CommandOrControl+Up'
        },
        {
          id: 'decreaseVolume',
          name: '减少音量',
          shortcut: 'CommandOrControl+Down',
          globalShortcut: 'Alt+CommandOrControl+Down'
        },
        {
          id: 'like',
          name: '喜欢歌曲',
          shortcut: 'CommandOrControl+L',
          globalShortcut: 'Alt+CommandOrControl+L'
        },
        {
          id: 'minimize',
          name: '隐藏/显示播放器',
          shortcut: 'CommandOrControl+M',
          globalShortcut: 'Alt+CommandOrControl+M'
        }
      ]
    },
    accounts: {
      selected: 'navidrome',
      navidrome: {
        url: '',
        clientID: '',
        anthorization: '',
        username: '',
        password: '',
        token: '',
        salt: ''
      },
      emby: {
        url: '',
        username: '',
        password: '',
        userId: '',
        accessToken: ''
      }
    }
  }
})

export default store
