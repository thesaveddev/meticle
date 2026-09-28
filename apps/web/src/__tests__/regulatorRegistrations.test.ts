/**
 * The registration panel, read as source.
 *
 * The failure this guards is the same shape as the one in the API: a Wales-shaped
 * gap statement ("Wales cannot record an SCW registration number") is really a
 * missing capability everywhere, and the tempting fix — a single "Registration
 * number" field — would be wrong twice over. It would offer one box to a
 * four-nation product, and it would invite a Social Care Wales *worker* number
 * into a place a service registration belongs.
 *
 * So the panel has to show each regulator separately, with that regulator's own
 * label, and it must not pretend to validate the number.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PANEL = readFileSync(
  join(process.cwd(), 'src/components/compliance/RegulatorRegistrationsPanel.tsx'),
  'utf8',
)

const PAGE = readFileSync(join(process.cwd(), 'src/pages/compliance/CompliancePage.tsx'), 'utf8')

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

describe('registrations are per regulator, not a single field', () => {
  it('renders one row per regulator returned by the API', () => {
    expect(code(PANEL)).toMatch(/data\?\.registrations \?\? \[\]/)
    expect(code(PANEL)).toMatch(/\.map\(\(row\)/)
  })

  it('uses the regulator’s own label, not a generic one', () => {
    // A single "Registration number" field would be wrong for a four-nation
    // product and would not say which register the number belongs to. The API
    // maps each regulator's `registration_label` through as `label`.
    expect(code(PANEL)).toMatch(/label=\{row\.label\}/)
    expect(code(PANEL)).toMatch(/label: string/)
  })

  it('lists a regulator whether or not it is recorded', () => {
    // Otherwise "not registered anywhere" and "never entered it" look identical.
    expect(code(PANEL)).toContain('Not recorded')
    expect(code(PANEL)).toMatch(/row\.recorded/)
  })

  it('says when the migration has not run, rather than showing nothing', () => {
    // An empty list would read as "you hold no registrations", which is a
    // materially different and false statement.
    expect(code(PANEL)).toMatch(/migration_pending/)
    expect(code(PANEL)).toContain('has not run')
  })
})

describe('the panel does not invent a registration format', () => {
  it('has no pattern attribute on the number field', () => {
    // CIW registration numbers can contain a forward slash and have had several
    // published formats. A regex that rejects a real number is worse than one
    // that accepts a typo, because a typo is visible to a human and a rejected
    // real number is not.
    expect(code(PANEL)).not.toMatch(/pattern=/)
  })

  it('shows the verified format hint when there is one, and nothing when there is not', () => {
    expect(code(PANEL)).toMatch(/row\.format_hint &&/)
  })
})

describe('verified is a human claim, not ours', () => {
  it('says so where the tick is', () => {
    expect(code(PANEL)).toContain('We do not verify registrations for you')
  })

  it('records when it was checked', () => {
    expect(code(PANEL)).toContain('row.verified_at')
  })
})

describe('workforce registration is not a service registration', () => {
  it('does not offer Social Care Wales as a place for a service number', () => {
    const src = code(PANEL)
    // The list comes from the API's regulators table, which holds service
    // regulators only. Nothing here adds a workforce body to it.
    expect(src).not.toMatch(/social_care_wales/)
    expect(src).not.toMatch(/'Social Care Wales'/)
  })
})

describe('the panel is reachable', () => {
  it('is mounted on the compliance page', () => {
    expect(PAGE).toContain('RegulatorRegistrationsPanel')
  })
})
