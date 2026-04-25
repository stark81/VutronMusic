/* eslint-disable no-unused-vars */
import SQLite3 from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import log from './log'
import { app } from 'electron'
import { createFileIfNotExist } from './utils'
import Constants from './utils/Constants'
import { compare, validate } from 'compare-versions'

export enum Tables {
  Track = 'Track',
  Album = 'Album',
  Artist = 'Artist',
  Playlist = 'Playlist',
  ArtistAlbum = 'ArtistAlbum',
  Lyrics = 'Lyrics',
  Audio = 'Audio',
  AppData = 'AppData',
  AppleMusicAlbum = 'AppleMusicAlbum',
  AppleMusicArtist = 'AppleMusicArtist',
  Unblock = 'Unblock',
  LocalAlbumCover = 'LocalAlbumCover',
  PluginData = 'PluginData',
  TrackArtist = 'TrackArtist',
  TrackSource = 'TrackSource',
  AlbumSource = 'AlbumSource',
  ArtistSource = 'ArtistSource',
  Plugins = 'Plugins',
  PlaylistEntry = 'PlaylistEntry',
  LyricOffsets = 'LyricOffsets'
}

type TableNames = `${Tables}`

const migrationsDir = Constants.IS_DEV_ENV
  ? path.join(process.cwd(), `./src/public/migrations`)
  : path.join(__dirname, `../migrations`)

const readSqlFile = (filename: string) => {
  return fs.readFileSync(path.join(migrationsDir, filename), 'utf8')
}

class DB {
  sqlite!: SQLite3.Database
  dbFilePath: string = path.resolve(app.getPath('userData'), './api_cache/vutron_music.sqlite')

  constructor() {
    try {
      createFileIfNotExist(this.dbFilePath)
      this.sqlite = new SQLite3(this.dbFilePath)
      this.sqlite.pragma('auto_vacuum = FULL')
      this.initTables()
      this.migrate()
    } catch (error) {
      log.info('[db init error]:', error)
    }
  }

  private assertTable(table: string) {
    if (!Object.values(Tables).includes(table as Tables)) {
      throw new Error(`Invalid table: ${table}`)
    }
  }

  initTables() {
    const init = readSqlFile('plugin.sql')
    this.sqlite.exec(init)
    this.sqlite.pragma('journal_mode=WAL')
  }

  migrate() {
    const key = 'appVersion'
    const appVersionRow = this.findAppData(key)
    const appVersion = appVersionRow?.value || '0.0.0'
    const updateAppVersionInDB = () => {
      this.upsertAppData({ id: key, value: Constants.APP_VERSION })
    }
    const sqlFiles = fs.readdirSync(migrationsDir).sort()
    sqlFiles.forEach((sqlFile: string) => {
      const versionMatch = sqlFile.match(/^(\d+(\.\d+)*)(?=\.)/)
      const version = versionMatch ? versionMatch[0] : ''
      if (!validate(version)) return
      if (compare(version, appVersion, '>')) {
        const file = readSqlFile(sqlFile)
        this.sqlite.exec(file)
        this.sqlite.pragma('journal_mode=WAL')
      }
    })
    updateAppVersionInDB()
  }

  /* ---------------- 基础查询 ---------------- */

  findByIdPlatform<T = any>(
    table: TableNames,
    id: string | number,
    pluginId: string
  ): T | undefined {
    this.assertTable(table)

    return this.sqlite
      .prepare(`SELECT * FROM ${table} WHERE id = ? AND pluginId = ? LIMIT 1`)
      .get(id, pluginId) as T
  }

  findManyByIds<T = any>(table: TableNames, ids: (string | number)[], pluginId: string): T[] {
    this.assertTable(table)

    if (!ids.length) return []

    const placeholders = ids.map(() => '?').join(',')

    return this.sqlite
      .prepare(`SELECT * FROM ${table} WHERE pluginId = ? AND id IN (${placeholders})`)
      .all(pluginId, ...ids) as T[]
  }

  findAll<T = any>(table: TableNames, where?: Record<string, any>): T[] {
    this.assertTable(table)

    if (!where || Object.keys(where).length === 0) {
      return this.sqlite.prepare(`SELECT * FROM ${table}`).all() as T[]
    }

    const keys = Object.keys(where)
    const clauses = keys.map((k) => `${k} = ?`).join(' AND ')
    const values = keys.map((k) => where[k])

    return this.sqlite.prepare(`SELECT * FROM ${table} WHERE ${clauses}`).all(...values) as T[]
  }

  /* ---------------- 插入 ---------------- */

  insert<T = any>(table: TableNames, data: T, ignore = true) {
    this.assertTable(table)

    const keys = Object.keys(data as any)
    const columns = keys.join(',')
    const placeholders = keys.map(() => '?').join(',')
    const values = Object.values(data as any)

    const sql = `INSERT ${ignore ? 'OR IGNORE' : ''} INTO ${table} (${columns}) VALUES (${placeholders})`

    return this.sqlite.prepare(sql).run(...values)
  }

  insertMany<T = any>(table: TableNames, rows: T[]) {
    this.assertTable(table)
    if (!rows.length) return

    const keys = Object.keys(rows[0] as any)
    const columns = keys.join(',')
    const placeholders = keys.map(() => '?').join(',')

    const stmt = this.sqlite.prepare(
      `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${placeholders})`
    )

    const trx = this.sqlite.transaction((data: T[]) => {
      data.forEach((row) => stmt.run(...Object.values(row as any)))
    })

    trx(rows)
  }

  /* ---------------- 更新 ---------------- */

  updateByIdPlatform(
    table: TableNames,
    id: string | number,
    pluginId: string,
    data: Record<string, any>
  ) {
    this.assertTable(table)

    const keys = Object.keys(data)
    if (!keys.length) return

    const setClause = keys.map((k) => `${k} = ?`).join(', ')
    const values = keys.map((k) => data[k])

    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ? AND pluginId = ?`

    return this.sqlite.prepare(sql).run(...values, id, pluginId)
  }

  replace<T = any>(table: TableNames, data: T) {
    this.assertTable(table)

    const keys = Object.keys(data as any)
    const columns = keys.join(',')
    const placeholders = keys.map(() => '?').join(',')

    return this.sqlite
      .prepare(`INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`)
      .run(...Object.values(data as any))
  }

  replaceMany<T = any>(table: TableNames, rows: T[]) {
    this.assertTable(table)
    if (!rows.length) return

    const keys = Object.keys(rows[0] as any)
    const columns = keys.join(',')
    const placeholders = keys.map(() => '?').join(',')

    const stmt = this.sqlite.prepare(
      `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`
    )

    const trx = this.sqlite.transaction((data: T[]) => {
      data.forEach((row) => {
        stmt.run(...Object.values(row as any))
      })
    })

    trx(rows)
  }

  upsert<T = any>(table: TableNames, data: T, conflictKeys: string[]) {
    this.assertTable(table)

    const keys = Object.keys(data as any)

    const columns = keys.join(',')
    const placeholders = keys.map(() => '?').join(',')

    const updateKeys = keys.filter((k) => !conflictKeys.includes(k))

    const updateClause = updateKeys.map((k) => `${k} = excluded.${k}`).join(', ')

    const sql = `
    INSERT INTO ${table}
    (${columns})
    VALUES (${placeholders})
    ON CONFLICT (${conflictKeys.join(', ')})
    DO UPDATE SET
    ${updateClause}
  `

    return this.sqlite.prepare(sql).run(...Object.values(data as any))
  }

  upsertMany<T = any>(table: TableNames, rows: T[], conflictKeys: string[]) {
    this.assertTable(table)

    if (!rows.length) return

    const keys = Object.keys(rows[0] as any)

    const columns = keys.join(',')
    const placeholders = keys.map(() => '?').join(',')

    const updateKeys = keys.filter((k) => !conflictKeys.includes(k))

    const updateClause = updateKeys.map((k) => `${k} = excluded.${k}`).join(', ')

    const sql = `
    INSERT INTO ${table}
    (${columns})
    VALUES (${placeholders})
    ON CONFLICT (${conflictKeys.join(', ')})
    DO UPDATE SET
    ${updateClause}
  `

    const stmt = this.sqlite.prepare(sql)

    const trx = this.sqlite.transaction((data: T[]) => {
      data.forEach((row) => {
        stmt.run(...Object.values(row as any))
      })
    })

    trx(rows)
  }

  /* ---------------- 删除 ---------------- */

  deleteManyByIds(table: TableNames, ids: (string | number)[], pluginId: string) {
    this.assertTable(table)
    if (!ids.length) return

    const placeholders = ids.map(() => '?').join(',')

    return this.sqlite
      .prepare(`DELETE FROM ${table} WHERE pluginId = ? AND id IN (${placeholders})`)
      .run(pluginId, ...ids)
  }

  /* ---------------- AppData ---------------- */

  findAppData(id: string) {
    return this.sqlite.prepare(`SELECT * FROM AppData WHERE id = ? LIMIT 1`).get(id) as {
      id: string
      value: string
    }
  }

  upsertAppData(data: { id: string; value: string }) {
    return this.sqlite
      .prepare(`INSERT OR REPLACE INTO AppData (id, value) VALUES (?, ?)`)
      .run(data.id, data.value)
  }

  /* ---------------- 工具 ---------------- */

  truncate(table: TableNames) {
    this.assertTable(table)
    return this.sqlite.prepare(`DELETE FROM ${table}`).run()
  }

  vacuum() {
    return this.sqlite.prepare('VACUUM').run()
  }
}

export const db = new DB()
