/**
 * Probe orchestration: queueing and execution for reasoning effort testing.
 *
 * @module dsh-trae-connect/probe-service
 */

import type { TraeCatalog } from './catalog.ts'
import { probeModel, type ProbeSender, type SentinelFactory } from './probe.ts'
import type { TraeProbeStore, TraeProbeValidation } from './probe-store.ts'
import type { TraeUpstreamClient } from './upstream.ts'

export type TraeProbeStatus =
  | { state: 'ok'; validation: TraeProbeValidation; efforts: readonly string[]; requests: number }
  | { state: 'unavailable'; reason: string }

export interface TraeProbeServiceOptions {
  store: TraeProbeStore
  catalog: TraeCatalog
  client: TraeUpstreamClient
  consent: () => boolean
  account: () => string | undefined
  sentinel?: SentinelFactory | undefined
  send?: ((modelId: string) => ProbeSender) | undefined
}

/**
 * Extract an error code from a Trae Solo upstream error body.
 *
 * Trae Solo endpoints may return errors in several shapes:
 *   - `{ "code": 4001, "msg": "..." }` — top-level numeric/string code
 *   - `{ "base_resp": { "status_code": 11150, "status_message": "..." } }` — nested status
 *   - `{ "error": { "code": "...", "message": "..." } }` — OpenAI-style
 *
 * When the body mentions `reasoning_effort` or `reasoning` in its message,
 * we normalize to `invalid_reasoning_effort` so `isEffortRejection` can match.
 */
function extractErrorCode(text: string): { errorCode?: string; detail?: string } {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { detail: text }
    }
    const obj = parsed as Record<string, unknown>

    // Top-level code / msg
    const topCode = obj['code']
    const topMsg = typeof obj['msg'] === 'string' ? obj['msg'] : undefined
    const topMessage = typeof obj['message'] === 'string' ? obj['message'] : undefined

    // Nested base_resp
    const baseResp = typeof obj['base_resp'] === 'object' && obj['base_resp'] !== null
      ? obj['base_resp'] as Record<string, unknown>
      : undefined
    const baseCode = baseResp?.['status_code']
    const baseMsg = typeof baseResp?.['status_message'] === 'string' ? baseResp['status_message'] : undefined

    // OpenAI-style error.code / error.message
    const errorObj = typeof obj['error'] === 'object' && obj['error'] !== null
      ? obj['error'] as Record<string, unknown>
      : undefined
    const errorCode = typeof errorObj?.['code'] === 'string' ? errorObj['code'] : undefined
    const errorMsg = typeof errorObj?.['message'] === 'string' ? errorObj['message'] : undefined

    const anyMessage = topMsg ?? topMessage ?? baseMsg ?? errorMsg ?? ''
    const anyCode = errorCode ?? (topCode !== undefined ? String(topCode) : undefined)
      ?? (baseCode !== undefined ? String(baseCode) : undefined)

    // Normalize reasoning-effort related errors
    if (anyMessage.includes('reasoning') || anyMessage.includes('effort')
      || anyCode === '11150' || anyCode === 'invalid_reasoning_effort') {
      return { errorCode: 'invalid_reasoning_effort', detail: anyMessage || 'invalid_reasoning_effort' }
    }

    if (anyCode !== undefined) {
      return { errorCode: anyCode, detail: anyMessage || anyCode }
    }

    return { detail: anyMessage || text }
  } catch {
    return { detail: text }
  }
}

export class TraeProbeService {
  private readonly options: TraeProbeServiceOptions
  private queue: Promise<unknown> = Promise.resolve()
  private running = false

  constructor(options: TraeProbeServiceOptions) {
    this.options = options
  }

  isRunning(): boolean {
    return this.running
  }

  candidates(): readonly string[] {
    return this.options.catalog.current()
      .filter(m => m.reasoningSupported || m.reasoningEfforts !== undefined)
      .map(m => m.id)
  }

  async probe(modelId: string): Promise<TraeProbeStatus> {
    if (!this.options.consent()) {
      return { state: 'unavailable', reason: '用户未授权推理档位探测' }
    }

    const model = this.options.catalog.current().find(m => m.id === modelId)
    if (model === undefined) {
      return { state: 'unavailable', reason: `模型 ${modelId} 不存在` }
    }

    return new Promise((resolve) => {
      this.queue = this.queue.then(async () => {
        this.running = true
        try {
          const sender: ProbeSender = this.options.send !== undefined
            ? this.options.send(modelId)
            : async (effort, signal) => {
              // Build the probe body directly, bypassing prepareSoloBody.
              // prepareSoloBody's reasoning_effort mapping silently drops
              // unknown/sentinel values, which breaks the probe's sentinel
              // detection step. We must pass reasoning_effort raw to the
              // upstream so it can accept or reject it.
              const wireModel = model.wireConfigName ?? modelId
              const wireFunction = model.wireFunction ?? (this.options.client.variant.region === 'ai' ? 'solo_agent' : 'solo_work_remote')
              const probeBody: Record<string, unknown> = {
                model: wireModel,
                config_name: wireModel,
                function: wireFunction,
                stream: true,
                messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
                max_tokens: 1,
              }
              if (effort !== undefined) {
                // Pass reasoning_effort raw — no mapping. The probe needs
                // the upstream to see the exact value (including sentinels)
                // so it can distinguish "validates" from "ignores".
                probeBody['reasoning_effort'] = effort
              }

              const result = await this.options.client.probeEffort(
                JSON.stringify(probeBody),
                signal,
              )
              if (!result.ok) {
                const extracted = extractErrorCode(result.message)
                return {
                  status: result.status,
                  streamed: false,
                  ...extracted,
                }
              }
              return { status: 200, streamed: true }
            }

          const outcome = await probeModel(sender, this.options.sentinel !== undefined ? { sentinel: this.options.sentinel } : {})
          if (outcome.validation === 'unknown') {
            // Do not persist unknown results; treat as unavailable.
            resolve({ state: 'unavailable', reason: outcome.reason })
            return
          }
          const currentAccount = this.options.account()
          this.options.store.put(model, outcome.validation, outcome.efforts, currentAccount)
          resolve({ state: 'ok', validation: outcome.validation, efforts: outcome.efforts, requests: outcome.requests })
        } catch (err) {
          resolve({ state: 'unavailable', reason: err instanceof Error ? err.message : String(err) })
        } finally {
          this.running = false
        }
      })
    })
  }

  clear(): void {
    this.options.store.clear()
  }
}

