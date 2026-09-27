import { describe, it, expect } from 'vitest'
import { PROMPTS, renderPrompt } from './ai.prompts'
import { collectNames, redactText, redactVariables, pseudonymFor } from './ai.redaction'

const ORG = '11111111-1111-1111-1111-111111111111'
const OTHER_ORG = '22222222-2222-2222-2222-222222222222'

/**
 * These tests are the control. A redaction layer that is not tested is a
 * comment, and the failure it prevents — a service user's name and their
 * medication-refusal note reaching a third-party LLM — is not the kind of
 * failure anyone notices from the logs.
 */
describe('the LLM boundary', () => {
  describe('names', () => {
    it('replaces a service user name carried in a person_name field', () => {
      const out = redactVariables({ person_name: 'Margaret Whitfield' }, ORG)
      expect(out.person_name).not.toContain('Margaret')
      expect(out.person_name).toMatch(/^Client [0-9A-F]{4}$/)
    })

    it('replaces the same name inside free text, which is where it actually lives', () => {
      // A daily note never says the full name. It says "Margaret".
      const out = redactVariables(
        {
          person_name: 'Margaret Whitfield',
          records: JSON.stringify([{ person_name: 'Margaret Whitfield', content: 'Margaret refused her medication again this evening.' }]),
        },
        ORG,
      )
      expect(out.records).not.toContain('Margaret')
      expect(out.records).not.toContain('Whitfield')
      // The clinical meaning has to survive, or the feature is worthless.
      expect(out.records).toContain('refused her medication')
    })

    it('distinguishes staff from service users so a model does not merge them', () => {
      const out = redactVariables(
        { records: JSON.stringify({ person_name: 'Alan Reed', staff_name: 'Priya Shah' }) },
        ORG,
      )
      expect(out.records).toContain('Client')
      expect(out.records).toContain('Staff')
      expect(out.records).not.toContain('Reed')
      expect(out.records).not.toContain('Shah')
    })

    it('gives one pseudonym when the same name appears as both, rather than two', () => {
      // A carer who is also a service user in the same payload. Keyed by the
      // string, so the last classification wins and the model sees one person,
      // which is the correct reading. Pinned because the alternative is two
      // references for one human and a model concluding they are different.
      const out = redactVariables(
        { records: JSON.stringify({ person_name: 'Alan Reed', staff_name: 'Alan Reed' }) },
        ORG,
      )
      const matches = out.records.match(/(Client|Staff) [0-9A-F]{4}/g) || []
      expect(new Set(matches).size).toBe(1)
    })

    it('gives the same name the same pseudonym within a request', () => {
      // Stability is the whole value of the feature: a model can only spot a
      // pattern across five records if they share an identifier.
      const out = redactVariables(
        { records: JSON.stringify({ a: { person_name: 'Joan Pike' }, b: { person_name: 'Joan Pike' } }) },
        ORG,
      )
      const matches = out.records.match(/Client [0-9A-F]{4}/g) || []
      expect(matches).toHaveLength(2)
      expect(matches[0]).toBe(matches[1])
    })

    it('gives the same name different pseudonyms in different organisations', () => {
      const a = pseudonymFor('Joan Pike', ORG)
      const b = pseudonymFor('Joan Pike', OTHER_ORG)
      expect(a).not.toBe(b)
    })

    it('leaves ordinary clinical and organisational vocabulary alone', () => {
      // The failure mode of a naive capitalised-pair heuristic: "Care
      // Inspectorate" and "NHS Digital" would be treated as people.
      const out = redactVariables(
        {
          person_name: 'Joan Pike',
          records: 'Care Inspectorate registration. NHS Digital standards. CQC inspection ready.',
        },
        ORG,
      )
      expect(out.records).toContain('Care Inspectorate')
      expect(out.records).toContain('NHS Digital')
      expect(out.records).toContain('CQC')
    })

    it('replaces a name declared by the call site as name-bearing', () => {
      const out = redactVariables({ involved: 'Margaret Whitfield, Alan Reed' }, ORG, ['involved'])
      expect(out.involved).not.toContain('Margaret')
      expect(out.involved).not.toContain('Reed')
      // The list must stay a list, or the prompt loses its structure.
      expect(out.involved).toContain(',')
    })

    it('does not treat a free-text description as a name and mangle the sentence', () => {
      const out = redactVariables({ description: 'Fell in the kitchen after standing up.' }, ORG)
      expect(out.description).toBe('Fell in the kitchen after standing up.')
    })
  })

  describe('direct identifiers', () => {
    it('strips an email address', () => {
      expect(redactText('Contact joan.pike@example.com', new Map())).toBe('Contact [email]')
    })

    it('strips a UK phone number', () => {
      expect(redactText('Ring 07700 900123 to confirm', new Map())).toBe('Ring [phone] to confirm')
    })

    it('strips a postcode', () => {
      expect(redactText('Home at SW1A 1AA', new Map())).toBe('Home at [postcode]')
    })

    it('strips a long digit run that could be an NHS number', () => {
      expect(redactText('Ref 485 777 3456 recorded', new Map())).toBe('Ref [id] recorded')
    })

    it('keeps clinical quantities, which are not identifiers', () => {
      const out = redactText('Given 2.5mg at 09:00, blood pressure 140/90', new Map())
      expect(out).toContain('2.5mg')
      expect(out).toContain('140/90')
    })
  })

  describe('renderPrompt, which is the only route to a provider', () => {
    it('strips a name before the template is filled in', () => {
      const { user } = renderPrompt('manager_briefing', {
        from: '2026-09-01', to: '2026-09-07',
        records: JSON.stringify([{ person_name: 'Margaret Whitfield', content: 'Margaret seemed confused, medication due.' }]),
      }, ORG)
      expect(user).not.toContain('Margaret')
      expect(user).not.toContain('Whitfield')
    })

    it('covers every prompt key we ship, so a new capability inherits the control', () => {
      // The reason redaction lives here rather than in thirteen call sites.
      const records = JSON.stringify([{ person_name: 'Margaret Whitfield', staff_name: 'Alan Reed' }])
      for (const key of Object.keys(PROMPTS)) {
        const { user } = renderPrompt(key, { records, person_name: 'Margaret Whitfield' }, ORG)
        expect(user, `${key} leaked a name`).not.toContain('Margaret')
        expect(user, `${key} leaked a staff name`).not.toContain('Alan')
      }
    })

    it('fills the template as before, so redaction did not break rendering', () => {
      const { user, system } = renderPrompt('manager_briefing', { from: '2026-01-01', to: '2026-01-07', records: '[]' }, ORG)
      expect(user).toContain('2026-01-01')
      expect(system.length).toBeGreaterThan(0)
    })
  })

  describe('collection', () => {
    it('finds names nested inside a serialised records blob', () => {
      const names = collectNames({ records: JSON.stringify({ rows: [{ person_name: 'Joan Pike' }] }) })
      expect(names.size).toBe(1)
    })

    it('ignores a name-like field that is obviously not a person', () => {
      // A date or an enum in a *_name column should not be pseudonymised into
      // something that looks like a client reference.
      const names = collectNames({ person_name: '2026-09-07' })
      expect(names.size).toBe(0)
    })
  })
})
