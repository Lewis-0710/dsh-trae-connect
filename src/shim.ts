import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { TraeCatalog } from './catalog.ts'
import { bridgeTraeSoloStream } from './solo-bridge.ts'
import type { TraeUpstreamClient, UpstreamErrorKind } from './upstream.ts'

export interface ShimLogger {
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export interface TraeShim {
  ready: Promise<void>
  baseUrl(): string
  token(): string
  close(): Promise<void>
}

export interface TraeShimOptions {
  catalog: TraeCatalog
  client: TraeUpstreamClient
  logger?: ShimLogger | undefined
}

const BODY_LIMIT = 64 * 1024 * 1024
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

const STATUS_BY_KIND: Readonly<Record<UpstreamErrorKind, number>> = {
  authentication: 401,
  hard_credit: 402,
  soft_rate: 429,
  not_found: 502,
  server: 502,
  client: 400,
  unconfigured: 503,
}

function hostnameOfHost(host: string): string {
  let hostname = host.trim().toLowerCase()
  if (hostname.startsWith('[')) {
    const end = hostname.indexOf(']')
    return end === -1 ? hostname : hostname.slice(0, end + 1)
  }
  const colon = hostname.lastIndexOf(':')
  if (colon !== -1 && /^\d+$/.test(hostname.slice(colon + 1))) hostname = hostname.slice(0, colon)
  return hostname
}

function hostIsLoopback(host: string | undefined): boolean {
  return host !== undefined && host.trim() !== '' && LOOPBACK_HOSTS.has(hostnameOfHost(host))
}

function originIsLoopback(origin: string | undefined): boolean {
  if (origin === undefined || origin.trim() === '') return true
  try {
    const hostname = new URL(origin).hostname
    return LOOPBACK_HOSTS.has(hostname) || hostname === '::1'
  } catch {
    return false
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
  res.end(payload)
}

function writeError(res: ServerResponse, status: number, kind: string, message: string): void {
  writeJson(res, status, { error: { message, type: kind, code: kind } })
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(new Error('request body too large'))
        req.destroy()
      } else {
        chunks.push(chunk)
      }
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function createTraeShim(options: TraeShimOptions): TraeShim {
  const secret = randomBytes(32).toString('base64url')
  const sockets = new Set<import('node:net').Socket>()
  const server: Server = createServer((req, res) => { void handle(req, res) })

  server.on('connection', socket => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })

  const ready = new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  server.listen(0, '127.0.0.1')

  function bearerOk(req: IncomingMessage): boolean {
    const match = typeof req.headers.authorization === 'string'
      ? /^Bearer\s+(.+)$/i.exec(req.headers.authorization.trim())
      : null
    if (match === null) return false
    const actual = Buffer.from(match[1] ?? '')
    const expected = Buffer.from(secret)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (!hostIsLoopback(req.headers.host)) return writeError(res, 403, 'host_not_allowed', 'Host must be loopback')
      if (!originIsLoopback(req.headers.origin)) return writeError(res, 403, 'origin_not_allowed', 'Origin must be loopback')
      if (!bearerOk(req)) return writeError(res, 401, 'unauthorized', 'Missing or invalid bearer')

      const url = req.url ?? '/'
      if (req.method === 'GET' && (url === '/healthz' || url === '/healthz/')) {
        return writeJson(res, 200, { ok: true })
      }
      if (req.method === 'GET' && (url === '/v1/models' || url === '/v1/models/')) {
        return writeJson(res, 200, {
          object: 'list',
          data: options.catalog.current().map(m => ({ id: m.id, object: 'model', created: 0, owned_by: 'trae' })),
        })
      }

      if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/v1/chat/completions/')) {
        const raw = (await readBody(req)).toString('utf8')
        let parsed: { model?: string }
        try {
          parsed = JSON.parse(raw) as { model?: string }
        } catch {
          return writeError(res, 400, 'invalid_json', 'Request body must be valid JSON')
        }

        const modelName = typeof parsed.model === 'string' && parsed.model !== '' ? parsed.model : 'glm-5.2'
        const controller = new AbortController()
        const abort = (): void => controller.abort()
        req.once('aborted', abort)
        req.socket.once('close', abort)

        const result = await options.client.chatStream(raw, controller.signal)
        if (!result.ok) {
          return writeError(res, STATUS_BY_KIND[result.kind], result.kind, result.message)
        }

        const bridgedResponse = bridgeTraeSoloStream(result.response, modelName)
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        })

        const bodyStream = Readable.fromWeb(bridgedResponse.body as Parameters<typeof Readable.fromWeb>[0])
        bodyStream.on('error', (err: unknown) => {
          options.logger?.warn('dsh-trae-connect: stream error', err)
          if (!res.writableEnded) res.end()
        })
        bodyStream.pipe(res)
        return
      }

      writeError(res, 404, 'not_found', `No such route: ${req.method} ${url}`)
    } catch (error: unknown) {
      options.logger?.error('dsh-trae-connect: shim error', error)
      if (!res.headersSent) writeError(res, 500, 'internal', 'Internal shim error')
      else if (!res.writableEnded) res.end()
    }
  }

  return {
    ready,
    baseUrl() {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('trae shim is not listening')
      return `http://127.0.0.1:${address.port}`
    },
    token: () => secret,
    close: () => new Promise<void>((resolve, reject) => {
      for (const socket of sockets) socket.destroy()
      server.close(error => error === undefined ? resolve() : reject(error))
    }),
  }
}
