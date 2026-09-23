import { randomUUID } from 'node:crypto'
import type { TraeCredential } from './auth.ts'
import { identityHeaders, type TraeIdentity } from './identity.ts'

export const TRAE_SOLO_CHAT_PATH = '/api/agent/v3/llm_utils_chat'
export const TRAE_SOLO_MODELS_PATH = '/api/ide/v1/get_detail_param'

export function traeEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

export type TraeHeaderProfile = 'agent-task' | 'model-detail' | 'raw-chat' | 'native-curl'

export const TRAE_VERSION_CODE_FALLBACK = '20260716'

export function normalizeTraeVersionCode(buildVersion: string | undefined): string {
  if (buildVersion === undefined || buildVersion.trim() === '') return TRAE_VERSION_CODE_FALLBACK
  const trimmed = buildVersion.trim()
  if (!/^\d+$/.test(trimmed)) return TRAE_VERSION_CODE_FALLBACK
  const num = Number.parseInt(trimmed, 10)
  if (num < 20000000) return TRAE_VERSION_CODE_FALLBACK
  return trimmed
}

/**
 * 构建完整的 Trae 官方请求头。
 * 必须包含 x-app-id、X-Ide-Token、x-plugin-channel 及版本号、Trace ID 等，
 * 否则官方微服务网关在参数绑定时会直接报错 4001（expr_path=app_id）。
 */
export function buildTraeHeaders(
  credential: TraeCredential,
  identity: TraeIdentity,
  options: { appId?: string; requestId?: string; profile?: TraeHeaderProfile } = {},
): Record<string, string> {
  const requestId = options.requestId ?? randomUUID()
  const traceId = requestId.replaceAll('-', '').slice(0, 32)
  const profile = options.profile ?? 'agent-task'
  const appVersion = (identity.appVersion && identity.appVersion !== '1.0.0') ? identity.appVersion : '1.0.8357'
  const common = {
    'Authorization': `Cloud-IDE-JWT ${credential.accessToken}`,
    'X-Ide-Token': credential.accessToken,
    'x-plugin-channel': 'icube-ai',
    'User-Agent': `Trae/${appVersion}`,
    'x-app-id': options.appId ?? '6eefa01c-1036-4c7e-9ca5-d891f63bfcd8',
    ...identityHeaders(identity),
    'x-app-version-code': normalizeTraeVersionCode(identity.buildVersion),
    'x-ide-version-code': normalizeTraeVersionCode(identity.buildVersion),
    'x-custom-trace-id': traceId,
    'x-flow-traceparent': `04-${traceId}-${traceId.slice(0, 16)}-01`,
    'request-traffic-type': 'prod',
    'Content-Type': 'application/json',
  }

  if (profile === 'model-detail') {
    return { ...common, 'Accept': 'application/json' }
  }

  return {
    ...common,
    'X-Cloudide-Token': credential.accessToken,
    'x-uid': credential.userId,
    'x-request-id': requestId,
    'x-trae-request-id': requestId,
    'Accept': 'text/event-stream',
  }
}

export const buildTraeCnHeaders = buildTraeHeaders
