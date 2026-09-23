/**
 * Sign-in client for Trae: OAuth PKCE browser authorization & credential import.
 *
 * Implements the official Trae OAuth 2.0 PKCE flow with a loopback callback server.
 * This completely decouples the plugin from any local Trae desktop app or CLI installation.
 *
 * @module dsh-trae-connect/login
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFile } from 'node:fs/promises'
import {
  parseTraeAuth,
  parseTraeDocument,
  type TraeCredential,
  type TraeCredentialStore,
} from './auth.ts'
import { parseTraeCliToken, parseTraeStorageDocument } from './decrypt.ts'
import { buildTraeDeviceInfo, type TraeDeviceInfo, type TraeDeviceProfile } from './device.ts'
import { traeStorageCandidates } from './paths.ts'
import type { TraeVariant } from './variants.ts'

const CLIENT_ID = 'en1oxy7wnw8j9n'
const ATTEMPT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export interface TraeLoginAttempt {
  state: string
  authUrl: string
  status: 'pending' | 'complete' | 'failed'
  accountName?: string | undefined
  userId?: string | undefined
  error?: string | undefined
  cleanup: () => void
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Trae 授权成功</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0f141c;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px 40px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      max-width: 440px;
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      margin-bottom: 16px;
    }
    h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 600; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
    button {
      background: #3b82f6;
      color: #fff;
      border: none;
      padding: 8px 22px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 500;
    }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h2>授权登录成功</h2>
    <p>您已成功授权 Trae 账号！凭据已自动同步，您可以关闭此浏览器标签页并返回 DSH Desktop 继续使用。</p>
    <button onclick="window.close()">关闭此标签页</button>
  </div>
</body>
</html>`

export class TraeLoginClient {
  private readonly attempts = new Map<string, TraeLoginAttempt>()

  constructor(
    readonly variant: TraeVariant,
    private readonly store: TraeCredentialStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /**
   * Start an OAuth PKCE sign-in attempt.
   * Spawns a temporary loopback HTTP server to catch browser authorization callback.
   */
  async begin(): Promise<{ state: string; authUrl: string }> {
    const traceId = randomUUID()
    const codeVerifier = randomBytes(48).toString('base64url')
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    const { profile, deviceInfo } = await buildTraeDeviceInfo()

    let serverInstance: Server | undefined
    let timer: NodeJS.Timeout | undefined

    const cleanup = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      if (serverInstance !== undefined) {
        try {
          serverInstance.close()
        } catch {}
        serverInstance = undefined
      }
    }

    const attempt: TraeLoginAttempt = {
      state: traceId,
      authUrl: '',
      status: 'pending',
      cleanup,
    }

    // Set 5-minute timeout
    timer = setTimeout(() => {
      if (attempt.status === 'pending') {
        attempt.status = 'failed'
        attempt.error = '登录授权超时（5分钟未完成）'
        attempt.cleanup()
      }
    }, ATTEMPT_TIMEOUT_MS)

    const port = await new Promise<number>((resolve, reject) => {
      const s = createServer((req: IncomingMessage, res: ServerResponse) => {
        // Handle CORS preflight
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', '*')

        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        const parsedUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
        if (parsedUrl.pathname === '/authorize') {
          void this.handleAuthorizeCallback(req, parsedUrl, codeVerifier, deviceInfo, attempt, res)
          return
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      })

      s.on('error', reject)
      s.listen(0, '127.0.0.1', () => {
        const addr = s.address() as AddressInfo
        serverInstance = s
        resolve(addr.port)
      })
    })

    const isGlobal = this.variant.region === 'ai'
    const authHost = isGlobal ? 'https://www.trae.ai' : 'https://www.trae.cn'
    const callbackUrl = `http://127.0.0.1:${port}/authorize`

    const params = new URLSearchParams({
      login_version: '1',
      auth_from: 'solo',
      login_channel: 'native_ide',
      plugin_version: 'local',
      auth_type: 'local',
      client_id: CLIENT_ID,
      redirect: '0',
      login_trace_id: traceId,
      auth_callback_url: callbackUrl,
      machine_id: profile.machineId,
      device_id: profile.deviceId,
      x_device_id: profile.deviceId,
      x_machine_id: profile.machineId,
      x_device_brand: deviceInfo.DeviceModel,
      x_device_type: deviceInfo.OSInfo,
      x_os_version: deviceInfo.OSVersion,
      x_app_version: '0.1.66',
      x_app_type: 'stable',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      hide_saas_login: 'true',
      channel_name: 'common',
    })

    const authUrl = `${authHost}/authorization?${params.toString()}`
    attempt.authUrl = authUrl
    this.attempts.set(traceId, attempt)

    return { state: traceId, authUrl }
  }

  /**
   * Handle the loopback callback from browser after user authorization.
   */
  private async handleAuthorizeCallback(
    req: IncomingMessage,
    url: URL,
    codeVerifier: string,
    deviceInfo: TraeDeviceInfo,
    attempt: TraeLoginAttempt,
    res: ServerResponse,
  ): Promise<void> {
    try {
      // Respond to browser immediately with success page
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(SUCCESS_HTML)

      // Collect data from URL search params or POST body
      let authCode: string | undefined
      let userInfoObj: Record<string, unknown> | undefined

      const authCodeInfoParam = url.searchParams.get('authCodeInfo')
      const userInfoParam = url.searchParams.get('userInfo')

      if (authCodeInfoParam !== null) {
        try {
          const parsed = JSON.parse(authCodeInfoParam) as Record<string, unknown>
          if (typeof parsed['AuthCode'] === 'string') authCode = parsed['AuthCode']
        } catch {}
      }
      if (authCode === undefined) {
        authCode = url.searchParams.get('AuthCode') ?? url.searchParams.get('auth_code') ?? url.searchParams.get('code') ?? undefined
      }

      if (userInfoParam !== null) {
        try {
          userInfoObj = JSON.parse(userInfoParam) as Record<string, unknown>
        } catch {}
      }

      // If POST, also inspect request body
      if (req.method === 'POST') {
        const bodyChunks: Buffer[] = []
        for await (const chunk of req) bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        const bodyText = Buffer.concat(bodyChunks).toString('utf8').trim()
        if (bodyText !== '') {
          try {
            const bodyObj = JSON.parse(bodyText) as Record<string, unknown>
            if (authCode === undefined) {
              if (typeof bodyObj['authCodeInfo'] === 'string') {
                const p = JSON.parse(bodyObj['authCodeInfo']) as Record<string, unknown>
                if (typeof p['AuthCode'] === 'string') authCode = p['AuthCode']
              } else if (typeof bodyObj['AuthCode'] === 'string') {
                authCode = bodyObj['AuthCode']
              }
            }
            if (userInfoObj === undefined && typeof bodyObj['userInfo'] === 'string') {
              userInfoObj = JSON.parse(bodyObj['userInfo']) as Record<string, unknown>
            }
          } catch {}
        }
      }

      if (authCode === undefined || authCode === '') {
        attempt.status = 'failed'
        attempt.error = '回调未携带有效的授权码 (AuthCode)'
        attempt.cleanup()
        return
      }

      // Exchange token with upstream Trae OAuth service
      await this.exchangeToken(authCode, codeVerifier, deviceInfo, userInfoObj, attempt)
    } catch (err) {
      attempt.status = 'failed'
      attempt.error = err instanceof Error ? err.message : String(err)
      attempt.cleanup()
    }
  }

  /**
   * Request /ExchangeToken to obtain access and refresh tokens.
   */
  private async exchangeToken(
    authCode: string,
    codeVerifier: string,
    deviceInfo: TraeDeviceInfo,
    userInfoObj: Record<string, unknown> | undefined,
    attempt: TraeLoginAttempt,
  ): Promise<void> {
    const isGlobal = this.variant.region === 'ai'
    const endpoint = isGlobal
      ? 'https://growsg-normal.trae.ai/trae/api/v3/oauth/ExchangeToken'
      : 'https://api.trae.cn/trae/api/v3/oauth/ExchangeToken'

    const payload = {
      ClientID: CLIENT_ID,
      AuthCode: authCode,
      CodeVerifier: codeVerifier,
      DeviceInfo: deviceInfo,
      IDEVersion: '0.1.66',
    }

    const resp = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cloudide-token': '',
        'User-Agent': 'Trae/0.1.66',
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      let errorDetail = ''
      try {
        const errorText = await resp.text()
        try {
          const parsed = JSON.parse(errorText) as {
            ResponseMetadata?: { Error?: { Code?: string; Message?: string } }
            message?: string
          }
          const code = parsed.ResponseMetadata?.Error?.Code ?? ''
          const msg = parsed.ResponseMetadata?.Error?.Message ?? parsed.message ?? ''
          errorDetail = code !== '' || msg !== '' ? ` [${code}] ${msg}` : ` ${errorText}`
        } catch {
          errorDetail = errorText !== '' ? ` ${errorText}` : ''
        }
      } catch {}
      throw new Error(`Trae OAuth 换取令牌失败 (HTTP ${resp.status})${errorDetail}`)
    }

    const data = await resp.json() as {
      Result?: {
        Token?: string
        RefreshToken?: string
        TokenExpireAt?: number
        RefreshExpireAt?: number
      }
    }

    const result = data.Result
    if (result?.Token === undefined || result.Token === '') {
      throw new Error('Trae OAuth 未返回有效的 Token')
    }

    const screenName = typeof userInfoObj?.['ScreenName'] === 'string' ? userInfoObj['ScreenName'] : undefined
    const userId = typeof userInfoObj?.['UserID'] === 'string' ? userInfoObj['UserID'] : ''
    const avatarUrl = typeof userInfoObj?.['AvatarUrl'] === 'string' ? userInfoObj['AvatarUrl'] : undefined

    const credential: TraeCredential = {
      accessToken: result.Token,
      ...result.RefreshToken !== undefined && result.RefreshToken !== '' ? { refreshToken: result.RefreshToken } : {},
      userId,
      ...screenName !== undefined ? { accountName: screenName } : {},
      ...avatarUrl !== undefined ? { avatarUrl } : {},
      ...typeof result.RefreshExpireAt === 'number' ? { refreshExpiresAtMs: result.RefreshExpireAt } : {},
      host: isGlobal ? 'https://coresg-normal.trae.ai' : 'https://api.trae.cn',
      expiresAtMs: typeof result.TokenExpireAt === 'number' ? result.TokenExpireAt : 0,
      edition: isGlobal ? 'sg' : 'cn',
      source: 'dsh',
    }

    await this.store.write(credential)

    attempt.status = 'complete'
    if (screenName !== undefined) attempt.accountName = screenName
    if (userId !== '') attempt.userId = userId

    // Give a small grace period for in-flight requests then dispose server
    setTimeout(() => {
      attempt.cleanup()
    }, 1_000)
  }

  /**
   * Poll the status of an ongoing sign-in attempt.
   */
  async poll(state: string): Promise<{
    status: 'pending' | 'complete' | 'failed'
    accountName?: string | undefined
    userId?: string | undefined
    message?: string | undefined
  }> {
    const attempt = this.attempts.get(state)
    if (attempt === undefined) {
      return { status: 'failed', message: '未找到该登录会话或已过期' }
    }

    if (attempt.status === 'complete') {
      this.attempts.delete(state)
      return {
        status: 'complete',
        ...attempt.accountName !== undefined ? { accountName: attempt.accountName } : {},
        ...attempt.userId !== undefined ? { userId: attempt.userId } : {},
      }
    }

    if (attempt.status === 'failed') {
      this.attempts.delete(state)
      return {
        status: 'failed',
        message: attempt.error ?? '登录失败',
      }
    }

    return { status: 'pending' }
  }

  /**
   * Automatically detect and adopt a sign-in from local Trae desktop app or CLI (fallback).
   */
  async detectLocal(): Promise<TraeCredential | undefined> {
    const candidates = traeStorageCandidates()
    const matching = candidates.filter(c => c.region === this.variant.region)

    for (const candidate of matching) {
      try {
        const text = await readFile(candidate.path, 'utf8')
        if (candidate.source === 'desktop') {
          const raw = parseTraeStorageDocument(text)
          const cred = parseTraeAuth(raw, candidate.edition, 'desktop')
          if (cred !== undefined) {
            await this.store.write(cred)
            return cred
          }
        } else if (candidate.source === 'cli') {
          const claims = parseTraeCliToken(text)
          const cred: TraeCredential = {
            accessToken: claims.accessToken,
            userId: claims.userId,
            host: this.variant.region === 'ai' ? 'https://coresg-normal.trae.ai' : 'https://api.trae.cn',
            expiresAtMs: claims.expiresAtMs ?? 0,
            edition: candidate.edition,
            source: 'cli',
          }
          await this.store.write(cred)
          return cred
        }
      } catch {
        // Candidate not readable or parsing failed, continue
      }
    }

    return undefined
  }

  /**
   * Adopt a user-provided credential document or bare token.
   */
  async importDocument(text: string): Promise<TraeCredential> {
    const trimmed = text.trim()
    if (trimmed === '') throw new Error('凭据内容为空')

    // Try parsing as standard format
    let cred = parseTraeDocument(trimmed)

    if (cred === undefined && trimmed.startsWith('{')) {
      try {
        const raw = parseTraeStorageDocument(trimmed)
        cred = parseTraeAuth(raw, this.variant.region === 'ai' ? 'sg' : 'cn', 'desktop')
      } catch {}
    }

    if (cred === undefined && trimmed.includes('.')) {
      try {
        const claims = parseTraeCliToken(trimmed)
        cred = {
          accessToken: claims.accessToken,
          userId: claims.userId,
          host: this.variant.region === 'ai' ? 'https://coresg-normal.trae.ai' : 'https://api.trae.cn',
          expiresAtMs: claims.expiresAtMs ?? 0,
          edition: this.variant.region === 'ai' ? 'sg' : 'cn',
          source: 'cli',
        }
      } catch {}
    }

    if (cred === undefined) {
      throw new Error('无法解析凭据：请提供有效的 Trae 凭据 JSON 文件或 JWT Token')
    }

    const targetRegion = cred.edition === 'sg' || cred.edition === 'solo-sg' ? 'ai' : 'cn'
    if (targetRegion !== this.variant.region) {
      throw new Error(`凭据版本不匹配：当前为 ${this.variant.displayName}，而该凭证属于 ${targetRegion === 'ai' ? '国际版' : '国内版'}`)
    }

    await this.store.write(cred)
    return cred
  }

  async logout(): Promise<void> {
    await this.store.remove()
  }
}
