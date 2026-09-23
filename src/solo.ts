import type { TraeCredential } from './auth.ts'
import type { TraeIdentity } from './identity.ts'
import { buildTraeHeaders, traeEndpoint, TRAE_SOLO_CHAT_PATH, TRAE_SOLO_MODELS_PATH } from './protocol.ts'
import { parseReasoningCapability, type TraeReasoningCapability } from './reasoning.ts'
import type { TraeRegion } from './variants.ts'

import type { TraeModelInfo } from './catalog.ts'

export const TRAE_SOLO_FUNCTION = 'solo_work_lite'

export const TRAE_DIRECTORY_FUNCTIONS: Readonly<Record<TraeRegion, readonly string[]>> = {
  cn: ['solo_work_remote', 'solo_agent', 'builder_v3', 'code_review_summary', TRAE_SOLO_FUNCTION],
  ai: ['solo_agent', 'solo_work_remote', 'solo_work_lite', 'solo_agent_lite', 'builder_v3', 'code_review_summary'],
}

export interface PrepareSoloBodyOptions {
  defaultModel?: string | undefined
  functionName?: string | undefined
  region?: TraeRegion | undefined
  catalogModels?: readonly TraeModelInfo[] | undefined
}

/**
 * 组装发送给 Trae llm_utils_chat 端点的请求体。
 * 精确匹配模型对应的 wireConfigName 与 wireFunction 通道，避免 4001 param is invalid 报错。
 */
export function prepareSoloBody(
  source: string,
  optionsOrModel?: string | PrepareSoloBodyOptions,
  functionName?: string,
  region: TraeRegion = 'cn',
): string {
  const opts: PrepareSoloBodyOptions = typeof optionsOrModel === 'object' && optionsOrModel !== null
    ? optionsOrModel
    : {
      defaultModel: typeof optionsOrModel === 'string' ? optionsOrModel : 'glm-5.2',
      functionName,
      region,
    }

  const effectiveRegion = opts.region ?? 'cn'
  const defaultModel = opts.defaultModel ?? (effectiveRegion === 'ai' ? 'gpt-5.4' : 'glm-5.2')
  const input = JSON.parse(source) as Record<string, unknown>
  let requestedModel = typeof input['model'] === 'string' && input['model'].trim() !== ''
    ? input['model'].trim()
    : defaultModel

  // Auto 智能路由映射到主力稳定模型
  if (requestedModel.toLowerCase() === 'auto') {
    requestedModel = effectiveRegion === 'ai' ? 'gpt-5.4' : 'glm-5.2'
  }

  // 从当前变体的 catalog 中解析真实的 wire 属性
  const entry = opts.catalogModels?.find(
    m => m.id === requestedModel || m.name === requestedModel || m.wireConfigName === requestedModel,
  )

  const wireModel = entry?.wireConfigName ?? requestedModel
  const wireFunction = typeof input['function'] === 'string' && input['function'] !== ''
    ? input['function']
    : (entry?.wireFunction ?? opts.functionName ?? (effectiveRegion === 'ai' ? 'solo_agent' : 'solo_work_remote'))

  const body: Record<string, unknown> = {
    ...Array.isArray(input['messages']) ? { messages: input['messages'] } : {},
    model: wireModel,
    config_name: wireModel,
    function: wireFunction,
    stream: true,
    ...Array.isArray(input['tools']) ? { tools: input['tools'] } : {},
  }

  // 映射 reasoning_effort
  if (typeof input['reasoning_effort'] === 'string') {
    const rawEffort = input['reasoning_effort']
    const efforts = entry?.reasoningEfforts
    const mapped = efforts?.[rawEffort as keyof typeof efforts]
    if (typeof mapped === 'string') {
      body['reasoning_effort'] = mapped
    } else if (efforts !== undefined && Object.values(efforts).includes(rawEffort)) {
      body['reasoning_effort'] = rawEffort
    }
  }

  if (Array.isArray(body['messages'])) {
    for (const raw of body['messages']) {
      if (typeof raw !== 'object' || raw === null) continue
      const message = raw as Record<string, unknown>
      if (message['role'] === 'developer') message['role'] = 'system'
      if (typeof message['content'] === 'string') message['content'] = [{ type: 'text', text: message['content'] }]
      if (message['role'] === 'assistant' && Array.isArray(message['tool_calls'])) {
        for (const rawCall of message['tool_calls']) {
          if (typeof rawCall !== 'object' || rawCall === null) continue
          const call = rawCall as Record<string, unknown>
          if (typeof call['function'] === 'object' && call['function'] !== null) {
            call['function_call'] = call['function']
            delete call['function']
          }
        }
      }
      if (message['role'] === 'tool') {
        if (typeof message['tool_call_id'] !== 'string' || message['tool_call_id'] === '') {
          throw new Error('Trae SOLO tool message requires tool_call_id')
        }
      }
    }
  }

  if (Array.isArray(body['tools'])) {
    for (const raw of body['tools']) {
      if (typeof raw !== 'object' || raw === null) continue
      const fn = (raw as Record<string, unknown>)['function']
      if (typeof fn !== 'object' || fn === null) continue
      const record = fn as Record<string, unknown>
      if (typeof record['parameters'] === 'object' && record['parameters'] !== null) {
        record['parameters'] = JSON.stringify(record['parameters'])
      }
    }
  }

  return JSON.stringify(body)
}

export interface TraeSoloModel {
  id: string
  name: string
  contextWindow?: number | undefined
  maxTokens?: number | undefined
  reasoning?: TraeReasoningCapability | undefined
  function?: string | undefined
}

export interface TraeSoloClientOptions {
  credential: () => Promise<TraeCredential | undefined>
  identity: () => Promise<TraeIdentity>
  baseUrl?: string | undefined
  fetchImpl?: typeof fetch | undefined
}

export class TraeSoloUpstreamClient {
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: TraeSoloClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async fetchModels(signal?: AbortSignal): Promise<TraeSoloModel[]> {
    const [credential, identity] = await Promise.all([this.options.credential(), this.options.identity()])
    if (credential === undefined || credential.accessToken === '') {
      throw new Error('Trae credential unavailable; cannot fetch wire models')
    }

    const region: TraeRegion = credential.edition === 'sg' || credential.edition === 'solo-sg' ? 'ai' : 'cn'
    const defaultBase = region === 'ai' ? 'https://coresg-normal.trae.ai' : 'https://trae-api-cn.mchost.guru'
    const base = this.options.baseUrl ?? defaultBase
    const headers = buildTraeHeaders(credential, identity, { profile: 'model-detail' })
    const byId = new Map<string, TraeSoloModel>()

    for (const directoryFunction of TRAE_DIRECTORY_FUNCTIONS[region]) {
      try {
        const response = await this.fetchImpl(traeEndpoint(base, TRAE_SOLO_MODELS_PATH), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            function: directoryFunction,
            config_names: null,
            need_prompt: false,
            current_config_info: null,
            poly_prompt: true,
            mode_type: null,
            agent_type: null,
          }),
          signal: signal ?? AbortSignal.timeout(15_000),
        })
        if (!response.ok) continue
        const payload = await response.json() as Record<string, unknown>
        const list = Array.isArray(payload['config_info_list'])
          ? payload['config_info_list']
          : Array.isArray((payload['data'] as Record<string, unknown>)?.['config_detail_list'])
            ? (payload['data'] as Record<string, unknown>)['config_detail_list'] as unknown[]
            : []

        for (const item of list) {
          if (typeof item !== 'object' || item === null) continue
          const config = item as Record<string, unknown>
          const id = typeof config['config_name'] === 'string' ? config['config_name'] : ''
          if (id === '' || byId.has(id)) continue
          const display = typeof config['display_config'] === 'object' && config['display_config'] !== null
            ? config['display_config'] as Record<string, unknown>
            : {}
          const name = typeof display['display_name'] === 'string' && display['display_name'] !== ''
            ? display['display_name']
            : (typeof config['model'] === 'string' && config['model'] !== '' ? config['model'] : id)
          const details = Array.isArray(config['model_detail_list']) ? config['model_detail_list'] : []
          const detail = typeof details[0] === 'object' && details[0] !== null ? details[0] as Record<string, unknown> : {}
          const promptMaxTokens = typeof detail['prompt_max_tokens'] === 'number' ? detail['prompt_max_tokens'] : undefined
          const maxTokens = typeof detail['max_tokens'] === 'number' ? detail['max_tokens'] : undefined
          const reasoning = parseReasoningCapability({ ...config, ...detail })
          byId.set(id, {
            id,
            name,
            function: directoryFunction,
            ...promptMaxTokens === undefined ? {} : { contextWindow: promptMaxTokens },
            ...maxTokens === undefined ? {} : { maxTokens },
            ...reasoning === undefined ? {} : { reasoning },
          })
        }
      } catch {
        // continue
      }
    }

    return Array.from(byId.values())
  }
}
