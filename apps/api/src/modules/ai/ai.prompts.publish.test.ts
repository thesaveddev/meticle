import { describe, expect, it } from 'vitest'
import { AI_CAPABILITIES, AI_METHOD_DISCLOSURE } from './ai.capabilities'
import { PROMPTS } from './ai.prompts'

/**
 * The prompt-publishing contract: GET /ai/prompts serves PROMPTS verbatim, and
 * these assertions hold the registry, the templates, and the honest-mechanism
 * disclosure together. If a capability names a prompt key that does not exist,
 * the publish endpoint would serve a mapping to nothing — so it fails here.
 */
describe('published AI prompts', () => {
  it('every capability names a prompt key that actually exists', () => {
    for (const cap of Object.values(AI_CAPABILITIES)) {
      expect(PROMPTS[cap.promptKey], `${cap.id} -> ${cap.promptKey}`).toBeDefined()
    }
  })

  it('the intelligence capabilities all share one template — visibly', () => {
    const shared = Object.values(AI_CAPABILITIES)
      .filter((c) => c.id !== 'manager_briefing')
      .map((c) => c.promptKey)
    // Eleven entry points, one template: the sharing is the point of publishing.
    expect(new Set(shared).size).toBe(1)
    expect(shared[0]).toBe('unified_intelligence')
  })

  it('every shipped prompt template is non-empty in both parts', () => {
    for (const [key, p] of Object.entries(PROMPTS)) {
      expect(p.system.length, key).toBeGreaterThan(20)
      expect(p.userTemplate.length, key).toBeGreaterThan(20)
    }
  })

  it('templates contain no credential-shaped strings', () => {
    for (const [key, p] of Object.entries(PROMPTS)) {
      const text = `${p.system}\n${p.userTemplate}`
      expect(/sk-[A-Za-z0-9]{10,}/.test(text), key).toBe(false)
      expect(/password/i.test(text) === false || key.includes('credential'), key).toBe(true)
    }
  })

  it('the disclosure travels with the prompts', () => {
    expect(AI_METHOD_DISCLOSURE.appliesStatisticalDetection).toBe(false)
  })
})
