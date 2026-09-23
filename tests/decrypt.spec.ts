import { describe, expect, it } from 'vitest'
import { parseTraeCliToken } from '../src/decrypt.ts'

describe('Trae Decrypt & CLI Token parsing', () => {
  it('parses valid CLI JWT token', () => {
    // Header: {"alg":"none"} => eyJhbGciOiJub25lIn0
    // Payload: {"data":{"user_id":"u_12345"},"exp":1794051445} => eyJkYXRhIjp7InVzZXJfaWQiOiJ1XzEyMzQ1In0sImV4cCI6MTc5NDA1MTQ0NX0
    const token = 'eyJhbGciOiJub25lIn0.eyJkYXRhIjp7InVzZXJfaWQiOiJ1XzEyMzQ1In0sImV4cCI6MTc5NDA1MTQ0NX0.signature'
    const claims = parseTraeCliToken(token)
    expect(claims.userId).toBe('u_12345')
    expect(claims.accessToken).toBe(token)
    expect(claims.expiresAtMs).toBe(1794051445 * 1000)
  })

  it('parses token wrapped in JSON envelope', () => {
    const token = 'eyJhbGciOiJub25lIn0.eyJkYXRhIjp7InVzZXJfaWQiOiJ1Xzk5OSJ9fQ.sig'
    const json = JSON.stringify({ token })
    const claims = parseTraeCliToken(json)
    expect(claims.userId).toBe('u_999')
    expect(claims.accessToken).toBe(token)
  })

  it('rejects malformed token', () => {
    expect(() => parseTraeCliToken('')).toThrow('empty')
    expect(() => parseTraeCliToken('invalid-token')).toThrow('three-part')
  })
})
