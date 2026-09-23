import { describe, expect, it } from 'vitest'
import { TraeCredentialStore } from '../src/auth.ts'
import { TraeLoginClient } from '../src/login.ts'
import { CN_VARIANT, AI_VARIANT } from '../src/variants.ts'

describe('TraeLoginClient (OAuth PKCE)', () => {
  it('begin generates correct auth url and loopback server for CN variant', async () => {
    let savedCred: unknown
    const mockStore = {
      write: async (c: unknown) => { savedCred = c },
      status: async () => ({ status: 'unconfigured' as const }),
      remove: async () => {},
    } as unknown as TraeCredentialStore

    const client = new TraeLoginClient(CN_VARIANT, mockStore)
    const attempt = await client.begin()

    expect(attempt.state).toBeDefined()
    expect(attempt.authUrl).toContain('https://www.trae.cn/authorization?')
    expect(attempt.authUrl).toContain('client_id=en1oxy7wnw8j9n')
    expect(attempt.authUrl).toContain('code_challenge_method=S256')
    expect(attempt.authUrl).toContain('code_challenge=')
    expect(attempt.authUrl).toContain('auth_callback_url=http%3A%2F%2F127.0.0.1%3A')

    // Initial poll should be pending
    const poll1 = await client.poll(attempt.state)
    expect(poll1.status).toBe('pending')

    // Clean up
    const attemptInternal = (client as unknown as { attempts: Map<string, { cleanup: () => void }> }).attempts.get(attempt.state)
    attemptInternal?.cleanup()
  })

  it('begin generates correct auth url for AI variant', async () => {
    const mockStore = {
      write: async () => {},
      status: async () => ({ status: 'unconfigured' as const }),
      remove: async () => {},
    } as unknown as TraeCredentialStore

    const client = new TraeLoginClient(AI_VARIANT, mockStore)
    const attempt = await client.begin()

    expect(attempt.authUrl).toContain('https://www.trae.ai/authorization?')
    expect(attempt.authUrl).toContain('client_id=en1oxy7wnw8j9n')

    const attemptInternal = (client as unknown as { attempts: Map<string, { cleanup: () => void }> }).attempts.get(attempt.state)
    attemptInternal?.cleanup()
  })

  it('handles loopback callback and exchanges token', async () => {
    let savedCred: Record<string, unknown> | undefined
    const mockStore = {
      write: async (c: unknown) => { savedCred = c as Record<string, unknown> },
      status: async () => ({ status: 'unconfigured' as const }),
      remove: async () => {},
    } as unknown as TraeCredentialStore

    let exchangeBody: Record<string, unknown> | undefined
    const mockFetch = (async (url: string, init?: RequestInit) => {
      if (url.includes('ExchangeToken')) {
        exchangeBody = JSON.parse(init?.body as string) as Record<string, unknown>
        return new Response(JSON.stringify({
          Result: {
            Token: 'test-access-token-jwt',
            RefreshToken: 'test-refresh-token',
            TokenExpireAt: Date.now() + 86400000,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('Not found', { status: 404 })
    }) as typeof fetch

    const client = new TraeLoginClient(CN_VARIANT, mockStore, mockFetch)
    const attempt = await client.begin()

    // Parse loopback callback port from authUrl
    const urlObj = new URL(attempt.authUrl)
    const callbackUrl = urlObj.searchParams.get('auth_callback_url')!
    expect(callbackUrl).toBeDefined()

    // Simulate browser redirect to loopback callback server
    const callbackRes = await fetch(`${callbackUrl}?AuthCode=code_12345&userInfo=${encodeURIComponent(JSON.stringify({
      UserID: 'user_999',
      ScreenName: 'TraeTester',
    }))}`)

    expect(callbackRes.status).toBe(200)
    const html = await callbackRes.text()
    expect(html).toContain('授权登录成功')

    // Wait a brief tick for async token exchange
    await new Promise(r => setTimeout(r, 50))

    expect(exchangeBody).toBeDefined()
    expect(exchangeBody?.['ClientID']).toBe('en1oxy7wnw8j9n')
    expect(exchangeBody?.['AuthCode']).toBe('code_12345')

    const deviceInfo = exchangeBody?.['DeviceInfo'] as Record<string, unknown>
    expect(deviceInfo).toBeDefined()
    expect(typeof deviceInfo['DevicePublicKey']).toBe('string')
    expect(deviceInfo['DevicePublicKey']).toContain('BEGIN PUBLIC KEY')
    expect(deviceInfo['PlatformCode']).toBe('SOLO_PC')
    expect(deviceInfo['DeviceType']).toBe('PC')
    expect(typeof deviceInfo['DeviceID']).toBe('string')
    expect(typeof deviceInfo['MachineID']).toBe('string')

    // Check credential saved
    expect(savedCred).toBeDefined()
    expect(savedCred?.['accessToken']).toBe('test-access-token-jwt')
    expect(savedCred?.['userId']).toBe('user_999')
    expect(savedCred?.['accountName']).toBe('TraeTester')

    // Poll should now be complete
    const pollResult = await client.poll(attempt.state)
    expect(pollResult.status).toBe('complete')
    expect(pollResult.accountName).toBe('TraeTester')
    expect(pollResult.userId).toBe('user_999')
  })
})
