/**
 * Trae credential store, managing persistent tokens for CN and Global variants.
 *
 * @module dsh-trae-connect/auth
 */

import { readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { parseTraeCliToken, parseTraeStorageDocument } from './decrypt.ts'
import {
  traePluginDataDir,
  traeStorageCandidates,
  type TraeCredentialSource,
  type TraeEdition,
  type TraeStorageCandidate,
} from './paths.ts'
import type { TraeRegion, TraeVariant } from './variants.ts'

export interface TraeRefreshOutcome {
  accessToken: string
  refreshToken?: string | undefined
  expiresAtMs: number
  refreshExpiresAtMs?: number | undefined
  host?: string | undefined
}

export interface TraeCredential {
  accessToken: string
  refreshToken?: string | undefined
  userId: string
  accountName?: string | undefined
  avatarUrl?: string | undefined
  host: string
  userRegion?: string | undefined
  expiresAtMs: number
  refreshExpiresAtMs?: number | undefined
  edition: TraeEdition
  source: 'desktop' | 'dsh' | 'cli'
}

export interface TraeCredentialStoreOptions {
  variant: TraeVariant
  refresh?: ((credential: TraeCredential) => Promise<TraeRefreshOutcome>) | undefined
  refreshMarginMs?: number | undefined
}

export interface TraeAuthStatus {
  status: 'valid' | 'expired' | 'unconfigured'
  credential?: TraeCredential | undefined
  expiresAtMs?: number | undefined
  error?: string | undefined
}

const OWN_VERSION = 1
const CLI_DEFAULT_HOST = 'https://api.trae.cn'

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function timeToMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value > 1e12 ? value : value * 1000
  }
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return numeric > 1e12 ? numeric : numeric * 1000
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseTraeAuth(raw: unknown, edition: TraeEdition = 'cn', source: TraeCredential['source'] = 'dsh'): TraeCredential | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const value = raw as Record<string, unknown>
  const accessToken = optionalString(value['token']) ?? optionalString(value['accessToken'])
  if (accessToken === undefined) return undefined

  const expiresAtMs = timeToMs(value['expiredAt'] ?? value['expiresAt']) ?? 0
  const refreshExpiresAtMs = timeToMs(value['refreshExpiredAt'] ?? value['refreshExpiresAt'])
  const refreshToken = optionalString(value['refreshToken'])
  const rawUserRegion = value['userRegion']
  const userRegion = typeof rawUserRegion === 'object' && rawUserRegion !== null
    ? optionalString((rawUserRegion as Record<string, unknown>)['region'])
    : optionalString(rawUserRegion)

  const account = typeof value['account'] === 'object' && value['account'] !== null && !Array.isArray(value['account'])
    ? value['account'] as Record<string, unknown>
    : undefined
  const accountName = optionalString(account?.['username'] ?? value['accountName'])
  const defaultHost = edition === 'sg' || edition === 'solo-sg' ? 'https://coresg-normal.trae.ai' : 'https://api.trae.cn'
  const host = optionalString(value['host']) ?? defaultHost

  return {
    accessToken,
    ...refreshToken === undefined ? {} : { refreshToken },
    userId: optionalString(value['userId']) ?? '',
    ...accountName === undefined ? {} : { accountName },
    host,
    ...userRegion === undefined ? {} : { userRegion },
    expiresAtMs,
    ...refreshExpiresAtMs === undefined ? {} : { refreshExpiresAtMs },
    edition,
    source,
  }
}

export function parseTraeDocument(text: string): TraeCredential | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  if (!trimmed.startsWith('{')) {
    // Might be bare JWT
    try {
      const claims = parseTraeCliToken(trimmed)
      return {
        accessToken: claims.accessToken,
        userId: claims.userId,
        host: CLI_DEFAULT_HOST,
        expiresAtMs: claims.expiresAtMs ?? 0,
        edition: 'cn',
        source: 'cli',
      }
    } catch {
      return undefined
    }
  }

  try {
    const document = JSON.parse(trimmed) as Record<string, unknown>
    if (document['version'] === OWN_VERSION && typeof document['credential'] === 'object' && document['credential'] !== null) {
      const cred = document['credential'] as Record<string, unknown>
      const edition = (cred['edition'] as TraeEdition) ?? 'cn'
      return parseTraeAuth(cred, edition, 'dsh')
    }
    // Might be CLI token envelope or raw storage JSON
    if (typeof document['token'] === 'string' || typeof document['accessToken'] === 'string') {
      return parseTraeAuth(document, 'cn', 'dsh')
    }
  } catch {
    return undefined
  }
  return undefined
}

export class TraeCredentialStore {
  readonly variant: TraeVariant
  private readonly refresh?: ((credential: TraeCredential) => Promise<TraeRefreshOutcome>) | undefined
  private readonly refreshMarginMs: number
  private inflight: Promise<TraeCredential | undefined> | undefined

  constructor(options: TraeCredentialStoreOptions) {
    this.variant = options.variant
    this.refresh = options.refresh
    this.refreshMarginMs = options.refreshMarginMs ?? 5 * 60_000
  }

  ownAuthPath(): string {
    return join(traePluginDataDir(), this.variant.ownFilename)
  }

  legacyAuthPaths(): string[] {
    const dshHome = resolveDshHome()
    return [
      join(dshHome, this.variant.ownFilename),
      join(dshHome, `.trae-auth.${this.variant.region}.json`),
      join(dshHome, '.trae-auth.json'),
    ]
  }

  async read(): Promise<TraeCredential | undefined> {
    const candidates = [this.ownAuthPath(), ...this.legacyAuthPaths()]
    for (const path of candidates) {
      try {
        const text = await readFile(path, 'utf8')
        const cred = parseTraeDocument(text)
        if (cred !== undefined) {
          const credRegion = cred.edition === 'sg' || cred.edition === 'solo-sg' ? 'ai' : 'cn'
          if (credRegion === this.variant.region) {
            return cred
          }
        }
      } catch {
        // file doesn't exist or unreadable
      }
    }
    return undefined
  }

  async write(credential: TraeCredential): Promise<void> {
    const filePath = this.ownAuthPath()
    const content = JSON.stringify({
      version: OWN_VERSION,
      updatedAt: Date.now(),
      credential,
    }, null, 2)
    await withFileLock(filePath, async () => {
      await writeFileAtomic(filePath, content, { mode: 0o600, dirMode: 0o700 })
    })
  }

  async remove(): Promise<void> {
    const targets = [this.ownAuthPath(), ...this.legacyAuthPaths()]
    for (const target of targets) {
      try {
        await rm(target, { force: true })
      } catch {}
    }
  }

  async get(): Promise<TraeCredential | undefined> {
    if (this.inflight !== undefined) return this.inflight
    this.inflight = this.resolveCurrent()
    try {
      return await this.inflight
    } finally {
      this.inflight = undefined
    }
  }

  private async resolveCurrent(): Promise<TraeCredential | undefined> {
    let credential = await this.read()
    if (credential === undefined) return undefined

    const now = Date.now()
    const needsRefresh = credential.refreshToken !== undefined
      && credential.expiresAtMs > 0
      && credential.expiresAtMs - now < this.refreshMarginMs

    if (needsRefresh && this.refresh !== undefined) {
      try {
        const refreshed = await this.refresh(credential)
        credential = {
          ...credential,
          accessToken: refreshed.accessToken,
          ...(refreshed.refreshToken !== undefined ? { refreshToken: refreshed.refreshToken } : {}),
          expiresAtMs: refreshed.expiresAtMs,
        }
        await this.write(credential)
      } catch (err) {
        // If refresh fails but current token not fully expired, proceed with current
        if (credential.expiresAtMs <= now) {
          return undefined
        }
      }
    }

    return credential
  }

  async status(): Promise<TraeAuthStatus> {
    try {
      const cred = await this.read()
      if (cred === undefined) {
        return { status: 'unconfigured' }
      }
      const now = Date.now()
      if (cred.expiresAtMs > 0 && cred.expiresAtMs <= now && cred.refreshToken === undefined) {
        return { status: 'expired', credential: cred, expiresAtMs: cred.expiresAtMs }
      }
      return { status: 'valid', credential: cred, expiresAtMs: cred.expiresAtMs }
    } catch (err) {
      return { status: 'unconfigured', error: err instanceof Error ? err.message : String(err) }
    }
  }
}
