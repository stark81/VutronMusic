import { db, Tables } from './db'
import { CacheAPIs } from './utils/CacheApis'
// @ts-ignore
// import _ from 'lodash'
// import log from './log'

class Cache {
  constructor() {}

  async set(api: string, data: any, query: any = {}) {
    switch (api) {
      case CacheAPIs.LocalMusic: {
        try {
          const { data: sData } = data as { data: Record<string, any> }
          const { id, ...fields } = sData
          if (id && Object.keys(fields).length) {
            const keys = Object.keys(fields)
            const setClause = keys.map((k) => `${k} = ?`).join(', ')
            const values = keys.map((k) => {
              const v = fields[k]
              return typeof v === 'boolean' ? (v ? 1 : 0) : v
            })
            db.sqlite
              .prepare(`UPDATE ${Tables.Track} SET ${setClause}, updateTime = ? WHERE id = ?`)
              .run(...values, Date.now(), String(id))
          }
        } catch (error) {
          console.error('[cache set LocalMusic error]:', error)
        }
        break
      }
      case CacheAPIs.searchMatch: {
        // if (!data.result.songs.length) return
        // const trackRaw = db.find(Tables.Track, query.localID)!
        // const track = JSON.parse(trackRaw.json)

        // const playlistsRaw = db.findAll(Tables.Playlist, `isLocal = 1`)
        // const playlists = playlistsRaw.map((t: any) => JSON.parse(t.json))

        // const newTrack = data.result.songs[0]
        // playlists.forEach((p: any) => {
        //   if (p.trackIds.includes(track.id)) {
        //     p.trackIds.splice(p.trackIds.indexOf(track.id), 1, newTrack.id)
        //     p.coverImgUrl = `vutron://local-asset?type=pic&id=${p.trackIds[p.trackIds.length - 1]}&size=512`
        //     const playlist = {
        //       id: p.id,
        //       isLocal: 1,
        //       json: JSON.stringify(p),
        //       updatedAt: Date.now()
        //     } as any
        //     db.update(Tables.Playlist, p.id, playlist)
        //   }
        // })

        // _.merge(track, newTrack)
        // track.matched = true
        // track.type = 'local'
        // track.album.matched = true
        // track.artists.forEach((a: any) => {
        //   a.matched = true
        // })

        // const result = {
        //   id: data.result.songs[0].id,
        //   type: 'local',
        //   json: JSON.stringify(track),
        //   updatedAt: Date.now()
        // } as any

        // try {
        //   db.update(Tables.Track, trackRaw.id, result)
        //   return true
        // } catch (error) {
        //   log.error('更新本地歌曲失败:', error)
        //   db.update(Tables.Track, result.id, result)
        //   db.delete(Tables.Track, trackRaw.id)
        //   return true
        // }
        break
      }
      case CacheAPIs.LocalPlaylist: {
        // let playlist: any = {}
        // if (query?.id) {
        //   const p = db.find(Tables.Playlist, query.id)!
        //   const pj = JSON.parse(p.json)
        //   pj.name = data.name
        //   pj.description = data.desc
        //   playlist = {
        //     ...p,
        //     json: JSON.stringify(pj),
        //     updatedAt: Date.now()
        //   }
        // } else {
        //   playlist = {
        //     id: data.id,
        //     isLocal: 1,
        //     json: JSON.stringify(data),
        //     updatedAt: data.updateTime
        //   }
        // }
        // try {
        //   db.upsert(Tables.Playlist, playlist)
        //   return true
        // } catch (error) {
        //   log.error('更新本地歌单失败:', error)
        //   return false
        // }
        break
      }
      case CacheAPIs.loginStatus: {
        // const user = {
        //   id: data.data.profile.userId,
        //   platform: 'netease',
        //   json: JSON.stringify(data.data.profile),
        //   updatedAt: Date.now()
        // }
        // db.upsert(Tables.AccountData, user)
        // return true
        break
      }
      case CacheAPIs.PluginData: {
        try {
          const {
            pluginId,
            type,
            data: sData
          } = data as {
            pluginId: string
            type: 'library' | 'stream' | 'local'
            data: Record<string, string>
          }
          const accounts = db.findAll(Tables.PluginData, { pluginId })
          const json = JSON.stringify(sData)
          if (accounts.length) {
            const account = accounts[0]
            account.json = json
            account.updatedAt = Date.now()
            db.replace(Tables.PluginData, account)
          } else {
            const account = {
              id: `${pluginId}-1`,
              pluginId,
              type,
              json,
              updatedAt: Date.now()
            }
            db.upsert(Tables.PluginData, account, ['id'])
          }
        } catch (error) {
          console.error('[db.set failed]: ', error)
        }
        break
      }
      case CacheAPIs.Track: {
        // try {
        //   const trackRaw = db.find(Tables.Track, query.id)
        //   if (!trackRaw) return false
        //   const track = JSON.parse(trackRaw.json)
        //   track.offset = data.offset
        //   const result = {
        //     ...trackRaw,
        //     json: JSON.stringify(track),
        //     updatedAt: Date.now()
        //   }
        //   db.update(Tables.Track, trackRaw.id, result)
        //   return true
        // } catch (error) {
        //   log.error('更新歌曲缓存失败:', error)
        //   return false
        // }
        break
      }

      case CacheAPIs.Artist: {
        try {
          const { data: sData } = data as { data: Record<string, any> }
          const { id, ...fields } = sData
          if (id && Object.keys(fields).length) {
            const keys = Object.keys(fields)
            const setClause = keys.map((k) => `${k} = ?`).join(', ')
            const values = keys.map((k) => {
              const v = fields[k]
              return typeof v === 'boolean' ? (v ? 1 : 0) : v
            })
            db.sqlite
              .prepare(`UPDATE ${Tables.Artist} SET ${setClause}, updateTime = ? WHERE id = ?`)
              .run(...values, Date.now(), String(id))
          }
        } catch (error) {
          console.error('[cache set Artist error]:', error)
        }
        break
      }

      case CacheAPIs.Album: {
        try {
          const { data: sData } = data as { data: Record<string, any> }
          const { id, ...fields } = sData
          if (id && Object.keys(fields).length) {
            const keys = Object.keys(fields)
            const setClause = keys.map((k) => `${k} = ?`).join(', ')
            const values = keys.map((k) => {
              const v = fields[k]
              return typeof v === 'boolean' ? (v ? 1 : 0) : v
            })
            db.sqlite
              .prepare(`UPDATE ${Tables.Album} SET ${setClause}, updateTime = ? WHERE id = ?`)
              .run(...values, Date.now(), String(id))
          }
        } catch (error) {
          console.error('[cache set Album error]:', error)
        }
        break
      }
    }
  }

  get(api: string, params: any = {}): any {
    switch (api) {
      case CacheAPIs.LocalMusic: {
        // 查询所有本地歌曲，关联 Album / Artist / TrackArtist 表组装完整数据
        const trackRows = db.sqlite.prepare(`SELECT * FROM ${Tables.Track}`).all() as Record<
          string,
          any
        >[]

        const albumMap = new Map(
          (
            db.sqlite.prepare(`SELECT id, name FROM ${Tables.Album}`).all() as Record<string, any>[]
          ).map((a) => [a.id, a.name])
        )

        const artistNameMap = new Map(
          (
            db.sqlite.prepare(`SELECT id, name FROM ${Tables.Artist}`).all() as Record<
              string,
              any
            >[]
          ).map((a) => [a.id, a.name])
        )

        // 构建 trackId → artists 映射
        const trackArtistMap = new Map<string, { id: string; name: string }[]>()
        for (const ta of db.sqlite.prepare(`SELECT * FROM ${Tables.TrackArtist}`).all() as Record<
          string,
          any
        >[]) {
          if (!trackArtistMap.has(ta.trackId)) trackArtistMap.set(ta.trackId, [])
          trackArtistMap.get(ta.trackId)!.push({
            id: ta.artistId,
            name: artistNameMap.get(ta.artistId) || ''
          })
        }

        // 构建 albumId → albumArtists 映射
        const albumArtistMap = new Map<string, { id: string; name: string }[]>()
        for (const aa of db.sqlite.prepare(`SELECT * FROM ${Tables.ArtistAlbum}`).all() as Record<
          string,
          any
        >[]) {
          if (!albumArtistMap.has(aa.albumId)) albumArtistMap.set(aa.albumId, [])
          albumArtistMap.get(aa.albumId)!.push({
            id: aa.artistId,
            name: artistNameMap.get(aa.artistId) || ''
          })
        }

        // 构建 trackId → filePath / size 映射
        const audioPathMap = new Map(
          (
            db.sqlite
              .prepare(`SELECT trackId, filePath, size, md5 FROM ${Tables.Audio}`)
              .all() as Record<string, any>[]
          ).map((a) => [a.trackId, { filePath: a.filePath, size: a.size, md5: a.md5 }])
        )

        const songs = trackRows.map((track) => {
          const audioInfo = audioPathMap.get(track.id) || { filePath: '', size: 0, md5: '' }
          return {
            id: track.id,
            name: track.name,
            duration: track.duration,
            albumId: track.albumId,
            albumName: albumMap.get(track.albumId) || '',
            artists: trackArtistMap.get(track.id) || [],
            albumArtists: albumArtistMap.get(track.albumId) || [],
            filePath: audioInfo.filePath,
            size: audioInfo.size,
            md5: audioInfo.md5,
            picUrl: track.picUrl,
            playCount: track.playCount,
            liked: track.liked || 0,
            createTime: track.createTime,
            no: track.no,
            alias: track.alias || ''
          }
        })

        return {
          code: 200,
          songs,
          privileges: {}
        }
      }
      case CacheAPIs.Track: {
        console.log('[cache get Track]:', params)
        // 根据歌曲ids获取歌曲，包括线上歌曲和本地歌曲
        // const ids = params?.ids.split(',').map((id: string) => Number(id))
        // if (!ids.length) return
        // if (ids.includes(NaN)) return

        // const tracksRaw = db.findMany(Tables.Track, ids)
        // if (tracksRaw.length !== ids.length) return

        // const tracks = ids.map((id: any) => {
        //   const track = tracksRaw.find((t: any) => t.id === String(id)) as any
        //   return JSON.parse(track.json)
        // })

        return {
          code: 200,
          songs: [],
          privileges: {}
        }
      }
      case CacheAPIs.Album: {
        return db.sqlite.prepare(`SELECT * FROM ${Tables.Album}`).all()
      }
      case CacheAPIs.Artist: {
        return db.sqlite.prepare(`SELECT * FROM ${Tables.Artist}`).all()
      }
      case CacheAPIs.LocalPlaylist: {
        // const data = db.findAll(Tables.Playlist, `isLocal = 1`)
        // const playlists = data.map((t: any) => JSON.parse(t.json)).filter((p) => p.id)
        return [] // playlists
      }
      case CacheAPIs.loginStatus: {
        const row = db.sqlite
          .prepare(`SELECT * FROM ${Tables.PluginData} WHERE platform = ? LIMIT 1`)
          .get(params.platform) as Record<string, any>

        if (!row) {
          return { userId: 0, isVip: false }
        }
        try {
          return JSON.parse(row.json)
        } catch {
          return row.json
        }
      }
      case CacheAPIs.PluginData: {
        const infos = db.findAll(Tables.PluginData, { pluginId: params.pluginId })
        if (infos.length) {
          return JSON.parse(infos[0].json)
        }
        return { userId: 0, userName: '', pwd: '', isVip: false, cookie: '', token: '' }
      }
    }
  }
}

export default new Cache()
