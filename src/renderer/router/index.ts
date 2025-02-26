import {
  LocalMusicScreen,
  SystemSettings,
  ErrorScreen,
  LoginAccount,
  LibraryMusic,
  AlbumPage,
  ArtistPage,
  UserPage,
  MvPage,
  ArtistMv,
  SearchPage,
  HomePage,
  ExplorePage,
  PlaylistPage,
  DailyTracks,
  NextUp,
  StreamLogin,
  StreamPage
} from '../views'
import { createRouter, createWebHashHistory } from 'vue-router'
import { isAccountLoggedIn } from '../utils/auth'

const routes = [
  {
    path: '/',
    name: 'HomePage',
    component: HomePage,
    meta: {
      titleKey: 'nav.home',
      keepAlive: true,
      savePosition: true
    }
  },
  {
    path: '/explore',
    name: 'explore',
    component: ExplorePage,
    meta: {
      titleKey: 'nav.search',
      keepAlive: true,
      savePosition: true
    }
  },
  {
    path: '/library',
    name: 'library',
    component: LibraryMusic,
    meta: {
      titleKey: 'nav.library',
      requireLogin: true
    }
  },
  {
    path: '/streamLogin',
    name: 'streamLogin',
    component: StreamLogin
  },
  {
    path: '/stream',
    name: 'stream',
    component: StreamPage
  },
  {
    path: '/streamPlaylist/:id',
    name: 'streamPlaylist',
    component: PlaylistPage
  },
  {
    path: '/library/liked-songs',
    name: 'likedSongs',
    component: PlaylistPage,
    meta: {
      requireLogin: true
    }
  },
  {
    path: '/stream-liked-songs',
    name: 'streamLikedSongs',
    component: PlaylistPage
  },
  {
    path: '/localMusic',
    name: 'localMusic',
    component: LocalMusicScreen,
    meta: {
      titleKey: 'nav.localMusic'
      // keepAlive: true,
      // savePosition: true
    }
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: PlaylistPage
  },
  {
    path: '/localPlaylist/:id',
    name: 'localPlaylist',
    component: PlaylistPage
  },
  {
    path: '/settings',
    name: 'settings',
    component: SystemSettings,
    meta: {
      titleKey: 'nav.settings'
    }
  },
  {
    path: '/daily/songs',
    name: 'dailySongs',
    component: DailyTracks,
    meta: {
      requireLogin: true
    }
  },
  {
    path: '/error',
    name: 'error',
    component: ErrorScreen,
    meta: {
      titleKey: 'title.error'
    }
  },
  {
    path: '/login/account',
    name: 'loginAccount',
    component: LoginAccount,
    meta: {
      titleKey: 'title.login'
    }
  },
  {
    path: '/album/:id',
    name: 'album',
    component: AlbumPage
  },
  {
    path: '/artist/:id',
    name: 'ArtistPage',
    component: ArtistPage,
    meta: {
      keepAlive: true
    }
  },
  {
    path: '/artist/:id/mv',
    name: 'artistMV',
    component: ArtistMv,
    meta: {
      keepAlive: true
    }
  },
  {
    path: '/search',
    name: 'search',
    component: SearchPage,
    meta: {
      keepAlive: true
    }
  },
  {
    path: '/user/:id',
    name: 'user',
    component: UserPage
  },
  {
    path: '/mv/:id',
    name: 'mv',
    component: MvPage
  },
  {
    path: '/next',
    name: 'next',
    component: NextUp
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.documentElement.scrollTo({ top: 0 })
  if (to.meta.requireLogin) {
    if (isAccountLoggedIn()) {
      next()
    } else {
      next('/login/account')
    }
  } else {
    next()
  }
})

export default router
