/**
 * Trae usage, credits, entitlements, and check-in status client.
 *
 * @module dsh-trae-connect/usage
 */

import type { TraeCredential } from './auth.ts'
import { buildTraeClientHeaders } from './device.ts'
import type { TraeRegion } from './variants.ts'

export interface TraeUsageOptions {
  credential: () => Promise<TraeCredential | undefined>
  fetchImpl?: typeof fetch | undefined
  baseUrl?: string | undefined
  timeoutMs?: number | undefined
}

export interface TraePayStatus {
  isDollarUsageBilling: boolean
  hasPackage: boolean
  isPayFreshman: boolean
  inTrial: boolean
  trialEndTimeMs: number
  enableSoloLite: boolean
  enableSoloBuilder: boolean
  enableSoloCoder: boolean
  enableSoloWeb: boolean
  fission?: { startTimeMs: number; expireTimeMs: number; maxUsage: number } | undefined
}

export interface TraeUsageSummary {
  totalAmount: number
  consumedAmount: number
  consumptionRatio: number
}

export interface TraeUsagePack {
  displayDesc: string
  entitlementId: string
  endTimeMs: number
  currency: number
  availableEndpoint?: number
  creditsLimit?: number
  consumedCredits?: number
}

export interface TraeUsageSnapshot {
  isCreditsBilling: boolean
  isDollarUsageBilling: boolean
  isPayFreshman: boolean
  inTrial: boolean
  trialEndTimeMs: number
  summary: TraeUsageSummary
  packs: TraeUsagePack[]
}

export interface TraeCheckinStatus {
  checkedIn: boolean
  credits: number
  enabled: boolean
}

export interface TraeActivityRule {
  activityId: string
  enabled: boolean
  activityType: number
  startTimeMs: number
  endTimeMs: number
  workExtra?: Record<string, unknown>
}

export interface TraeUsageView {
  snapshot?: TraeUsageSnapshot
  checkin?: TraeCheckinStatus
  activities?: TraeActivityRule[]
  payStatus?: TraePayStatus
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseUsageSnapshot(payload: Record<string, unknown>): TraeUsageSnapshot {
  const summaryRaw = payload['usage_summary'] as Record<string, unknown> | undefined
  const summary: TraeUsageSummary = {
    totalAmount: asNumber(summaryRaw?.['total_amount']) ?? 0,
    consumedAmount: asNumber(summaryRaw?.['consumed_amount']) ?? 0,
    consumptionRatio: asNumber(summaryRaw?.['consumption_ratio']) ?? 0,
  }
  const trial = payload['trial_status'] as Record<string, unknown> | undefined
  const packs: TraeUsagePack[] = []
  const rawPacks = Array.isArray(payload['user_entitlement_pack_list']) ? payload['user_entitlement_pack_list'] : []

  for (const raw of rawPacks) {
    if (typeof raw !== 'object' || raw === null) continue
    const pack = raw as Record<string, unknown>
    const base = pack['entitlement_base_info'] as Record<string, unknown> | undefined
    const quota = base?.['quota'] as Record<string, unknown> | undefined
    const usage = pack['usage'] as Record<string, unknown> | undefined
    const productExtra = base?.['product_extra'] as Record<string, unknown> | undefined
    const packageExtra = productExtra?.['package_extra'] as Record<string, unknown> | undefined
    const packageQuota = packageExtra?.['quota'] as Record<string, unknown> | undefined
    const creditsLimit = asNumber(packageQuota?.['credits_limit']) ?? asNumber(quota?.['credits_limit'])
    const consumedCredits = asNumber(usage?.['credits_amount'])
    const availableEndpoint = asNumber(base?.['available_endpoint'])

    packs.push({
      displayDesc: typeof pack['display_desc'] === 'string' ? pack['display_desc'] : '',
      entitlementId: typeof base?.['entitlement_id'] === 'string' ? base['entitlement_id'] : '',
      endTimeMs: asNumber(base?.['end_time']) ?? 0,
      currency: asNumber(base?.['currency']) ?? 0,
      ...availableEndpoint === undefined ? {} : { availableEndpoint },
      ...creditsLimit === undefined ? {} : { creditsLimit },
      ...consumedCredits === undefined ? {} : { consumedCredits },
    })
  }

  return {
    isCreditsBilling: payload['is_credits_billing'] === true,
    isDollarUsageBilling: payload['is_dollar_usage_billing'] === true,
    isPayFreshman: payload['is_pay_freshman'] === true,
    inTrial: trial?.['is_in_trial'] === true,
    trialEndTimeMs: asNumber(trial?.['trial_end_time']) ?? 0,
    summary,
    packs,
  }
}

export class TraeUsageClient {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string | undefined
  private readonly timeoutMs: number

  constructor(private readonly options: TraeUsageOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = options.baseUrl
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  private async currentRegion(): Promise<TraeRegion> {
    const cred = await this.options.credential()
    if (cred === undefined) return 'cn'
    return cred.edition === 'sg' || cred.edition === 'solo-sg' ? 'ai' : 'cn'
  }

  private async payBase(): Promise<string> {
    if (this.baseUrl !== undefined) return this.baseUrl
    const region = await this.currentRegion()
    return region === 'ai' ? 'https://growsg-normal.trae.ai' : 'https://api.trae.cn'
  }

  private async authedHeaders(): Promise<Record<string, string>> {
    const credential = await this.options.credential()
    if (credential === undefined || credential.accessToken === '') {
      throw new Error('Trae credential is not available; cannot query usage')
    }
    const region = await this.currentRegion()
    const origin = region === 'ai' ? 'https://www.trae.ai' : 'https://www.trae.cn'
    return {
      'Authorization': `Cloud-IDE-JWT ${credential.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Origin': origin,
      'Referer': `${origin}/`,
    }
  }

  private async post<T>(path: string, data: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const headers = await this.authedHeaders()
    const response = await this.fetchImpl(`${await this.payBase()}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: signal ?? AbortSignal.timeout(this.timeoutMs),
    })
    if (!response.ok) throw new Error(`Trae usage endpoint ${path} returned HTTP ${response.status}`)
    return await response.json() as T
  }

  async payStatus(signal?: AbortSignal): Promise<TraePayStatus> {
    const payload = await this.post<Record<string, unknown>>('/trae/api/v1/pay/ide_user_pay_status', {}, signal)
    const flag = (key: string): boolean => payload[key] === true
    const trial = typeof payload['trial_status'] === 'object' && payload['trial_status'] !== null
      ? payload['trial_status'] as Record<string, unknown>
      : {}
    const fissionStart = asNumber(payload['solo_fission_start_time'])
    const fissionExpire = asNumber(payload['solo_fission_expire_time'])
    const fissionMax = asNumber(payload['solo_fission_max_usage'])
    return {
      isDollarUsageBilling: flag('is_dollar_usage_billing'),
      hasPackage: flag('has_package'),
      isPayFreshman: flag('is_pay_freshman') || flag('is_pay_freshman_v2'),
      inTrial: trial['is_in_trial'] === true,
      trialEndTimeMs: asNumber(trial['trial_end_time']) ?? 0,
      enableSoloLite: flag('enable_solo_lite'),
      enableSoloBuilder: flag('enable_solo_builder'),
      enableSoloCoder: flag('enable_solo_coder'),
      enableSoloWeb: flag('enable_solo_web'),
      ...fissionStart === undefined || fissionExpire === undefined || fissionMax === undefined ? {} : {
        fission: { startTimeMs: fissionStart, expireTimeMs: fissionExpire, maxUsage: fissionMax },
      },
    }
  }

  async snapshot(signal?: AbortSignal): Promise<TraeUsageSnapshot> {
    const payload = await this.post<Record<string, unknown>>('/trae/api/v2/pay/web_user_ent_usage', { require_usage: true }, signal)
    return parseUsageSnapshot(payload)
  }

  private async clientHeaders(): Promise<Record<string, string>> {
    const credential = await this.options.credential()
    if (credential === undefined || credential.accessToken === '') {
      throw new Error('Trae credential is not available; cannot query usage')
    }
    return buildTraeClientHeaders(credential.accessToken)
  }

  async checkinStatus(signal?: AbortSignal): Promise<TraeCheckinStatus> {
    const region = await this.currentRegion()
    if (region !== 'cn') {
      return { checkedIn: false, credits: 0, enabled: false }
    }
    const headers = await this.clientHeaders()
    const response = await this.fetchImpl('https://api.trae.cn/trae/api/v2/ug/checkin_credits/status', {
      method: 'POST',
      headers,
      body: JSON.stringify({ req_source: 1 }),
      signal: signal ?? AbortSignal.timeout(this.timeoutMs),
    })
    if (!response.ok) {
      throw new Error(`Trae checkinStatus returned HTTP ${response.status}`)
    }
    const payload = await response.json() as Record<string, unknown>
    return {
      checkedIn: payload['checked_in'] === true,
      credits: asNumber(payload['credits']) ?? 0,
      enabled: payload['enable'] !== false,
    }
  }

  async claimCheckin(signal?: AbortSignal): Promise<{
    ok: boolean
    code?: number
    message?: string
    credits?: number
    alreadyClaimed?: boolean
  }> {
    const region = await this.currentRegion()
    if (region !== 'cn') {
      return { ok: false, message: '国际版（Trae Global）暂无每日签到活动' }
    }

    // 先检查当前服务端是否已显示已签到，若已签到直接自愈返回成功，避免重复请求被风控
    try {
      const current = await this.checkinStatus(signal)
      if (current.checkedIn) {
        return { ok: true, alreadyClaimed: true, credits: current.credits }
      }
    } catch {}

    const headers = await this.clientHeaders()
    const response = await this.fetchImpl('https://api.trae.cn/trae/api/v2/ug/checkin_credits/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify({ req_source: 1 }),
      signal: signal ?? AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` }
    }

    const json = await response.json() as { code?: number; message?: string; credits?: number }
    if (json.code === 0) {
      return { ok: true, credits: json.credits ?? 150 }
    }
    return {
      ok: false,
      ...typeof json.code === 'number' ? { code: json.code } : {},
      message: json.message ?? (typeof json.code === 'number' ? `签到失败 (错误码 ${json.code})` : '签到未成功'),
    }
  }

  async view(signal?: AbortSignal): Promise<TraeUsageView> {
    const region = await this.currentRegion()
    if (region === 'ai') {
      try {
        const pay = await this.payStatus(signal)
        return { payStatus: pay }
      } catch {
        return {}
      }
    }

    try {
      const [snapshot, checkin] = await Promise.all([
        this.snapshot(signal).catch(() => undefined),
        this.checkinStatus(signal).catch(() => undefined),
      ])
      return {
        ...snapshot !== undefined ? { snapshot } : {},
        ...checkin !== undefined ? { checkin } : {},
      }
    } catch {
      return {}
    }
  }
}
