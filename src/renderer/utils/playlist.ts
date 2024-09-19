import { isAccountLoggedIn } from './auth'
import { recommendPlaylist, dailyRecommendPlaylist, getPlaylistDetail } from '../api/playlist'

export const getRecommendPlayList = async (limit: number, removePrivateRecommand: boolean) => {
  if (isAccountLoggedIn()) {
    const playlists = await Promise.all([dailyRecommendPlaylist(), recommendPlaylist({ limit })])
    let recommend = playlists[0].recommend ?? []
    if (recommend.length) {
      if (removePrivateRecommand) recommend = recommend.slice(1)
      await replaceRecommendResult(recommend)
    }
    const lists = [...new Map(recommend.concat(playlists[1].result).map((p) => [p.id, p])).values()]
    return lists.slice(0, limit)
    // return recommend.concat(playlists[1].result).slice(0, limit)
  } else {
    const response = await recommendPlaylist({ limit })
    return response.result
  }
}

const replaceRecommendResult = async (recommend: any) => {
  for (const r of recommend) {
    if (specialPlaylist.indexOf(r.id) > -1) {
      const data = await getPlaylistDetail(r.id, true)
      const playlist = data.playlist
      if (playlist) {
        r.name = playlist.name
        r.picUrl = playlist.coverImgUrl
      }
    }
  }
}

const specialPlaylist = [3136952023, 2829883282, 2829816518, 2829896389]
