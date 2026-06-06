import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import log from './log'

const CACHE_DIR = 'apiBgCache'
const INDEX_FILE = 'index.json'

interface CacheEntry {
  filename: string
  addedAt: number
}

const extMap: Record<string, string> = {
  jpeg: 'jpg',
  'svg+xml': 'svg'
}

class ApiBgCache {
  private cacheDir: string
  private lock: Promise<void> = Promise.resolve()

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), CACHE_DIR)
    this.initCache()
  }

  private initCache() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  private async serialized<T>(fn: () => T | Promise<T>): Promise<T> {
    return this.lock = this.lock.then(fn)
  }

  getCacheDir(): string {
    return this.cacheDir
  }

  private getIndexPath(): string {
    return path.join(this.cacheDir, INDEX_FILE)
  }

  private getCacheIndex(): CacheEntry[] {
    const indexPath = this.getIndexPath()
    if (!fs.existsSync(indexPath)) return []
    try {
      const content = fs.readFileSync(indexPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return []
    }
  }

  private saveCacheIndex(entries: CacheEntry[]) {
    fs.writeFileSync(this.getIndexPath(), JSON.stringify(entries, null, 2))
  }

  getCacheCount(): number {
    return this.getCacheIndex().length
  }

  getRandomCachedPath(): string | null {
    const entries = this.getCacheIndex()
    if (entries.length === 0) return null
    const entry = entries[Math.floor(Math.random() * entries.length)]
    return path.join(this.cacheDir, entry.filename)
  }

  async downloadOne(apiUrl?: string): Promise<string | null> {
    try {
      const url = apiUrl || 'https://acg.suyanw.cn/random.php'
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!response.ok) {
        log.error('API bg cache download failed:', response.status)
        return null
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const rawExt = contentType.split('/').pop() || 'jpg'
      const ext = extMap[rawExt] || rawExt
      const filename = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const filePath = path.join(this.cacheDir, filename)
      fs.writeFileSync(filePath, buffer)

      await this.serialized(() => {
        const entries = this.getCacheIndex()
        entries.push({ filename, addedAt: Date.now() })
        this.saveCacheIndex(entries)
      })

      return filePath
    } catch (error) {
      log.error('API bg cache download failed:', error)
      return null
    }
  }

  async fillTo(maxCount: number, apiUrl?: string): Promise<void> {
    const entries = this.getCacheIndex()
    let needed = maxCount - entries.length

    for (let i = 0; i < needed; i++) {
      const result = await this.downloadOne(apiUrl)
      if (!result) break
    }

    this.evictToMax(maxCount)
  }

  evictToMax(maxCount: number) {
    let entries = this.getCacheIndex()
    if (entries.length <= maxCount) return

    entries.sort((a, b) => a.addedAt - b.addedAt)
    const toRemove = entries.slice(0, entries.length - maxCount)
    entries = entries.slice(entries.length - maxCount)

    for (const entry of toRemove) {
      const filePath = path.join(this.cacheDir, entry.filename)
      try {
        fs.unlinkSync(filePath)
      } catch (e: any) {
        if (e?.code !== 'ENOENT') {
          log.error('Failed to remove cached bg file:', e)
        }
      }
    }

    this.saveCacheIndex(entries)
  }

  clearAll() {
    const entries = this.getCacheIndex()
    for (const entry of entries) {
      const filePath = path.join(this.cacheDir, entry.filename)
      try {
        fs.unlinkSync(filePath)
      } catch (e: any) {
        if (e?.code !== 'ENOENT') {
          log.error('Failed to clear cached bg file:', e)
        }
      }
    }
    this.saveCacheIndex([])
  }
}

export default new ApiBgCache()
