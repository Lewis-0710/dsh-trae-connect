/**
 * Token refresh client conforming to official Trae OAuth 2.0 ExchangeToken contract.
 *
 * Implements DeviceProof ECDSA P-256 signature verification (_Te contract).
 *
 * @module dsh-trae-connect/refresh
 */

import type { TraeCredential, TraeRefreshOutcome } from './auth.ts'
import { buildTraeDeviceInfo, signDeviceProof } from './device.ts'

const OAUTH_CLIENT_ID = 'en1oxy7wnw8j9n'

function normalizeHost(host: string): string {
  const value = host.trim()
  if (value === '') throw new Error('Trae refresh host is missing')
  return value.replace(/\/$/, '')
}

export async function refreshTraeCredential(
  credential: TraeCredential,
  signal?: AbortSignal,
): Promise<TraeRefreshOutcome> {
  if (credential.refreshToken === undefined || credential.refreshToken === '') {
    throw new Error('Trae refresh token is missing')
  }

  const { profile, deviceInfo } = await buildTraeDeviceInfo()
  const path = '/trae/api/v3/oauth/ExchangeToken'
  const proof = signDeviceProof('POST', path, OAUTH_CLIENT_ID, credential.refreshToken, profile.keyPair.privateKeyPEM)

  const body: Record<string, unknown> = {
    ClientID: OAUTH_CLIENT_ID,
    ClientSecret: '',
    RefreshToken: credential.refreshToken,
    DeviceInfo: deviceInfo,
    DeviceProof: {
      Signature: proof.signature,
      Timestamp: proof.timestamp,
      Nonce: proof.nonce,
    },
    IDEVersion: '0.1.66',
  }

  const response = await fetch(`${normalizeHost(credential.host)}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cloudide-token': '',
      'User-Agent': 'Trae/0.1.66',
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    let errorDetail = ''
    try {
      const errorText = await response.text()
      errorDetail = errorText !== '' ? ` - ${errorText}` : ''
    } catch {}
    throw new Error(`Trae token refresh failed (HTTP ${response.status})${errorDetail}`)
  }

  const payload = await response.json() as { Result?: Record<string, unknown> }
  const result = payload.Result
  const accessToken = typeof result?.['Token'] === 'string' ? result['Token'] : ''
  if (accessToken === '') throw new Error('Trae token refresh returned no token')
  const expiry = result?.['TokenExpireAt']
  const expiresAtMs = typeof expiry === 'number'
    ? (expiry > 1e12 ? expiry : expiry * 1000)
    : typeof expiry === 'string' ? Date.parse(expiry) : Number.NaN
  if (!Number.isFinite(expiresAtMs)) throw new Error('Trae token refresh returned an invalid expiry')
  const refreshToken = typeof result?.['RefreshToken'] === 'string' && result['RefreshToken'] !== ''
    ? result['RefreshToken']
    : undefined
  return { accessToken, ...refreshToken === undefined ? {} : { refreshToken }, expiresAtMs }
}
