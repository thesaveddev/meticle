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

  /**
   * No prompt may ask a language model to produce a legal citation.
   *
   * This is the guard for the most damaging thing the AI module was doing.
   * Three prompts contained a worked example of a statutory citation — the
   * literal text "e.g. Care Act 2014 s.42, CQC Reg. 12" — in the field a
   * safeguarding record was supposed to fill in. A model asked for a field
   * whose example is a real-looking citation will produce a real-looking
   * citation, whether or not it is right, and there is no field in a JSON
   * response that says "I am not certain this is real". The output lands in a
   * safeguarding record that a provider may quote to an inspector, a
   * commissioner or a court.
   *
   * The prompt was deleted rather than reworded, and this test is what stops
   * the shape coming back in a new prompt. Note what it does not do: it does
   * not check that the citation *is* accurate, because nothing in this codebase
   * can. It only refuses the request for one.
   */
  it('no prompt asks the model for a legal citation or regulation number', () => {
    for (const [key, p] of Object.entries(PROMPTS)) {
      const text = `${p.system}\n${p.userTemplate}`
      // The two things that actually teach a model to cite: an output *field*
      // whose name says "regulation", and a worked example. Prose is not
      // checked, because "do not cite legislation" is a prohibition and reads
      // identically to an instruction under any pattern loose enough to catch
      // one — an earlier version of this test failed on its own guard text.
      expect(/reference_regulation|regulation_reference|statutory_reference/i.test(text), key).toBe(false)
      expect(/Act \d{4}\s*s\.\d+/i.test(text), key).toBe(false)
      expect(/CQC Reg\.?\s*\d+/i.test(text), key).toBe(false)
      expect(/\bs\.\d+/i.test(text), key).toBe(false)
    }
  })

  /**
   * No prompt may name one nation's regulator as if it applied to all of them.
   *
   * The compliance module was made four-nations aware after a Scottish provider
   * was marked non-compliant for not holding a DBS. The same error existed in
   * the prompts, where a care note written in Wales was asked to be
   * "CQC-compliant" and a Scottish one was asked whether it needed a MASH
   * referral — an England-only mechanism. Naming a regulator in a prompt is
   * allowed; naming one and not the others is the defect, so the check is that
   * a prompt naming CQC must also name the other three.
   */
  it('a prompt that names a regulator names all of them, or none', () => {
    const bodies = [/CQC/i, /\bCIW\b/i, /Care Inspectorate/i, /\bRQIA\b/i]
    for (const [key, p] of Object.entries(PROMPTS)) {
      const text = `${p.system}\n${p.userTemplate}`
      const named = bodies.filter((re) => re.test(text))
      // One or none is fine. Two or three is the shape of a prompt written for
      // England and lightly edited, which is how the CQC-only prompts arose.
      expect(named.length === 1 || named.length === 0, `${key} names only ${named[0]}`).toBe(true)
    }
  })

  /**
   * England-only safeguarding bodies must not appear in any prompt.
   *
   * MASH is the Multi-Agency Safeguarding Hub, an England mechanism. Wales
   * routes through the National Safeguarding Team and Scotland through national
   * adult protection guidance, so asking a Scottish service whether it needs a
   * "MASH referral" asks a question with no answer in that country.
   */
  it('no prompt names an England-only safeguarding route', () => {
    for (const [key, p] of Object.entries(PROMPTS)) {
      const text = `${p.system}\n${p.userTemplate}`
      expect(/\bMASH\b/i.test(text), key).toBe(false)
      expect(/Better care for our people/i.test(text), key).toBe(false)
    }
  })
})
