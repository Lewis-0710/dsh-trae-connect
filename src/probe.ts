import { randomBytes } from 'node:crypto'
import type { TraeReasoningEffort } from './reasoning.ts'

export const PROBE_EFFORT_CANDIDATES: readonly TraeReasoningEffort[] = ['low', 'medium', 'high', 'xhigh']
export const PROBE_PROMPT = 'ping'
export const PROBE_MAX_TOKENS = 1
export const PROBE_REQUEST_TIMEOUT_MS = 30_000

export type SentinelFactory = () => string

export function randomSentinel(): string {
  return `probe_sentinel_${randomBytes(12).toString('hex')}`
}

export interface ProbeAttempt {
  status: number
  streamed: boolean
  errorCode?: string
  detail?: string
}

export type ProbeSender = (effort: string | undefined, signal: AbortSignal) => Promise<ProbeAttempt>

export type ProbeOutcome =
  | { validation: 'validating'; efforts: readonly TraeReasoningEffort[]; requests: number }
  | { validation: 'non-validating'; efforts: readonly []; requests: number }
  | { validation: 'unknown'; efforts: readonly []; requests: number; reason: string }

function isEffortRejection(attempt: ProbeAttempt): boolean {
  return attempt.status === 400 || (attempt.errorCode !== undefined && attempt.errorCode.includes('reasoning'))
}

function isAcceptance(attempt: ProbeAttempt): boolean {
  return attempt.status === 200 && attempt.streamed
}

export async function probeModel(
  send: ProbeSender,
  options: { sentinel?: SentinelFactory | undefined } = {},
): Promise<ProbeOutcome> {
  let requests = 0
  const sentinelFactory = options.sentinel ?? randomSentinel

  // 1. Baseline: send with no reasoning_effort
  const baseline = await send(undefined, AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS))
  requests++
  if (!isAcceptance(baseline)) {
    return { validation: 'unknown', efforts: [], requests, reason: `baseline failed: HTTP ${baseline.status}` }
  }

  // 2. Sentinel: send with random invalid effort to verify upstream validates it
  const sentinel = await send(sentinelFactory(), AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS))
  requests++
  if (isAcceptance(sentinel)) {
    // Upstream ignored sentinel, non-validating
    return { validation: 'non-validating', efforts: [], requests }
  }
  if (!isEffortRejection(sentinel)) {
    return { validation: 'unknown', efforts: [], requests, reason: `sentinel gave unexpected status: ${sentinel.status}` }
  }

  // 3. Sweep supported candidate levels
  const supported: TraeReasoningEffort[] = []
  for (const effort of PROBE_EFFORT_CANDIDATES) {
    const attempt = await send(effort, AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS))
    requests++
    if (isAcceptance(attempt)) {
      supported.push(effort)
    }
  }

  return { validation: 'validating', efforts: supported, requests }
}
