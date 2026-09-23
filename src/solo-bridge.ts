import { randomUUID } from 'node:crypto'
import { SseDecoder, decodeTraeEvent } from './sse.ts'

interface OpenAIToolCallDelta {
  index: number
  id?: string
  type?: 'function'
  function?: { name?: string; arguments?: string }
}

function normalizeToolCalls(value: unknown): OpenAIToolCallDelta[] {
  if (!Array.isArray(value)) return []
  const calls: OpenAIToolCallDelta[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const record = raw as Record<string, unknown>
    const rawFunction = typeof record['function_call'] === 'object' && record['function_call'] !== null
      ? record['function_call'] as Record<string, unknown>
      : typeof record['function'] === 'object' && record['function'] !== null
        ? record['function'] as Record<string, unknown>
        : {}
    const fn = {
      ...typeof rawFunction['name'] === 'string' ? { name: rawFunction['name'] } : {},
      ...typeof rawFunction['arguments'] === 'string' ? { arguments: rawFunction['arguments'] } : {},
    }
    calls.push({
      index: typeof record['index'] === 'number' ? record['index'] : calls.length,
      ...typeof record['id'] === 'string' ? { id: record['id'] } : {},
      ...record['type'] === 'function' ? { type: 'function' as const } : {},
      ...Object.keys(fn).length === 0 ? {} : { function: fn },
    })
  }
  return calls
}

export function formatTraeErrorMessage(code?: number, rawMsg: string = ''): string {
  let message = rawMsg.trim()
  if (code === 4120) {
    message = '当前账号权限不足，该模型需要订阅 Trae Pro 会员计划 (错误码 4120)'
  } else if (code === 4008) {
    message = '当前 Trae 账号可用额度已耗尽，请前往 Trae 充值或升级套餐 (错误码 4008)'
  } else if (code === 4001) {
    message = rawMsg ? `${rawMsg} (错误码 4001)` : '模型调用参数无效 (错误码 4001)'
  } else if (code === 4003) {
    message = 'Trae 账号登录凭据已失效，请重新登录 Trae 账号 (错误码 4003)'
  } else if (code === 4029 || code === 429) {
    message = '请求过于频繁，触发 Trae 限流，请稍后重试 (错误码 4029)'
  } else if (!message) {
    message = `Trae 上游请求错误 (错误码 ${code ?? '?'})`
  }
  return message
}

export function bridgeTraeSoloStream(response: Response, model: string): Response {
  const source = response.body
  if (source === null) return new Response(null, { status: 502 })
  const id = `chatcmpl-${randomUUID().replaceAll('-', '').slice(0, 24)}`
  const created = Math.floor(Date.now() / 1000)
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const sse = new SseDecoder()
  let sawToolCalls = false
  let emittedFinishReason = false
  let upstreamError: Error | undefined
  let usage: Record<string, number> | undefined

  const chunk = (delta: Record<string, unknown>, finishReason: string | null = null): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
      ...usage === undefined ? {} : { usage },
    })}\n\n`)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader()
      const consume = (event: ReturnType<SseDecoder['push']>[number]): void => {
        const decoded = decodeTraeEvent(event)
        if (decoded.type === 'unknown') {
          const payload = decoded.data as Record<string, unknown> | undefined
          const code = typeof payload?.['code'] === 'number' ? payload['code'] : undefined
          if (decoded.event === 'error' || (code !== undefined && code >= 4000)) {
            const rawMsg = typeof payload?.['message'] === 'string' ? payload['message'].trim() : ''
            const message = formatTraeErrorMessage(code, rawMsg)
            upstreamError = new Error(message)
          }
          return
        }
        if (decoded.type === 'delta') {
          const delta: Record<string, unknown> = {}
          if (decoded.text !== '') delta['content'] = decoded.text
          if (decoded.reasoning !== undefined && decoded.reasoning !== '') {
            delta['reasoning_content'] = decoded.reasoning
          }
          const toolCalls = normalizeToolCalls(decoded.toolCalls)
          if (toolCalls.length > 0) {
            sawToolCalls = true
            delta['tool_calls'] = toolCalls
          }
          if (Object.keys(delta).length > 0) controller.enqueue(chunk(delta))
        } else if (decoded.type === 'usage') {
          usage = {
            ...decoded.inputTokens === undefined ? {} : { prompt_tokens: decoded.inputTokens },
            ...decoded.outputTokens === undefined ? {} : { completion_tokens: decoded.outputTokens },
            ...decoded.totalTokens === undefined ? {} : { total_tokens: decoded.totalTokens },
          }
        } else if (decoded.type === 'done') {
          if (!emittedFinishReason) {
            emittedFinishReason = true
            if (upstreamError !== undefined) {
              controller.enqueue(chunk({ content: `\n\n⚠️ **[Trae 错误]**: ${upstreamError.message}` }))
              controller.enqueue(chunk({}, 'stop'))
            } else {
              controller.enqueue(chunk({}, sawToolCalls ? 'tool_calls' : decoded.finishReason || 'stop'))
            }
          }
        }
      }

      try {
        while (true) {
          const next = await reader.read()
          if (next.done) break
          for (const event of sse.push(decoder.decode(next.value, { stream: true }))) consume(event)
        }
        for (const event of sse.finish()) consume(event)
        if (!emittedFinishReason) {
          emittedFinishReason = true
          if (upstreamError !== undefined) {
            controller.enqueue(chunk({ content: `\n\n⚠️ **[Trae 错误]**: ${upstreamError.message}` }))
            controller.enqueue(chunk({}, 'stop'))
          } else {
            controller.enqueue(chunk({}, sawToolCalls ? 'tool_calls' : 'stop'))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
    cancel(reason) {
      return source.cancel(reason)
    },
  })

  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}
