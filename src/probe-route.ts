/**
 * Trae 探测、设置与签到控制路由处理器。
 *
 * @module dsh-trae-connect/probe-route
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { hostIsLoopback, originIsLoopback } from './loopback.ts'
import type { TraeProbeService } from './probe-service.ts'
import type { TraeProbeAction } from './status-paths.ts'
import type { TraeVariant } from './variants.ts'

export interface TraeProbeRouteOptions {
  variant: TraeVariant
  probeService: TraeProbeService
  probeKey?: () => string
  onRefresh?: () => Promise<void>
  onCheckin?: () => Promise<{ state: string; reason?: string; amount?: number }>
  onClearCheckInLogs?: () => void
  onSetMaximumContextWindow?: (enabled: boolean) => Promise<{ state: string; reason?: string }>
  onSetDisabledModels?: (disabledModels: readonly string[]) => Promise<{ state: string; reason?: string }>
}

export function createProbeKey(): string {
  return randomBytes(24).toString('hex')
}

function keyMatches(expected: string, presented: string | undefined): boolean {
  if (presented === undefined || presented.length !== expected.length) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(presented)
  return a.length === b.length && timingSafeEqual(a, b)
}

const MAX_BODY_BYTES = 16384

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

export async function traeProbeHandler(
  req: IncomingMessage,
  res: ServerResponse,
  options: TraeProbeRouteOptions,
): Promise<void> {
  const send = (status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  if (req.method !== 'POST') {
    send(405, { error: 'Method not allowed' })
    return
  }

  if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers.origin)) {
    send(403, { error: '请求未受信：仅支持本地环回访问' })
    return
  }

  if (options.probeKey !== undefined) {
    const headerKey = (req.headers['x-trae-probe-key'] ?? req.headers['x-dsh-probe-key']) as string | undefined
    if (!keyMatches(options.probeKey(), headerKey)) {
      send(403, { error: '未经授权的操作：安全密钥不匹配' })
      return
    }
  }

  let body: TraeProbeAction
  try {
    body = (await parseJsonBody(req)) as TraeProbeAction
  } catch (err) {
    send(400, { error: err instanceof Error ? err.message : '无效的 JSON 请求体' })
    return
  }

  try {
    if (body.action === 'probe') {
      if (typeof body.model !== 'string' || body.model === '') {
        send(400, { error: '缺少 model 参数' })
        return
      }
      const result = await options.probeService.probe(body.model)
      send(200, result)
    } else if (body.action === 'clear') {
      options.probeService.clear()
      send(200, { state: 'cleared' })
    } else if (body.action === 'refresh') {
      if (options.onRefresh !== undefined) {
        await options.onRefresh()
      }
      send(200, { state: 'refreshed' })
    } else if (body.action === 'checkin') {
      if (options.onCheckin === undefined) {
        send(404, { error: '当前版本不支持每日签到' })
        return
      }
      const result = await options.onCheckin()
      send(200, result)
    } else if (body.action === 'clear-checkin-logs') {
      options.onClearCheckInLogs?.()
      send(200, { state: 'cleared' })
    } else if (body.action === 'set-maximum-context-window') {
      if (options.onSetMaximumContextWindow === undefined) {
        send(404, { error: '当前版本不支持上下文窗口设置' })
        return
      }
      const result = await options.onSetMaximumContextWindow(body.enabled === true)
      send(200, result)
    } else if (body.action === 'set-disabled-models') {
      if (options.onSetDisabledModels === undefined) {
        send(404, { error: '当前版本不支持模型禁用开关设置' })
        return
      }
      const result = await options.onSetDisabledModels(body.disabledModels ?? [])
      send(200, result)
    } else {
      send(400, { error: '未知操作' })
    }
  } catch (err) {
    send(500, { error: err instanceof Error ? err.message : String(err) })
  }
}
