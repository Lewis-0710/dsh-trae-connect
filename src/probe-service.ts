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
              const body = JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 1,
                ...(effort !== undefined ? { reasoning_effort: effort } : {}),
              })
              const result = await this.options.client.chatStream(body, signal)
              if (!result.ok) {
                return { status: result.status, streamed: false, detail: result.message }
              }
              return { status: 200, streamed: true }
            }

          const outcome = await probeModel(sender, this.options.sentinel !== undefined ? { sentinel: this.options.sentinel } : {})
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
