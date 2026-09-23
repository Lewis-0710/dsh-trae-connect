import { describe, expect, it } from 'vitest'
import { SseDecoder, decodeTraeEvent } from '../src/sse.ts'
import { bridgeTraeSoloStream } from '../src/solo-bridge.ts'

describe('SSE & Solo Stream Bridge', () => {
  it('decodes incremental SSE events', () => {
    const decoder = new SseDecoder()
    const events = decoder.push('event: output\ndata: {"response":"hello"}\n\n')
    expect(events).toHaveLength(1)
    expect(events[0]?.event).toBe('output')

    const decoded = decodeTraeEvent(events[0]!)
    expect(decoded.type).toBe('delta')
    if (decoded.type === 'delta') {
      expect(decoded.text).toBe('hello')
    }
  })

  it('decodes reasoning_content', () => {
    const decoder = new SseDecoder()
    const events = decoder.push('event: output\ndata: {"response":"","reasoning_content":"thinking..."}\n\n')
    const decoded = decodeTraeEvent(events[0]!)
    expect(decoded.type).toBe('delta')
    if (decoded.type === 'delta') {
      expect(decoded.reasoning).toBe('thinking...')
    }
  })

  it('bridges Trae SSE stream to OpenAI completion chunk stream with reasoning', async () => {
    const rawSse = [
      'event: output\ndata: {"response":"Hello", "reasoning_content":"let me think"}\n\n',
      'event: token_usage\ndata: {"prompt_tokens":10, "completion_tokens":5, "total_tokens":15}\n\n',
      'event: done\ndata: {"finish_reason":"stop"}\n\n',
    ].join('')

    const response = new Response(rawSse, {
      headers: { 'Content-Type': 'text/event-stream' },
    })

    const bridged = bridgeTraeSoloStream(response, 'test-model')
    expect(bridged.status).toBe(200)

    const text = await bridged.text()
    expect(text).toContain('chat.completion.chunk')
    expect(text).toContain('reasoning_content')
    expect(text).toContain('let me think')
    expect(text).toContain('Hello')
    expect(text).toContain('[DONE]')
  })
})
