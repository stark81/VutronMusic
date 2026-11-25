import Store from 'electron-store'
import { TrackInfoOrder, streamStatus } from '@/types/music'

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
  pluginEnable: {
    library: boolean
    stream: boolean
    local: boolean
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
      status: streamStatus
    }
    emby: {
      url: string
      username: string
      password: string
      userId: string
      accessToken: string
      status: streamStatus
    }
    jellyfin: {
      url: string
      username: string
      password: string
      userId: string
      accessToken: string
      status: streamStatus
    }
  }
  plugins: {
    [key: string]: Record<string, any>
  }
  security: {
    /**
     * 用户通过系统对话框显式授权过的目录。
     *
     * 注意：该键**不是** `settings.*` 的子键，渲染进程的 `setStoreSettings`
     * 无法写入它（那里的 key 前缀固定为 `settings.`），因此可以作为文件系统
     * 访问权限的可信来源（见 issue #416）。
     */
    grantedPaths: string[]
    /**
     * 用户通过「选择文件」对话框显式授权过的单个文件。
     * 用于 `vutron://local-resource` / `vutron://local-asset` 读取单文件资源
     * （自定义背景图片/视频、lottie 配置文件等）。
     */
    grantedFiles: string[]
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
      trayColor: 0, // 0: 彩色, 1: 白色, 2: 黑色, 3: 跟随系统
      uiScale: 1, // 界面缩放比例：1 = 100%，低分辨率屏幕可调到 0.8 等
      embedCoverArt: 0, // 0: 不嵌入, 1: 内嵌, 2: 歌曲路径下, 3: 两者都嵌入
      embedStyle: 0, // 0: 跳过, 1: 覆盖
      enableGlobalShortcut: false,
      unblockNeteaseMusic: {
        enable: true,
        source: '',
        enableFlac: true,
        orderFirst: true,
        jooxCookie: '',
        qqCookie: ''
      },
      trackInfoOrder: ['path', 'online', 'embedded'] as TrackInfoOrder[],
      autoCacheTrack: {
        enable: false,
        path: '',
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
      ],
      enableAmuseServer: true,
      lastfmSession: { name: '', key: '', subscriber: 0 },
      proxy: { type: 0, address: '', port: '' },
      forceFactor: false,
      showHttpLog: false,
      sourcePriority: {
        lyric: ['self'] as string[],
        comment: ['self'] as string[],
        trackInfoOrder: ['path', 'online', 'embedded']
      }
    },
    pluginEnable: {
      library: true,
      stream: true,
      local: true
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
        salt: '',
        status: 'logout'
      },
      emby: {
        url: '',
        username: '',
        password: '',
        userId: '',
        accessToken: '',
        status: 'logout'
      },
      jellyfin: {
        url: '',
        username: '',
        password: '',
        userId: '',
        accessToken: '',
        status: 'logout'
      }
    },
    plugins: {},
    security: {
      grantedPaths: [],
      grantedFiles: []
    }
  }
})

export default store
