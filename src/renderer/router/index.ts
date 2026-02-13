import { HomePage } from '../views'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
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
    component: () => import('../views/ExplorePage.vue'),
    meta: {
      titleKey: 'nav.search',
      keepAlive: true,
      savePosition: true
    }
  },
  {
    path: '/library',
    name: 'library',
    component: () => import(/* webpackPrefetch: true */ '../views/LibraryMusic.vue'),
    meta: {
      titleKey: 'nav.library',
      requireLogin: true
    }
  },
  {
    path: '/streamLogin/:service',
    name: 'streamLogin',
    component: () => import('../views/StreamLogin.vue')
  },
  {
    path: '/stream',
    name: 'stream',
    component: () => import(/* webpackPrefetch: true */ '../views/StreamPage.vue')
  },
  {
    path: '/streamPlaylist/:service/:id',
    name: 'streamPlaylist',
    component: () => import('../views/PlaylistPage.vue')
  },
  {
    path: '/library/liked-songs',
    name: 'likedSongs',
    component: () => import('../views/PlaylistPage.vue'),
    meta: {
      requireLogin: true
    }
  },
  {
    path: '/stream-liked-songs/:service',
    name: 'streamLikedSongs',
    component: () => import('../views/PlaylistPage.vue')
  },
  {
    path: '/localMusic',
    name: 'localMusic',
    component: () => import(/* webpackPrefetch: true */ '../views/LocalMusic.vue'),
    meta: {
      titleKey: 'nav.localMusic'
      // keepAlive: true,
      // savePosition: true
    }
  },
  {
    path: '/tongrenlu',
    name: 'tongrenlu',
    component: () => import('../views/TongrenluPage.vue')
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: () => import('../views/PlaylistPage.vue')
  },
  {
    path: '/localPlaylist/:id',
    name: 'localPlaylist',
    component: () => import('../views/PlaylistPage.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SystemSettings.vue'),
    meta: {
      titleKey: 'nav.settings'
    }
  },
  {
    path: '/daily/songs',
    name: 'dailySongs',
    component: () => import('../views/DailyTracks.vue'),
    meta: {
      requireLogin: true
    }
  },
  {
    path: '/login/account',
    name: 'loginAccount',
    component: () => import('../views/LoginAccount.vue'),
    meta: {
      titleKey: 'title.login'
    }
  },
  {
    path: '/album/:id',
    name: 'album',
    component: () => import('../views/AlbumPage.vue')
  },
  {
    path: '/artist/:id',
    name: 'ArtistPage',
    component: () => import('../views/ArtistPage.vue'),
    meta: {
      keepAlive: true
    }
  },
  {
    path: '/artist/:id/mv',
    name: 'artistMV',
    component: () => import('../views/ArtistMv.vue'),
    meta: {
      keepAlive: true
    }
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('../views/SearchPage.vue'),
    meta: {
      keepAlive: true
    }
  },
  {
    path: '/user/:id',
    name: 'user',
    component: () => import('../views/UserPage.vue')
  },
  {
    path: '/mv/:id',
    name: 'mv',
    component: () => import('../views/MvPage.vue')
  },
  {
    path: '/next',
    name: 'next',
    component: () => import('../views/NextUp.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: window.env?.isElectron ? createWebHashHistory() : createWebHistory(),
  routes
})

// 在 Electron 环境下，默认导航到东方同人录
if (window.env?.isElectron && window.location.hash === '' || window.location.hash === '#/') {
  router.replace('/tongrenlu')
}

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
