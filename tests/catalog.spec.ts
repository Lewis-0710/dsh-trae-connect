import { describe, expect, it } from 'vitest'
import {
  FALLBACK_TRAE_MODELS,
  FALLBACK_TRAE_MODELS_AI,
  fallbackModelsFor,
  formatTraeModelDisplayName,
  mergeTraeModelSources,
  type TraeDiscoveredModel,
  type TraeWireModel,
} from '../src/catalog.ts'

describe('Trae Catalog', () => {
  it('provides fallback models for both regions', () => {
    expect(fallbackModelsFor('cn')).toEqual(FALLBACK_TRAE_MODELS)
    expect(fallbackModelsFor('ai')).toEqual(FALLBACK_TRAE_MODELS_AI)
    expect(FALLBACK_TRAE_MODELS).toHaveLength(16)
    expect(FALLBACK_TRAE_MODELS_AI).toHaveLength(17)
    expect(FALLBACK_TRAE_MODELS[0]?.id).toBe('auto')
    expect(FALLBACK_TRAE_MODELS_AI[0]?.id).toBe('auto')
  })

  it('formats display name with membership and credit multiplier', () => {
    const name = formatTraeModelDisplayName({
      id: 'm1',
      name: 'Test Model',
      requiresMembership: true,
      creditMultiplier: 0.8,
    })
    expect(name).toBe('Test Model · x0.80 · 会员计划')

    const autoName = formatTraeModelDisplayName({
      id: 'auto',
      name: 'Auto',
    })
    expect(autoName).toBe('Auto · 智能路由')

    const freeName = formatTraeModelDisplayName({
      id: 'm2',
      name: 'Hy3',
      creditMultiplier: 0,
    })
    expect(freeName).toBe('Hy3 · x0.00 · 限时免费')

    const badgeName = formatTraeModelDisplayName({
      id: 'm3',
      name: 'GLM-5.2',
      creditMultiplier: 0.79,
      badges: ['夜间折扣'],
    })
    expect(badgeName).toBe('GLM-5.2 · x0.79 · 夜间折扣')
  })

  it('merges remote catalog with wire models and auto model', () => {
    const remote: TraeDiscoveredModel[] = [
      {
        id: 'DeepSeek-V4-Flash-Official',
        name: 'DeepSeek-V4-Flash',
        multimodal: true,
        reasoningSupported: true,
        contextWindow: 200_000,
        creditMultiplier: 0.2,
      },
      {
        id: 'unmatched-model',
        name: 'Unmatched',
        multimodal: false,
        reasoningSupported: false,
      },
    ]

    const wire: TraeWireModel[] = [
      {
        id: 'DeepSeek-V4-Flash-Official',
        name: 'DeepSeek-V4-Flash',
        function: 'solo_work_remote',
      },
    ]

    const merged = mergeTraeModelSources(remote, wire, 'cn')
    // 包含 Auto + 2 个 remote 模型 = 3 个
    expect(merged).toHaveLength(3)
    expect(merged[0]?.id).toBe('auto')
    expect(merged[0]?.name).toBe('Auto')

    expect(merged[1]?.id).toBe('DeepSeek-V4-Flash-Official')
    expect(merged[1]?.name).toBe('DeepSeek-V4-Flash')
    expect(merged[1]?.input).toEqual(['text', 'image'])
    expect(merged[1]?.wireFunction).toBe('solo_work_remote')

    expect(merged[2]?.id).toBe('unmatched-model')
  })
})
