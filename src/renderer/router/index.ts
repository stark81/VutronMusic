import { HomePage } from '../views'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { isAccountLoggedIn } from '../utils/auth'

const routes = [
  {
    path: '/',
    name: 'HomePage',
    component: HomePage
  },
  {
    path: '/explore',
    name: 'explore',
    component: () => import('../views/ExplorePage.vue')
  },
  {
    path: '/library',
    name: 'library',
    component: () => import(/* webpackPrefetch: true */ '../views/LibraryMusic.vue')
  },
  {
    path: '/stream',
    name: 'stream',
    component: () => import(/* webpackPrefetch: true */ '../views/StreamPage.vue')
  },
  {
    path: '/liked-songs/:pluginId+',
    name: 'likedSongs',
    component: () => import('../views/PlaylistPage.vue')
  },
  {
    path: '/localMusic',
    name: 'localMusic',
    component: () => import(/* webpackPrefetch: true */ '../views/LocalMusic.vue')
  },
  {
    path: '/Playlist/:pluginId/:sourceContext',
    name: 'Playlist',
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
    component: () => import('../views/SystemSettings.vue')
  },
  {
    path: '/daily/songs/:pluginId',
    name: 'dailySongs',
    component: () => import('../views/DailyTracks.vue')
  },
  {
    path: '/login/:service/:type',
    name: 'login',
    component: () => import('../views/LoginAccount.vue')
  },
  {
    path: '/album/:pluginId/:sourceContext',
    name: 'album',
    component: () => import('../views/AlbumPage.vue')
  },
  {
    path: '/artist/:pluginId/:sourceContext',
    name: 'ArtistPage',
    component: () => import('../views/ArtistPage.vue')
  },
  {
    path: '/artistmv/:pluginId/:sourceContext',
    name: 'artistMV',
    component: () => import('../views/ArtistMv.vue')
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('../views/SearchPage.vue')
  },
  {
    path: '/user/:id',
    name: 'user',
    component: () => import('../views/UserPage.vue')
  },
  {
    path: '/mv/:pluginId/:sourceContext',
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

router.beforeEach((to, from, next) => {
  document.documentElement.scrollTo({ top: 0 })
  if (to.meta.requireLogin) {
    if (isAccountLoggedIn()) {
      next()
    } else {
      next('/onlineMusic/login/kugou')
    }
  } else {
    next()
  }
})

export default router
