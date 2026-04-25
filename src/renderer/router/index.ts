import { HomePage, DailyTracks, ExplorePage, AlbumPage, ArtistPage, SearchPage } from '../views'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { usePluginMusic } from '../store/pluginMusic'
import type { LoginType, MusicType } from '@/types/plugin'

const routes = [
  {
    path: '/',
    name: 'HomePage',
    component: HomePage,
    meta: { sourceType: 'library' as MusicType }
  },
  {
    path: '/explore',
    name: 'explore',
    component: ExplorePage,
    meta: { sourceType: 'library' as MusicType }
  },
  {
    path: '/library',
    name: 'library',
    component: () => import(/* webpackPrefetch: true */ '../views/LibraryMusic.vue'),
    meta: { sourceType: 'library' as MusicType, requireLogin: true }
  },
  {
    path: '/stream',
    name: 'stream',
    component: () => import(/* webpackPrefetch: true */ '../views/StreamPage.vue'),
    meta: { sourceType: 'stream' as MusicType, requireLogin: true }
  },
  {
    path: '/liked-songs/:pluginId+',
    name: 'likedSongs',
    component: () => import('../views/PlaylistPage.vue')
  },
  {
    path: '/localMusic',
    name: 'localMusic',
    component: () => import(/* webpackPrefetch: true */ '../views/LocalMusic.vue'),
    meta: { sourceType: 'local' as MusicType, requireLogin: true }
  },
  {
    path: '/Playlist/:pluginId/:sourceContext',
    name: 'Playlist',
    component: () => import('../views/PlaylistPage.vue')
  },
  {
    path: '/localPlaylist/:id',
    name: 'localPlaylist',
    component: () => import('../views/PlaylistPage.vue'),
    meta: { sourceType: 'local' as MusicType }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SystemSettings.vue')
  },
  {
    path: '/daily/songs/:pluginId',
    name: 'dailySongs',
    component: DailyTracks
  },
  {
    path: '/login/:service/:type',
    name: 'login',
    component: () => import('../views/LoginAccount.vue')
  },
  {
    path: '/album/:pluginId/:sourceContext',
    name: 'album',
    component: AlbumPage
  },
  {
    path: '/artist/:pluginId/:sourceContext',
    name: 'ArtistPage',
    component: ArtistPage
  },
  {
    path: '/artistmv/:pluginId/:sourceContext',
    name: 'artistMV',
    component: () => import('../views/ArtistMv.vue')
  },
  {
    path: '/search',
    name: 'search',
    component: SearchPage
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

  const pluginMusicStore = usePluginMusic()
  const { enableLibrary, enableStream, enableLocal, services } = pluginMusicStore

  const sourceType = to.meta.sourceType as MusicType | undefined

  if (sourceType) {
    const enableMap: Record<MusicType, boolean> = {
      library: enableLibrary,
      stream: enableStream,
      local: enableLocal
    }
    if (!enableMap[sourceType]) {
      const fallbacks: [MusicType, string][] = [
        ['library', '/'],
        ['stream', '/stream'],
        ['local', '/localMusic']
      ]
      for (const [type, path] of fallbacks) {
        if (enableMap[type]) return next(path)
      }
      return next('/settings')
    }
  }

  if (to.meta.requireLogin && sourceType) {
    const hasLoggedIn = services.some((s) => s.type === sourceType && s.status === 'login')
    if (!hasLoggedIn) {
      if (to.name === 'login') return next()

      const plugins = services.filter((s) => s.type === sourceType)
      const pluginId = plugins[0]?.code ?? 'netease'
      const loginTypeMap: Record<MusicType, LoginType> = {
        library: 'QrCode',
        stream: 'Username',
        local: 'LocalDir'
      }
      return next({
        name: 'login',
        params: { service: pluginId, type: loginTypeMap[sourceType] }
      })
    }
  }

  next()
})

export default router
