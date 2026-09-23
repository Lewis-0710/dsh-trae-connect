/**
 * Trae 网页登录与授权路由处理器。
 *
 * @module dsh-trae-connect/login-route
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TraeLoginClient } from './login.ts'
import { hostIsLoopback, originIsLoopback } from './loopback.ts'
import type { TraeWebLoginRequest, TraeWebLoginResult } from './status-paths.ts'
import type { TraeVariant } from './variants.ts'

export interface TraeLoginRouteOptions {
  variant: TraeVariant
  loginClient: TraeLoginClient
  loginKey?: () => string
  onLoggedIn?: () => void
}

export function createLoginKey(): string {
  return randomBytes(24).toString('hex')
}

function keyMatches(expected: string, presented: string | undefined): boolean {
  if (presented === undefined || presented.length !== expected.length) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(presented)
  return a.length === b.length && timingSafeEqual(a, b)
}

const MAX_BODY_BYTES = 65536

async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buffer.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'))
        return
      }
      chunks.push(buffer)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text.trim() === '' ? {} : JSON.parse(text))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export async function traeLoginHandler(
  req: IncomingMessage,
  res: ServerResponse,
  options: TraeLoginRouteOptions,
): Promise<void> {
  const send = (status: number, body: TraeWebLoginResult | { error: string }): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  if (req.method !== 'POST') {
    send(405, { error: 'Method not allowed' })
    return
  }

  if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers.origin)) {
    send(403, { status: 'failed', message: '请求未受信：仅支持本地环回访问' })
    return
  }

  // 验证安全密钥
  if (options.loginKey !== undefined) {
    const headerKey = (req.headers['x-trae-login-key'] ?? req.headers['x-dsh-login-key']) as string | undefined
    if (!keyMatches(options.loginKey(), headerKey)) {
      send(403, { status: 'failed', message: '未经授权的操作：安全密钥不匹配' })
      return
    }
  }

  let body: TraeWebLoginRequest
  try {
    body = (await parseJsonBody(req)) as TraeWebLoginRequest
  } catch {
    send(400, { status: 'failed', message: '无效的 JSON 请求体' })
    return
  }

  try {
    if (body.action === 'begin') {
      const attempt = await options.loginClient.begin()
      send(200, {
        status: 'pending',
        state: attempt.state,
        url: attempt.authUrl,
      })
    } else if (body.action === 'poll') {
      if (typeof body.state !== 'string' || body.state.trim() === '') {
        send(400, { status: 'failed', message: '缺少轮询 state 标识' })
        return
      }
      const pollRes = await options.loginClient.poll(body.state)
      if (pollRes.status === 'complete') {
        options.onLoggedIn?.()
        send(200, {
          status: 'complete',
          ...pollRes.accountName !== undefined ? { accountName: pollRes.accountName } : {},
          ...pollRes.userId !== undefined ? { userId: pollRes.userId } : {},
        })
      } else if (pollRes.status === 'failed') {
        send(200, {
          status: 'failed',
          message: pollRes.message ?? '登录授权失败',
        })
      } else {
        send(200, { status: 'pending' })
      }
    } else if (body.action === 'detect') {
      const cred = await options.loginClient.detectLocal()
      if (cred !== undefined) {
        options.onLoggedIn?.()
        send(200, {
          status: 'complete',
          ...cred.accountName !== undefined ? { accountName: cred.accountName } : {},
          userId: cred.userId,
        })
      } else {
        send(200, { status: 'failed', message: '未在本地检测到已登录的 Trae 账号或 CLI Token' })
      }
    } else if (body.action === 'import') {
      if (typeof body.document !== 'string' || body.document.trim() === '') {
        send(400, { status: 'failed', message: '缺少导入内容' })
        return
      }
      const cred = await options.loginClient.importDocument(body.document)
      options.onLoggedIn?.()
      send(200, {
        status: 'imported',
        ...cred.accountName !== undefined ? { accountName: cred.accountName } : {},
        userId: cred.userId,
      })
    } else if (body.action === 'logout') {
      await options.loginClient.logout()
      send(200, { status: 'signed-out' })
    } else {
      send(400, { status: 'failed', message: '未知操作' })
    }
  } catch (err) {
    send(200, { status: 'failed', message: err instanceof Error ? err.message : String(err) })
  }
}
