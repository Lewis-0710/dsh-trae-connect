/**
 * Persistent store for reasoning-effort probe observations.
 *
 * @module dsh-trae-connect/probe-store
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type TraeModelInfo } from './catalog.ts'
import { traeStateDir } from './paths.ts'
import type { TraeReasoningEffort } from './reasoning.ts'
import type { TraeVariant } from './variants.ts'
import { TRAE_CONNECT_VERSION } from './version.ts'

export const TRAE_PROBE_FILENAME = '.trae-probe.json'
const PROBE_FORMAT_VERSION = 1
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000

export type TraeProbeValidation = 'validating' | 'non-validating' | 'unknown'

export interface TraeProbeRecord {
  fingerprint: string
  validation: TraeProbeValidation
  efforts: readonly TraeReasoningEffort[]
  probedAtMs: number
  pluginVersion: string
  account?: string | undefined
}

interface ProbeDocument {
  version: typeof PROBE_FORMAT_VERSION
  records: Record<string, TraeProbeRecord>
}

export function traeProbePath(filename: string = TRAE_PROBE_FILENAME): string {
  return join(traeStateDir(), filename)
}

export function fingerprintModel(model: TraeModelInfo): string {
  const parts = [
    model.id,
    model.reasoningSupported ? 'reasoning:true' : 'reasoning:false',
    JSON.stringify(model.reasoning?.supported ?? []),
  ]
  return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 16)
}

export function newestFirst(records: Record<string, TraeProbeRecord>): [string, TraeProbeRecord][] {
  return Object.entries(records).sort(([, a], [, b]) => b.probedAtMs - a.probedAtMs)
}

export interface TraeProbeStoreOptions {
  path?: string
  variant?: TraeVariant
  ttlMs?: number
}

export class TraeProbeStore {
  private readonly path: string
  private readonly ttlMs: number
  private records: Record<string, TraeProbeRecord> | undefined

  constructor(options: TraeProbeStoreOptions = {}) {
    if (options.path !== undefined) {
      this.path = options.path
    } else {
      const filename = options.variant?.probeFilename ?? TRAE_PROBE_FILENAME
      this.path = traeProbePath(filename)
    }
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  }

  private load(): Record<string, TraeProbeRecord> {
    if (this.records !== undefined) return this.records
    if (!existsSync(this.path)) {
      this.records = {}
      return this.records
    }
    try {
      const raw = JSON.parse(readFileSync(this.path, 'utf8')) as unknown
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        this.records = {}
        return this.records
      }
      const doc = raw as Record<string, unknown>
      if (doc['version'] !== PROBE_FORMAT_VERSION || typeof doc['records'] !== 'object' || doc['records'] === null) {
        this.records = {}
        return this.records
      }
      this.records = doc['records'] as Record<string, TraeProbeRecord>
      return this.records
    } catch {
      this.records = {}
      return this.records
    }
  }

  get(model: TraeModelInfo, account?: string): TraeProbeRecord | undefined {
    const record = this.load()[model.id]
    if (record === undefined) return undefined
    if (account !== undefined && record.account !== account) return undefined
    if (Date.now() - record.probedAtMs > this.ttlMs) return undefined
    if (record.fingerprint !== fingerprintModel(model)) return undefined
    return record
  }

  all(): Record<string, TraeProbeRecord> {
    return { ...this.load() }
  }

  put(model: TraeModelInfo, validation: TraeProbeValidation, efforts: readonly TraeReasoningEffort[], account?: string): void {
    const current = this.load()
    current[model.id] = {
      fingerprint: fingerprintModel(model),
      validation,
      efforts: [...efforts],
      probedAtMs: Date.now(),
      pluginVersion: TRAE_CONNECT_VERSION,
      ...account !== undefined ? { account } : {},
    }
    this.flush()
  }

  clear(): void {
    this.records = {}
    this.flush()
  }

  private flush(): void {
    const dir = dirname(this.path)
    if (!existsSync(dir)) {
      try { mkdirSync(dir, { recursive: true }) } catch {}
    }
    const doc: ProbeDocument = {
      version: PROBE_FORMAT_VERSION,
      records: this.records ?? {},
    }
    const tempPath = `${this.path}.${process.pid}.${Date.now()}.tmp`
    try {
      writeFileSync(tempPath, JSON.stringify(doc, null, 2), 'utf8')
      renameSync(tempPath, this.path)
    } catch {}
  }
}
