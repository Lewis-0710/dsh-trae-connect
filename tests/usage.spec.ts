import { describe, expect, it } from 'vitest'
import type { TraeCredential } from '../src/auth.ts'
import { TraeUsageClient } from '../src/usage.ts'

describe('Trae Usage Client', () => {
  it('parses CN entitlements and usage summary', async () => {
    const mockCred: TraeCredential = {
      accessToken: 'token-123',
      userId: 'u1',
      edition: 'cn',
      source: 'desktop',
      expiresAtMs: 0,
      host: 'https://api.trae.cn',
    }

    const mockFetch = async (url: string | URL | Request): Promise<Response> => {
      const urlStr = String(url)
      if (urlStr.includes('/web_user_ent_usage')) {
        return new Response(JSON.stringify({
          usage_summary: {
            total_amount: 5000,
            consumed_amount: 2000,
            consumption_ratio: 0.4,
          },
          user_entitlement_pack_list: [
            {
              display_desc: '老用户福利',
              entitlement_base_info: {
                entitlement_id: 'ent_1',
                end_time: 1794051445000,
                quota: { credits_limit: 2000 },
              },
              usage: { credits_amount: 1500 },
            },
          ],
        }))
      }
      if (urlStr.includes('/checkin_credits/status')) {
        return new Response(JSON.stringify({
          checked_in: true,
          credits: 200,
          enable: true,
        }))
      }
      return new Response(JSON.stringify({}), { status: 404 })
    }

    const client = new TraeUsageClient({
      credential: async () => mockCred,
      fetchImpl: mockFetch as typeof fetch,
    })

    const view = await client.view()
    expect(view.snapshot).toBeDefined()
    expect(view.snapshot?.summary.totalAmount).toBe(5000)
    expect(view.snapshot?.summary.consumedAmount).toBe(2000)
    expect(view.snapshot?.packs).toHaveLength(1)
    expect(view.snapshot?.packs[0]?.displayDesc).toBe('老用户福利')
    expect(view.checkin?.checkedIn).toBe(true)
  })

  it('parses AI subscription status', async () => {
    const mockCred: TraeCredential = {
      accessToken: 'token-ai',
      userId: 'u2',
      edition: 'sg',
      source: 'desktop',
      expiresAtMs: 0,
      host: 'https://coresg-normal.trae.ai',
    }

    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({
        has_package: true,
        trial_status: { is_in_trial: true, trial_end_time: 1794051445000 },
        is_pay_freshman: false,
      }))
    }

    const client = new TraeUsageClient({
      credential: async () => mockCred,
      fetchImpl: mockFetch as typeof fetch,
    })

    const view = await client.view()
    expect(view.payStatus).toBeDefined()
    expect(view.payStatus?.hasPackage).toBe(true)
    expect(view.payStatus?.inTrial).toBe(true)
  })

  it('claims checkin credits successfully with self-healing and code 0', async () => {
    const mockCred: TraeCredential = {
      accessToken: 'token-claim-1',
      userId: 'u3',
      edition: 'cn',
      source: 'desktop',
      expiresAtMs: 0,
      host: 'https://api.trae.cn',
    }

    let claimReqBody: unknown
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlStr = String(url)
      if (urlStr.includes('/checkin_credits/status')) {
        return new Response(JSON.stringify({
          checked_in: false,
          credits: 150,
          enable: true,
        }))
      }
      if (urlStr.includes('/checkin_credits/claim')) {
        claimReqBody = init?.body ? JSON.parse(String(init.body)) : undefined
        return new Response(JSON.stringify({
          code: 0,
          message: 'success',
          credits: 150,
        }))
      }
      return new Response(JSON.stringify({}), { status: 404 })
    }

    const client = new TraeUsageClient({
      credential: async () => mockCred,
      fetchImpl: mockFetch as typeof fetch,
    })

    const res = await client.claimCheckin()
    expect(res.ok).toBe(true)
    expect(res.credits).toBe(150)
    expect(claimReqBody).toEqual({ req_source: 2 })
  })

  it('treats error 9095 (already checked in on this device) as successful claim', async () => {
    const mockCred: TraeCredential = {
      accessToken: 'token-claim-2',
      userId: 'u4',
      edition: 'cn',
      source: 'desktop',
      expiresAtMs: 0,
      host: 'https://api.trae.cn',
    }

    const mockFetch = async (url: string | URL | Request): Promise<Response> => {
      const urlStr = String(url)
      if (urlStr.includes('/checkin_credits/status')) {
        return new Response(JSON.stringify({
          checked_in: false,
          credits: 150,
          enable: true,
        }))
      }
      if (urlStr.includes('/checkin_credits/claim')) {
        return new Response(JSON.stringify({
          code: 9095,
          message: 'This device has already checked in today.',
        }))
      }
      return new Response(JSON.stringify({}), { status: 404 })
    }

    const client = new TraeUsageClient({
      credential: async () => mockCred,
      fetchImpl: mockFetch as typeof fetch,
    })

    const res = await client.claimCheckin()
    expect(res.ok).toBe(true)
    expect(res.alreadyClaimed).toBe(true)
  })
})
