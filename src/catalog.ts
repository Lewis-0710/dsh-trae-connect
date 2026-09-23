/**
 * Trae model catalog, fallback models, source merging, and metadata formatting.
 *
 * @module dsh-trae-connect/catalog
 */

import { type TraeReasoningCapability, type TraeReasoningEffort } from './reasoning.ts'
import type { TraeRegion } from './variants.ts'

export type TraeInputModality = 'text' | 'image'

export interface TraeDiscoveredReasoning {
  supported: TraeReasoningEffort[]
  defaultEffort?: TraeReasoningEffort
}

export interface TraeDiscoveredModel {
  id: string
  name: string
  multimodal: boolean
  requiresMembership?: boolean
  contextWindow?: number
  maxContextWindow?: number
  creditMultiplier?: number
  badges?: string[]
  reasoningSupported: boolean
  reasoning?: TraeDiscoveredReasoning | undefined
}

export interface TraeWireModel {
  id: string
  name: string
  contextWindow?: number | undefined
  maxTokens?: number | undefined
  reasoning?: TraeReasoningCapability | undefined
  function?: string | undefined
}

export interface TraeModelInfo {
  id: string
  name: string
  contextWindow?: number | undefined
  maxTokens?: number | undefined
  input?: TraeInputModality[] | undefined
  creditMultiplier?: number | undefined
  badges?: string[] | undefined
  requiresMembership?: boolean | undefined
  reasoningSupported?: boolean | undefined
  reasoning?: TraeDiscoveredReasoning | undefined
  reasoningEfforts?: Partial<Record<TraeReasoningEffort, string | null>> | undefined
  maxContextWindow?: number | undefined
  wireConfigName?: string | undefined
  wireFunction?: string | undefined
}

/**
 * 国内版（16 个模型，含 Auto）兜底目录。
 */
export const FALLBACK_TRAE_MODELS: readonly TraeModelInfo[] = [
  { id: 'auto', name: 'Auto', contextWindow: 200_000, wireConfigName: 'glm-5.2', wireFunction: 'solo_work_lite' },
  { id: 'Doubao-Seed-Evolving', name: 'Seed-Evolving', contextWindow: 200_000, creditMultiplier: 0.8, wireConfigName: 'Doubao-Seed-Evolving', wireFunction: 'solo_work_remote' },
  { id: 'Doubao-Seed-2.1-Pro', name: 'Seed-2.1-Pro-0915', contextWindow: 200_000, creditMultiplier: 0.8, wireConfigName: 'Doubao-Seed-2.1-Pro', wireFunction: 'solo_work_remote' },
  { id: 'Doubao-Seed-2.1-Turbo', name: 'Seed-2.1-Turbo', contextWindow: 200_000, creditMultiplier: 0.2, wireConfigName: 'Doubao-Seed-2.1-Turbo', wireFunction: 'solo_work_remote' },
  { id: 'Doubao-Seed-Code', name: 'Seed-Code', contextWindow: 200_000, creditMultiplier: 0.06, wireConfigName: 'Doubao-Seed-Code', wireFunction: 'solo_agent_remote' },
  { id: 'step-5-preview', name: 'Step-5-Preview', contextWindow: 200_000, creditMultiplier: 0.48, wireConfigName: 'step-5-preview', wireFunction: 'solo_work_remote' },
  { id: 'glm-5.3', name: 'GLM-5.3', contextWindow: 200_000, creditMultiplier: 0.78, wireConfigName: 'glm-5.3', wireFunction: 'solo_work_remote' },
  { id: 'glm-5.2', name: 'GLM-5.2', contextWindow: 200_000, creditMultiplier: 0.78, wireConfigName: 'glm-5.2', wireFunction: 'solo_work_remote' },
  { id: 'DeepSeek-V4-Flash-Official', name: 'DeepSeek-V4-Flash 正式版', contextWindow: 200_000, creditMultiplier: 0.16, wireConfigName: 'DeepSeek-V4-Flash-Official', wireFunction: 'solo_work_remote' },
  { id: 'DeepSeek-V4-Pro-Official', name: 'DeepSeek-V4-Pro 正式版', contextWindow: 200_000, creditMultiplier: 0.72, wireConfigName: 'DeepSeek-V4-Pro-Official', wireFunction: 'solo_work_remote' },
  { id: 'kimi-k3', name: 'Kimi-K3', contextWindow: 200_000, creditMultiplier: 1.83, wireConfigName: 'kimi-k3', wireFunction: 'solo_work_remote' },
  { id: 'kimi-k2.7-code', name: 'Kimi-K2.7-Code', contextWindow: 200_000, creditMultiplier: 0.83, wireConfigName: 'kimi-k2.7-code', wireFunction: 'solo_work_remote' },
  { id: 'kimi-k2.6', name: 'Kimi-K2.6', contextWindow: 200_000, creditMultiplier: 0.75, wireConfigName: 'kimi-k2.6', wireFunction: 'solo_work_remote' },
  { id: 'minimax-m3', name: 'MiniMax-M3', contextWindow: 200_000, creditMultiplier: 0.26, wireConfigName: 'minimax-m3', wireFunction: 'solo_work_remote' },
  { id: 'qwen3.8-max', name: 'Qwen3.8-Max', contextWindow: 200_000, creditMultiplier: 1.5, wireConfigName: 'qwen3.8-max', wireFunction: 'solo_work_remote' },
  { id: 'qwen-3.7-plus', name: 'Qwen3.7-Plus', contextWindow: 200_000, creditMultiplier: 0.25, wireConfigName: 'qwen-3.7-plus', wireFunction: 'solo_work_remote' },
]

/**
 * 国际版（17 个模型，含 Auto）兜底目录。
 */
export const FALLBACK_TRAE_MODELS_AI: readonly TraeModelInfo[] = [
  { id: 'auto', name: 'Auto', contextWindow: 200_000, wireConfigName: 'gpt-5.4', wireFunction: 'solo_agent' },
  { id: 'Dola-Seed-2.0-Code', name: 'Seed-2.1-Turbo', contextWindow: 200_000, wireConfigName: 'Dola-Seed-2.0-Code', wireFunction: 'solo_agent' },
  { id: 'gpt-6-astra', name: 'GPT-6-Astra', contextWindow: 272_000, wireConfigName: 'gpt-6-astra', wireFunction: 'solo_agent' },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6-Sol', contextWindow: 272_000, wireConfigName: 'gpt-5.6-sol', wireFunction: 'solo_agent' },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6-Terra', contextWindow: 272_000, wireConfigName: 'gpt-5.6-terra', wireFunction: 'solo_agent' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6-Luna', contextWindow: 272_000, wireConfigName: 'gpt-5.6-luna', wireFunction: 'solo_agent' },
  { id: 'gpt-5.5', name: 'GPT-5.5', contextWindow: 272_000, wireConfigName: 'gpt-5.5', wireFunction: 'solo_agent' },
  { id: 'gpt-5.4', name: 'GPT-5.4', contextWindow: 272_000, wireConfigName: 'gpt-5.4', wireFunction: 'solo_agent' },
  { id: 'gpt-5.2', name: 'GPT-5.2', contextWindow: 272_000, wireConfigName: 'gpt-5.2', wireFunction: 'solo_agent' },
  { id: 'glm-5.2', name: 'GLM-5.2', contextWindow: 200_000, wireConfigName: 'glm-5.2', wireFunction: 'solo_agent' },
  { id: 'deepseek-v4-flash-0731', name: 'DeepSeek-V4-Flash', contextWindow: 200_000, wireConfigName: 'deepseek-v4-flash-0731', wireFunction: 'solo_agent' },
  { id: 'kimi-k2.7-code', name: 'Kimi-K2.7-Code', contextWindow: 200_000, wireConfigName: 'kimi-k2.7-code', wireFunction: 'solo_agent' },
  { id: 'kimi-k2.5', name: 'Kimi-K2.5', contextWindow: 200_000, wireConfigName: 'kimi-k2.5', wireFunction: 'solo_agent' },
  { id: 'gemini-3.1-pro', name: 'Gemini-3.1-Pro-Preview', contextWindow: 200_000, wireConfigName: 'gemini-3.1-pro', wireFunction: 'solo_agent' },
  { id: 'gemini-3-flash-solo', name: 'Gemini-3-Flash-Preview', contextWindow: 200_000, wireConfigName: 'gemini-3-flash-solo', wireFunction: 'solo_agent' },
  { id: 'minimax-m3', name: 'MiniMax-M3', contextWindow: 200_000, wireConfigName: 'minimax-m3', wireFunction: 'solo_agent' },
  { id: 'minimax-m2.7', name: 'MiniMax-M2.7', contextWindow: 200_000, wireConfigName: 'minimax-m2.7', wireFunction: 'solo_agent' },
]

export function fallbackModelsFor(region: TraeRegion): readonly TraeModelInfo[] {
  return region === 'ai' ? FALLBACK_TRAE_MODELS_AI : FALLBACK_TRAE_MODELS
}

const RATE_SEPARATOR = ' · '

/**
 * 格式化模型在 DSH 界面中的展示名称。
 * 对齐 WorkBuddy 格式规范：通过 ` · ` 分割显示模型名、积分倍率与活动标签。
 * 样例：
 *   - Auto · 智能路由
 *   - GLM-5.3 · x0.78
 *   - DeepSeek-V4-Flash 正式版 · x0.16
 *   - Hy3 · x0.00 · 限时免费
 *   - GLM-5.2 · x0.79 · 夜间折扣
 */
export function formatTraeModelDisplayName(
  model: Pick<TraeModelInfo, 'id' | 'name' | 'creditMultiplier' | 'requiresMembership' | 'badges'>,
): string {
  if (model.id.toLowerCase() === 'auto' || model.name.toLowerCase() === 'auto') {
    return 'Auto · 智能路由'
  }

  const parts: string[] = [model.name]

  if (model.creditMultiplier !== undefined) {
    parts.push(`x${model.creditMultiplier.toFixed(2)}`)
  }

  if (model.badges !== undefined && model.badges.length > 0) {
    parts.push(...model.badges)
  } else if (model.creditMultiplier === 0) {
    parts.push('限时免费')
  } else if (model.requiresMembership === true) {
    parts.push('会员计划')
  }

  return parts.join(RATE_SEPARATOR)
}

export function traeInputModalities(model: Pick<TraeModelInfo, 'input'>): TraeInputModality[] {
  return [...(model.input ?? ['text'])]
}

function displayKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * 合并远端模型目录与 wire 运行时映射。
 * 确保包含 Auto 以及所有可调用的模型，不遗漏任何有效模型。
 */
export function mergeTraeModelSources(
  remote: readonly TraeDiscoveredModel[],
  wire: readonly TraeWireModel[],
  region: TraeRegion = 'cn',
): TraeModelInfo[] {
  const wireByName = new Map<string, TraeWireModel>()
  const wireById = new Map<string, TraeWireModel>()
  for (const model of wire) {
    wireByName.set(displayKey(model.name), model)
    wireById.set(displayKey(model.id), model)
  }

  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const result: TraeModelInfo[] = []

  // 1. 首位注入 Auto 模型
  const defaultWire = region === 'ai' ? 'gpt-5.4' : 'glm-5.2'
  const defaultFunction = region === 'ai' ? 'solo_agent' : 'solo_work_lite'
  result.push({
    id: 'auto',
    name: 'Auto',
    contextWindow: 200_000,
    wireConfigName: defaultWire,
    wireFunction: defaultFunction,
  })
  seenIds.add('auto')
  seenNames.add('auto')

  // 2. 遍历远端发现的模型
  for (const model of remote) {
    const idKey = displayKey(model.id)
    const nameKey = displayKey(model.name)
    if (seenIds.has(idKey) || seenNames.has(nameKey)) continue

    const wireModel = wireById.get(idKey) ?? wireByName.get(nameKey)
    const wireConfigName = wireModel !== undefined && wireModel.id !== '' && wireModel.id !== model.id
      ? wireModel.id
      : model.id
    const wireFunction = wireModel?.function ?? (region === 'ai' ? 'solo_agent' : 'solo_work_remote')

    seenIds.add(idKey)
    seenNames.add(nameKey)

    result.push({
      id: model.id,
      name: model.name,
      ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
      ...model.maxContextWindow === undefined ? {} : { maxContextWindow: model.maxContextWindow },
      ...model.creditMultiplier === undefined ? {} : { creditMultiplier: model.creditMultiplier },
      ...model.badges !== undefined && model.badges.length > 0 ? { badges: model.badges } : {},
      input: model.multimodal ? ['text', 'image'] : ['text'],
      ...model.requiresMembership ? { requiresMembership: true } : {},
      reasoningSupported: model.reasoningSupported,
      ...model.reasoning === undefined ? {} : {
        reasoning: model.reasoning,
        reasoningEfforts: Object.fromEntries(
          model.reasoning.supported.map(effort => [
            effort,
            effort === 'low' ? 'light' : effort === 'xhigh' ? 'extra_high' : 'high',
          ]),
        ) as Partial<Record<TraeReasoningEffort, string>>,
      },
      wireConfigName,
      wireFunction,
    })
  }

  return result
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function parseFeatures(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string' || value === '') return undefined
  try { return record(JSON.parse(value) as unknown) } catch { return undefined }
}

const EFFORT_MAP: Readonly<Record<string, TraeReasoningEffort>> = {
  light: 'low',
  high: 'high',
  extra_high: 'xhigh',
}

export function parseTraeRemoteModel(value: unknown): TraeDiscoveredModel | undefined {
  const raw = record(value)
  if (raw === undefined || typeof raw['name'] !== 'string' || raw['name'] === '') return undefined

  const context = record(raw['context_window_tokens'])
  const features = parseFeatures(raw['features'])
  const contextWindowsFeature = record(features?.['context_windows'])
  const contextWindowsData = record(contextWindowsFeature?.['data'])
  const contextWindowSize = record(raw['context_window_size'])

  const dev = finitePositive(context?.['dev'])
    ?? finitePositive(contextWindowsData?.['dev_context'])
    ?? finitePositive(contextWindowSize?.['default'])
    ?? finitePositive(raw['prompt_max_tokens'])

  const maxFromList = Array.isArray(contextWindowsData?.['max_context_list'])
    ? finitePositive(contextWindowsData['max_context_list'][0])
    : undefined
  const maxFromSizeList = Array.isArray(contextWindowSize?.['max'])
    ? finitePositive(contextWindowSize['max'][0])
    : undefined

  const maxVal = finitePositive(context?.['max'])
    ?? finitePositive(contextWindowsData?.['max_context'])
    ?? maxFromList
    ?? finitePositive(contextWindowSize?.['max'])
    ?? maxFromSizeList

  const max = (raw['max_mode'] === true || contextWindowsFeature?.['enable'] === true || maxVal !== undefined)
    && maxVal !== undefined && maxVal > (dev ?? 0)
    ? maxVal
    : undefined

  const activityDiscount = record(features?.['activity_discount'])
  const activityData = record(activityDiscount?.['data'])
  const currentDiscount = record(activityData?.['current'])
  const discountedRate = activityDiscount?.['enable'] === true ? finitePositive(currentDiscount?.['consumption_rate']) : undefined
  const consumption = record(features?.['consumption_rate'])
  const consumptionData = record(consumption?.['data'])
  const standardRate = consumption?.['enable'] === true ? finitePositive(consumptionData?.['rate']) : undefined
  const creditMultiplier = discountedRate ?? standardRate

  const badges: string[] = []
  if (activityDiscount?.['enable'] === true) {
    const actName = typeof currentDiscount?.['activity_name'] === 'string' ? currentDiscount['activity_name'].trim() : ''
    const actType = typeof currentDiscount?.['discount_type'] === 'string' ? currentDiscount['discount_type'].trim() : ''
    if (actName !== '') {
      badges.push(actName)
    } else if (actType === 'limited' || actType === 'time_limit') {
      badges.push('限时优惠')
    } else if (actType === 'night') {
      badges.push('夜间折扣')
    }
  }
  if (creditMultiplier === 0 && !badges.includes('限时免费')) {
    badges.push('限时免费')
  }

  const reasoningFeature = record(features?.['reasoning'])
  const reasoningSupported = reasoningFeature?.['enable'] === true
  const multimodalFeature = record(features?.['multimodal'])
  const multimodal = raw['multimodal'] === true || multimodalFeature?.['enable'] === true
  const access = record(features?.['access'])
  const accessData = record(access?.['data'])
  const identityList = Array.isArray(accessData?.['identity_list']) ? accessData['identity_list'] : undefined
  const requiresMembership = identityList !== undefined && !identityList.includes(0)

  const reasoningConfig = record(raw['reasoning_effort_config'])
  const rawOptions = Array.isArray(reasoningConfig?.['options']) ? reasoningConfig['options'] : []
  const supported = rawOptions.flatMap(option => {
    if (typeof option !== 'string') return []
    const effort = EFFORT_MAP[option]
    return effort === undefined ? [] : [effort]
  })
  const rawDefault = reasoningConfig?.['default_level']
  const mappedDefault = typeof rawDefault === 'string' ? EFFORT_MAP[rawDefault] : undefined
  const defaultEffort = mappedDefault !== undefined && supported.includes(mappedDefault) ? mappedDefault : undefined

  return {
    id: raw['name'],
    name: typeof raw['display_name'] === 'string' && raw['display_name'] !== '' ? raw['display_name'] : raw['name'],
    multimodal,
    ...requiresMembership ? { requiresMembership: true } : {},
    ...dev === undefined ? {} : { contextWindow: dev },
    ...max === undefined ? {} : { maxContextWindow: max },
    ...creditMultiplier === undefined ? {} : { creditMultiplier },
    ...badges.length > 0 ? { badges } : {},
    reasoningSupported,
    ...supported.length === 0 ? {} : { reasoning: { supported, ...defaultEffort === undefined ? {} : { defaultEffort } } },
  }
}

export type CatalogSource = 'live' | 'saved' | 'fallback'

export class TraeCatalog {
  private models: TraeModelInfo[]
  private disabledModels = new Set<string>()
  private source: CatalogSource = 'fallback'
  private fetchedAt: number | undefined = undefined
  private lastError: string | undefined = undefined
  private listeners = new Set<() => void>()

  constructor(readonly region: TraeRegion) {
    this.models = [...fallbackModelsFor(region)]
  }

  setDisabledModels(disabled: readonly string[]): boolean {
    const next = new Set(disabled)
    if (this.disabledModels.size === next.size && [...this.disabledModels].every(id => next.has(id))) {
      return false
    }
    this.disabledModels = next
    this.notify()
    return true
  }

  getDisabledModels(): readonly string[] {
    return Array.from(this.disabledModels)
  }

  current(): readonly TraeModelInfo[] {
    return this.models
  }

  status(): { source: CatalogSource; fetchedAt?: number; error?: string } {
    return {
      source: this.source,
      ...(this.fetchedAt !== undefined ? { fetchedAt: this.fetchedAt } : {}),
      ...(this.lastError !== undefined ? { error: this.lastError } : {}),
    }
  }

  setLive(models: readonly TraeModelInfo[]): void {
    if (models.length === 0) return
    this.models = [...models]
    this.source = 'live'
    this.fetchedAt = Date.now()
    this.lastError = undefined
    this.notify()
  }

  setSaved(models: readonly TraeModelInfo[], fetchedAt?: number): void {
    if (this.source === 'live' || models.length === 0) return
    this.models = [...models]
    this.source = 'saved'
    this.fetchedAt = fetchedAt
    this.notify()
  }

  setFallback(error?: string): void {
    if (this.source === 'live') {
      this.lastError = error
      return
    }
    if (this.source !== 'saved') {
      this.models = [...fallbackModelsFor(this.region)]
      this.source = 'fallback'
    }
    this.lastError = error
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try { listener() } catch {}
    }
  }
}
