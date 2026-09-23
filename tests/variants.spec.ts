import { describe, expect, it } from 'vitest'
import { AI_VARIANT, CN_VARIANT, TRAE_VARIANTS, variantFor, variantForRegion } from '../src/variants.ts'

describe('Trae Variants', () => {
  it('defines both CN and AI variants', () => {
    expect(TRAE_VARIANTS).toHaveLength(2)
    expect(CN_VARIANT.id).toBe('trae')
    expect(CN_VARIANT.region).toBe('cn')
    expect(AI_VARIANT.id).toBe('trae-global')
    expect(AI_VARIANT.region).toBe('ai')
  })

  it('resolves variant by id and region', () => {
    expect(variantFor('trae')).toBe(CN_VARIANT)
    expect(variantFor('trae-global')).toBe(AI_VARIANT)
    expect(variantForRegion('cn')).toBe(CN_VARIANT)
    expect(variantForRegion('ai')).toBe(AI_VARIANT)
  })

  it('defines distinct files and routes for each variant', () => {
    expect(CN_VARIANT.ownFilename).not.toBe(AI_VARIANT.ownFilename)
    expect(CN_VARIANT.statusPath).not.toBe(AI_VARIANT.statusPath)
    expect(CN_VARIANT.loginPath).not.toBe(AI_VARIANT.loginPath)
    expect(CN_VARIANT.probePath).not.toBe(AI_VARIANT.probePath)
  })
})
