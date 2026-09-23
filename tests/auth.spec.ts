import { describe, expect, it } from 'vitest'
import { parseTraeAuth, parseTraeDocument } from '../src/auth.ts'

describe('Trae Auth parsing', () => {
  it('parses standard auth shape', () => {
    const raw = {
      accessToken: 'test-token',
      userId: 'user_100',
      account: { username: 'test-user' },
      expiresAt: 1794051445,
    }
    const cred = parseTraeAuth(raw, 'cn', 'dsh')
    expect(cred).toBeDefined()
    expect(cred?.accessToken).toBe('test-token')
    expect(cred?.userId).toBe('user_100')
    expect(cred?.accountName).toBe('test-user')
    expect(cred?.expiresAtMs).toBe(1794051445 * 1000)
    expect(cred?.edition).toBe('cn')
  })

  it('parses JSON document format', () => {
    const doc = {
      version: 1,
      credential: {
        accessToken: 'tok_abc',
        userId: 'u_1',
        edition: 'sg',
      },
    }
    const cred = parseTraeDocument(JSON.stringify(doc))
    expect(cred).toBeDefined()
    expect(cred?.accessToken).toBe('tok_abc')
    expect(cred?.edition).toBe('sg')
  })

  it('rejects empty input', () => {
    expect(parseTraeDocument('')).toBeUndefined()
    expect(parseTraeAuth(null)).toBeUndefined()
  })
})
