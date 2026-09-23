/**
 * Trae pi-ai provider adapter for DeepSeek Harness.
 *
 * @module dsh-trae-connect/adapter
 */

import { createProvider } from '@earendil-works/pi-ai'
import type { Api, AuthContext, CredentialStore, Model, Provider } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { resolveRetryPolicy, type LlmModelInfo, type LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter, type ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import {
  formatTraeModelDisplayName,
  traeInputModalities,
  type TraeCatalog,
  type TraeModelInfo,
} from './catalog.ts'
import type { TraeShim } from './shim.ts'
import type { TraeVariant } from './variants.ts'

export const TRAE_PROVIDER = 'trae'
export const TRAE_AI_PROVIDER = 'trae-global'
export const TRAE_STREAM_IDLE_TIMEOUT_MS = 300_000

const INERT_AUTH: { credentials: CredentialStore; authContext: AuthContext } = {
  credentials: {
    async read() { return undefined },
    async list() { return [] },
    async modify() { throw new Error('dsh-trae-connect has no pi-ai credential lifecycle') },
    async delete() {},
  },
  authContext: {
    async env() { return undefined },
    async fileExists() { return false },
  },
}

const REQUEST_IMAGE_BUDGETS = {
  maxRequestImageBytes: 20_971_520,
  requestImagePixelBudget: 4_194_304,
  requestImageMaxBytes: 1_048_576,
} as const

function toPiModel(info: TraeModelInfo, baseUrl: string, providerId: string, useMax = false): Model<Api> {
  const displayName = formatTraeModelDisplayName(info)
  const ctxWindow = (useMax ? (info.maxContextWindow ?? info.contextWindow) : info.contextWindow) ?? info.maxContextWindow
  return {
    id: info.id,
    name: displayName,
    api: 'openai-completions',
    provider: providerId,
    baseUrl,
    input: traeInputModalities(info),
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    reasoning: info.reasoningEfforts !== undefined,
    ...(info.reasoningEfforts === undefined ? {} : {
      thinkingLevelMap: {
        off: null,
        minimal: null,
        low: info.reasoningEfforts.low ?? null,
        medium: null,
        high: info.reasoningEfforts.high ?? null,
        xhigh: info.reasoningEfforts.xhigh ?? null,
        max: null,
      },
    }),
    ...(ctxWindow === undefined ? {} : { contextWindow: ctxWindow }),
    ...(info.maxTokens === undefined ? {} : { maxTokens: info.maxTokens }),
    compat: { supportsReasoningEffort: info.reasoningEfforts !== undefined },
  } as unknown as Model<Api>
}

export interface TraeAdapterOptions {
  variant: TraeVariant
  shim: TraeShim
  catalog: TraeCatalog
  resolveAttachments?: () => AttachmentStore | undefined
  useMaximumContextWindow?: () => boolean
}

export interface TraeAdapter {
  adapter: PiAiAdapter
  invalidate(): void
}

class TraePiAiAdapter extends PiAiAdapter {
  constructor(
    private readonly catalog: TraeCatalog,
    options: ConstructorParameters<typeof PiAiAdapter>[0],
  ) {
    super(options)
  }

  private infoFor(model: string): TraeModelInfo | undefined {
    return this.catalog.current().find(entry => entry.id === model)
  }

  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const models = await super.listModels(provider)
    return models.map(model => {
      const info = this.infoFor(model.id)
      if (info === undefined) return model
      return { ...model, name: formatTraeModelDisplayName(info) }
    })
  }

  override async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    const resolved = await super.resolveModel(provider, model, signal)
    const info = this.infoFor(model)
    if (info === undefined) return resolved
    return { ...resolved, name: formatTraeModelDisplayName(info) }
  }
}

export function createTraeAdapter(options: TraeAdapterOptions): TraeAdapter {
  const providerId = options.variant.id
  const providerName = options.variant.displayName

  const buildModels = (): Model<Api>[] => {
    let baseUrl = 'http://127.0.0.1:0/v1'
    try {
      baseUrl = `${options.shim.baseUrl()}/v1`
    } catch {
      // Ephemeral shim port might not be ready yet during immediate synchronous assembly
    }
    const useMax = options.useMaximumContextWindow?.() ?? false
    return options.catalog.current().map(info => toPiModel(info, baseUrl, providerId, useMax))
  }

  const base = createProvider({
    id: providerId,
    name: providerName,
    auth: {
      apiKey: {
        name: 'Trae loopback secret',
        async resolve({ credential }) {
          const apiKey = credential?.key ?? options.shim.token()
          return { auth: { apiKey }, source: 'Trae loopback' }
        },
      },
    },
    models: buildModels(),
    api: openAICompletionsApi(),
  })

  const provider: Provider = { ...base, getModels: () => buildModels() }
  const profile: ResolvedPiAiProviderProfile = {
    provider: providerId,
    displayName: providerName,
    streamIdleTimeoutMs: TRAE_STREAM_IDLE_TIMEOUT_MS,
    retryPolicy: resolveRetryPolicy(undefined, 'dsh-trae-connect retryPolicy'),
    configuredMaxTokens: new Map(),
    modelErrors: new Map(),
    ...REQUEST_IMAGE_BUDGETS,
    piProvider: provider,
  }

  let profiles = new Map<string, ResolvedPiAiProviderProfile>([[providerId, profile]])

  const adapter = new TraePiAiAdapter(options.catalog, {
    profiles: () => profiles,
    auth: INERT_AUTH,
    resolveApiKey: async () => options.shim.token(),
    ...options.resolveAttachments === undefined ? {} : { resolveAttachments: options.resolveAttachments },
  })

  return {
    adapter,
    invalidate() {
      profiles = new Map<string, ResolvedPiAiProviderProfile>([[providerId, profile]])
    },
  }
}
