import { db, Tables } from './db'
import { CacheAPIs } from './utils/CacheApis'
import _ from 'lodash'

class Cache {
  constructor() {}

  async set(api: string, data: any, query: any = {}) {
    switch (api) {
      case CacheAPIs.LocalMusic: {
        const { newTracks } = data
        const tracks = newTracks.map((t: any) => ({
          id: t.id,
          type: t.type,
          json: JSON.stringify(t),
          updatedAt: Date.now()
        }))
        db.upsertMany(Tables.Track, tracks)
        break
      }
      case CacheAPIs.searchMatch: {
        if (!data.result.songs.length) return
        const trackRaw = db.find(Tables.Track, query.localID)
        const track = JSON.parse(trackRaw.json)

        const playlistsRaw = db.findAll(Tables.Playlist, `isLocal = 1`)
        const playlists = playlistsRaw.map((t: any) => JSON.parse(t.json))

        const newTrack = data.result.songs[0]
        playlists.forEach((p: any) => {
          if (p.trackIds.includes(track.id)) {
            // p.trackIds = p.trackIds.map((id: number) => (id === track.id ? newTrack.id : id))
            // p.coverImgUrl = `atom://get-playlist-pic/${newTrack.id}`
            p.trackIds.splice(p.trackIds.indexOf(track.id), 1, newTrack.id)
            p.coverImgUrl = `atom://get-playlist-pic/${p.trackIds[p.trackIds.length - 1]}`
            const playlist = {
              id: p.id,
              isLocal: 1,
              json: JSON.stringify(p),
              updatedAt: Date.now()
            } as any
            db.update(Tables.Playlist, p.id, playlist)
          }
        })

        _.merge(track, newTrack)
        track.matched = true
        track.type = 'local'
        track.album.matched = true
        track.artists.forEach((a: any) => {
          a.matched = true
        })

        const result = {
          id: data.result.songs[0].id,
          type: 'local',
          json: JSON.stringify(track),
          updatedAt: Date.now()
        } as any

        db.update(Tables.Track, trackRaw.id, result)
        return true
      }
      case CacheAPIs.LocalPlaylist: {
        const playlist = {
          id: data.id,
          isLocal: 1,
          json: JSON.stringify(data),
          updatedAt: data.updateTime
        } as any
        try {
          db.upsert(Tables.Playlist, playlist)
          return true
        } catch (error) {
          return false
        }
      }
      case CacheAPIs.loginStatus: {
        const user = {
          id: data.data.profile.userId,
          json: JSON.stringify(data.data.profile),
          updatedAt: Date.now()
        }
        db.upsert(Tables.AccountData, user)
        return true
      }
      case CacheAPIs.Track: {
        try {
          const trackRaw = db.find(Tables.Track, query.id)
          if (!trackRaw) return false
          const track = JSON.parse(trackRaw.json)
          track.offset = data.offset
          const result = {
            ...trackRaw,
            json: JSON.stringify(track),
            updatedAt: Date.now()
          }
          db.update(Tables.Track, trackRaw.id, result)
          return true
        } catch (error) {
          return false
        }
      }
    }
  }

  get(api: string, params: any = {}): any {
    switch (api) {
      case CacheAPIs.LocalMusic: {
        // 此项用于获取所有本地歌曲
        // 注：是全部本地歌曲，不可获取部分，仅在扫描本地歌曲与程序启动时使用
        const sql = params.sql ?? `type = 'local'`
        const data = db.findAll(Tables.Track, sql)
        const tracks = data.map((t: any) => JSON.parse(t.json))
        return {
          code: 200,
          songs: tracks,
          privileges: {}
        }
      }
      case CacheAPIs.Track: {
        // 根据歌曲ids获取歌曲，包括线上歌曲和本地歌曲
        const ids = params?.ids.split(',').map((id: string) => Number(id))
        if (!ids.length) return
        if (ids.includes(NaN)) return

        const tracksRaw = db.findMany(Tables.Track, ids)
        if (tracksRaw.length !== ids.length) return

        const tracks = ids.map((id: any) => {
          const track = tracksRaw.find((t: any) => t.id === Number(id)) as any
          return JSON.parse(track.json)
        })

        return {
          code: 200,
          songs: tracks,
          privileges: {}
        }
      }
      case CacheAPIs.Album: {
        break
      }
      case CacheAPIs.Artist: {
        break
      }
      case CacheAPIs.LocalPlaylist: {
        const data = db.findAll(Tables.Playlist, `isLocal = 1`)
        const playlists = data.map((t: any) => JSON.parse(t.json))
        return playlists
      }
      case CacheAPIs.loginStatus: {
        const data = db.findAll(Tables.AccountData)
        if (!data.length) {
          return {
            userId: 0,
            vipType: 0
          }
        } else {
          const user = JSON.parse(data[0].json)
          return user
        }
      }
    }
  }

  getAudio(fileName: string) {}

  setAudio(buffer: Buffer, { id, url, bitrate }: { id: number; url: string; bitrate: number }) {}
}

export default new Cache()
