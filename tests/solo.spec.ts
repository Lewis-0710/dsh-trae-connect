import { describe, expect, it } from 'vitest'
import { FALLBACK_TRAE_MODELS, FALLBACK_TRAE_MODELS_AI } from '../src/catalog.ts'
import { prepareSoloBody } from '../src/solo.ts'

describe('prepareSoloBody', () => {
  it('应当为国内版 GLM-5.3 正确映射 solo_work_remote 通道', () => {
    const input = JSON.stringify({
      model: 'glm-5.3',
      messages: [{ role: 'user', content: 'hello' }],
    })
    const body = prepareSoloBody(input, {
      region: 'cn',
      catalogModels: FALLBACK_TRAE_MODELS,
    })
    const parsed = JSON.parse(body) as { model: string; function: string }
    expect(parsed.model).toBe('glm-5.3')
    expect(parsed.function).toBe('solo_work_remote')
  })

  it('应当为国内版 Auto 智能路由映射到 glm-5.2', () => {
    const input = JSON.stringify({
      model: 'auto',
      messages: [{ role: 'user', content: 'hello' }],
    })
    const body = prepareSoloBody(input, {
      region: 'cn',
      catalogModels: FALLBACK_TRAE_MODELS,
    })
    const parsed = JSON.parse(body) as { model: string }
    expect(parsed.model).toBe('glm-5.2')
  })

  it('应当为国际版 Auto 智能路由映射到 gpt-5.4', () => {
    const input = JSON.stringify({
      model: 'auto',
      messages: [{ role: 'user', content: 'hello' }],
    })
    const body = prepareSoloBody(input, {
      region: 'ai',
      catalogModels: FALLBACK_TRAE_MODELS_AI,
    })
    const parsed = JSON.parse(body) as { model: string; function: string }
    expect(parsed.model).toBe('gpt-5.4')
    expect(parsed.function).toBe('solo_agent')
  })
})

import { formatTraeErrorMessage } from '../src/solo-bridge.ts'

describe('formatTraeErrorMessage', () => {
  it('应当把 4120 错误转化为中文友好提示（需要 Pro 订阅）', () => {
    const msg = formatTraeErrorMessage(4120, '')
    expect(msg).toContain('4120')
    expect(msg).toContain('Trae Pro')
  })

  it('应当把 4008 错误转化为额度已耗尽提示', () => {
    const msg = formatTraeErrorMessage(4008, '')
    expect(msg).toContain('额度已耗尽')
  })
})
