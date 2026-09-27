import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn()
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } }
    constructor(public opts: unknown) {}
  },
}))

import { OpenAIProvider } from './ai.provider'

/**
 * The retention flag is a control, and an untested control is a comment. This
 * exists because `store: false` was added, then immediately removed during a
 * mutation check and nothing failed — a green build on a version of the code
 * that lets a US provider keep a second copy of pseudonymous health data for
 * thirty days.
 */
describe('OpenAIProvider', () => {
  beforeEach(() => { create.mockReset(); create.mockResolvedValue({ choices: [{ message: { content: 'ok' } }], usage: {} }) })

  it('opts out of payload retention on every call', async () => {
    await new OpenAIProvider('test-key').chatCompletion([{ role: 'user', content: 'hello' }])
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toHaveProperty('store', false)
  })

  it('keeps the flag when the model needs max_completion_tokens', async () => {
    // A different body shape, and therefore a different place to forget it.
    await new OpenAIProvider('test-key').chatCompletion([{ role: 'user', content: 'hi' }], { model: 'gpt-4.1' })
    const body = create.mock.calls[0][0] as Record<string, unknown>
    expect(body.store).toBe(false)
    expect(body).toHaveProperty('max_completion_tokens')
  })

  it('returns the token counts the audit log records', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    })
    const result = await new OpenAIProvider('test-key').chatCompletion([{ role: 'user', content: 'hello' }])
    expect(result).toMatchObject({ promptTokens: 11, completionTokens: 7, totalTokens: 18 })
  })

  it('sends only what the caller passed, so redaction is not undone here', async () => {
    await new OpenAIProvider('test-key').chatCompletion([{ role: 'user', content: 'Client 4F2A had a note' }])
    const body = create.mock.calls[0][0] as { messages: Array<{ content: string }> }
    expect(body.messages[0].content).toBe('Client 4F2A had a note')
  })
})
