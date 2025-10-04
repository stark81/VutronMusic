/* eslint-disable no-unused-vars */
import SQLite3 from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import log from './log'
import { app } from 'electron'
import { createFileIfNotExist } from './utils/utils'
import Constants from './utils/Constants'
import { compare, validate } from 'compare-versions'

export const enum Tables {
  Track = 'Track',
  TrackNew = 'Track_new',
  Album = 'Album',
  Artist = 'Artist',
  Playlist = 'Playlist',
  ArtistAlbum = 'ArtistAlbum',
  Lyrics = 'Lyrics',
  Audio = 'Audio',
  AccountData = 'AccountData',
  CoverColor = 'CoverColor',
  AppData = 'AppData',
  AppleMusicAlbum = 'AppleMusicAlbum',
  AppleMusicArtist = 'AppleMusicArtist',
  Unblock = 'unblock',
  LocalAlbumCover = 'LocalAlbumCover'
}

interface CommonTableStructure {
  id: number
  filePath?: string
  isLocal?: boolean
  type?: string
  deleted?: boolean
  json: string
  updatedAt: number
}

export interface TablesStructures {
  [Tables.Track]: CommonTableStructure
  [Tables.TrackNew]: CommonTableStructure
  [Tables.Album]: CommonTableStructure
  [Tables.Unblock]: CommonTableStructure
  [Tables.Artist]: CommonTableStructure
  [Tables.Playlist]: CommonTableStructure
  [Tables.ArtistAlbum]: CommonTableStructure
  [Tables.Lyrics]: CommonTableStructure
  [Tables.AccountData]: {
    id: string
    json: string
    updatedAt: number
  }
  [Tables.Audio]: {
    id: number
    bitRate: number
    format: 'mp3' | 'flac' | 'ogg' | 'wav' | 'm4a' | 'aac' | 'unknown' | 'opus'
    source:
      | 'unknown'
      | 'netease'
      | 'migu'
      | 'kuwo'
      | 'kugou'
      | 'youtube'
      | 'qq'
      | 'bilibili'
      | 'joox'
    queriedAt: number
  }
  [Tables.CoverColor]: {
    id: number
    color: string
    queriedAt: number
  }
  [Tables.AppData]: {
    id: 'appVersion' | 'skippedVersion'
    value: string
  }
  [Tables.AppleMusicAlbum]: CommonTableStructure
  [Tables.AppleMusicArtist]: CommonTableStructure
}

type TableNames = keyof TablesStructures

const migrationsDir = Constants.IS_DEV_ENV
  ? path.join(process.cwd(), `./src/public/migrations`)
  : path.join(__dirname, `../migrations`)

const readSqlFile = (filename: string) => {
  return fs.readFileSync(path.join(migrationsDir, filename), 'utf8')
}

class DB {
  sqlite: SQLite3.Database
  dbFilePath: string = path.resolve(app.getPath('userData'), './api_cache/db.sqlite')

  constructor() {
    try {
      createFileIfNotExist(this.dbFilePath)
      this.sqlite = new SQLite3(this.dbFilePath)
      this.sqlite.pragma('auto_vacuum = FULL')
      this.initTables()
      this.migrate()
    } catch (e) {
      log.error(e)
    }
  }

  initTables() {
    const init = readSqlFile('init.sql')
    this.sqlite.exec(init)
    this.sqlite.pragma('journal_mode=WAL')
  }

  migrate() {
    const key = 'appVersion'
    const appVersion = this.find(Tables.AppData, key)
    const updateAppVersionInDB = () => {
      this.upsert(Tables.AppData, { id: key, value: Constants.APP_VERSION })
    }
    if (!appVersion?.value) {
      if (compare(Constants.APP_VERSION, '1.5.0', '>=')) {
        const file = readSqlFile('1.5.0.sql')
        this.sqlite.exec(file)
        this.sqlite.pragma('journal_mode=WAL')
      }
      updateAppVersionInDB()
      return
    }
    const sqlFiles = fs.readdirSync(migrationsDir)
    sqlFiles.forEach((sqlFile: string) => {
      const versionMatch = sqlFile.match(/^(\d+(\.\d+)*)(?=\.)/)
      const version = versionMatch ? versionMatch[0] : ''
      if (!validate(version)) return
      if (compare(version, appVersion.value, '>')) {
        const file = readSqlFile(sqlFile)
        this.sqlite.exec(file)
        this.sqlite.pragma('journal_mode=WAL')
      }
    })
    updateAppVersionInDB()
  }

  find<T extends TableNames>(
    table: T,
    key: TablesStructures[T]['id']
  ): TablesStructures[T] | undefined {
    return this.sqlite
      .prepare(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`)
      .get(key) as TablesStructures[T]
  }

  findMany<T extends TableNames>(
    table: T,
    keys: TablesStructures[T]['id'][]
  ): TablesStructures[T][] {
    const idsQuery = keys.map((key) => `id = ${key}`).join(' OR ')
    if (idsQuery === '')
      return this.sqlite.prepare(`SELECT * FROM ${table}`).all() as TablesStructures[T][]
    return this.sqlite
      .prepare(`SELECT * FROM ${table} WHERE ${idsQuery}`)
      .all() as TablesStructures[T][]
  }

  findAll<T extends TableNames>(table: T, condition = ''): TablesStructures[T][] {
    if (condition) {
      return this.sqlite
        .prepare(`SELECT * FROM ${table} WHERE ${condition}`)
        .all() as TablesStructures[T][]
    }
    return this.sqlite.prepare(`SELECT * FROM ${table}`).all() as TablesStructures[T][]
  }

  create<T extends TableNames>(table: T, data: TablesStructures[T], skipWhenExist: boolean = true) {
    if (skipWhenExist && db.find(table, data.id)) return
    return this.sqlite.prepare(`INSERT INTO ${table} VALUES (?)`).run(data)
  }

  createMany<T extends TableNames>(
    table: T,
    data: TablesStructures[T][],
    skipWhenExist: boolean = true
  ) {
    const valuesQuery = Object.keys(data[0])
      .map((key) => `:${key}`)
      .join(', ')
    const insert = this.sqlite.prepare(
      `INSERT ${skipWhenExist ? 'OR IGNORE' : ''} INTO ${table} VALUES (${valuesQuery})`
    )
    const insertMany = this.sqlite.transaction((rows: any[]) => {
      rows.forEach((row: any) => insert.run(row))
    })
    insertMany(data)
  }

  update<T extends TableNames>(
    table: T,
    key: TablesStructures[T]['id'],
    data: Partial<TablesStructures[T]>
  ) {
    // 构造SET子句的部分，使用占位符
    const placeholders = Object.keys(data)
      .map(() => '?')
      .join(', ')
    const setClauses = Object.entries(data)
      .map(([columnName, value], index) => `${columnName} = ?`) // 注意这里的?占位符
      .join(', ')

    // 构造完整的SQL语句
    const sql = `UPDATE ${table} SET ${setClauses} WHERE id = ?` // 注意这里的?占位符

    // 准备SQL语句，并传递值数组作为第二个参数
    // 假设this.sqlite是一个支持这种用法的SQLite库实例
    const values = [...Object.values(data), key] // 将data的值和key合并为一个数组
    return this.sqlite.prepare(sql).run(values) // 注意这里只调用.run(values)
  }

  upsert<T extends TableNames>(table: T, data: TablesStructures[T]) {
    const valuesQuery = Object.keys(data)
      .map((key) => `:${key}`)
      .join(', ')
    return this.sqlite.prepare(`INSERT OR REPLACE INTO ${table} VALUES (${valuesQuery})`).run(data)
  }

  upsertMany<T extends TableNames>(table: T, data: TablesStructures[T][]) {
    const valuesQuery = Object.keys(data[0])
      .map((key) => `:${key}`)
      .join(', ')
    const upsert = this.sqlite.prepare(`INSERT OR REPLACE INTO ${table} VALUES (${valuesQuery})`)
    const upsertMany = this.sqlite.transaction((rows: any[]) => {
      rows.forEach((row: any) => upsert.run(row))
    })
    upsertMany(data)
  }

  delete<T extends TableNames>(table: T, key: TablesStructures[T]['id']) {
    return this.sqlite.prepare(`DELETE FROM ${table} WHERE id = ?`).run(key)
  }

  deleteMany<T extends TableNames>(table: T, keys: TablesStructures[T]['id'][]) {
    if (keys.length === 0) return

    const calculateBatchSize = () => {
      if (keys.length > 100_000) return 50
      if (keys.length > 10_000) return 100
      if (keys.length > 1_000) return 250
      return 500
    }

    const batchSize = calculateBatchSize()
    const totalBatches = Math.ceil(keys.length / batchSize)

    const transaction = this.sqlite.transaction(() => {
      for (let i = 0; i < totalBatches; i++) {
        const batchKeys = keys.slice(i * batchSize, (i + 1) * batchSize)

        const placeholders = batchKeys.map(() => '?').join(',')
        const query = `DELETE FROM ${table} WHERE id IN (${placeholders})`

        try {
          const stmt = this.sqlite.prepare(query)
          stmt.run(...batchKeys)
        } catch (batchError) {
          log.error(
            `[Batch ${i + 1}/${totalBatches}] Failed to delete ${batchKeys.length} records:`,
            batchError
          )
          throw batchError
        }
      }
    })

    try {
      // 执行事务
      transaction()
      log.log(`Deleted ${keys.length} records from ${table} in ${totalBatches} batches`)
    } catch (transactionError) {
      log.error(`Transaction failed:`, transactionError)
      throw new Error(`Bulk delete operation partially failed: ${transactionError.message}`)
    }
  }

  truncate<T extends TableNames>(table: T) {
    return this.sqlite.prepare(`DELETE FROM ${table}`).run()
  }

  vacuum() {
    return this.sqlite.prepare('VACUUM').run()
  }
}

export const db = new DB()
