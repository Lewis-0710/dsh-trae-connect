/**
 * Read-only model catalog client for the SOLO Web API.
 *
 * @module dsh-trae-connect/solo-remote
 */

import type { TraeCredential } from './auth.ts'
import { parseTraeRemoteModel, type TraeDiscoveredModel } from './catalog.ts'
import type { TraeRegion } from './variants.ts'

export interface TraeSoloRemoteCatalogOptions {
  credential: () => Promise<TraeCredential | undefined>
  fetchImpl?: typeof fetch | undefined
  baseUrl?: string | undefined
}

function remoteDressing(region: TraeRegion): { referer: string; timezone: string; language: string } {
  return region === 'ai'
    ? { referer: 'https://coresg-normal.trae.ai/', timezone: 'Asia/Singapore', language: 'en' }
    : { referer: 'https://solo.trae.cn/', timezone: 'Asia/Shanghai', language: 'zh-cn' }
}

export class TraeSoloRemoteCatalogClient {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string | undefined

  constructor(private readonly options: TraeSoloRemoteCatalogOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = options.baseUrl
  }

  private async headers(credential: TraeCredential, region: TraeRegion): Promise<Record<string, string>> {
    const dressing = remoteDressing(region)
    return {
      'Authorization': `Cloud-IDE-JWT ${credential.accessToken}`,
      'Content-Type': 'application/json',
      'x-trae-client-type': 'web',
      'x-trae-user-timezone': dressing.timezone,
      'x-preferenced-language': dressing.language,
      'Referer': dressing.referer,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  }

  async fetchModels(signal?: AbortSignal): Promise<TraeDiscoveredModel[]> {
    const credential = await this.options.credential()
    if (credential === undefined || credential.accessToken === '') {
      throw new Error('Trae credential unavailable; cannot fetch models')
    }

    const region: TraeRegion = credential.edition === 'sg' || credential.edition === 'solo-sg' ? 'ai' : 'cn'
    const defaultBase = region === 'ai'
      ? 'https://coresg-normal.trae.ai/api/remote/v1'
      : 'https://solo.trae.cn/api/remote/v1'
    const base = this.baseUrl ?? defaultBase

    const functions = region === 'ai'
      ? 'solo_agent,solo_agent_remote,solo_work_remote'
      : 'solo_agent_remote,solo_work_remote'

    const headers = await this.headers(credential, region)
    const response = await this.fetchImpl(`${base}/models?functions=${functions}`, {
      headers,
      signal: signal ?? AbortSignal.timeout(30_000),
    })

    if (!response.ok) throw new Error(`SOLO remote models returned HTTP ${response.status}`)
    const json = await response.json() as {
      code?: number
      data?: { list?: { function?: string; models?: unknown[] }[] }
    }

    const groups = json.data?.list ?? []
    const seenIds = new Set<string>()
    const seenNames = new Set<string>()
    const models: TraeDiscoveredModel[] = []

    for (const group of groups) {
      for (const raw of group.models ?? []) {
        const model = parseTraeRemoteModel(raw)
        if (model === undefined) continue
        const idKey = model.id.trim().toLowerCase()
        const nameKey = model.name.trim().toLowerCase()
        if (seenIds.has(idKey) || seenNames.has(nameKey)) continue
        seenIds.add(idKey)
        seenNames.add(nameKey)
        models.push(model)
      }
    }

    if (models.length === 0) throw new Error('SOLO remote models response contained no models')
    return models
  }
}
