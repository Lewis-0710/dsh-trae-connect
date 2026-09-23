/**
 * Trae 状态端点路由处理器：为前端卡片与侧栏额度提供账号状态、额度、模型列表与探测状态。
 *
 * @module dsh-trae-connect/web-status
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TraeCredentialStore } from './auth.ts'
import type { TraeModelInfo } from './catalog.ts'
import { hostIsLoopback, originIsLoopback } from './loopback.ts'
import type {
  TraeWebCatalog,
  TraeWebCheckInInfo,
  TraeWebCredits,
  TraeWebModelBadge,
  TraeWebProbeSection,
  TraeWebStatus,
} from './status-paths.ts'
import type { TraeUpstreamClient } from './upstream.ts'
import type { TraeVariant } from './variants.ts'

export interface TraeStatusRouteOptions {
  variant: TraeVariant
  store: TraeCredentialStore
  client: TraeUpstreamClient
  models: () => readonly TraeModelInfo[]
  catalog?: () => TraeWebCatalog | undefined
  probe?: () => TraeWebProbeSection
  probeKey?: string
  loginKey?: string
  useMaximumContextWindow?: () => boolean
  disabledModels?: () => readonly string[]
  checkIn?: () => TraeWebCheckInInfo | undefined
  onForceRefresh?: () => Promise<void>
}

const cachedCreditsByVariant = new Map<string, { data: TraeWebCredits | undefined; at: number }>()
const CREDITS_TTL_MS = 60_000

export async function traeStatusHandler(
  req: IncomingMessage,
  res: ServerResponse,
  options: TraeStatusRouteOptions,
): Promise<void> {
  const send = (status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  if (req.method !== 'GET') {
    send(405, { error: 'Method not allowed' })
    return
  }

  if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers.origin)) {
    send(403, { error: '请求未受信：仅支持本地环回访问' })
    return
  }

  const credential = await options.store.get()
  const models = options.models()
  const modelBadges: TraeWebModelBadge[] = models.map(m => ({
    id: m.id,
    name: m.name,
    free: m.creditMultiplier === 0,
    ...m.creditMultiplier !== undefined ? { credits: `x${m.creditMultiplier.toFixed(2)}` } : {},
    ...m.contextWindow !== undefined ? { contextWindow: m.contextWindow } : {},
    ...m.maxContextWindow !== undefined ? { maxContextWindow: m.maxContextWindow } : {},
    ...m.requiresMembership !== undefined ? { requiresMembership: m.requiresMembership } : {},
  }))

  const probe = options.probe?.()
  const catalog = options.catalog?.()
  const checkIn = options.checkIn?.()
  const disabledModels = options.disabledModels?.()
  const useMaximumContextWindow = options.useMaximumContextWindow?.()

  if (credential === undefined || credential.accessToken === '') {
    const document: TraeWebStatus = {
      status: 'signed-out',
      region: options.variant.region,
      models: modelBadges,
      ...catalog !== undefined ? { catalog } : {},
      ...probe !== undefined ? { probe } : {},
      ...options.loginKey !== undefined ? { loginKey: options.loginKey } : {},
      ...options.probeKey !== undefined ? { probeKey: options.probeKey } : {},
      ...checkIn !== undefined ? { checkIn } : {},
      ...disabledModels !== undefined ? { disabledModels } : {},
      ...useMaximumContextWindow !== undefined ? { useMaximumContextWindow } : {},
    }
    send(200, document)
    return
  }

  let credits: TraeWebCredits | undefined
  let creditsError: string | undefined

  const now = Date.now()
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const forceRefresh = url.searchParams.get('refresh') === '1'
  const cached = cachedCreditsByVariant.get(options.variant.id)

  if (!forceRefresh && cached !== undefined && now - cached.at < CREDITS_TTL_MS) {
    credits = cached.data
  } else {
    if (forceRefresh) {
      void options.onForceRefresh?.()
    }
    try {
      credits = await options.client.fetchCredits(AbortSignal.timeout(10_000))
      cachedCreditsByVariant.set(options.variant.id, { data: credits, at: now })
    } catch (err) {
      creditsError = err instanceof Error ? err.message : String(err)
    }
  }

  const document: TraeWebStatus = {
    status: 'signed-in',
    userId: credential.userId,
    nickname: credential.accountName ?? credential.userId,
    ...credential.accountName !== undefined ? { accountName: credential.accountName } : {},
    region: options.variant.region,
    source: credential.source,
    expiresAt: credential.expiresAtMs,
    ...credits !== undefined ? { credits } : {},
    ...creditsError !== undefined ? { creditsError } : {},
    models: modelBadges,
    ...catalog !== undefined ? { catalog } : {},
    ...probe !== undefined ? { probe } : {},
    ...options.loginKey !== undefined ? { loginKey: options.loginKey } : {},
    ...options.probeKey !== undefined ? { probeKey: options.probeKey } : {},
    ...checkIn !== undefined ? { checkIn } : {},
    ...disabledModels !== undefined ? { disabledModels } : {},
    ...useMaximumContextWindow !== undefined ? { useMaximumContextWindow } : {},
  }

  send(200, document)
}
