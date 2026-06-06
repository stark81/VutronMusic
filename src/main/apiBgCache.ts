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

class ApiBgCache {
  private cacheDir: string

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), CACHE_DIR)
    this.initCache()
  }

  private initCache() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
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

  async downloadOne(): Promise<string | null> {
    try {
      const response = await fetch('https://acg.suyanw.cn/random.php', {
        signal: AbortSignal.timeout(15000)
      })
      if (!response.ok) {
        log.error('API bg cache download failed:', response.status)
        return null
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const ext = contentType.split('/').pop() || 'jpg'
      const filename = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const filePath = path.join(this.cacheDir, filename)
      fs.writeFileSync(filePath, buffer)

      const entries = this.getCacheIndex()
      entries.push({ filename, addedAt: Date.now() })
      this.saveCacheIndex(entries)

      return filePath
    } catch (error) {
      log.error('API bg cache download failed:', error)
      return null
    }
  }

  async fillTo(maxCount: number): Promise<void> {
    const entries = this.getCacheIndex()
    const needed = maxCount - entries.length
    if (needed <= 0) return

    const downloads: Promise<string | null>[] = []
    for (let i = 0; i < needed; i++) {
      downloads.push(this.downloadOne())
    }
    await Promise.allSettled(downloads)
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
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch (e) {
        log.error('Failed to remove cached bg file:', e)
      }
    }

    this.saveCacheIndex(entries)
  }

  clearAll() {
    const entries = this.getCacheIndex()
    for (const entry of entries) {
      const filePath = path.join(this.cacheDir, entry.filename)
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch (e) {
        log.error('Failed to clear cached bg file:', e)
      }
    }
    this.saveCacheIndex([])
  }
}

export default new ApiBgCache()
