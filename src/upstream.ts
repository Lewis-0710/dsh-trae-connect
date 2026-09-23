/**
 * Unified upstream client for Trae (Chat streaming, catalog fetching, and billing credits).
 *
 * @module dsh-trae-connect/upstream
 */

import type { TraeCredential, TraeCredentialStore } from './auth.ts'
import {
  fallbackModelsFor,
  mergeTraeModelSources,
  type TraeModelInfo,
} from './catalog.ts'
import { fallbackTraeIdentity, type TraeIdentity } from './identity.ts'
import { buildTraeCnHeaders, traeEndpoint, TRAE_SOLO_CHAT_PATH } from './protocol.ts'
import { prepareSoloBody, TraeSoloUpstreamClient } from './solo.ts'
import { TraeSoloRemoteCatalogClient } from './solo-remote.ts'
import type { TraeWebCreditAccount, TraeWebCredits } from './status-paths.ts'
import { TraeUsageClient } from './usage.ts'
import type { TraeVariant } from './variants.ts'

export type UpstreamErrorKind =
  | 'authentication'
  | 'hard_credit'
  | 'soft_rate'
  | 'not_found'
  | 'server'
  | 'client'
  | 'unconfigured'

export type TraeChatResult =
  | { ok: true; response: Response }
  | { ok: false; status: number; kind: UpstreamErrorKind; message: string }

export function classifyUpstreamError(status: number): UpstreamErrorKind {
  if (status === 401 || status === 403) return 'authentication'
  if (status === 402) return 'hard_credit'
  if (status === 429) return 'soft_rate'
  if (status === 404) return 'not_found'
  if (status >= 500) return 'server'
  return 'client'
}

export interface TraeUpstreamClientOptions {
  variant: TraeVariant
  store: TraeCredentialStore
  identity?: (() => Promise<TraeIdentity>) | undefined
  fetchImpl?: typeof fetch | undefined
  chatBaseUrl?: string | undefined
  remoteBaseUrl?: string | undefined
  payBaseUrl?: string | undefined
  catalog?: (() => readonly TraeModelInfo[]) | undefined
}

export class TraeUpstreamClient {
  readonly variant: TraeVariant
  private readonly store: TraeCredentialStore
  private readonly identityProvider: () => Promise<TraeIdentity>
  private readonly fetchImpl: typeof fetch
  private readonly chatBaseUrl: string | undefined
  private readonly catalogProvider?: (() => readonly TraeModelInfo[]) | undefined
  readonly usageClient: TraeUsageClient
  readonly remoteClient: TraeSoloRemoteCatalogClient
  readonly soloClient: TraeSoloUpstreamClient

  constructor(options: TraeUpstreamClientOptions) {
    this.variant = options.variant
    this.store = options.store
    this.fetchImpl = options.fetchImpl ?? fetch
    this.identityProvider = options.identity ?? (async () => fallbackTraeIdentity(this.variant.region === 'ai' ? 'sg' : 'cn'))
    this.chatBaseUrl = options.chatBaseUrl
    this.catalogProvider = options.catalog

    this.usageClient = new TraeUsageClient({
      credential: () => this.store.get(),
      fetchImpl: this.fetchImpl,
      ...options.payBaseUrl !== undefined ? { baseUrl: options.payBaseUrl } : {},
    })

    this.remoteClient = new TraeSoloRemoteCatalogClient({
      credential: () => this.store.get(),
      fetchImpl: this.fetchImpl,
      ...options.remoteBaseUrl !== undefined ? { baseUrl: options.remoteBaseUrl } : {},
    })

    this.soloClient = new TraeSoloUpstreamClient({
      credential: () => this.store.get() as Promise<TraeCredential>,
      identity: this.identityProvider,
      ...options.chatBaseUrl !== undefined ? { baseUrl: options.chatBaseUrl } : {},
      fetchImpl: this.fetchImpl,
    })
  }

  async chatStream(bodyJson: string, signal?: AbortSignal): Promise<TraeChatResult> {
    const [credential, identity] = await Promise.all([this.store.get(), this.identityProvider()])
    if (credential === undefined || credential.accessToken === '') {
      return {
        ok: false,
        status: 401,
        kind: 'authentication',
        message: `未配置或未登录 ${this.variant.displayName} 凭据`,
      }
    }

    const defaultBase = this.variant.region === 'ai'
      ? 'https://coresg-normal.trae.ai'
      : 'https://trae-api-cn.mchost.guru'
    const base = this.chatBaseUrl ?? defaultBase
    const url = traeEndpoint(base, TRAE_SOLO_CHAT_PATH)
    const headers = buildTraeCnHeaders(credential, identity)
    const models = this.catalogProvider?.() ?? []
    const body = prepareSoloBody(bodyJson, {
      region: this.variant.region,
      catalogModels: models,
    })

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        ...signal !== undefined ? { signal } : {},
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return {
          ok: false,
          status: response.status,
          kind: classifyUpstreamError(response.status),
          message: errorText || `HTTP ${response.status}`,
        }
      }

      return { ok: true, response }
    } catch (err) {
      return {
        ok: false,
        status: 0,
        kind: 'server',
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async fetchCatalog(signal?: AbortSignal): Promise<readonly TraeModelInfo[]> {
    try {
      const [remoteModels, wireModels] = await Promise.all([
        this.remoteClient.fetchModels(signal).catch(() => []),
        this.soloClient.fetchModels(signal).catch(() => []),
      ])

      const merged = mergeTraeModelSources(remoteModels, wireModels, this.variant.region)
      return merged.length > 0 ? merged : [...fallbackModelsFor(this.variant.region)]
    } catch {
      return [...fallbackModelsFor(this.variant.region)]
    }
  }

  async fetchCredits(signal?: AbortSignal): Promise<TraeWebCredits | undefined> {
    const cred = await this.store.get()
    if (cred === undefined || cred.accessToken === '') return undefined

    const view = await this.usageClient.view(signal)
    if (this.variant.region === 'ai') {
      const pay = view.payStatus
      if (pay === undefined) return undefined
      return {
        total: pay.hasPackage ? 100 : 0,
        accounts: [],
        isSubscription: true,
        inTrial: pay.inTrial,
        ...pay.trialEndTimeMs > 0 ? { trialEndTime: new Date(pay.trialEndTimeMs).toLocaleString() } : {},
      }
    }

    const snap = view.snapshot
    if (snap === undefined) return undefined

    const totalAvailable = Math.max(0, snap.summary.totalAmount - snap.summary.consumedAmount)
    const accounts: TraeWebCreditAccount[] = snap.packs.map(p => ({
      packageName: p.displayDesc || '权益额度',
      remain: p.consumedCredits !== undefined && p.creditsLimit !== undefined
        ? Math.max(0, p.creditsLimit - p.consumedCredits)
        : (p.creditsLimit ?? 0),
      size: p.creditsLimit ?? 0,
      ...p.endTimeMs > 0 ? { packageEndTime: new Date(p.endTimeMs).toLocaleDateString() } : {},
    }))

    return {
      total: totalAvailable,
      totalSize: snap.summary.totalAmount,
      accounts,
    }
  }
}
