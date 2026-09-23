import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { createLoginKey, traeLoginHandler, type TraeLoginRouteOptions } from '../src/login-route.ts'
import { CN_VARIANT } from '../src/variants.ts'
import type { TraeLoginClient } from '../src/login.ts'

let server: Server | undefined

afterEach(async () => {
  if (server !== undefined) {
    await new Promise<void>(resolve => server?.close(() => resolve()))
    server = undefined
  }
})

async function mount(opts?: Partial<TraeLoginRouteOptions>): Promise<{ origin: string; key: string; calls: string[] }> {
  const key = createLoginKey()
  const calls: string[] = []

  const mockLoginClient = {
    begin: async () => {
      calls.push('begin')
      return { state: 'state-123', authUrl: 'https://www.trae.cn/authorization?state=state-123' }
    },
    poll: async (state: string) => {
      calls.push(`poll:${state}`)
      if (state === 'state-done') {
        return { status: 'complete', accountName: 'Lewis', userId: 'user-001' }
      }
      return { status: 'pending' }
    },
    logout: async () => {
      calls.push('logout')
    },
    importDocument: async (text: string) => {
      calls.push(`import:${text.length}`)
      return {
        accessToken: 'imported-tok',
        userId: 'imp-user',
        accountName: 'ImportedUser',
        host: 'https://api.trae.cn',
        expiresAtMs: 0,
        edition: 'cn',
        source: 'dsh',
      }
    },
    detectLocal: async () => {
      calls.push('detect')
      return undefined
    },
  } as unknown as TraeLoginClient

  const options: TraeLoginRouteOptions = {
    variant: CN_VARIANT,
    loginClient: mockLoginClient,
    loginKey: () => key,
    ...opts,
  }

  server = createServer((req, res) => {
    void traeLoginHandler(req, res, options)
  })

  await new Promise<void>(resolve => server?.listen(0, '127.0.0.1', () => resolve()))
  const addr = server.address()
  if (addr === null || typeof addr === 'string') throw new Error('no port')

  return { origin: `http://127.0.0.1:${addr.port}`, key, calls }
}

async function post(origin: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const resp = await fetch(origin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return { status: resp.status, body: await resp.json() as Record<string, unknown> }
}

describe('traeLoginHandler', () => {
  it('rejects missing or wrong login key when key configured', async () => {
    const { origin } = await mount()
    const res = await post(origin, { action: 'begin' })
    expect(res.status).toBe(403)
    expect(res.body['message']).toContain('安全密钥不匹配')
  })

  it('handles begin action and returns state and url', async () => {
    const { origin, key, calls } = await mount()
    const res = await post(origin, { action: 'begin' }, { 'x-dsh-login-key': key })
    expect(res.status).toBe(200)
    expect(res.body['status']).toBe('pending')
    expect(res.body['state']).toBe('state-123')
    expect(res.body['url']).toContain('https://www.trae.cn/authorization')
    expect(calls).toEqual(['begin'])
  })

  it('handles poll action with pending and complete states', async () => {
    const { origin, key, calls } = await mount()
    const resPending = await post(origin, { action: 'poll', state: 'state-pending' }, { 'x-dsh-login-key': key })
    expect(resPending.status).toBe(200)
    expect(resPending.body['status']).toBe('pending')

    const resComplete = await post(origin, { action: 'poll', state: 'state-done' }, { 'x-dsh-login-key': key })
    expect(resComplete.status).toBe(200)
    expect(resComplete.body['status']).toBe('complete')
    expect(resComplete.body['accountName']).toBe('Lewis')
    expect(resComplete.body['userId']).toBe('user-001')

    expect(calls).toEqual(['poll:state-pending', 'poll:state-done'])
  })

  it('handles logout action', async () => {
    const { origin, key, calls } = await mount()
    const res = await post(origin, { action: 'logout' }, { 'x-dsh-login-key': key })
    expect(res.status).toBe(200)
    expect(res.body['status']).toBe('signed-out')
    expect(calls).toEqual(['logout'])
  })

  it('handles import action', async () => {
    const { origin, key, calls } = await mount()
    const res = await post(origin, { action: 'import', document: '{"token":"xyz"}' }, { 'x-dsh-login-key': key })
    expect(res.status).toBe(200)
    expect(res.body['status']).toBe('imported')
    expect(res.body['accountName']).toBe('ImportedUser')
    expect(res.body['userId']).toBe('imp-user')
    expect(calls).toEqual(['import:15'])
  })
})
