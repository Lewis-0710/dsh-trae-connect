/**
 * Persistent store for the last successful model catalog per account and variant.
 *
 * @module dsh-trae-connect/catalog-store
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type TraeModelInfo } from './catalog.ts'
import { traeStateDir } from './paths.ts'
import type { TraeVariant } from './variants.ts'

const CATALOG_FORMAT_VERSION = 1
export const TRAE_CATALOG_FILENAME = '.trae-catalog.json'

interface SavedCatalog {
  account: string
  source: string
  fetchedAtMs: number
  models: readonly TraeModelInfo[]
}

interface CatalogDocument {
  version: typeof CATALOG_FORMAT_VERSION
  entries: Record<string, SavedCatalog>
}

export function traeCatalogPath(filename: string = TRAE_CATALOG_FILENAME): string {
  return join(traeStateDir(), filename)
}

function isModel(value: unknown): value is TraeModelInfo {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row['id'] === 'string' && row['id'] !== '' && typeof row['name'] === 'string'
}

function isSaved(value: unknown): value is SavedCatalog {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  if (typeof entry['account'] !== 'string' || entry['account'] === '') return false
  if (typeof entry['source'] !== 'string' || entry['source'] === '') return false
  if (typeof entry['fetchedAtMs'] !== 'number' || !Number.isFinite(entry['fetchedAtMs'])) return false
  const models = entry['models']
  if (!Array.isArray(models) || models.length === 0) return false
  return models.every(isModel)
}

export interface TraeCatalogStoreOptions {
  path?: string
  variant?: TraeVariant
}

export class TraeCatalogStore {
  private readonly path: string
  private entries: Record<string, SavedCatalog> | undefined

  constructor(options: TraeCatalogStoreOptions | string = {}) {
    if (typeof options === 'string') {
      this.path = options
    } else if (options.path !== undefined) {
      this.path = options.path
    } else {
      const filename = options.variant?.catalogFilename ?? TRAE_CATALOG_FILENAME
      this.path = traeCatalogPath(filename)
    }
  }

  private load(): Record<string, SavedCatalog> {
    if (this.entries !== undefined) return this.entries
    if (!existsSync(this.path)) {
      this.entries = {}
      return this.entries
    }
    try {
      const raw = JSON.parse(readFileSync(this.path, 'utf8')) as unknown
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        this.entries = {}
        return this.entries
      }
      const doc = raw as Record<string, unknown>
      if (doc['version'] !== CATALOG_FORMAT_VERSION || typeof doc['entries'] !== 'object' || doc['entries'] === null) {
        this.entries = {}
        return this.entries
      }
      const parsed: Record<string, SavedCatalog> = {}
      for (const [key, value] of Object.entries(doc['entries'] as Record<string, unknown>)) {
        if (isSaved(value)) parsed[key] = value
      }
      this.entries = parsed
      return this.entries
    } catch {
      this.entries = {}
      return this.entries
    }
  }

  get(account: string): { models: readonly TraeModelInfo[]; fetchedAtMs: number } | undefined {
    const entry = this.load()[account]
    if (entry === undefined) return undefined
    return { models: entry.models, fetchedAtMs: entry.fetchedAtMs }
  }

  put(account: string, source: string, models: readonly TraeModelInfo[]): void {
    if (account.trim() === '' || models.length === 0) return
    const current = this.load()
    current[account] = {
      account,
      source,
      fetchedAtMs: Date.now(),
      models,
    }
    this.flush()
  }

  private flush(): void {
    const dir = dirname(this.path)
    if (!existsSync(dir)) {
      try { mkdirSync(dir, { recursive: true }) } catch {}
    }
    const doc: CatalogDocument = {
      version: CATALOG_FORMAT_VERSION,
      entries: this.entries ?? {},
    }
    const tempPath = `${this.path}.${process.pid}.${Date.now()}.tmp`
    try {
      writeFileSync(tempPath, JSON.stringify(doc, null, 2), 'utf8')
      renameSync(tempPath, this.path)
    } catch {
      // best-effort
    }
  }
}
